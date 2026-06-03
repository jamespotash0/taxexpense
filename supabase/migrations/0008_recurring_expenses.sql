-- Tally — Recurring expenses (subscriptions, rent, phone…). DEC-033.
--
-- DESIGN (founder-approved): "detect a repeat → offer → remind & confirm" — Tally NEVER
-- auto-creates a future expense (that would fabricate a tax record). A template here only
-- drives a monthly "did it renew? reply Y to log it" nudge; the actual receipt is created
-- by the normal capture flow only after the user confirms.
--
-- Run in the Supabase SQL editor. Idempotent.

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Snapshot of the template (what to re-log on confirm).
  vendor VARCHAR(255),
  amount_cents INTEGER NOT NULL,
  category VARCHAR(100),
  business_purpose TEXT,
  cadence VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (cadence IN ('monthly')),
  next_due DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'awaiting_confirm', 'paused')),
  last_logged_at TIMESTAMPTZ,   -- last time an occurrence was actually logged (on confirm)
  confirm_sent_at TIMESTAMPTZ,  -- when the current "did it renew?" nudge went out
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DEC-030: RLS on every table (default-deny; service_role bypasses). Belt-and-suspenders
-- revoke too — the 0006 default-privileges already deny new tables, this makes it explicit.
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON recurring_expenses FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_recurring_org ON recurring_expenses(organization_id);
-- Cron scans active templates whose next occurrence is due.
CREATE INDEX IF NOT EXISTS idx_recurring_due ON recurring_expenses(next_due) WHERE status = 'active';
-- One active template per (org, vendor, amount) — prevents duplicate subscriptions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_recurring_unique
  ON recurring_expenses(organization_id, lower(vendor), amount_cents)
  WHERE status <> 'paused';
