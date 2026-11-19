// POST /api/linq/inbound — Linq inbound message webhook (used when MESSAGING_PROVIDER=linq).
// The Twilio webhook at /api/sms/inbound stays in place as the alternative provider.
//
// 1. Verify the Standard Webhooks signature over the RAW body (Jordan: non-negotiable).
// 2. Parse message.received into an InboundMessage; ignore every other event type.
// 3. Ack 200 immediately and process in after(): Linq retries anything not acked within 10s,
//    and OCR + Sonnet can take longer, which would otherwise log duplicate expenses.

import { NextResponse, after } from 'next/server';
import { verifyLinqSignature, parseLinqInbound } from '@/lib/linq';
import { handleInboundSms } from '@/lib/sms-handler';
import { optionalEnv } from '@/lib/env';
import { log } from '@/lib/log';

export const maxDuration = 30;

export async function POST(req: Request): Promise<NextResponse> {
  const raw = await req.text();
  const valid = verifyLinqSignature(
    req.headers.get('webhook-id'),
    req.headers.get('webhook-timestamp'),
    req.headers.get('webhook-signature'),
    raw,
  );
  // Local-only escape hatch for manual testing without a real signature. NEVER in prod.
  const devBypass =
    process.env.NODE_ENV !== 'production' && optionalEnv('ALLOW_INSECURE_SMS_WEBHOOK') === '1';
  if (!valid && !devBypass) {
    log.warn('linq_signature_invalid');
    return new NextResponse('Forbidden', { status: 403 });
  }

  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }

  const msg = parseLinqInbound(event as Parameters<typeof parseLinqInbound>[0]);
  if (msg) {
    after(async () => {
      try {
        await handleInboundSms(msg);
      } catch (err) {
        log.error('inbound_handler_uncaught', {
          message: err instanceof Error ? err.message : 'unknown',
        });
      }
    });
  }
  return new NextResponse('', { status: 200 });
}
