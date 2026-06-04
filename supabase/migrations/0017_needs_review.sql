-- Tally — category-review floor (DEC-055). Flags a categorized expense for a quick human
-- glance when the LLM's category was low-confidence OR the note looked instruction-shaped
-- (an injection-defense + accuracy backstop; see claude_files/docs/REDTEAM-FINDINGS.md).
-- The flag rides along to the dashboard + CSV/accountant export. Never blocks logging.
-- Run in the Supabase SQL editor. Idempotent.

ALTER TABLE receipts ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS review_reason TEXT;
-- Store the model's categorization confidence for later calibration analysis (tune the floor).
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS category_confidence REAL;

-- Speeds up "show me what needs review" on the dashboard/export.
CREATE INDEX IF NOT EXISTS idx_receipts_needs_review ON receipts(organization_id) WHERE needs_review = TRUE;
