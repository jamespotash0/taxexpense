-- Tally — Landing traffic-source capture (DEC-084). One row per attributed visit (a session that
-- arrived with a utm_source/ref param or an external referrer, e.g. a Product Hunt launch link), so
-- we can count "how much traffic came from where." Aggregate only, NO PII: no phone, name, or full
-- referrer URL — just the source/medium/campaign and the referrer HOST. Per the decoupled web→SMS
-- funnel (DEC-048/049) this is NOT tied to a later inbound text; it's a channel counter, not per-user
-- attribution.
--
-- Run in the Supabase SQL editor. Idempotent.

CREATE TABLE IF NOT EXISTS traffic_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  source        VARCHAR(60),   -- utm_source / ref / via, lowercased (e.g. 'producthunt')
  medium        VARCHAR(60),   -- utm_medium (e.g. 'launch', 'social')
  campaign      VARCHAR(60),   -- utm_campaign
  referrer_host VARCHAR(120),  -- host of document.referrer only (e.g. 'www.producthunt.com'); no path
  landing_path  VARCHAR(120),  -- first path landed on (e.g. '/')
  locale        VARCHAR(8)
);

CREATE INDEX IF NOT EXISTS idx_traffic_sources_source ON traffic_sources(source);
CREATE INDEX IF NOT EXISTS idx_traffic_sources_created_at ON traffic_sources(created_at);

ALTER TABLE traffic_sources ENABLE ROW LEVEL SECURITY; -- default-deny; written via service role only
