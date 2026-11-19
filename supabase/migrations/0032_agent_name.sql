-- Tally: per-user name for the texting assistant (DEC-086).
--
-- The assistant introduces itself as "Penny" and, right after asking the user's name, asks what
-- they'd like to call it. NULL means the default ("Penny"); existing users keep the default.
--
-- Idempotent. Run after 0001_schema.sql.

ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_name TEXT;

COMMENT ON COLUMN users.agent_name IS
  'What this user calls the texting assistant. NULL = default "Penny".';
