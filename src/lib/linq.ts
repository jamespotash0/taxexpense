// Linq (iMessage / RCS / SMS) provider: outbound send, iMessage extras, webhook signature check,
// inbound parse. Selected with MESSAGING_PROVIDER=linq; Twilio (./twilio.ts) stays wired as the
// alternative. API: Linq Partner API v3, https://docs.linqapp.com (Standard Webhooks).
//
// iMessage extras (DEC-087): tapbacks, threaded replies, screen effects, contact card. All are
// best-effort and iMessage-only; the plain text reply always carries the real information, so
// Android/SMS users (and any Linq hiccup) lose nothing.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { requireEnv, optionalEnv } from './env';
import { log } from './log';
import type { InboundMessage } from './sms-handler';

const LINQ_API = 'https://api.linqapp.com/api/partner/v3';

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${requireEnv('LINQ_API_KEY')}`, 'Content-Type': 'application/json' };
}

/** Optional iMessage extras for one outbound message. */
export interface SendOptions {
  /** The Linq chat to send in (from the inbound webhook). Without it Linq resolves the chat by number. */
  chatId?: string;
  /** Thread the reply under this message (e.g. the receipt photo a follow-up question is about). */
  replyTo?: string;
  /** Full-screen iMessage effect, e.g. 'confetti'. Ignored on SMS/RCS. */
  effect?: 'confetti' | 'celebration' | 'balloons' | 'fireworks' | 'sparkles';
}

async function postMessage(to: string, body: string, opts: SendOptions): Promise<Response> {
  const message: Record<string, unknown> = { parts: [{ type: 'text', value: body }] };
  if (opts.replyTo) message.reply_to = { message_id: opts.replyTo };
  if (opts.effect) message.effect = { type: 'screen', name: opts.effect };
  // An existing chat → send into it; otherwise POST /v3/messages lets Linq pick the line and allows
  // URLs in a first message (POST /v3/chats does not), which our replies contain.
  return opts.chatId
    ? fetch(`${LINQ_API}/chats/${encodeURIComponent(opts.chatId)}/messages`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ message }),
      })
    : fetch(`${LINQ_API}/messages`, { method: 'POST', headers: headers(), body: JSON.stringify({ to: [to], message }) });
}

/**
 * Send a text. If Linq rejects the extras (reply_to on an inbound id and effects are documented
 * loosely), retry once as a plain text so the reply always lands. An opted-out recipient (they
 * texted STOP) is 403 / code 2024: not retried.
 */
export async function sendLinq(to: string, body: string, opts: SendOptions = {}): Promise<string> {
  let res = await postMessage(to, body, opts);
  // Any rejection with extras attached (e.g. a feature the shared line doesn't support) → plain retry.
  if (!res.ok && (opts.replyTo || opts.effect)) {
    log.warn('linq_extras_rejected', { replyTo: !!opts.replyTo, effect: opts.effect ?? null });
    res = await postMessage(to, body, { chatId: opts.chatId });
  }
  if (!res.ok) throw new Error(`linq_send_failed_${res.status}`);
  const data = (await res.json()) as { message?: { id?: string }; id?: string };
  return data.message?.id ?? data.id ?? '';
}

/**
 * The iMessage feel (DEC-086): mark the chat "Read" and show the "..." typing bubble while we
 * process. The bubble clears itself when our reply lands (or after ~90s). Best-effort.
 */
export async function showReadAndTyping(chatId: string): Promise<void> {
  const base = `${LINQ_API}/chats/${encodeURIComponent(chatId)}`;
  await fetch(`${base}/read`, { method: 'POST', headers: headers() }).catch(() => {});
  await fetch(`${base}/typing`, { method: 'POST', headers: headers() }).catch(() => {});
}

/** Tapback a message (❤️ / 👍). Best-effort; iMessage only. */
export async function reactLinq(messageId: string, type: 'love' | 'like'): Promise<void> {
  const res = await fetch(`${LINQ_API}/messages/${encodeURIComponent(messageId)}/reactions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ operation: 'add', type }),
  }).catch(() => null);
  if (res && !res.ok) log.warn('linq_reaction_failed', { status: res.status });
}

/**
 * Drop Penny's contact card (name + photo) into a chat so she shows up as "Penny" instead of a
 * number. Needs a prior outbound message in the chat. NOT supported on Linq's shared (free) line
 * (403 / 2005), so it's off unless LINQ_CONTACT_CARD=1; on a dedicated line, create the card once
 * with POST /v3/contact_card (see JOURNAL DEC-087), then set the flag. Returns whether it was shared.
 */
export async function shareContactCard(chatId: string): Promise<boolean> {
  if (optionalEnv('LINQ_CONTACT_CARD') !== '1') return false;
  const res = await fetch(`${LINQ_API}/chats/${encodeURIComponent(chatId)}/share_contact_card`, {
    method: 'POST',
    headers: headers(),
  }).catch(() => null);
  if (res && !res.ok) log.warn('linq_contact_card_failed', { status: res.status });
  return !!res?.ok;
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

export interface LinqEvent {
  event_type?: string;
  data?: {
    id?: string;
    chat?: { id?: string };
    direction?: string;
    sender_handle?: { handle?: string };
    parts?: LinqPart[];
    // message.edited
    part?: { index?: number; text?: string };
    // message.failed
    chat_id?: string;
    message_id?: string;
    code?: number;
    reason?: string;
    service?: string | null;
  };
}

/**
 * Turn a `message.received` event (webhook_version 2026-02-03, pinned via ?version= on the
 * subscription URL) into our InboundMessage. Anything else returns null.
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
  const linq = d.id && d.chat?.id ? { messageId: d.id, chatId: d.chat.id } : undefined;
  return { from, body, numMedia: mediaUrls.length, mediaUrls, channel: 'sms', linq };
}

/** A user edited one of their texts in iMessage (`message.edited`, inbound only). */
export interface LinqEdit {
  from: string;
  messageId: string;
  chatId: string;
  text: string;
}

export function parseLinqEdit(event: LinqEvent): LinqEdit | null {
  const d = event.data;
  if (event.event_type !== 'message.edited' || !d || d.direction !== 'inbound') return null;
  const from = d.sender_handle?.handle;
  const text = d.part?.text?.trim();
  if (!from || !d.id || !d.chat?.id || !text) return null;
  return { from, messageId: d.id, chatId: d.chat.id, text };
}
