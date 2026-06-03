-- Tally — Structured pending-state payload on conversations (DEC-039).
-- Holds the candidate list for "flag the $48 lunch" disambiguation (and any future multi-value
-- pending interaction) so a follow-up "reply 1/2/3" can resolve to the right receipt. Generic
-- JSONB so we don't add a column per feature.
-- Run in the Supabase SQL editor. Idempotent.

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pending_data JSONB;
