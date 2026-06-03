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
