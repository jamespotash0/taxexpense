-- Tally — Add `location_city` to required context for travel categories (DEC-071)
--
-- §274(d) lists "place" as a required substantiation element for travel. We now extract
-- location_city from the receipt address / text up front (prompts.ts), so making it a
-- required field rarely triggers an extra ask — it only fires when extraction genuinely
-- couldn't determine a place. Scoped to travel_* ONLY: for meals the `vendor` field (the
-- restaurant name) already satisfies "place", so requiring a separate city there would be
-- redundant friction against the "ask only when required" rule.
--
-- Idempotent: re-running re-syncs the two rows to the intended arrays.

UPDATE substantiation_rules
SET required_context_fields = ARRAY['business_purpose', 'location_city']
WHERE category IN ('travel_transportation', 'travel_lodging');

-- Verify:
--   SELECT category, required_context_fields FROM substantiation_rules
--   WHERE category IN ('travel_transportation','travel_lodging');
--   -- both → {business_purpose,location_city}
