-- Tally: two deduction-relevant onboarding answers (2026-11-25).
--
-- work_location: where they usually work. Drives home-office treatment (IRC §280A): someone who
--   works only from an office/studio/shop shouldn't see home utilities filed as home_office.
-- drives_for_work: whether they drive to clients/job sites. Primes vehicle/mileage handling
--   (IRC §274(d) strict substantiation).
-- setup_checkin_at: set when an already-onboarded user is sent the one-time "we've made some
--   changes" check-in (scripts/setup-checkin.ts) asking these two questions; cleared when done.
--   Non-null = their next plain-text answer is read as a check-in answer (onboarding.ts).
-- NULL = not asked yet (users onboarded before this) or unclear answer; categorization ignores it.
--
-- Idempotent. Run after 0001_schema.sql.

ALTER TABLE users ADD COLUMN IF NOT EXISTS work_location TEXT
  CHECK (work_location IN ('home', 'office', 'both', 'unknown'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS drives_for_work BOOLEAN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_checkin_at TIMESTAMPTZ;

COMMENT ON COLUMN users.work_location IS 'Where the user usually works: home | office | both | unknown. NULL = not asked.';
COMMENT ON COLUMN users.drives_for_work IS 'Whether the user drives for work (clients, job sites). NULL = not asked / unclear.';
