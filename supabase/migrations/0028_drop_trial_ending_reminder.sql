-- 0028 — Drop the now-dead "ending soon" trial stamp (DEC-079).
-- We no longer send a pre-expiry nudge: the trial-start is announced on the user's first text and
-- the daily cron only sends the one "trial ended" notice after expiry. That left
-- trial_ending_reminder_at unread by any code path, so remove it. The "ended" stamp
-- (trial_ended_reminder_at) and the trialing scan index (idx_orgs_trialing_ends, on trial_ends_at)
-- are both still used and stay.
-- Run in the Supabase SQL editor. Idempotent.

ALTER TABLE organizations DROP COLUMN IF EXISTS trial_ending_reminder_at;
