-- Tally — "Flag for my CPA" marker on a receipt (DEC-038). Lets a user mark an expense for
-- their accountant to weigh in on later; the flag rides along to CSV/accountant export.
-- Run in the Supabase SQL editor. Idempotent.

ALTER TABLE receipts ADD COLUMN IF NOT EXISTS flagged_for_cpa BOOLEAN NOT NULL DEFAULT FALSE;

-- Speeds up "show me what's flagged" on the dashboard/export.
CREATE INDEX IF NOT EXISTS idx_receipts_cpa_flag ON receipts(organization_id) WHERE flagged_for_cpa = TRUE;
