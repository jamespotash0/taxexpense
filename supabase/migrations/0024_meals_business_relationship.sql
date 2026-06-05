-- Tally — Business meals: require the business RELATIONSHIP, and give the catch-all a rule.
--
-- WHY (bug): §274(d) substantiation for a meal needs amount, time, place, business purpose,
-- AND the business relationship of the person entertained. meals_business only required
-- ['attendees', 'business_purpose'] (0002), so the capture flow never asked for the
-- relationship and a meal could go substantiation_complete=true without it. The month-end
-- review agent then referenced a "business relationship" the system never collected.
-- Fix: add 'business_relationship' to meals_business required context fields. The reply
-- composer asks for any missing field automatically, and the clarification/correction prompts
-- already parse business_relationship — only the rule row was missing.
--
-- Also: other_business (the §162 drift catch-all in canonicalizeCategory) had NO rule row, so
-- getSubstantiationRule() returned null and the code silently fell back to "general". Make that
-- explicit (general, §162, 100%) so EVERY ALLOWED_CATEGORIES key has a real rule and the
-- silent fallback can never quietly downgrade a category. (See loadRuleOrFallback warn + test.)
--
-- Run in the Supabase SQL editor. Idempotent.

UPDATE substantiation_rules
SET required_context_fields = ARRAY['attendees', 'business_purpose', 'business_relationship']
WHERE category = 'meals_business';

INSERT INTO substantiation_rules
  (category, irc_section, substantiation_level, receipt_threshold_cents, always_receipt, required_context_fields, deduction_percentage, deduction_cap_cents)
VALUES
  ('other_business', '162', 'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL)
ON CONFLICT (category) DO UPDATE SET
  irc_section             = EXCLUDED.irc_section,
  substantiation_level    = EXCLUDED.substantiation_level,
  receipt_threshold_cents = EXCLUDED.receipt_threshold_cents,
  always_receipt          = EXCLUDED.always_receipt,
  required_context_fields = EXCLUDED.required_context_fields,
  deduction_percentage    = EXCLUDED.deduction_percentage,
  deduction_cap_cents     = EXCLUDED.deduction_cap_cents;

-- Verify (expect business_relationship present):
--   SELECT category, required_context_fields FROM substantiation_rules WHERE category = 'meals_business';
