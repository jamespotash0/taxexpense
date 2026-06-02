// POST /api/auth/verify-code — verify OTP, issue session cookie (TSNAP-036).
// Attempt lockout (5) + constant-time compare in verifyCode() (Jordan).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeToE164 } from '@/lib/phone';
import { verifyCode, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';
import { log, maskPhone } from '@/lib/log';

const Body = z.object({
  phone_number: z.string().min(7).max(20),
  code: z.string().regex(/^\d{6}$/),
});

const FAIL_MESSAGES: Record<string, string> = {
  no_code: 'No active code. Request a new one.',
  expired: 'That code expired. Request a new one.',
  too_many_attempts: 'Too many attempts. Request a new code.',
  mismatch: "That code doesn't match. Try again.",
  no_account: 'No account for this number yet — text Tally first to get started.',
};

export async function POST(req: Request): Promise<NextResponse> {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const phone = normalizeToE164(parsed.data.phone_number);
  if (!phone) return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });

  try {
    const result = await verifyCode(phone, parsed.data.code);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason, message: FAIL_MESSAGES[result.reason] ?? 'Verification failed.' },
        { status: 401 },
      );
    }

    const res = NextResponse.json({ ok: true, user_id: result.user.id });
    res.cookies.set(SESSION_COOKIE, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return res;
  } catch (err) {
    log.error('verify_code_failed', { phone: maskPhone(phone), message: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
