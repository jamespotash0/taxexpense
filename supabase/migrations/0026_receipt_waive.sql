-- 0026 — Receipt-reminder suppression (DEC-078)
-- Fixes the contradiction where a user says "I don't have a receipt" (DEC-072), we ack
-- "no problem"… but keep needs_receipt = TRUE, so the weekly cron nags them forever.
--
-- Two new columns on receipts:
--   receipt_waived_at      — set when the user (or dashboard) says "no receipt available".
--                            The reminder cron skips these. needs_receipt STAYS true and
--                            substantiation_complete is NOT flipped — a waived ≥$75 strict
--                            expense is still an audit gap, surfaced on the export (Jordan).
--   receipt_reminder_count — how many weekly nudges this receipt has received. The cron caps
--                            at RECEIPT_REMINDER_CAP and then stops (Sofia: silence = annoyed;
--                            Alex/Jordan: not silent — the capping nudge says so + export shows it).

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS receipt_waived_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receipt_reminder_count INTEGER NOT NULL DEFAULT 0;

-- The weekly reminder query filters needs_receipt = TRUE AND receipt_waived_at IS NULL AND
-- receipt_reminder_count < cap. Partial index keeps that scan cheap as receipts grow.
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_pending
  ON receipts(user_id)
  WHERE needs_receipt = TRUE AND receipt_waived_at IS NULL;
