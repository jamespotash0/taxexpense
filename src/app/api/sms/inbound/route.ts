// POST /api/sms/inbound — Twilio inbound SMS webhook (TSNAP-013/015/016+).
// OWNER: Raj + Sofia + Jordan.
//
// 1. Validate X-Twilio-Signature (Jordan: non-negotiable) — reject 403 if invalid.
// 2. Parse the urlencoded body into a clean InboundMessage.
// 3. Hand off to handleInboundSms (which sends the reply + logs).
// 4. Return empty 200 (we reply via the Twilio REST API, not TwiML).

import { NextResponse, after } from 'next/server';
import { claimWebhookEvent } from '@/lib/idempotency';
import { validateTwilioSignature, sendViaTwilio } from '@/lib/twilio';
import { addLinqContact } from '@/lib/linq';
import { handleInboundSms, type InboundMessage } from '@/lib/sms-handler';
import { optionalEnv, isLinq, publicSmsNumber } from '@/lib/env';
import { formatUsPhone } from '@/lib/phone';
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

  // Redelivery of a message we've already taken (Twilio Fallback URL / retry overrides).
  if (params.MessageSid && !(await claimWebhookEvent(`twilio:${params.MessageSid}`))) {
    return new NextResponse('', { status: 200 });
  }

  const numMedia = parseInt(params.NumMedia ?? '0', 10) || 0;
  const mediaUrls: string[] = [];
  for (let i = 0; i < numMedia; i++) {
    const u = params[`MediaUrl${i}`];
    if (u) mediaUrls.push(u);
  }

  // Twilio prefixes WhatsApp addresses with "whatsapp:". Same webhook serves both.
  const rawFrom = params.From ?? '';
  const isWhatsApp = rawFrom.startsWith('whatsapp:');

  const msg: InboundMessage = {
    from: rawFrom.replace(/^whatsapp:/, ''),
    body: params.Body ?? '',
    numMedia,
    mediaUrls,
    channel: isWhatsApp ? 'whatsapp' : 'sms',
  };

  // We're on Linq but they texted the old Twilio number (DEC-089). Register them on Linq so their
  // replies there get through, tell them (from the number they texted) where Penny lives now,
  // then handle the message as usual; that answer comes from the Linq number.
  const linqNumber = publicSmsNumber();
  if (isLinq() && !isWhatsApp && linqNumber) {
    try {
      await addLinqContact(msg.from);
      await sendViaTwilio(msg.from, movedMessage(formatUsPhone(linqNumber)));
    } catch (err) {
      log.warn('twilio_moved_notice_failed', { message: err instanceof Error ? err.message : 'unknown' });
    }
  }

  // Ack now and process after the response (as on Linq): OCR + several model calls can outlast
  // Twilio's 15s webhook timeout. The reply goes out via the REST API, not TwiML.
  after(async () => {
    try {
      await handleInboundSms(msg);
    } catch (err) {
      log.error('inbound_handler_uncaught', {
        message: err instanceof Error ? err.message : 'unknown',
      });
    }
  });

  return new NextResponse('', { status: 200 });
}

function movedMessage(number: string): string {
  return `Heads up, I have a new number! Save ${number} and text me there from now on. I'll answer this one from it too.`;
}
