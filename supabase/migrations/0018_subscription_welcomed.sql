-- Tally — race-safe subscribe-welcome idempotency (DEC-060, hardens DEC-059). Stamped the first
-- time we send the "you're subscribed" welcome, via an atomic conditional UPDATE ... WHERE
-- subscription_welcomed_at IS NULL. Stripe retries checkout.session.completed and fires
-- subscription.updated on every renewal; this column guarantees the welcome goes out at most once
-- even under concurrent webhook deliveries (Postgres serializes the row update).
-- Run in the Supabase SQL editor. Idempotent.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_welcomed_at TIMESTAMPTZ;
