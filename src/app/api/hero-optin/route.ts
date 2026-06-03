// POST /api/hero-optin — landing-page "text me first" opt-in (hero A/B arm C).
// The visitor gives us their number and we send the first SMS (inverse of the usual
// "text Tally first" flow — a marketing opt-in, not auth). Sends via Twilio when the
// number is configured; otherwise simulates success so the beta works before go-live.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeToE164 } from '@/lib/phone';
import { sendSms } from '@/lib/twilio';
import { optionalEnv } from '@/lib/env';
import { createRateLimiter } from '@/lib/rate-limit';
import { log, maskPhone } from '@/lib/log';

const Body = z.object({ phone_number: z.string().min(7).max(20) });

// Best-effort throttle: 3 opt-ins per phone per 15 min. Per-instance only (resets on cold
// start) — fine for a marketing opt-in; a DB-backed limit is a re-enable gate before arm C
// goes to live traffic (JOURNAL DEC-027). See lib/rate-limit.ts (unit-tested).
const isRateLimited = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 3 });

export async function POST(req: Request): Promise<NextResponse> {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const phone = normalizeToE164(parsed.data.phone_number);
  if (!phone) return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });

  // Date.now() is the request clock here (not a workflow script) — allowed.
  if (isRateLimited(phone, Date.now())) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  // Opt-in confirmation. Must stay aligned with the registered A2P 10DLC campaign's declared
  // opt-in message: brand name + recurring-automated disclosure + HELP + STOP.
  const welcome =
    "Hey, it's Tally 👋 You're opted in to recurring automated texts — expense confirmations, " +
    'account notifications & one-time login codes. Snap a receipt or text an expense anytime. ' +
    'Msg & data rates may apply. Reply HELP for help, STOP to opt out.';

  try {
    if (optionalEnv('TWILIO_PHONE_NUMBER')) {
      await sendSms(phone, welcome);
      log.info('hero_optin_sent', { phone: maskPhone(phone) });
    } else {
      // No live number yet — log the lead so the CTA is testable pre-launch.
      log.info('hero_optin_simulated', { phone: maskPhone(phone) });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error('hero_optin_failed', { phone: maskPhone(phone), message: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
