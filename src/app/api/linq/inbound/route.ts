// POST /api/linq/inbound — Linq inbound message webhook (used when MESSAGING_PROVIDER=linq).
// The Twilio webhook at /api/sms/inbound stays in place as the alternative provider.
//
// 1. Verify the Standard Webhooks signature over the RAW body (Jordan: non-negotiable).
// 2. Route by event: message.received → the normal handler; message.edited → correct the receipt
//    that message created (DEC-087); message.failed → log it so a lost reply is visible.
//    Everything else is acked and ignored.
// 3. Ack 200 immediately and process in after(): Linq retries anything not acked within 10s,
//    and OCR + Sonnet can take longer, which would otherwise log duplicate expenses.

import { NextResponse, after } from 'next/server';
import { verifyLinqSignature, parseLinqInbound, parseLinqEdit, showReadAndTyping, type LinqEvent } from '@/lib/linq';
import { handleInboundSms, handleInboundEdit } from '@/lib/sms-handler';
import { optionalEnv } from '@/lib/env';
import { claimWebhookEvent } from '@/lib/idempotency';
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

  const parsed = event as LinqEvent;

  if (parsed.event_type === 'message.failed') {
    // A reply that never reached the user. No PII: ids + Linq's error code/reason only.
    log.error('linq_message_failed', {
      code: parsed.data?.code ?? null,
      reason: parsed.data?.reason ?? null,
      service: parsed.data?.service ?? null,
      messageId: parsed.data?.message_id ?? null,
    });
    return new NextResponse('', { status: 200 });
  }

  // Standard Webhooks keeps webhook-id stable across retries: a repeat id is a redelivery of
  // something already processed (or in flight), so ack and skip. Without this a lost ack meant
  // a duplicate expense, a second LLM bill and a second reply.
  const webhookId = req.headers.get('webhook-id');
  if (webhookId && !(await claimWebhookEvent(`linq:${webhookId}`))) {
    return new NextResponse('', { status: 200 });
  }

  const edit = parseLinqEdit(parsed);
  if (edit) {
    after(async () => {
      try {
        await showReadAndTyping(edit.chatId);
        await handleInboundEdit(edit);
      } catch (err) {
        log.error('inbound_edit_uncaught', { message: err instanceof Error ? err.message : 'unknown' });
      }
    });
    return new NextResponse('', { status: 200 });
  }

  const msg = parseLinqInbound(parsed);
  if (msg) {
    // How long Linq took to hand us the text (webhook-timestamp = when Linq sent it). Separates
    // "Linq was slow" from "we were slow" when a reply feels late.
    const sentSec = Number(req.headers.get('webhook-timestamp'));
    if (sentSec) log.info('linq_inbound_lag', { ms: Date.now() - sentSec * 1000 });
    after(async () => {
      try {
        // "Read" + "..." while Penny thinks, like a friend about to reply.
        if (msg.linq) await showReadAndTyping(msg.linq.chatId);
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
