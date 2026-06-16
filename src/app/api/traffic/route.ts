// POST /api/traffic — record where a landing visit came from (utm_source / ref param, or an
// external referrer like Product Hunt), for aggregate launch/channel analytics (DEC-084). Public +
// unauthenticated (it fires from the marketing page before any signup), so it's IP-throttled and
// writes only no-PII, length-capped fields. Best-effort: a failure never surfaces to the visitor.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody, jsonError } from '@/lib/api';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';
import { normalizeTrafficSource, recordTrafficSource } from '@/lib/traffic';
import { PUBLIC_ENV } from '@/lib/env';
import { log } from '@/lib/log';

// Generous per-IP cap: a beacon fires at most once per session client-side, so this only blunts
// abuse. Per-instance (resets on cold start) — fine for an aggregate counter (matches hero-optin).
const ipLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30 });

// Loose bounds — the lib trims/caps/lowercases everything; this just rejects obviously hostile bulk.
const Body = z.object({
  source: z.string().max(200).nullish(),
  medium: z.string().max(200).nullish(),
  campaign: z.string().max(200).nullish(),
  referrer: z.string().max(2048).nullish(),
  path: z.string().max(512).nullish(),
  locale: z.string().max(16).nullish(),
});

/** Our own hosts, so internal navigation isn't logged as a referral. */
function selfHosts(): string[] {
  const hosts = ['tallywhy.com', 'www.tallywhy.com', 'localhost'];
  const appUrl = PUBLIC_ENV.appUrl;
  if (appUrl) {
    try {
      hosts.push(new URL(appUrl).hostname);
    } catch {
      /* ignore a malformed env URL */
    }
  }
  return hosts;
}

export async function POST(req: Request): Promise<NextResponse> {
  if (ipLimiter(getClientIp(req), Date.now())) return jsonError('rate_limited', 429);

  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;

  const row = normalizeTrafficSource(body, selfHosts());
  if (!row) return NextResponse.json({ ok: true, recorded: false }); // no attribution signal → no-op

  try {
    await recordTrafficSource(row);
    log.info('traffic_source_recorded', { source: row.source, referrer_host: row.referrer_host });
  } catch {
    // Best-effort: the insert helper already logged the cause. Never fail the beacon.
  }
  return NextResponse.json({ ok: true, recorded: true });
}
