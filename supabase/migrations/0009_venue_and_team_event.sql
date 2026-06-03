-- Tally — Add venue-rental + team/company-event categories (DEC-035).
--
-- B) venue_rental — renting a room/hall/venue for a business meeting or event → §162,
--    general substantiation, 100% deductible (reuses the existing §162 summary).
-- A) team_event — food/recreation primarily for your EMPLOYEES (staff lunch, holiday party,
--    company picnic) → §274(e)(4) exception, 100% deductible (vs the 50% client-meal limit).
--    New §274e summary, carefully scoped (NOT client meals/entertainment). CPA-flagged.
--
-- Run in the Supabase SQL editor. Idempotent (ON CONFLICT upserts).

-- --- Substantiation rules (general level; the SMS text is the record, no forced context) ---
INSERT INTO substantiation_rules
  (category, irc_section, substantiation_level, receipt_threshold_cents, always_receipt, required_context_fields, deduction_percentage, deduction_cap_cents)
VALUES
  ('venue_rental', '162',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('team_event',   '274e', 'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL)
ON CONFLICT (category) DO UPDATE SET
  irc_section             = EXCLUDED.irc_section,
  substantiation_level    = EXCLUDED.substantiation_level,
  receipt_threshold_cents = EXCLUDED.receipt_threshold_cents,
  always_receipt          = EXCLUDED.always_receipt,
  required_context_fields = EXCLUDED.required_context_fields,
  deduction_percentage    = EXCLUDED.deduction_percentage,
  deduction_cap_cents     = EXCLUDED.deduction_cap_cents;

-- --- §274(e)(4) summary: employee/company events (the 100% exception) ---
-- CPA-flagged (DEC-035): the statute is primary-sourced, but whether a given event qualifies —
-- and especially whether it applies to a solo owner with no employees — is a judgment call.
INSERT INTO irc_summaries
  (section_id, title, short_summary, deduction_percentage, common_practice, worth_noting, source_url, last_reviewed, version)
VALUES
(
  '274e',
  'Employee & Company Events',
  'Food, drinks, and recreational events put on primarily for your employees — a team lunch, holiday party, or company picnic — are generally 100% deductible, an exception to the usual 50% limit on business meals.',
  100,
  'This applies when the event is mainly for the benefit of your staff/team as a whole (not just owners or highly paid people), and isn''t lavish. Keep a record of the date, who it was for, the business reason, and the cost. If you''re a solo business with no employees, this usually does NOT apply — a meal with a client is a business meal (50% deductible), and pure entertainment is generally not deductible.',
  'Don''t confuse this with client meals or entertainment. A meal with a client is 50% deductible (business meal); entertainment — sporting events, concerts, golf — is generally NOT deductible since the 2017 TCJA, even with employees present. The 100% treatment is specifically for staff/morale events primarily benefiting your employees. Whether your event qualifies is a judgment call — check with a tax professional.',
  'https://www.law.cornell.edu/uscode/text/26/274',
  DATE '2026-06-03',
  1
)
ON CONFLICT (section_id) DO UPDATE SET
  title                = EXCLUDED.title,
  short_summary        = EXCLUDED.short_summary,
  deduction_percentage = EXCLUDED.deduction_percentage,
  common_practice      = EXCLUDED.common_practice,
  worth_noting         = EXCLUDED.worth_noting,
  source_url           = EXCLUDED.source_url,
  last_reviewed        = EXCLUDED.last_reviewed,
  version              = EXCLUDED.version;

-- Coverage check (expect 0): every rule's irc_section must have a summary.
--   SELECT DISTINCT irc_section FROM substantiation_rules s WHERE irc_section IS NOT NULL
--     AND NOT EXISTS (SELECT 1 FROM irc_summaries i WHERE i.section_id = s.irc_section);
