// POST /api/onboarding/preseed — the web funnel (/start) calls this on completion (whether the
// visitor gives a phone number or skips that step). It does two things:
//   1. Records a LEAD (name + work + "worst part of tax time" + locale) — funnel analytics +
//      pain taxonomy. Captured even when the phone step is skipped.
//   2. If a usable phone was given, PRE-SEEDS the user row so the SMS onboarding can skip the
//      questions already answered here (see lib/onboarding.ts step 0).
//
// NOT an SMS opt-in: we never text from here. TCPA consent is stamped on the user's first
// inbound text (lib/users.ts). Best-effort by design — the funnel still works (and the user can
// onboard fully over SMS) if this fails, so the client advances regardless of the response.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody, jsonError, serverError } from '@/lib/api';
import { normalizeToE164 } from '@/lib/phone';
import { preseedUserByPhone } from '@/lib/users';
import { insertLead } from '@/lib/leads';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';
import { log, maskPhone } from '@/lib/log';

const Body = z.object({
  phone_number: z.string().min(7).max(20).optional(), // omitted when the user skips the phone step
  full_name: z.string().trim().min(1).max(80).optional(),
  business_type: z.string().trim().min(1).max(100).optional(),
  pain: z.string().trim().max(500).optional(),
  locale: z.string().trim().max(8).optional(),
});

// Same posture as hero-optin: per-phone + per-IP throttle (per-instance; resets on cold start).
const phoneLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
const ipLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

export async function POST(req: Request): Promise<NextResponse> {
  if (ipLimiter(getClientIp(req), Date.now())) return jsonError('rate_limited', 429);

  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;

  // Normalize the phone only if one was given. A malformed number doesn't fail the request —
  // we still record the lead; we just skip the pre-seed (nothing to key it on).
  const phone = body.phone_number ? normalizeToE164(body.phone_number) : null;
  if (phone && phoneLimiter(phone, Date.now())) return jsonError('rate_limited', 429);

  // 1. Record the funnel lead (independent of the pre-seed; failure here must not block it).
  await insertLead({
    phone_number: phone,
    full_name: body.full_name ?? null,
    business_type: body.business_type ?? null,
    pain: body.pain ?? null,
    locale: body.locale ?? null,
  }).catch(() => { /* already logged in insertLead; best-effort */ });

  try {
    // 2. Pre-seed the user row when we have a usable number.
    if (phone) {
      await preseedUserByPhone(phone, {
        full_name: body.full_name ?? null,
        business_type: body.business_type ?? null,
      });
    }
    // No-PII log (masked phone; pain recorded only as a boolean).
    log.info('onboarding_preseed', { phone: phone ? maskPhone(phone) : null, preseeded: !!phone, hasPain: !!body.pain });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError('onboarding_preseed_failed', err, { phone: phone ? maskPhone(phone) : null });
  }
}
