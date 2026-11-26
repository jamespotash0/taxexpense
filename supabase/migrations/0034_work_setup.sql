-- Tally: two deduction-relevant onboarding answers (2026-11-25).
--
-- work_location: where they usually work. Drives home-office treatment (IRC §280A): someone who
--   works only from an office/studio/shop shouldn't see home utilities filed as home_office.
-- drives_for_work: whether they drive to clients/job sites. Primes vehicle/mileage handling
--   (IRC §274(d) strict substantiation).
-- NULL = not asked yet (users onboarded before this) or unclear answer; categorization ignores it.
--
-- Idempotent. Run after 0001_schema.sql.

ALTER TABLE users ADD COLUMN IF NOT EXISTS work_location TEXT
  CHECK (work_location IN ('home', 'office', 'both', 'unknown'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS drives_for_work BOOLEAN;

COMMENT ON COLUMN users.work_location IS 'Where the user usually works: home | office | both | unknown. NULL = not asked.';
COMMENT ON COLUMN users.drives_for_work IS 'Whether the user drives for work (clients, job sites). NULL = not asked / unclear.';
