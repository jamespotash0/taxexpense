-- Tally — Seed: substantiation_rules (TSNAP-007)
-- Source of truth: claude_files/docs/SPEC.md "Seeded data for v1".
--
-- This table is THE single source of truth for how the AI behaves (SPEC.md
-- "Important Notes": never hardcode category logic elsewhere). 18 rows:
-- 6 strict-substantiation (§274(d)) categories + 11 general + 1 personal (§262).
--
-- Idempotent: ON CONFLICT (category) upserts, so re-running this migration
-- re-syncs rows to match this file. Run after 0001_schema.sql.
-- IRC subsection rationale for these figures: claude_files/docs/IRC-RESEARCH.md.

INSERT INTO substantiation_rules
  (category, irc_section, substantiation_level, receipt_threshold_cents, always_receipt, required_context_fields, deduction_percentage, deduction_cap_cents)
VALUES
  -- Strict substantiation categories (§274(d): amount, time, place, business purpose, relationship).
  -- receipt_threshold_cents 7500 = the $75 documentary-evidence rule (Reg §1.274-5(c)(2); fixed, not indexed).
  ('meals_business',        '274',  'strict', 7500, FALSE, ARRAY['attendees', 'business_purpose'],        50,  NULL),
  ('meals_travel',          '274',  'strict', 7500, FALSE, ARRAY['business_purpose'],                     50,  NULL),
  ('travel_transportation', '162',  'strict', 7500, FALSE, ARRAY['business_purpose'],                     100, NULL),
  -- Lodging always needs a receipt regardless of amount (Reg §1.274-5(c)(2)).
  ('travel_lodging',        '162',  'strict', 0,    TRUE,  ARRAY['business_purpose'],                     100, NULL),
  -- Business gifts: cite §274(b) (gift-specific summary), $25/recipient/yr cap (2500 cents; fixed, not indexed).
  ('business_gifts',        '274b', 'strict', 7500, FALSE, ARRAY['attendees', 'business_relationship'],   100, 2500),
  -- Vehicle: listed property — cite §280F (vehicle summary); needs a contemporaneous mileage log; no flat receipt threshold.
  ('vehicle_business',      '280F', 'strict', NULL, FALSE, ARRAY['business_miles', 'business_purpose'],    100, NULL),

  -- General substantiation categories (§162 ordinary & necessary; §6001 recordkeeping).
  ('software',              '162',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('office_supplies',       '162',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('professional_services', '162',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('advertising',           '162',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('internet_phone',        '162',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('equipment',             '179',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('insurance',             '162',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('rent',                  '162',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('repairs',               '162',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('education',             '162',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('home_office',           '280A', 'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),

  -- Special case: personal (§262) — modeled explicitly so the AI classifies non-deductible
  -- expenses rather than mis-bucketing them (DEC-004). 0% deductible.
  ('personal',              '262',  'general', NULL, FALSE, ARRAY[]::TEXT[], 0,   NULL)
ON CONFLICT (category) DO UPDATE SET
  irc_section             = EXCLUDED.irc_section,
  substantiation_level    = EXCLUDED.substantiation_level,
  receipt_threshold_cents = EXCLUDED.receipt_threshold_cents,
  always_receipt          = EXCLUDED.always_receipt,
  required_context_fields = EXCLUDED.required_context_fields,
  deduction_percentage    = EXCLUDED.deduction_percentage,
  deduction_cap_cents     = EXCLUDED.deduction_cap_cents;

-- Verify: 18 rows total, 6 of them strict.
--   SELECT count(*) FROM substantiation_rules;                                  -- 18
--   SELECT count(*) FROM substantiation_rules WHERE substantiation_level='strict'; -- 6
