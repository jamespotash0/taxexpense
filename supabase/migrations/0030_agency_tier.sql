-- Tally — Agency tier foundation (Spec 10: foundation + Fix 1 provisioning).
--
-- Additive only. Introduces a tier ABOVE organizations so one agency can manage many SEPARATE
-- creator books (one manager → many orgs) — distinct from co-owners (many people → one shared org,
-- DEC-045). Changes NO existing behavior: organizations.agency_id defaults NULL = today's
-- self-serve account, evaluated exactly as before.
--
-- Access: service-role only, same default-deny posture as users/orgs/leads (RLS enabled, zero
-- policies → anon/auth roles get nothing; only the server's service-role client bypasses RLS,
-- DEC-001).
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.

CREATE TABLE IF NOT EXISTS agencies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(255),
  -- Billing lives on the agency (Spec 10, Fix 3). For the first agencies these are set BY HAND
  -- after invoicing; automated per-seat Stripe sync is deferred until an agency commits.
  stripe_customer_id  VARCHAR(255),
  subscription_status VARCHAR(50) DEFAULT 'trialing',
  seat_plan           VARCHAR(50),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agency staff (NOT creators): they use the agency dashboard and never text expenses. A staffer is
-- a normal users row; this table grants them cross-org access to the agency's creators (Fix 2).
CREATE TABLE IF NOT EXISTS agency_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agency_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_agency_members_user ON agency_members(user_id);

-- The hinge: a managed creator org points at its agency. NULL = self-serve (unchanged).
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id);
CREATE INDEX IF NOT EXISTS idx_organizations_agency ON organizations(agency_id) WHERE agency_id IS NOT NULL;

COMMENT ON COLUMN organizations.agency_id IS
  'Spec 10: when set, this creator org is managed by an agency (billing + cross-org access flow through the agency). NULL = self-serve.';

-- Service-role only (no policies created → anon/auth roles get nothing; service role bypasses RLS).
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_members ENABLE ROW LEVEL SECURITY;
