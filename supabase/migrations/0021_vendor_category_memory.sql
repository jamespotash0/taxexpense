-- Tally — per-org vendor→category memory (DEC-070).
-- Deterministic personalization: when a user explicitly CORRECTS an expense's category
-- (the strongest "the model got it wrong, here's the right answer" signal we have), we
-- remember that THIS org files THIS vendor under THAT category, and apply it to future
-- captures so the user doesn't have to correct the same vendor twice.
--
-- This is a lookup table, NOT machine learning — it can't drift, it's fully overridable
-- (the next correction re-teaches it), and it is strictly per-org (multi-tenant isolation:
-- one org never sees another's mappings). See src/lib/vendor-memory.ts.
--
-- Run in the Supabase SQL editor. Idempotent.

CREATE TABLE IF NOT EXISTS vendor_category_memory (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Normalized vendor name (lowercased, possessives/punctuation stripped) — see vendorKey().
  vendor_key VARCHAR(255) NOT NULL,
  -- Canonical category (one of categories.ts ALLOWED_CATEGORIES). Latest correction wins.
  category VARCHAR(100) NOT NULL,
  -- Last raw vendor string seen, for display/debugging (not used for matching).
  vendor_label VARCHAR(255),
  -- How many times the user has confirmed this mapping; resets to 1 when the category flips.
  times_confirmed INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One preferred category per vendor per org; the PK doubles as the (org, vendor_key) lookup index.
  PRIMARY KEY (organization_id, vendor_key)
);

-- RLS default-deny, same posture as every org-owned table (the service role bypasses it;
-- all app access goes through the admin client scoped by organization_id). See 0001_schema.sql.
ALTER TABLE vendor_category_memory ENABLE ROW LEVEL SECURITY;
