// SMS segment + encoding analysis (instrumentation for the messaging-cost work —
// see claude_files/specs/messaging-cost-levers.md, Section A.1).
//
// Twilio bills per SEGMENT, and segment size depends on encoding:
//   - GSM-7 (the default 7-bit alphabet): 160 chars single / 153 chars per concatenated segment.
//   - UCS-2 (forced the instant ANY character is outside GSM-7): 70 / 67.
// So a single non-GSM-7 glyph (✓, →, an em dash, an emoji) more than halves the per-segment
// budget and can turn a 1-segment reply into 3. This module is pure + testable; it computes the
// encoding, segment count, and which characters (if any) forced UCS-2 — so logs can prove or
// disprove the hypothesis with real traffic before we change any user-facing copy.

/**
 * GSM 03.38 basic alphabet — each character costs 1 septet. (ESC/0x1B is the extension marker and
 * is intentionally excluded; a literal ESC isn't meaningful in our copy.)
 */
const GSM7_BASIC = new Set(
  [
    '@£$¥èéùìòÇ',
    '\nØø\rÅå',
    'Δ_ΦΓΛΩΠΨΣΘΞ',
    'ÆæßÉ',
    " !\"#¤%&'()*+,-./",
    '0123456789:;<=>?',
    '¡ABCDEFGHIJKLMNO',
    'PQRSTUVWXYZÄÖÑÜ§',
    '¿abcdefghijklmno',
    'pqrstuvwxyzäöñüà',
  ]
    .join('')
    .split(''),
);

/** GSM 03.38 extension table — each costs 2 septets (an ESC prefix + the char). */
const GSM7_EXTENSION = new Set('\f^{}\\[~]|€'.split(''));

export interface SegmentInfo {
  /** User-perceived length in Unicode code points. */
  chars: number;
  encoding: 'gsm7' | 'ucs2';
  /** Number of SMS segments Twilio would bill for this body. */
  segments: number;
  /** Unique characters that are NOT GSM-7 encodable (what forced UCS-2). Empty when gsm7. */
  nonGsmChars: string[];
}

/**
 * Analyze a message body for SMS encoding + segmentation. Pure.
 * Note: WhatsApp is NOT billed per segment, so callers should only treat `segments` as a cost
 * signal on the `sms` channel.
 */
export function analyzeSegments(text: string): SegmentInfo {
  let septets = 0;
  let gsmOk = true;
  const nonGsm = new Set<string>();

  for (const ch of text) {
    // for…of iterates by code point, so astral chars (emoji) arrive whole
    if (GSM7_BASIC.has(ch)) septets += 1;
    else if (GSM7_EXTENSION.has(ch)) septets += 2;
    else {
      gsmOk = false;
      nonGsm.add(ch);
    }
  }

  const chars = [...text].length;

  if (gsmOk) {
    const segments = septets <= 160 ? 1 : Math.ceil(septets / 153);
    return { chars, encoding: 'gsm7', segments: Math.max(1, segments), nonGsmChars: [] };
  }

  // UCS-2: Twilio counts UTF-16 code units (a non-BMP emoji is a surrogate pair = 2 units).
  const units = text.length;
  const segments = units <= 70 ? 1 : Math.ceil(units / 67);
  return { chars, encoding: 'ucs2', segments: Math.max(1, segments), nonGsmChars: [...nonGsm] };
}

/**
 * Split non-GSM characters into log-safe symbols vs a bare count of letters, for logging.
 * Letters (CJK / Cyrillic / Arabic / Latin-extended) can be vendor/attendee name fragments — i.e.
 * PII — so we NEVER write them to logs (DEC-003 / Jordan principle #3); we only count them. The
 * cost culprits we actually diagnose (✓, →, —, curly quotes, emoji) are symbols/punctuation that
 * carry no identity, so they're safe to surface. Pure + testable.
 */
export function redactNonGsmForLog(nonGsmChars: string[]): { symbols: string[]; letterCount: number } {
  const symbols: string[] = [];
  let letterCount = 0;
  for (const ch of nonGsmChars) {
    if (/\p{L}/u.test(ch)) letterCount += 1;
    else symbols.push(ch);
  }
  return { symbols, letterCount };
}
