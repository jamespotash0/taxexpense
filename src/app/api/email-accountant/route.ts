// POST /api/email-accountant — email a monthly PDF+CSV summary to the accountant.
// OWNER: Emma. EPIC-8 (P1 — can slip to week 3), Day 8.
// Jordan: verify accountant email ownership before sending (data-leak risk).
import { NextResponse } from 'next/server';

export async function POST() {
  // TODO(EPIC-8): generate PDF+CSV, send via Resend to verified accountant_email.
  return NextResponse.json({ error: 'not_implemented' }, { status: 501 });
}
