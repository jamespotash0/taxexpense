-- Tally — Hash session tokens at rest (DEC-030, residual item #1).
--
-- Previously `sessions.token` held the RAW 256-bit session token. Now the app stores only
-- SHA-256(token) (see lib/auth.ts: createSession/getSessionUser/destroySession), so a DB
-- read (leak, backup, or over-broad query) can't be replayed to hijack a live session.
--
-- This migration renames the column to `token_hash` and clears any pre-existing rows
-- (their PLAINTEXT values can never match a hashed lookup, so they're dead — and we don't
-- want plaintext lingering in a column named *_hash). The UNIQUE constraint + index on the
-- column follow the rename automatically.
--
-- Run in the Supabase SQL editor. Idempotent: guarded so re-runs are non-destructive.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'token'
  ) THEN
    ALTER TABLE sessions RENAME COLUMN token TO token_hash;
    -- Old rows hold plaintext tokens in the renamed column; purge them (pre-launch — worst
    -- case is a re-login). Guarded by the rename above, so a second run won't wipe sessions.
    DELETE FROM sessions;
  END IF;
END $$;
