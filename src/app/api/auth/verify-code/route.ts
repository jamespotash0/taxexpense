// POST /api/auth/verify-code — verify OTP, issue session cookie (TSNAP-036).
// Attempt lockout (5) + constant-time compare in verifyCode() (Jordan).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody, jsonError, serverError } from '@/lib/api';
import { normalizeToE164 } from '@/lib/phone';
import { verifyCode, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';
import { maskPhone } from '@/lib/log';

const Body = z.object({
  phone_number: z.string().min(7).max(20),
  code: z.string().regex(/^\d{6}$/),
});

const FAIL_MESSAGES: Record<string, string> = {
  no_code: 'No active code. Request a new one.',
  expired: 'That code expired. Request a new one.',
  too_many_attempts: 'Too many attempts. Request a new code.',
  mismatch: "That code doesn't match. Try again.",
  no_account: 'No account for this number yet. Text Tally first to get started.',
};

export async function POST(req: Request): Promise<NextResponse> {
  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;

  const phone = normalizeToE164(body.phone_number);
  if (!phone) return jsonError('invalid_phone', 400);

  try {
    const result = await verifyCode(phone, body.code);
    if (!result.ok) {
      return jsonError(result.reason, 401, { message: FAIL_MESSAGES[result.reason] ?? 'Verification failed.' });
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
    return serverError('verify_code_failed', err, { phone: maskPhone(phone) });
  }
}
