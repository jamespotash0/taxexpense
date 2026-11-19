-- Tally: iMessage extras via Linq (DEC-087).
--
-- receipts.source_message_id: the Linq message id of the text/photo that created the receipt, so an
-- iMessage edit of that message ("$45" → "$54") can find and correct the right expense.
-- users.linq_card_shared_at: when Penny's contact card was dropped into this user's chat (once).
--
-- Idempotent. Run after 0032_agent_name.sql.

ALTER TABLE receipts ADD COLUMN IF NOT EXISTS source_message_id TEXT;
CREATE INDEX IF NOT EXISTS idx_receipts_source_message
  ON receipts(organization_id, source_message_id) WHERE source_message_id IS NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS linq_card_shared_at TIMESTAMPTZ;
