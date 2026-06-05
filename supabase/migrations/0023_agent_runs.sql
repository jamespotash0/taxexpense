-- Tally — agent run log (Phase 2: the month-end review agent; AGENTS-VS-WORKFLOWS.md).
-- OWNER: Raj. Every agentic run is recorded here: the tool-call trace, token cost, and
-- the DRAFT it produced for the user to approve. This IS the observability the doc says
-- agents require ("trace logging, cost monitoring") — append-only audit log, one row per run.
-- Accessed only via the service-role client; RLS is enabled with no policies (default-deny),
-- matching the posture of every other table (migration 0001). Run in the Supabase SQL editor. Idempotent.

CREATE TABLE IF NOT EXISTS agent_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_type      TEXT NOT NULL,              -- 'month_end_review'
  period          TEXT,                       -- review window, e.g. 'YYYY-MM'
  status          TEXT NOT NULL,              -- 'completed' | 'max_steps' | 'incomplete'
  steps           INT  NOT NULL DEFAULT 0,    -- model turns taken (bounded by maxSteps)
  input_tokens    INT  NOT NULL DEFAULT 0,    -- cost tracking (Raj: cost-per-user is non-negotiable)
  output_tokens   INT  NOT NULL DEFAULT 0,
  trace           JSONB,                      -- [{ tool, input, ok }] — per-step audit trail
  summary         TEXT,                       -- one-line month summary for the user
  draft_subject   TEXT,                       -- draft accountant email (NOT sent — human approves)
  draft_body      TEXT,
  flagged         JSONB,                      -- [{ id, reason }] — expenses worth the CPA's attention
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- "Show this org's recent agent runs", newest first (dashboard history + idempotency checks).
CREATE INDEX IF NOT EXISTS idx_agent_runs_org ON agent_runs(organization_id, created_at DESC);

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
