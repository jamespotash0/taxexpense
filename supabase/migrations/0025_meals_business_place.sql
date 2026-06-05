-- Tally — Business meals: also require PLACE (location), completing §274(d) for meals.
--
-- WHY: §274(d) meal substantiation = amount + time + place + business purpose + business
-- relationship. The IRC-SUMMARIES §274 copy lists all five as required ("amount, time, place,
-- business purpose, and business relationship"). After 0024 meals_business required
-- ['attendees', 'business_purpose', 'business_relationship'] — still missing PLACE. This adds
-- 'location_city' so the rule fully matches the summary it's meant to enforce. (amount + time are
-- captured by the dollar amount + transaction_date at extraction, not as context questions.)
-- The reply composer asks for any missing field automatically; the clarification/correction
-- prompts already parse location_city — only the rule row needed updating.
--
-- Run in the Supabase SQL editor. Idempotent.

UPDATE substantiation_rules
SET required_context_fields = ARRAY['attendees', 'business_purpose', 'business_relationship', 'location_city']
WHERE category = 'meals_business';

-- Verify (expect all four fields):
--   SELECT category, required_context_fields FROM substantiation_rules WHERE category = 'meals_business';
