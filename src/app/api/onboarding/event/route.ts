// POST /api/onboarding/event — funnel step instrumentation (DEC-049). The /start funnel fires
// one of these per step view (and on the text-link tap) so we can measure per-step drop-off.
// No PII (just a random session id + step). Best-effort + IP-rate-limited; the client never
// blocks on the response.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody, jsonError } from '@/lib/api';
import { insertFunnelEvent } from '@/lib/leads';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';

const Body = z.object({
  session_id: z.string().uuid(),
  step: z.number().int().min(0).max(20),
  step_name: z.string().max(40).optional(),
  locale: z.string().max(8).optional(),
});

// Generous: a full funnel run is ~6 events; allow bursts but cap abuse per IP.
const ipLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 120 });

export async function POST(req: Request): Promise<NextResponse> {
  if (ipLimiter(getClientIp(req), Date.now())) return jsonError('rate_limited', 429);

  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;

  await insertFunnelEvent(body).catch(() => {}); // best-effort; already logged in lib
  return NextResponse.json({ ok: true });
}
