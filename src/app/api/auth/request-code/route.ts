// POST /api/auth/request-code — start phone OTP login.
// OWNER: Emma + Jordan. EPIC-4 + EPIC-7, Day 6.
// Rate limit: 3 per phone per 15 min (Jordan, non-negotiable).
import { NextResponse } from 'next/server';

export async function POST() {
  // TODO(EPIC-4): generate code, store in auth_codes (10-min expiry), send via Twilio.
  return NextResponse.json({ error: 'not_implemented' }, { status: 501 });
}
