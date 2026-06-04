-- Tally — Web onboarding funnel instrumentation (DEC-049). One row per step VIEW, keyed by a
-- client-generated session_id, so we can compute per-step drop-off and a "reached the number /
-- tapped text" conversion proxy. Aggregate only: with no phone captured in the funnel anymore
-- (DEC-048), a web session can't be tied to a specific later inbound text — per-user web→SMS
-- attribution isn't possible without a shared key. No PII here (no name/phone/pain).
--
-- Run in the Supabase SQL editor. Idempotent.

CREATE TABLE IF NOT EXISTS funnel_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id  UUID NOT NULL,          -- random per funnel mount; groups a visitor's steps
  step        SMALLINT NOT NULL,      -- 0-based step index
  step_name   VARCHAR(40),            -- 'name' | 'work' | 'pain' | 'how_it_works' | 'start' | 'text_click'
  locale      VARCHAR(8)
);

CREATE INDEX IF NOT EXISTS idx_funnel_events_session ON funnel_events(session_id);
CREATE INDEX IF NOT EXISTS idx_funnel_events_created_at ON funnel_events(created_at);

ALTER TABLE funnel_events ENABLE ROW LEVEL SECURITY; -- default-deny; written via service role only
