// POST /api/sms/inbound — Twilio inbound SMS webhook (TSNAP-013/015/016+).
// OWNER: Raj + Sofia + Jordan.
//
// 1. Validate X-Twilio-Signature (Jordan: non-negotiable) — reject 403 if invalid.
// 2. Parse the urlencoded body into a clean InboundMessage.
// 3. Hand off to handleInboundSms (which sends the reply + logs).
// 4. Return empty 200 (we reply via the Twilio REST API, not TwiML).

import { NextResponse } from 'next/server';
import { validateTwilioSignature } from '@/lib/twilio';
import { handleInboundSms, type InboundMessage } from '@/lib/sms-handler';
import { optionalEnv } from '@/lib/env';
import { log } from '@/lib/log';

// AI processing (OCR + Sonnet) can take several seconds; give the function headroom.
export const maxDuration = 30;

export async function POST(req: Request): Promise<NextResponse> {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = typeof v === 'string' ? v : '';

  // The URL Twilio signed = the public host + this path (must match the Console config).
  const host = req.headers.get('host');
  const url = `https://${host}/api/sms/inbound`;
  const signature = req.headers.get('x-twilio-signature');

  const valid = validateTwilioSignature(signature, url, params);
  // Local-only escape hatch for manual testing without a real signature. NEVER in prod.
  const devBypass =
    process.env.NODE_ENV !== 'production' && optionalEnv('ALLOW_INSECURE_SMS_WEBHOOK') === '1';

  if (!valid && !devBypass) {
    log.warn('twilio_signature_invalid');
    return new NextResponse('Forbidden', { status: 403 });
  }

  const numMedia = parseInt(params.NumMedia ?? '0', 10) || 0;
  const mediaUrls: string[] = [];
  for (let i = 0; i < numMedia; i++) {
    const u = params[`MediaUrl${i}`];
    if (u) mediaUrls.push(u);
  }

  const msg: InboundMessage = {
    from: params.From ?? '',
    body: params.Body ?? '',
    numMedia,
    mediaUrls,
  };

  try {
    await handleInboundSms(msg);
  } catch (err) {
    // handleInboundSms is defensive, but never 500 back to Twilio (it would retry).
    log.error('inbound_handler_uncaught', {
      message: err instanceof Error ? err.message : 'unknown',
    });
  }

  return new NextResponse('', { status: 200 });
}
