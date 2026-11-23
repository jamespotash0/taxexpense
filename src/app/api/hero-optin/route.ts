// POST /api/hero-optin — landing-page "text me first" opt-in (hero A/B arm C).
// The visitor gives us their number and we send the first SMS (inverse of the usual
// "text Tally first" flow — a marketing opt-in, not auth). Sends via Twilio when the
// number is configured; otherwise simulates success so the beta works before go-live.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody, jsonError, serverError } from '@/lib/api';
import { normalizeToE164 } from '@/lib/phone';
import { sendSms } from '@/lib/twilio';
import { publicSmsNumber, isLinq } from '@/lib/env';
import { addLinqContact } from '@/lib/linq';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';
import { log, maskPhone } from '@/lib/log';

const Body = z.object({ phone_number: z.string().min(7).max(20) });

// Best-effort throttle: 3 opt-ins per phone per 15 min. Per-instance only (resets on cold
// start) — fine for a marketing opt-in; a DB-backed limit is a re-enable gate before arm C
// goes to live traffic (JOURNAL DEC-027). See lib/rate-limit.ts (unit-tested).
const isRateLimited = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 3 });
// Per-source throttle so one host can't fan opt-in SMS across rotated phone numbers (toll-fraud).
const ipLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

export async function POST(req: Request): Promise<NextResponse> {
  if (ipLimiter(getClientIp(req), Date.now())) {
    return jsonError('rate_limited', 429);
  }

  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;

  const phone = normalizeToE164(body.phone_number);
  if (!phone) return jsonError('invalid_phone', 400);

  // Date.now() is the request clock here (not a workflow script) — allowed.
  if (isRateLimited(phone, Date.now())) {
    return jsonError('rate_limited', 429);
  }

  // Opt-in confirmation. Must stay aligned with the registered A2P 10DLC campaign's declared
  // opt-in message: brand name + recurring-automated disclosure + HELP + STOP.
  const welcome =
    "Hey! It's Penny from Tally 👋 You're opted in to recurring automated texts: expense confirmations, " +
    'account notifications & one-time login codes. Snap a receipt or text me an expense anytime. ' +
    'Msg & data rates may apply. Reply HELP for help, STOP to opt out.';

  try {
    // Linq shared line (DEC-089): register the number so their first text reaches us. No welcome
    // text: shared lines are inbound-first, so the page opens Messages and they text us instead.
    if (isLinq()) {
      // A failed add is logged inside addLinqContact; still let them through to Messages rather
      // than blame their number for our config.
      if (await addLinqContact(phone)) log.info('hero_optin_linq_registered', { phone: maskPhone(phone) });
      return NextResponse.json({ ok: true });
    }
    if (publicSmsNumber()) {
      await sendSms(phone, welcome);
      log.info('hero_optin_sent', { phone: maskPhone(phone) });
    } else {
      // No live number yet — log the lead so the CTA is testable pre-launch.
      log.info('hero_optin_simulated', { phone: maskPhone(phone) });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError('hero_optin_failed', err, { phone: maskPhone(phone) });
  }
}
