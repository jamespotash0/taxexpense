// Phone number normalization. Users are keyed by E.164 phone (DEC-003, DEC-006).
// Twilio sends E.164 already (e.g. +14155551234), but normalize defensively.

/**
 * Normalize a US phone number to E.164 (+1XXXXXXXXXX).
 * Returns null if it can't be confidently normalized.
 *
 * US-ONLY by design (Tally is US-only, V1). We deliberately reject non-+1 numbers:
 * the public, unauthenticated request-code / hero-optin endpoints send SMS, so accepting
 * arbitrary international E.164 opens an SMS-pumping (toll-fraud) vector to premium-rate
 * numbers that the per-phone rate limit can't stop (attacker rotates numbers).
 */
export function normalizeToE164(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.trim().replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`; // bare US 10-digit
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`; // 1 + 10-digit / +1 E.164
  return null; // anything else (incl. non-US country codes) is rejected
}

/**
 * Format a US phone number for display as +1 (XXX) XXX-XXXX.
 *
 * Accepts E.164 (+14155551234), bare 10-digit, or already-formatted input.
 * If the value can't be confidently parsed as a US number, it's returned
 * unchanged so display never silently drops a number it doesn't understand.
 */
export function formatUsPhone(input: string | null | undefined): string {
  if (!input) return '';
  const e164 = normalizeToE164(input);
  if (!e164) return input.trim();
  const d = e164.slice(2); // strip leading +1 → 10 digits
  return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
