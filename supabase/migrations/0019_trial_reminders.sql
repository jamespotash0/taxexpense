-- Tally — proactive trial-expiry reminders (DEC-061). Two idempotency stamps so the daily cron
-- texts each trial at most once before expiry ("ending soon") and once at/after expiry ("ended"),
-- never re-sending. Opt-out is enforced in code (sms_opted_out_at).
-- Run in the Supabase SQL editor. Idempotent.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ending_reminder_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ended_reminder_at TIMESTAMPTZ;

-- The cron only scans trials nearing/past expiry; this index keeps that scan cheap.
CREATE INDEX IF NOT EXISTS idx_orgs_trialing_ends
  ON organizations(trial_ends_at)
  WHERE subscription_status = 'trialing';
