-- =============================================================
-- Tally — RUN ALL (paste into Supabase SQL editor, run once).
-- Regenerated from supabase/migrations/0001..0007. Idempotent / re-runnable.
-- =============================================================

-- =============================================================
-- 0001_schema.sql
-- =============================================================

-- Tally — Database Schema (TSNAP-005)
-- Source of truth: claude_files/docs/SPEC.md "Database Schema"
-- Multi-tenant from day 1 (organizations table, 1:1 user:org in V1).
--
-- DEC-001 (claude_files/docs/JOURNAL.md): RLS is enabled on EVERY table with a
-- DEFAULT-DENY posture (RLS on + zero policies = anon/authenticated read/write
-- nothing). Only the service_role key (server-only) bypasses RLS. Application code
-- additionally org-scopes every query via lib/db.orgScoped(). Custom-JWT RLS that
-- enforces per-org isolation under the service role is a documented V2 item.
--
-- Run in the Supabase SQL Editor (or `supabase db push`). Idempotent-ish: uses
-- IF NOT EXISTS where Postgres supports it.

-- Extensions ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

-- organizations -------------------------------------------------------------
-- Created before users because users.organization_id references it.
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  owner_user_id UUID,                       -- no FK: avoids circular dependency with users
  subscription_tier VARCHAR(50) DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- users ---------------------------------------------------------------------
-- DEC-003: phone_number stored plaintext (needed for inbound lookup + outbound
-- send). Rely on Supabase at-rest encryption; never log full numbers.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  business_type VARCHAR(100),
  entity_type VARCHAR(20) CHECK (entity_type IN ('sole_prop', 'smllc', 'unknown')),
  default_payment_account VARCHAR(20) CHECK (default_payment_account IN ('business', 'personal', 'unknown')),
  accountant_email VARCHAR(255),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_step INT DEFAULT 0,
  -- TCPA: explicit SMS consent logged with timestamp (Jordan / EPIC-7).
  sms_consent_at TIMESTAMPTZ,
  sms_opted_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);

-- user_roles (for future multi-user; V1 everyone is 'owner') -----------------
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role VARCHAR(20) CHECK (role IN ('owner', 'editor', 'viewer', 'accountant')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- receipts (the core table) -------------------------------------------------
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Core transaction data
  vendor VARCHAR(255),
  amount_cents INTEGER NOT NULL,
  transaction_date DATE,
  payment_account VARCHAR(20) CHECK (payment_account IN ('business', 'personal', 'unknown')),

  -- Categorization
  category VARCHAR(100),
  irc_section VARCHAR(20),
  deduction_percentage INTEGER DEFAULT 100,
  deductible_amount_cents INTEGER,

  -- Strict substantiation fields (for §274(d) categories)
  business_purpose TEXT,
  attendees TEXT,
  business_relationship TEXT,
  location_city VARCHAR(100),
  business_miles INTEGER,

  -- Receipt + documentation status
  photo_url VARCHAR(500),
  needs_receipt BOOLEAN DEFAULT FALSE,
  receipt_reason TEXT,
  substantiation_complete BOOLEAN DEFAULT FALSE,
  substantiation_missing_fields TEXT[],

  -- AI extraction metadata
  raw_extracted_data JSONB,
  extraction_confidence DECIMAL(3,2),

  -- Edit tracking
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_receipts_org ON receipts(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_user ON receipts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_needs_receipt ON receipts(user_id, needs_receipt) WHERE needs_receipt = TRUE;

-- Keep updated_at honest (dashboard edit flow depends on it).
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_receipts_updated_at ON receipts;
CREATE TRIGGER trg_receipts_updated_at
  BEFORE UPDATE ON receipts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- substantiation_rules (the smart logic — single source of truth) -----------
CREATE TABLE IF NOT EXISTS substantiation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(100) UNIQUE NOT NULL,
  irc_section VARCHAR(20),
  substantiation_level VARCHAR(20) CHECK (substantiation_level IN ('strict', 'general')),
  receipt_threshold_cents INTEGER,
  always_receipt BOOLEAN DEFAULT FALSE,
  required_context_fields TEXT[],
  deduction_percentage INTEGER DEFAULT 100,
  deduction_cap_cents INTEGER,
  notes TEXT
);

-- irc_summaries -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS irc_summaries (
  section_id VARCHAR(20) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  short_summary TEXT NOT NULL,
  deduction_percentage INTEGER,
  common_practice TEXT,
  worth_noting TEXT,
  source_url VARCHAR(500),
  last_reviewed DATE,
  version INTEGER DEFAULT 1
);

-- conversations (the written record; SMS itself substantiates sub-$75) -------
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
  message_text TEXT,
  media_url VARCHAR(500),
  receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL,
  context_state VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, created_at DESC);

-- auth_codes (phone OTP) ----------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  attempts INT DEFAULT 0,           -- brute-force lockout (Jordan, EPIC-7)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_codes_phone ON auth_codes(phone_number, created_at DESC);

-- sessions ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

-- ---------------------------------------------------------------------------
-- DEC-001 RLS default-deny backstop.
-- Enabling RLS with NO policies denies all access to the anon/authenticated
-- roles. The server uses the service_role key, which bypasses RLS. This makes
-- accidental public exposure (the most likely real-world leak) impossible while
-- we ship V1 on app-layer org filtering.
-- ---------------------------------------------------------------------------
ALTER TABLE organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE substantiation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE irc_summaries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_codes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions             ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- 0002_seed_substantiation_rules.sql
-- =============================================================

-- Tally — Seed: substantiation_rules (TSNAP-007)
-- Source of truth: claude_files/docs/SPEC.md "Seeded data for v1".
--
-- This table is THE single source of truth for how the AI behaves (SPEC.md
-- "Important Notes": never hardcode category logic elsewhere). 18 rows:
-- 6 strict-substantiation (§274(d)) categories + 11 general + 1 personal (§262).
--
-- Idempotent: ON CONFLICT (category) upserts, so re-running this migration
-- re-syncs rows to match this file. Run after 0001_schema.sql.
-- IRC subsection rationale for these figures: claude_files/docs/IRC-RESEARCH.md.

INSERT INTO substantiation_rules
  (category, irc_section, substantiation_level, receipt_threshold_cents, always_receipt, required_context_fields, deduction_percentage, deduction_cap_cents)
VALUES
  -- Strict substantiation categories (§274(d): amount, time, place, business purpose, relationship).
  -- receipt_threshold_cents 7500 = the $75 documentary-evidence rule (Reg §1.274-5(c)(2); fixed, not indexed).
  ('meals_business',        '274',  'strict', 7500, FALSE, ARRAY['attendees', 'business_purpose'],        50,  NULL),
  ('meals_travel',          '274',  'strict', 7500, FALSE, ARRAY['business_purpose'],                     50,  NULL),
  ('travel_transportation', '162',  'strict', 7500, FALSE, ARRAY['business_purpose'],                     100, NULL),
  -- Lodging always needs a receipt regardless of amount (Reg §1.274-5(c)(2)).
  ('travel_lodging',        '162',  'strict', 0,    TRUE,  ARRAY['business_purpose'],                     100, NULL),
  -- Business gifts: cite §274(b) (gift-specific summary), $25/recipient/yr cap (2500 cents; fixed, not indexed).
  ('business_gifts',        '274b', 'strict', 7500, FALSE, ARRAY['attendees', 'business_relationship'],   100, 2500),
  -- Vehicle: listed property — cite §280F (vehicle summary); needs a contemporaneous mileage log; no flat receipt threshold.
  ('vehicle_business',      '280F', 'strict', NULL, FALSE, ARRAY['business_miles', 'business_purpose'],    100, NULL),

  -- General substantiation categories (§162 ordinary & necessary; §6001 recordkeeping).
  ('software',              '162',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('office_supplies',       '162',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('professional_services', '162',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('advertising',           '162',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('internet_phone',        '162',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('equipment',             '179',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('insurance',             '162',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('rent',                  '162',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('repairs',               '162',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('education',             '162',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('home_office',           '280A', 'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),

  -- Special case: personal (§262) — modeled explicitly so the AI classifies non-deductible
  -- expenses rather than mis-bucketing them (DEC-004). 0% deductible.
  ('personal',              '262',  'general', NULL, FALSE, ARRAY[]::TEXT[], 0,   NULL)
ON CONFLICT (category) DO UPDATE SET
  irc_section             = EXCLUDED.irc_section,
  substantiation_level    = EXCLUDED.substantiation_level,
  receipt_threshold_cents = EXCLUDED.receipt_threshold_cents,
  always_receipt          = EXCLUDED.always_receipt,
  required_context_fields = EXCLUDED.required_context_fields,
  deduction_percentage    = EXCLUDED.deduction_percentage,
  deduction_cap_cents     = EXCLUDED.deduction_cap_cents;

-- Verify: 18 rows total, 6 of them strict.
--   SELECT count(*) FROM substantiation_rules;                                  -- 18
--   SELECT count(*) FROM substantiation_rules WHERE substantiation_level='strict'; -- 6

-- =============================================================
-- 0003_seed_irc_summaries.sql
-- =============================================================

-- Tally — Seed: irc_summaries (TSNAP-006)
-- Source of truth: THIS FILE (the IRC-SUMMARIES.md doc holds the human-readable copy).
-- Sourcing / subsection detail / annual-review flags: claude_files/docs/IRC-RESEARCH.md.
--
-- 9 sections: the original 7 core + §274b (gifts) and §280F (vehicle/listed property),
-- added per DEC-009 so the `business_gifts` and `vehicle_business` rules resolve to
-- gift/vehicle content instead of mis-loading the meals / generic-§162 summaries.
--
-- These are the user-facing summaries the AI loads to cite the relevant code for a
-- categorized expense (SPEC.md: "Always pass relevant IRC summaries in the system prompt").
--
-- 2026 currency: figures reconciled to the One Big Beautiful Bill Act (P.L. 119-21,
-- July 2025). §179 was bumped to version 2 ($1.16M -> $2.5M/$4M + §168(k) 100% bonus).
-- Several figures are inflation-adjusted annually — see the IRC-RESEARCH.md
-- "Annual-Review Checklist" and bump version/last_reviewed when they change.
--
-- Idempotent: ON CONFLICT (section_id) upserts. Run after 0001_schema.sql.

INSERT INTO irc_summaries
  (section_id, title, short_summary, deduction_percentage, common_practice, worth_noting, source_url, last_reviewed, version)
VALUES

-- §162 General Business Expenses
(
  '162',
  'General Business Expenses',
  'The foundational tax code section that allows deduction of "ordinary and necessary" expenses paid or incurred during the tax year in carrying on any trade or business.',
  100,
  'Most business expenses fall under this section — supplies, software, marketing, professional services, business insurance, internet, business phone, advertising, professional development. The expense must be common in your line of work ("ordinary") and helpful to your business ("necessary"). It doesn''t have to be required.',
  'Personal expenses claimed as business expenses are a common reason deductions get disallowed. The expense must have a genuine business purpose, and keeping a record of what each one was for is what supports it.',
  'https://www.law.cornell.edu/uscode/text/26/162',
  DATE '2026-06-01',  -- literal review date; do NOT use CURRENT_DATE (re-running would falsely re-stamp every row)
  1
),

-- §262 Personal Expenses (Not Deductible)
(
  '262',
  'Personal Expenses (Not Deductible)',
  'Personal, living, or family expenses generally cannot be deducted as business expenses, even if you also use them for work.',
  0,
  'Common examples of expenses that are NOT deductible: regular clothing (even if worn at work), gym memberships (unless you''re a fitness professional), commuting from home to your office, personal meals eaten alone, entertainment for personal enjoyment.',
  'Mixed-use expenses (phone, internet, vehicle, home) can be partially deductible based on business-use percentage — but the personal portion is never deductible. The business-use percentage should reflect actual use and is commonly scrutinized, so a contemporaneous record of how it was calculated matters.',
  'https://www.law.cornell.edu/uscode/text/26/262',
  DATE '2026-06-01',  -- literal review date; do NOT use CURRENT_DATE (re-running would falsely re-stamp every row)
  1
),

-- §274 Business Meals
(
  '274',
  'Business Meals',
  'Business meals are generally 50% deductible. The meal must have a business purpose, a business contact must be present (not just yourself), and you must keep documentation of who attended and what was discussed.',
  50,
  'Most freelancers deduct: client lunches, networking meals, meals during business travel, working meals with potential clients or business partners. The IRS specifically requires documentation of: amount, time, place, business purpose, and business relationship to the person you ate with.',
  'Entertainment expenses (sports tickets, concerts, golf outings) are NOT deductible since the 2017 Tax Cuts and Jobs Act, even with clients present. Solo meals eaten alone while working are personal, not business. The $75 receipt rule isn''t meals-only: for strict categories (meals, travel, gifts) keep a receipt for any expense of $75 or more, and keep a receipt for lodging at any amount. Below $75, your written record — your text to us — can substantiate it.',
  'https://www.law.cornell.edu/uscode/text/26/274',
  DATE '2026-06-01',  -- literal review date; do NOT use CURRENT_DATE (re-running would falsely re-stamp every row)
  1
),

-- §274(b) Business Gifts. Content checked against the §274(b)(1) statutory text
-- (Cornell LII) on 2026-06-02 — v2: corrected the $4 exception (was "branded items
-- $4 or less"; the statute also requires the name be clearly/permanently imprinted AND
-- the item be one of many identical items distributed generally) and added the
-- promotional-materials exclusion (B), which was missing. See JOURNAL DEC-031.
(
  '274b',
  'Business Gifts',
  'You can deduct business gifts, but only up to $25 per recipient per year — that counts everything you give one person during the year, directly or indirectly. Spend more than $25 on the same person and the extra isn''t deductible.',
  100,
  'Client and referral gifts are deductible up to $25 per person for the whole year, so keep a running total per recipient. Two things don''t count as a "gift" against the $25: (1) cheap promotional items that cost $4 or less, have your name clearly and permanently printed on them, and are handed out widely as identical items (think logo pens or magnets); and (2) signs, display racks, or other promotional material meant for use at the recipient''s place of business. Incidental costs like engraving, packaging, insurance, and mailing also don''t count toward the $25, as long as they don''t add real value to the gift. Keep a record of who received the gift, the date, a short description, the amount, and the business reason.',
  'The $25 cap is per recipient for the whole year, so track a running total per person. A married couple is treated as one recipient. Gifts follow the strict-substantiation rules (who, what, when, why). The $25 figure has been fixed since 1962 — it is not inflation-adjusted. For how this applies to your situation, check with a tax professional.',
  'https://www.law.cornell.edu/uscode/text/26/274',
  DATE '2026-06-02',
  2
),

-- §280A Home Office Deduction
(
  '280A',
  'Home Office Deduction',
  'If you use part of your home regularly and exclusively for business, you can deduct a portion of home-related expenses (rent, mortgage interest, utilities, insurance, repairs) proportional to the space used.',
  100,
  'The IRS offers two methods: (1) Simplified method — $5 per square foot up to 300 sq ft ($1,500 max). (2) Regular method — calculate the exact percentage of your home used for business and apply to actual expenses. Most freelancers use the simplified method for ease.',
  'The "exclusively for business" requirement is strict — the space must NOT be used for any personal purposes. A guest room that doubles as an office doesn''t qualify. A dedicated corner of a room counts if used only for work. Keep documentation of the space and how it''s used exclusively for business.',
  'https://www.law.cornell.edu/uscode/text/26/280A',
  DATE '2026-06-01',  -- literal review date; do NOT use CURRENT_DATE (re-running would falsely re-stamp every row)
  1
),

-- §280F Vehicle & Listed Property
(
  '280F',
  'Vehicle & Listed Property',
  'Vehicle expenses are deductible for the business-use portion of your driving. Because a car counts as ''listed property,'' the IRS requires a contemporaneous mileage log, and you must use the vehicle more than 50% for business to claim the larger write-offs.',
  100,
  'Most freelancers track business miles and deduct either the IRS standard mileage rate or actual costs (gas, insurance, repairs, depreciation) times their business-use percentage. Log the date, miles, and business purpose for each trip. If you own the vehicle, annual depreciation is capped by the "luxury auto" limits, which change every year.',
  'The mileage log IS the substantiation — without it, vehicle deductions are commonly disallowed. Commuting from home to a regular workplace is personal, not business. If business use drops to 50% or below, you lose accelerated depreciation and Section 179 for that vehicle. The annual depreciation caps are inflation-adjusted — re-verify each tax year (see IRC-RESEARCH.md).',
  'https://www.law.cornell.edu/uscode/text/26/280F',
  DATE '2026-06-01',
  1
),

-- §179 Section 179 Equipment Deduction (version 2 — OBBBA 2025 update)
(
  '179',
  'Section 179 Equipment Deduction',
  'Allows businesses to deduct the full purchase price of qualifying equipment and software in the year it was bought, rather than depreciating it over several years.',
  100,
  'Commonly used for: computers, cameras, professional equipment, business vehicles (with limits), software, office furniture, machinery. Under the One Big Beautiful Bill Act (2025), the annual limit is $2.5 million with a $4 million phase-out threshold (indexed for inflation from 2026) — most freelancers won''t approach this cap. Separately, §168(k) bonus depreciation is back to 100% (permanent) for qualifying property acquired and placed in service after Jan 19, 2025.',
  'The equipment must be used more than 50% for business. If you use it less than 100% for business, you can only deduct the business-use percentage. The item must be put into service during the tax year — buying it and storing it unused doesn''t qualify. The $2.5M/$4M figures are inflation-adjusted annually starting 2026.',
  'https://www.law.cornell.edu/uscode/text/26/179',
  DATE '2026-06-01',  -- literal review date; do NOT use CURRENT_DATE (re-running would falsely re-stamp every row)
  2
),

-- §1402 Self-Employment Tax
(
  '1402',
  'Self-Employment Tax',
  'Self-employed individuals pay both the employer and employee portions of Social Security and Medicare taxes — 15.3% total on net self-employment income (12.4% Social Security + 2.9% Medicare, with an additional 0.9% Medicare surtax on high earners).',
  0,
  'Self-employment tax applies to net earnings from self-employment over $400 annually. It''s calculated on Schedule SE and added to your regular income tax. The employer-equivalent half (7.65%) is deductible as an adjustment to income.',
  'Self-employment tax is one of the largest tax costs for self-employed people. At higher income levels, some people ask a CPA whether a different business structure would reduce it — but that''s a professional decision based on your specific situation, not a DIY move.',
  'https://www.law.cornell.edu/uscode/text/26/1402',
  DATE '2026-06-01',  -- literal review date; do NOT use CURRENT_DATE (re-running would falsely re-stamp every row)
  1
),

-- §6654 Estimated Quarterly Tax Payments
(
  '6654',
  'Estimated Quarterly Tax Payments',
  'Self-employed individuals are generally required to make estimated tax payments four times per year if they expect to owe $1,000 or more in taxes for the year.',
  0,
  'Quarterly payment deadlines are typically: April 15 (Q1), June 15 (Q2), September 15 (Q3), and January 15 of the following year (Q4). Most freelancers calculate quarterly payments based on either: (1) 100% of prior year''s tax liability, or (2) 90% of current year''s expected liability.',
  'Underpayment penalties apply if you don''t pay enough throughout the year. The "safe harbor" rule says you generally won''t be penalized if you pay either 100% of last year''s tax (110% if your AGI was over $150K) or 90% of this year''s tax, whichever is less.',
  'https://www.law.cornell.edu/uscode/text/26/6654',
  DATE '2026-06-01',  -- literal review date; do NOT use CURRENT_DATE (re-running would falsely re-stamp every row)
  1
)

ON CONFLICT (section_id) DO UPDATE SET
  title                = EXCLUDED.title,
  short_summary        = EXCLUDED.short_summary,
  deduction_percentage = EXCLUDED.deduction_percentage,
  common_practice      = EXCLUDED.common_practice,
  worth_noting         = EXCLUDED.worth_noting,
  source_url           = EXCLUDED.source_url,
  last_reviewed        = EXCLUDED.last_reviewed,
  version              = EXCLUDED.version;

-- Verify: 9 rows (162, 262, 274, 274b, 280A, 280F, 179, 1402, 6654).
--   SELECT section_id, title, version FROM irc_summaries ORDER BY section_id;
-- Coverage integrity — every section a rule cites must have a summary row (expect 0):
--   SELECT DISTINCT irc_section FROM substantiation_rules s
--   WHERE irc_section IS NOT NULL
--     AND NOT EXISTS (SELECT 1 FROM irc_summaries i WHERE i.section_id = s.irc_section);

-- =============================================================
-- 0004_user_profile_fields.sql
-- =============================================================

-- Tally — Add user profile fields (DEC-014).
-- full_name: captured during SMS onboarding (warm personalization + export/accountant headers).
-- email:     captured later at the dashboard (NOT over SMS — typo-prone; not needed for
--            phone-OTP login). Optional. organizations.name already exists (used for org name).
--
-- Run in the Supabase SQL editor. Idempotent.

ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Optional: speed up dashboard lookups by email if we add email-based features later.
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- =============================================================
-- 0005_subscriptions.sql
-- =============================================================

-- Tally — Monetization (EPIC-9 / DEC-021). Subscription state on the organization
-- (the billing entity; 1:1 with user in V1). Hybrid paywall: 21-day app-managed trial,
-- then Stripe-backed subscription required to keep logging.
--
-- Run in the Supabase SQL editor. Idempotent.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20)
  DEFAULT 'trialing'
  CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'expired'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan VARCHAR(20)
  CHECK (plan IN ('monthly', 'annual'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orgs_stripe_customer ON organizations(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Backfill existing orgs onto a fresh 21-day trial so nobody is locked out by the migration.
UPDATE organizations
  SET trial_ends_at = COALESCE(trial_ends_at, NOW() + INTERVAL '21 days'),
      subscription_status = COALESCE(subscription_status, 'trialing')
  WHERE trial_ends_at IS NULL;

-- =============================================================
-- 0006_security_hardening.sql
-- =============================================================

-- Tally — Database access hardening (DEC-030). Defense-in-depth for the public/anon path.
--
-- CONTEXT: 100% of app data access is server-side via the SERVICE ROLE (bypasses RLS);
-- the anon key is defined but never used for data (verified in code). RLS is already
-- ENABLED on every table with NO policies (= default-deny), so the anon/public REST API
-- already returns nothing. This migration makes that guarantee belt-and-suspenders and
-- self-enforcing:
--   1. Re-assert RLS on every app table (centralizes + documents the invariant).
--   2. REVOKE all privileges from the public `anon`/`authenticated` roles so the anon key
--      cannot even reference the tables — and so a future *accidental* permissive policy
--      can't expose data on its own.
--   3. Make those revokes apply to FUTURE objects too (ALTER DEFAULT PRIVILEGES).
--   4. Self-check: fail loudly if any table in `public` ships without RLS (regression guard).
--
-- NON-BREAKING: `service_role` (used by the server) has BYPASSRLS + retains its grants, so
-- the app is unaffected. This does NOT add per-tenant RLS policies — because every request
-- runs as service_role (which bypasses RLS), cross-tenant isolation is enforced in app code
-- (lib/db.orgTable); see JOURNAL DEC-030 for that trade-off.
--
-- Run in the Supabase SQL editor. Idempotent.

-- 1) Re-assert RLS on every application table (idempotent).
ALTER TABLE organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE substantiation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE irc_summaries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_codes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions             ENABLE ROW LEVEL SECURITY;

-- 2) Strip ALL privileges from the public roles. RLS default-deny already blocks row
--    access; this removes the table-level GRANTs Supabase hands `anon`/`authenticated`
--    by default, so the anon key gets "permission denied" before RLS is even consulted.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- 3) Apply the same denial to objects CREATED LATER by the migration role (so a new table
--    can't be born with anon grants). The self-check in step 4 is the catch-all regardless
--    of which role creates a table.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- NOTE (intentionally NOT enabled): `FORCE ROW LEVEL SECURITY`. With no policies it would
-- also block the table-OWNER role used by the Supabase dashboard's data viewer / manual
-- maintenance, with no security gain here (service_role already bypasses RLS, and anon is
-- fully revoked above). Enable per-table only if you add real policies and want the owner
-- subject to them, e.g.:  ALTER TABLE receipts FORCE ROW LEVEL SECURITY;

-- 4) Regression guard: refuse to leave any base table in `public` without RLS. A future
--    migration that adds a table and forgets RLS will FAIL here until it's fixed.
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
    INTO missing
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'            -- ordinary tables only
    AND c.relrowsecurity = false;  -- RLS not enabled
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Security guard: these public tables have no RLS enabled: %', missing;
  END IF;
END $$;

-- =============================================================
-- 0007_hash_session_tokens.sql
-- =============================================================

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
