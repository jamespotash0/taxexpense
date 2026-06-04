-- Tally — Weekly-decoy pricing (DEC-044). The monthly plan is replaced by a deliberately
-- steep weekly plan that pushes users to annual. Widen the `plan` CHECK to allow 'weekly'.
-- 'monthly' is retained so any legacy rows don't violate the constraint (pre-launch; safe).
--
-- Run in the Supabase SQL editor. Idempotent.

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_plan_check
  CHECK (plan IN ('weekly', 'monthly', 'annual'));
