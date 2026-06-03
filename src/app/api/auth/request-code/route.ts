// POST /api/auth/request-code — start phone OTP login (TSNAP-035).
// Rate limited to 3/phone/15min inside requestCode() (Jordan). Generates the code
// server-side and sends it via SMS; never returns the code in the HTTP response.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeToE164 } from '@/lib/phone';
import { requestCode } from '@/lib/auth';
import { sendSms } from '@/lib/twilio';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';
import { log, maskPhone } from '@/lib/log';

const Body = z.object({ phone_number: z.string().min(7).max(20) });

// Per-source courtesy throttle (in front of the per-phone + global DB caps in lib/auth) so a
// single host can't fan out OTP sends across many phone numbers. Spoofable → defense-in-depth.
const ipLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

export async function POST(req: Request): Promise<NextResponse> {
  if (ipLimiter(getClientIp(req), Date.now())) {
    return NextResponse.json({ error: 'rate_limited', message: 'Too many requests. Try again shortly.' }, { status: 429 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const phone = normalizeToE164(parsed.data.phone_number);
  if (!phone) return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });

  try {
    const result = await requestCode(phone);
    if (!result.ok) {
      return NextResponse.json(
        { error: 'rate_limited', message: 'Too many code requests. Try again in a few minutes.' },
        { status: 429 },
      );
    }
    await sendSms(phone, `Your Tally code is: ${result.code} (expires in 10 min)`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error('request_code_failed', { phone: maskPhone(phone), message: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
