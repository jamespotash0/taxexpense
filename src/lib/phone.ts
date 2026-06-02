// Phone number normalization. Users are keyed by E.164 phone (DEC-003, DEC-006).
// Twilio sends E.164 already (e.g. +14155551234), but normalize defensively.

/**
 * Normalize a US phone number to E.164 (+1XXXXXXXXXX).
 * Returns null if it can't be confidently normalized.
 */
export function normalizeToE164(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^\+\d{8,15}$/.test(trimmed)) return trimmed; // already E.164
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`; // bare US 10-digit
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}
