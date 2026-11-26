-- Tally: security hardening from the 2026-11-26 audit.
--
-- webhook_events: idempotency claims. Every webhook (Twilio MessageSid, Linq webhook-id, Stripe
--   event.id) inserts its provider id here before processing; a duplicate insert = a redelivery,
--   which is skipped. The app fails OPEN if this table is missing, so deploying code first is safe.
-- rate_events: durable rate limiting (per org / per phone / global), shared across serverless
--   instances, for email sends, AI routes and the landing opt-in. Also fails open if missing.
-- auth_codes.code widened: login codes are now stored as an HMAC, not the plaintext 6 digits.
--   APPLY THIS BEFORE DEPLOYING the code, or new login codes won't fit the old VARCHAR(6).
-- users.join_status: a co-owner invite must be accepted by the invitee (Reply YES) before their
--   texts land in the inviter's books. 'invited' → 'asked' → NULL (joined, or detached on NO).
-- receipts bucket: size + type limits.
--
-- Idempotent. Run after 0034_work_setup.sql.

CREATE TABLE IF NOT EXISTS webhook_events (
  id         TEXT PRIMARY KEY,            -- '<source>:<provider id>'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON webhook_events(created_at);

CREATE TABLE IF NOT EXISTS rate_events (
  id         BIGSERIAL PRIMARY KEY,
  key        TEXT NOT NULL,               -- e.g. 'email:<org id>', 'optin:+1555...'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rate_events_key_created ON rate_events(key, created_at);

-- Same default-deny posture as every other table (DEC-001 / 0006): service role only.
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON webhook_events, rate_events FROM anon, authenticated;
REVOKE ALL ON SEQUENCE rate_events_id_seq FROM anon, authenticated;

ALTER TABLE auth_codes ALTER COLUMN code TYPE TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS join_status TEXT CHECK (join_status IN ('invited', 'asked'));
COMMENT ON COLUMN users.join_status IS 'Co-owner invite consent: invited | asked | NULL (joined or own account).';

UPDATE storage.buckets
SET file_size_limit = 10485760,                          -- 10 MB
    allowed_mime_types = ARRAY['image/*', 'application/pdf']
WHERE id = 'receipts';
