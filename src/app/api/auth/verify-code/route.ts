// POST /api/auth/verify-code — verify OTP, issue session.
// OWNER: Emma + Jordan. EPIC-4 + EPIC-7, Day 6.
// Attempt lockout after N failures (Jordan).
import { NextResponse } from 'next/server';

export async function POST() {
  // TODO(EPIC-4): verify code, mark used, create session cookie (HTTP-only/secure/sameSite).
  return NextResponse.json({ error: 'not_implemented' }, { status: 501 });
}
