// Linq (iMessage / RCS / SMS) provider: outbound send, webhook signature check, inbound parse.
// Selected with MESSAGING_PROVIDER=linq; Twilio (./twilio.ts) stays wired as the alternative.
// API: Linq Partner API v3, https://docs.linqapp.com. Webhooks follow the Standard Webhooks spec.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { requireEnv, optionalEnv } from './env';
import type { InboundMessage } from './sms-handler';

const LINQ_API = 'https://api.linqapp.com/api/partner/v3';

/**
 * Send a text. POST /v3/messages lets Linq pick the line and reuse the existing chat, and
 * (unlike POST /v3/chats) allows URLs in a first message, which our replies contain.
 * An opted-out recipient (they texted STOP) comes back as 403 / code 2024: don't retry it.
 */
export async function sendLinq(to: string, body: string): Promise<string> {
  const res = await fetch(`${LINQ_API}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireEnv('LINQ_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to: [to], message: { parts: [{ type: 'text', value: body }] } }),
  });
  if (!res.ok) throw new Error(`linq_send_failed_${res.status}`);
  const data = (await res.json()) as { message?: { id?: string } };
  return data.message?.id ?? '';
}

/**
 * The iMessage feel (DEC-086): mark the chat "Read" and show the "..." typing bubble while we
 * process. The bubble clears itself when our reply lands (or after ~90s). iMessage only; Linq
 * accepts and ignores it on SMS/RCS chats. Best-effort: never blocks or fails the reply.
 */
export async function showReadAndTyping(chatId: string): Promise<void> {
  const headers = { Authorization: `Bearer ${requireEnv('LINQ_API_KEY')}` };
  const base = `${LINQ_API}/chats/${encodeURIComponent(chatId)}`;
  await fetch(`${base}/read`, { method: 'POST', headers }).catch(() => {});
  await fetch(`${base}/typing`, { method: 'POST', headers }).catch(() => {});
}

/**
 * Verify a Linq webhook (Standard Webhooks): HMAC-SHA256 over `${id}.${timestamp}.${rawBody}`,
 * keyed with the base64 part of the `whsec_...` secret, compared against each `v1,<base64>`
 * entry in `webhook-signature`. Rejects timestamps more than 5 min off (replay protection).
 */
export function verifyLinqSignature(
  id: string | null,
  timestamp: string | null,
  signatureHeader: string | null,
  rawBody: string,
  nowMs: number = Date.now(),
): boolean {
  const secret = optionalEnv('LINQ_WEBHOOK_SECRET');
  if (!secret || !id || !timestamp || !signatureHeader) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowMs / 1000 - ts) > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest();
  return signatureHeader.split(' ').some((entry) => {
    const [version, sig] = entry.split(',');
    if (version !== 'v1' || !sig) return false;
    const got = Buffer.from(sig, 'base64');
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

interface LinqPart {
  type: string;
  value?: string;
  url?: string;
}

interface LinqEvent {
  event_type?: string;
  data?: {
    chat?: { id?: string };
    direction?: string;
    sender_handle?: { handle?: string };
    parts?: LinqPart[];
  };
}

/**
 * Turn a `message.received` event (webhook_version 2026-02-03, pinned via ?version= on the
 * subscription URL) into our InboundMessage. Anything else (delivery receipts, reactions,
 * our own outbound echoes) returns null and is acked without processing.
 */
export function parseLinqInbound(event: LinqEvent): InboundMessage | null {
  const d = event.data;
  if (event.event_type !== 'message.received' || !d || d.direction !== 'inbound') return null;
  const from = d.sender_handle?.handle;
  if (!from) return null;
  const parts = d.parts ?? [];
  const body = parts
    .filter((p) => p.type === 'text' && p.value)
    .map((p) => p.value)
    .join('\n');
  const mediaUrls = parts.filter((p) => p.type === 'media' && p.url).map((p) => p.url as string);
  return { from, body, numMedia: mediaUrls.length, mediaUrls, channel: 'sms' };
}
