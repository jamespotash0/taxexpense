-- Tally — Monetization (EPIC-9 / DEC-021). Subscription state on the organization
-- (the billing entity; 1:1 with user in V1). Hybrid paywall: 21-day app-managed trial,
-- then Stripe-backed subscription required to keep logging.
--
-- Run in the Supabase SQL editor. Idempotent.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20)
  DEFAULT 'trialing'
  CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'expired'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan VARCHAR(20)
  CHECK (plan IN ('monthly', 'annual'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orgs_stripe_customer ON organizations(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Backfill existing orgs onto a fresh 21-day trial so nobody is locked out by the migration.
UPDATE organizations
  SET trial_ends_at = COALESCE(trial_ends_at, NOW() + INTERVAL '21 days'),
      subscription_status = COALESCE(subscription_status, 'trialing')
  WHERE trial_ends_at IS NULL;
