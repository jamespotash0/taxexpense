-- Tally — AI decision/evaluation log (DEC-080). One append-only row per AI decision the
-- workflow makes, captured AT DECISION TIME. This is the eval signal that cannot be backfilled:
-- `receipts` holds only the FINAL, human-blended state, and dashboard/SMS edits overwrite a
-- category in place — so "what the model originally guessed vs. what the user corrected it to" is
-- destroyed on write unless we snapshot it here first. A 'correction' row's from_category→to_category
-- IS a free, real-world labeled eval example.
--
-- Append-only; never updated. No message text / PII — the transcript lives in `conversations`;
-- this table is keyed to a receipt and stores decisions + cost only. Written via the service-role
-- client (like agent_runs / funnel_events); RLS enabled with no policies (default-deny), matching
-- every other table (migration 0001). Run in the Supabase SQL editor. Idempotent.

CREATE TABLE IF NOT EXISTS ai_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  receipt_id       UUID REFERENCES receipts(id) ON DELETE SET NULL,

  kind             TEXT NOT NULL,                  -- 'categorize' | 'correction'
  model            TEXT,                           -- model that produced the decision (null if from vendor memory)

  -- The decision (kind='categorize'): what the AI chose + whether the tree decided to ask.
  category         TEXT,
  irc_section      TEXT,
  confidence       DECIMAL(3,2),
  asked            BOOLEAN NOT NULL DEFAULT FALSE, -- did the workflow ask the user anything? (the over-asking metric)
  ask_reason       TEXT,                           -- 'context' | 'receipt' | 'amount_verify' | 'category_confirm'
  drifted          BOOLEAN NOT NULL DEFAULT FALSE, -- category fell back to other_business (taxonomy escape / injection signal)
  from_memory      BOOLEAN NOT NULL DEFAULT FALSE, -- category came from per-org vendor memory (DEC-070), not the model
  flagged_review   BOOLEAN NOT NULL DEFAULT FALSE, -- needs a human glance (DEC-055)
  review_reason    TEXT,                           -- review.reasonCode when flagged

  -- The label (kind='correction'): the user told us the right answer. The highest-value eval signal.
  category_changed BOOLEAN,
  from_category    TEXT,
  to_category      TEXT,
  amount_corrected BOOLEAN,

  -- Cost / latency (Raj: cost-per-user is non-negotiable). Null where the producing call's usage
  -- isn't threaded through yet (the merged OCR extract+categorize path — see DEC-080 "Deferred").
  input_tokens     INT,
  output_tokens    INT,
  latency_ms       INT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- "This org's recent AI decisions", newest first (the future internal eval dashboard).
CREATE INDEX IF NOT EXISTS idx_ai_events_org ON ai_events(organization_id, created_at DESC);
-- Eval rollups slice by kind over time (correction rate, over-ask rate, drift rate).
CREATE INDEX IF NOT EXISTS idx_ai_events_kind ON ai_events(kind, created_at DESC);

ALTER TABLE ai_events ENABLE ROW LEVEL SECURITY; -- default-deny; written via service role only
