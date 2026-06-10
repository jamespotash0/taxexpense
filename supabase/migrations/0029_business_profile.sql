-- Tally — Business profile for profession-aware categorization (Spec 09, Piece 1).
--
-- Adds a single JSONB column holding a structured prior derived ONCE from the user's free-text
-- "what kind of work do you do?" onboarding answer (users.business_type). The categorizer reads
-- it (via userContextLine) so an expense is categorized with the user's profession in mind —
-- e.g. a realtor's "MLS"/"desk fee" → professional_services instead of the other_business drift
-- bucket, mileage between showings recognized as the dominant pattern, etc.
--
-- Shape (see src/lib/businessProfile.ts BusinessProfile):
--   { industry, sells_product, common_categories[], synonyms{term->category}, notes_for_categorizer }
--
-- Nullable + best-effort: generated lazily at first expense. If generation fails the column stays
-- NULL and categorization falls back to the bare business_type line (today's behavior). No backfill
-- needed — existing users get a profile on their next logged expense.
--
-- Idempotent. Run after 0001_schema.sql.

ALTER TABLE users ADD COLUMN IF NOT EXISTS business_profile JSONB;

COMMENT ON COLUMN users.business_profile IS
  'Spec 09: profession-aware categorization prior derived from business_type. Null until generated at first expense.';
