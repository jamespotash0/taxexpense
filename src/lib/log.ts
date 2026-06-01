// Logging helpers. DEC-003 / Jordan: NEVER log full phone numbers or PII.
// Use maskPhone() for any phone value that reaches a log line.

/** Mask a phone number to its last 4 digits, e.g. +14155551234 -> ***1234. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '***';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***${digits.slice(-4)}`;
}

type LogFields = Record<string, unknown>;

/** Structured log line. Caller is responsible for not passing raw PII. */
function emit(level: 'info' | 'warn' | 'error', event: string, fields: LogFields = {}) {
  const line = { level, event, ...fields, ts: new Date().toISOString() };
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  out(JSON.stringify(line));
}

export const log = {
  info: (event: string, fields?: LogFields) => emit('info', event, fields),
  warn: (event: string, fields?: LogFields) => emit('warn', event, fields),
  error: (event: string, fields?: LogFields) => emit('error', event, fields),
};
