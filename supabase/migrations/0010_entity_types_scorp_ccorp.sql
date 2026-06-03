-- Tally — Add S-corp and C-corp to user entity types (DEC-036).
-- V1 still centers sole props / SMLLCs, but higher-earning self-employed people commonly
-- elect S-corp (and some operate C-corps), so the onboarding question now offers them.
-- Expense categorization/substantiation is entity-agnostic in V1 — this captures the data;
-- entity-specific tax treatment (payroll, reasonable comp, owner draws) is out of V1 scope.
--
-- Run in the Supabase SQL editor. Idempotent (drop-if-exists + re-add).

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_entity_type_check;
ALTER TABLE users ADD CONSTRAINT users_entity_type_check
  CHECK (entity_type IN ('sole_prop', 'smllc', 's_corp', 'c_corp', 'unknown'));
