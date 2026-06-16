// Landing traffic-source capture (DEC-084). Counts where a visit came from (utm_source / ref param,
// or external referrer host like Product Hunt) for launch/channel analytics. Aggregate only, no PII
// (no phone/name/full referrer URL) — and NOT tied to a later inbound text (the web→SMS funnel is
// decoupled, DEC-048/049). Service-role write only; best-effort (never blocks a page render).
import { getSupabaseAdmin } from './supabase';
import { log } from './log';

/** Raw signals the client beacon sends (utm params + the full document.referrer). */
export interface RawTraffic {
  source?: string | null; // utm_source / ref / via
  medium?: string | null; // utm_medium
  campaign?: string | null; // utm_campaign
  referrer?: string | null; // full document.referrer URL (host only is kept)
  path?: string | null; // landing path
  locale?: string | null;
}

/** The cleaned row we persist (referrer reduced to its host; everything length-capped). */
export interface TrafficRow {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  referrer_host: string | null;
  landing_path: string | null;
  locale: string | null;
}

/** Trim → lowercase → cap, returning null for empty/whitespace. */
function clean(value: string | null | undefined, max: number): string | null {
  const v = (value ?? '').trim().toLowerCase().slice(0, max);
  return v.length ? v : null;
}

/** The host of a referrer URL, or null if it's missing, unparseable, or one of OUR OWN hosts
 *  (internal navigation isn't a referral). selfHosts are compared case-insensitively. */
function referrerHost(referrer: string | null | undefined, selfHosts: string[]): string | null {
  if (!referrer) return null;
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return null; // not a full URL → ignore
  }
  if (!host) return null;
  const self = new Set(selfHosts.map((h) => h.toLowerCase()));
  if (self.has(host)) return null; // same-site nav, not an external referral
  return host.slice(0, 120);
}

/**
 * Normalize the raw client signals into a row, or null when there's NO attribution signal
 * (no source param and no external referrer) — the caller drops those so we never log empty
 * "direct" visits. Pure + unit-tested. `selfHosts` are our own domains (so internal navigation
 * isn't recorded as a referral); the route supplies them.
 */
export function normalizeTrafficSource(raw: RawTraffic, selfHosts: string[] = []): TrafficRow | null {
  const source = clean(raw.source, 60);
  const refHost = referrerHost(raw.referrer, selfHosts);
  // No source param AND no external referrer → nothing worth recording.
  if (!source && !refHost) return null;

  // landing_path: keep a leading-slash path only (cap length), else null. Not lowercased — paths
  // are case-sensitive — but the value is bounded and carries no query string.
  const rawPath = (raw.path ?? '').trim();
  const landing_path = rawPath.startsWith('/') ? rawPath.split('?')[0].slice(0, 120) : null;

  return {
    source,
    medium: clean(raw.medium, 60),
    campaign: clean(raw.campaign, 60),
    referrer_host: refHost,
    landing_path,
    locale: clean(raw.locale, 8),
  };
}

/** Persist a normalized traffic-source row. Best-effort: callers never block on it. */
export async function recordTrafficSource(row: TrafficRow): Promise<void> {
  const { error } = await getSupabaseAdmin().from('traffic_sources').insert(row);
  if (error) {
    log.warn('traffic_source_insert_failed', { message: error.message });
    throw error;
  }
}
