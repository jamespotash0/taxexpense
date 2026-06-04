-- Tally — Web onboarding leads (EPIC-9 funnel).
-- Every /start funnel completion drops a row here — including visitors who SKIP the phone step
-- — capturing the name + work type they picked and their "worst part of tax time" answer in
-- their own words, plus the phone they gave (if any).
--
-- Why this exists beyond marketing copy:
--   • Funnel analytics — measure drop-off + web→SMS conversion (the core funnel KPI).
--   • Work-type distribution — tune the onboarding chips AND the expense categorizer to the
--     mix of trades that actually sign up (e.g. lots of "Something else" = a missing segment).
--   • Pain taxonomy — real, unsolicited language about the problem prioritizes features and
--     the in-thread IRC education, and validates positioning ("capture the WHY").
--
-- NOT an SMS opt-in: phones here are never texted cold. Recognition is handled by the user
-- pre-seed (users.preseedUserByPhone), gated on the user texting Tally first (TCPA).
--
-- Access: service-role only. RLS is enabled with NO anon/auth policies, so only the server's
-- service-role admin client (which bypasses RLS) can read/write — same posture as users/orgs.
-- PII note: `pain` is free text; it lives here but is never written to logs.
-- Run in the Supabase SQL editor. Idempotent.

CREATE TABLE IF NOT EXISTS leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  phone_number      VARCHAR(20),
  full_name         VARCHAR(120),
  business_type     VARCHAR(100),
  pain              TEXT,
  locale            VARCHAR(8),
  source            VARCHAR(40) NOT NULL DEFAULT 'web_onboarding',
  -- Set later when this lead's phone first texts in — web→SMS attribution (column reserved;
  -- population is a follow-up, not wired yet).
  converted_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone_number) WHERE phone_number IS NOT NULL;

-- Service-role only (no policies created → anon/auth roles get nothing; service role bypasses RLS).
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
