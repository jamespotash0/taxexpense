-- Tally — AI evaluation rollups over `ai_events` (DEC-080).
-- Paste any block into the Supabase SQL editor. These are READ-ONLY analysis queries, NOT a
-- migration — nothing here alters schema. They are the v1 way to read the eval signal until the
-- v2 internal dashboard renders the same numbers.
--
-- Source table: ai_events (migration 0027). kind='categorize' = an AI decision; kind='correction'
-- = the user told us the right answer, keyed to the same receipt_id as its categorize row.
--
-- CAVEAT (DEC-080 "Deferred"): input_tokens/output_tokens are NULL on the main SMS path today
-- (the category there comes from the merged OCR extract+categorize call, whose usage isn't threaded
-- yet). The cost queries below therefore report only the rows that DO carry tokens (standalone
-- categorize + corrections) and say so. Every other metric is complete on all paths.
--
-- Window: each query looks at the last 30 days. Change the INTERVAL to re-scope.


-- ============================================================================
-- 1. OVER-ASKING RATE  — the metric the "ask only when required" positioning lives on.
--    Of all categorize decisions, how often did we ask the user something, and for what?
-- ============================================================================
SELECT
  count(*)                                              AS decisions,
  count(*) FILTER (WHERE asked)                         AS asked,
  round(100.0 * count(*) FILTER (WHERE asked) / nullif(count(*), 0), 1) AS asked_pct,
  count(*) FILTER (WHERE ask_reason = 'context')        AS ask_context,
  count(*) FILTER (WHERE ask_reason = 'receipt')        AS ask_receipt,
  count(*) FILTER (WHERE ask_reason = 'amount_verify')  AS ask_amount_verify,
  count(*) FILTER (WHERE ask_reason = 'category_confirm') AS ask_category_confirm
FROM ai_events
WHERE kind = 'categorize'
  AND created_at >= now() - interval '30 days';


-- ============================================================================
-- 2. CORRECTION RATE  — of categorized expenses, how many did the user later correct?
--    A correction is an error-driven extra round trip (a Sonnet call + an SMS). This is the
--    leading "are mistakes costing us money / data quality" signal.
-- ============================================================================
WITH cat AS (
  SELECT DISTINCT receipt_id FROM ai_events
  WHERE kind = 'categorize' AND receipt_id IS NOT NULL
    AND created_at >= now() - interval '30 days'
),
corr AS (
  SELECT DISTINCT receipt_id FROM ai_events
  WHERE kind = 'correction' AND receipt_id IS NOT NULL
    AND created_at >= now() - interval '30 days'
)
SELECT
  (SELECT count(*) FROM cat)                                            AS categorized,
  (SELECT count(*) FROM corr WHERE receipt_id IN (SELECT receipt_id FROM cat)) AS corrected,
  round(100.0 * (SELECT count(*) FROM corr WHERE receipt_id IN (SELECT receipt_id FROM cat))
              / nullif((SELECT count(*) FROM cat), 0), 1)               AS corrected_pct;


-- ============================================================================
-- 3. CATEGORY-FLIP RATE  — of corrections, how often did the fix change the CATEGORY
--    (vs. only adding context / fixing the amount)? A flip is the categorizer being wrong.
-- ============================================================================
SELECT
  count(*)                                              AS corrections,
  count(*) FILTER (WHERE category_changed)              AS category_flips,
  round(100.0 * count(*) FILTER (WHERE category_changed) / nullif(count(*), 0), 1) AS flip_pct,
  count(*) FILTER (WHERE amount_corrected)              AS amount_fixes
FROM ai_events
WHERE kind = 'correction'
  AND created_at >= now() - interval '30 days';


-- ============================================================================
-- 4. CONFUSION PAIRS  — the categorizer's mistakes, ranked. from_category → to_category is a
--    free, real-world labeled set: where the model guessed X but the right answer was Y.
--    Feed the top rows back into the categorizer prompt / vendor memory as the next fix.
-- ============================================================================
SELECT
  from_category,
  to_category,
  count(*) AS times
FROM ai_events
WHERE kind = 'correction' AND category_changed
  AND created_at >= now() - interval '30 days'
GROUP BY from_category, to_category
ORDER BY times DESC
LIMIT 25;


-- ============================================================================
-- 5. CONFIDENCE CALIBRATION  — does low model confidence actually predict corrections?
--    If the high-confidence bucket gets corrected as often as the low one, the confidence
--    score is noise and the review floor (EXTRACTION_CONFIDENCE_FLOOR / DEC-066, DEC-073)
--    is mis-tuned. Joins each categorize decision to whether its receipt was later corrected.
-- ============================================================================
WITH cat AS (
  SELECT receipt_id, confidence, flagged_review
  FROM ai_events
  WHERE kind = 'categorize' AND receipt_id IS NOT NULL
    AND created_at >= now() - interval '30 days'
),
corrected AS (
  SELECT DISTINCT receipt_id FROM ai_events
  WHERE kind = 'correction' AND category_changed AND receipt_id IS NOT NULL
)
SELECT
  CASE
    WHEN confidence IS NULL THEN 'n/a (from memory)'
    WHEN confidence < 0.5 THEN '0.0–0.5'
    WHEN confidence < 0.7 THEN '0.5–0.7'
    WHEN confidence < 0.9 THEN '0.7–0.9'
    ELSE '0.9–1.0'
  END                                                   AS confidence_bucket,
  count(*)                                              AS decisions,
  count(*) FILTER (WHERE cat.receipt_id IN (SELECT receipt_id FROM corrected)) AS later_flipped,
  round(100.0 * count(*) FILTER (WHERE cat.receipt_id IN (SELECT receipt_id FROM corrected))
              / nullif(count(*), 0), 1)                 AS flip_pct
FROM cat
GROUP BY confidence_bucket
ORDER BY confidence_bucket;


-- ============================================================================
-- 6. DRIFT & VENDOR-MEMORY  — taxonomy escapes (a hallucinated category coerced to
--    other_business; also an injection signal) and how often vendor memory (DEC-070) is
--    answering instead of the model.
-- ============================================================================
SELECT
  count(*)                                              AS decisions,
  count(*) FILTER (WHERE drifted)                       AS drifted,
  round(100.0 * count(*) FILTER (WHERE drifted) / nullif(count(*), 0), 1)     AS drift_pct,
  count(*) FILTER (WHERE from_memory)                   AS from_vendor_memory,
  round(100.0 * count(*) FILTER (WHERE from_memory) / nullif(count(*), 0), 1) AS memory_pct,
  count(*) FILTER (WHERE flagged_review)                AS flagged_for_review
FROM ai_events
WHERE kind = 'categorize'
  AND created_at >= now() - interval '30 days';


-- ============================================================================
-- 7. COST & LATENCY  — per model. NOTE: rows with NULL tokens (the main SMS path, see caveat
--    above) are excluded from the token averages but counted in `calls`, so a low `with_tokens`
--    relative to `calls` is the gap, not low usage.
-- ============================================================================
SELECT
  model,
  count(*)                                              AS calls,
  count(*) FILTER (WHERE input_tokens IS NOT NULL)      AS with_tokens,
  round(avg(input_tokens))                              AS avg_input_tokens,
  round(avg(output_tokens))                             AS avg_output_tokens,
  round(avg(latency_ms))                                AS avg_latency_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms
FROM ai_events
WHERE model IS NOT NULL
  AND created_at >= now() - interval '30 days'
GROUP BY model
ORDER BY calls DESC;


-- ============================================================================
-- 8. DAILY VOLUME  — decisions, asks, and corrections per day (trend / sanity check that
--    capture is actually flowing).
-- ============================================================================
SELECT
  date_trunc('day', created_at)::date                   AS day,
  count(*) FILTER (WHERE kind = 'categorize')           AS decisions,
  count(*) FILTER (WHERE kind = 'categorize' AND asked) AS asked,
  count(*) FILTER (WHERE kind = 'correction')           AS corrections
FROM ai_events
WHERE created_at >= now() - interval '30 days'
GROUP BY day
ORDER BY day DESC;
