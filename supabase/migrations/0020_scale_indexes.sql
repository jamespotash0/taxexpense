-- Tally — indexes for two hot-path queries that were doing wider scans than necessary,
-- so they stay cheap as the receipts table grows toward 10k+ users.
-- Run in the Supabase SQL editor. Idempotent.
--
-- NOTE: on an already-populated production table, run each statement with
-- CREATE INDEX CONCURRENTLY (outside a transaction) to avoid locking writes while
-- the index builds. The plain form below is fine for fresh/small DBs and dev.

-- findReceiptsAwaitingPhoto() (lib/receipts.ts) filters by organization_id +
-- needs_receipt and orders by created_at DESC, on the SMS attachment-matching path.
-- The existing idx_receipts_needs_receipt leads on user_id, so this query couldn't
-- use it; this org-scoped partial index serves it directly (and also covers the
-- instance-wide receipt-reminders cron's needs_receipt scan).
CREATE INDEX IF NOT EXISTS idx_receipts_org_needs_receipt
  ON receipts(organization_id, created_at DESC)
  WHERE needs_receipt = TRUE;

-- priorOccurrenceCount() (lib/recurring.ts) runs on every new expense to detect a
-- repeat: organization_id + amount_cents equality, then a case-insensitive vendor
-- match. (organization_id, amount_cents) narrows to a handful of rows before the
-- ILIKE, instead of scanning all of an org's receipts.
CREATE INDEX IF NOT EXISTS idx_receipts_org_amount
  ON receipts(organization_id, amount_cents);
