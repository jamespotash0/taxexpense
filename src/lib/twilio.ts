// Twilio client + outbound SMS + webhook signature validation.
// Jordan/Raj: webhook signature validation is NON-NEGOTIABLE from day 1 — without
// it anyone can POST forged SMS to /api/sms/inbound. The actual verification is
// called in the route handler (EPIC-2); the helper lives here.

import twilio from 'twilio';
import { requireEnv, optionalEnv } from './env';

let _client: ReturnType<typeof twilio> | null = null;

function getTwilio() {
  if (_client) return _client;
  _client = twilio(requireEnv('TWILIO_ACCOUNT_SID'), requireEnv('TWILIO_AUTH_TOKEN'));
  return _client;
}

/** Send an outbound SMS from our configured Twilio number. */
export async function sendSms(to: string, body: string): Promise<string> {
  const message = await getTwilio().messages.create({
    to,
    from: requireEnv('TWILIO_PHONE_NUMBER'),
    body,
  });
  return message.sid;
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
