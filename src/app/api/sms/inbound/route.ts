// POST /api/sms/inbound — Twilio inbound SMS webhook.
// OWNER: Raj + Sofia. EPIC-2 (claude_files/specs/02-sms-pipeline.md), Day 3.
//
// Stub during EPIC-1. The real handler (EPIC-2) will:
//   1. Validate the X-Twilio-Signature header (lib/twilio.validateTwilioSignature) — REQUIRED.
//   2. Look up user by From; route to onboarding / clarification / new-expense.
//   3. Run the substantiation decision tree; reply via Twilio.
// Twilio expects a 200 with (optionally empty) TwiML; we send replies via the API.

import { NextResponse } from 'next/server';

export async function POST() {
  // TODO(EPIC-2): validate signature, parse form body, process message.
  return new NextResponse('', { status: 200 });
}
