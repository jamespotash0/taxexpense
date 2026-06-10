// Twilio client + outbound SMS + webhook signature validation.
// Jordan/Raj: webhook signature validation is NON-NEGOTIABLE from day 1 — without
// it anyone can POST forged SMS to /api/sms/inbound. The actual verification is
// called in the route handler (EPIC-2); the helper lives here.

import twilio from 'twilio';
import { requireEnv, optionalEnv } from './env';
import { analyzeSegments, redactNonGsmForLog } from './sms-segments';
import { log } from './log';

let _client: ReturnType<typeof twilio> | null = null;

function getTwilio() {
  if (_client) return _client;
  _client = twilio(requireEnv('TWILIO_ACCOUNT_SID'), requireEnv('TWILIO_AUTH_TOKEN'));
  return _client;
}

export type Channel = 'sms' | 'whatsapp';

/**
 * Send an outbound message on the given channel. WhatsApp uses the same Twilio API with
 * `whatsapp:` address prefixes and a WhatsApp-enabled sender (TWILIO_WHATSAPP_FROM, e.g.
 * "whatsapp:+14155238886" — the Twilio sandbox number works for testing).
 */
export async function sendMessage(to: string, body: string, channel: Channel = 'sms'): Promise<string> {
  const from =
    channel === 'whatsapp'
      ? requireEnv('TWILIO_WHATSAPP_FROM') // already "whatsapp:+1..."
      : requireEnv('TWILIO_PHONE_NUMBER');
  const toAddr = channel === 'whatsapp' ? `whatsapp:${to}` : to;

  // Instrumentation only (messaging-cost-levers.md A.1): record encoding + segment count so we can
  // measure the real cost of UCS-2-forcing glyphs (✓, →, emoji) before changing copy. PII-safe —
  // we log derived metrics and the offending NON-GSM symbols only, never the body (names/amounts
  // are GSM-7 and so never surface here). WhatsApp isn't segment-billed, so we only log for SMS.
  if (channel === 'sms') {
    const seg = analyzeSegments(body);
    const { symbols, letterCount } = redactNonGsmForLog(seg.nonGsmChars);
    log.info('sms_segments', {
      encoding: seg.encoding,
      segments: seg.segments,
      chars: seg.chars,
      nonGsmSymbols: symbols.slice(0, 10),
      nonGsmLetterCount: letterCount,
    });
  }

  const message = await getTwilio().messages.create({ to: toAddr, from, body });
  return message.sid;
}

/** Backwards-compatible SMS helper (OTP, reminders). */
export async function sendSms(to: string, body: string): Promise<string> {
  return sendMessage(to, body, 'sms');
}

/**
 * Validate an inbound Twilio webhook signature.
 * @param signature  Value of the `X-Twilio-Signature` request header.
 * @param url        The full public URL Twilio POSTed to (must match exactly).
 * @param params     The parsed application/x-www-form-urlencoded body params.
 */
export function validateTwilioSignature(
  signature: string | null,
  url: string,
  params: Record<string, string>,
): boolean {
  if (!signature) return false;
  const authToken = optionalEnv('TWILIO_AUTH_TOKEN');
  if (!authToken) return false;
  return twilio.validateRequest(authToken, signature, url, params);
}
