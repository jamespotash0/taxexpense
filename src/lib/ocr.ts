// Receipt extraction + photo storage + text-expense parsing.
// OWNER: Raj. TSNAP-018 (storage), TSNAP-019 (OCR), TSNAP-020 (text parse).
//
// Security (Jordan / SEC-001): the `receipts` Storage bucket MUST be private (codified in
// migration 0015 + a RESTRICTIVE storage.objects policy). We never return public URLs — only
// short-lived signed URLs. Twilio media URLs require basic-auth with the account SID/token.

import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from './supabase';
import { claudeJSON } from './llm';
import { HAIKU_MODEL } from './claude';
import {
  RECEIPT_EXTRACTION_PROMPT,
  TEXT_EXPENSE_PARSE_PROMPT,
  TEXT_PARSE_CATEGORIZE_PROMPT,
  RECEIPT_EXTRACT_CATEGORIZE_PROMPT,
} from './prompts';
import { normalizeCategoryResult, userContextLine, type CategoryResult } from './categorize';
import type { AppUser } from './users';
import { requireEnv } from './env';

/** Raw category fields the merged extract+categorize prompts add to the JSON payload.
 *  Namespaced so they don't collide with the extraction `confidence`. */
interface RawCategoryFields {
  category?: string;
  category_confidence?: number;
  category_reasoning?: string;
}

function toCategoryResult(raw: RawCategoryFields): CategoryResult {
  return normalizeCategoryResult({
    category: raw.category,
    confidence: raw.category_confidence,
    reasoning: raw.category_reasoning,
  });
}

const RECEIPTS_BUCKET = 'receipts';
// Signed receipt URLs are minted fresh on each dashboard/receipt-detail render, so they only
// need to outlive a single page view. A short TTL shrinks the window in which a leaked URL
// (browser history, shared screenshot, proxy log) is still live. 5 min covers render + image
// load with margin; a reload re-mints.
const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes

export interface ExtractedReceipt {
  vendor: string | null;
  total_amount: number | null;
  transaction_date: string | null;
  items: string[];
  payment_method: string | null;
  location_city: string | null;
  confidence: number;
}

export type OcrResult =
  | { ok: true; data: ExtractedReceipt }
  | { ok: false; error: 'not_a_receipt' | 'unreadable' };

export interface ParsedTextExpense {
  amount: number | null;
  vendor: string | null;
  transaction_date: string | null;
  attendees: string | null;
  business_purpose: string | null;
  business_miles: number | null;
  location_city: string | null;
  raw_text: string;
  confidence: number;
}

const MAX_ADDITIONAL_PER_TEXT = 5;
const MEDIA_TIMEOUT_MS = 10_000;
const MEDIA_MAX_BYTES = 10 * 1024 * 1024; // matches the receipts bucket limit (migration 0035)

// Media types Claude vision accepts. Others (e.g. HEIC) fall back to jpeg for the OCR
// call (Twilio transcodes MMS to jpeg in practice).
const VISION_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
function visionMediaType(contentType: string): string {
  return VISION_TYPES.has(contentType) ? contentType : 'image/jpeg';
}

/**
 * Download an inbound photo (Twilio or Linq) into memory (NO storage write). We OCR from these
 * bytes first and only persist to Storage once we know the image will be linked to a
 * receipt — this prevents orphaned uploads from non-receipt / unmatched photos.
 */
export async function fetchInboundMedia(mediaUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  const url = new URL(mediaUrl);
  const host = url.hostname;
  const isLinqHost = host === 'linqapp.com' || host.endsWith('.linqapp.com');
  const isTwilioHost = host === 'api.twilio.com' || host.endsWith('.twilio.com');
  // Exact allowlist: credentials only ever go to their own provider, and nothing else is fetched.
  if (url.protocol !== 'https:' || (!isLinqHost && !isTwilioHost)) throw new Error('media_host_not_allowed');
  const signal = AbortSignal.timeout(MEDIA_TIMEOUT_MS);

  let res: Response;
  if (isLinqHost) {
    // Linq attachment URLs are typically pre-signed (an extra auth header can break those);
    // the docs don't say, so fall back to the API key if the plain fetch is refused.
    res = await fetch(mediaUrl, { signal });
    if (res.status === 401 || res.status === 403) {
      res = await fetch(mediaUrl, { signal, headers: { Authorization: `Bearer ${requireEnv('LINQ_API_KEY')}` } });
    }
  } else {
    const sid = requireEnv('TWILIO_ACCOUNT_SID');
    const token = requireEnv('TWILIO_AUTH_TOKEN');
    // Twilio media requires basic auth; use the Authorization header (don't inline creds in URL).
    res = await fetch(mediaUrl, {
      signal,
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}` },
    });
  }
  if (!res.ok) throw new Error(`media_fetch_failed_${res.status}`);
  const contentType = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim().toLowerCase();
  // Only images reach OCR; a video/PDF used to be mislabeled jpeg and burn two model calls.
  if (!contentType.startsWith('image/')) throw new Error('media_not_image');
  if (Number(res.headers.get('content-length') ?? 0) > MEDIA_MAX_BYTES) throw new Error('media_too_large');
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MEDIA_MAX_BYTES) throw new Error('media_too_large');
  return { buffer, contentType };
}

/** Remove every stored photo for a user (account deletion / data-purge — SEC-001). */
export async function deleteAllUserPhotos(userId: string): Promise<void> {
  const bucket = getSupabaseAdmin().storage.from(RECEIPTS_BUCKET);
  // list() pages (default 100). Always read offset 0: each pass removes what it listed.
  for (;;) {
    const { data, error } = await bucket.list(userId, { limit: 1000 });
    if (error) throw error;
    if (!data?.length) return;
    const { error: rmErr } = await bucket.remove(data.map((f) => `${userId}/${f.name}`));
    if (rmErr) throw rmErr;
  }
}

/** Store a photo provided as a buffer (dashboard upload, TSNAP-041). */
export async function storePhotoBuffer(
  buffer: Buffer,
  contentType: string,
  userId: string,
): Promise<{ path: string; signedUrl: string }> {
  const ext = contentType.includes('png') ? 'png' : contentType.includes('pdf') ? 'pdf' : 'jpg';
  const path = `${userId}/${randomUUID()}.${ext}`;
  const admin = getSupabaseAdmin();
  const { error: upErr } = await admin.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, buffer, { contentType, upsert: false });
  if (upErr) throw upErr;
  const { data: signed, error: signErr } = await admin.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signErr || !signed) throw signErr ?? new Error('sign_url_failed');
  return { path, signedUrl: signed.signedUrl };
}

/** Mint a fresh signed URL for an already-stored receipt path. */
export async function getSignedReceiptUrl(path: string): Promise<string> {
  const { data, error } = await getSupabaseAdmin().storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) throw error ?? new Error('sign_url_failed');
  return data.signedUrl;
}

function toOcrResult(parsed: ExtractedReceipt & { error?: string }): OcrResult {
  if (parsed.error === 'not_a_receipt') return { ok: false, error: 'not_a_receipt' };
  if (parsed.error === 'unreadable') return { ok: false, error: 'unreadable' };
  return {
    ok: true,
    data: {
      vendor: parsed.vendor ?? null,
      total_amount: parsed.total_amount ?? null,
      transaction_date: parsed.transaction_date ?? null,
      items: Array.isArray(parsed.items) ? parsed.items : [],
      payment_method: parsed.payment_method ?? null,
      location_city: parsed.location_city ?? null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    },
  };
}

/**
 * Merged extract + categorize from in-memory image bytes (one Haiku call) — DEC-063.
 * Replaces the OCR-then-categorize two-call chain on the SMS new-expense photo path.
 * `caption` is any text the user sent with the photo; it gives the categorizer the same
 * business-context signal the standalone path got via business_purpose. Returns the OCR
 * result plus the category (null when the image isn't a usable receipt).
 */
export async function extractAndCategorizeReceiptFromImageData(
  buffer: Buffer,
  contentType: string,
  user: AppUser,
  caption: string,
  model: string = HAIKU_MODEL,
): Promise<{ ocr: OcrResult; category: CategoryResult | null }> {
  try {
    const note = caption.trim() ? `\n\n## Note the user texted with the photo\n${caption.trim()}` : '';
    const parsed = await claudeJSON<ExtractedReceipt & { error?: string } & RawCategoryFields>({
      model,
      system: RECEIPT_EXTRACT_CATEGORIZE_PROMPT,
      userText: `Extract the receipt data and categorize the expense.\n\n## User Context\n${userContextLine(user)}${note}`,
      imageBase64: buffer.toString('base64'),
      imageMediaType: visionMediaType(contentType),
      cacheSystem: true,
    });
    const ocr = toOcrResult(parsed);
    return { ocr, category: ocr.ok ? toCategoryResult(parsed) : null };
  } catch {
    return { ocr: { ok: false, error: 'unreadable' }, category: null };
  }
}

/** Extract receipt data from an already-stored photo via signed URL (dashboard path). */
export async function extractReceiptFromPhoto(photoUrl: string): Promise<OcrResult> {
  try {
    const parsed = await claudeJSON<ExtractedReceipt & { error?: string }>({
      model: HAIKU_MODEL,
      system: RECEIPT_EXTRACTION_PROMPT,
      userText: 'Extract receipt data.',
      imageUrl: photoUrl,
      cacheSystem: true,
    });
    return toOcrResult(parsed);
  } catch {
    return { ok: false, error: 'unreadable' };
  }
}

/** Parse a text-only expense description via Haiku 4.5. (TSNAP-020) */
export async function parseTextExpense(text: string): Promise<ParsedTextExpense> {
  const parsed = await claudeJSON<Partial<ParsedTextExpense>>({
    model: HAIKU_MODEL,
    system: TEXT_EXPENSE_PARSE_PROMPT,
    userText: text,
    cacheSystem: true,
  });
  return {
    amount: parsed.amount ?? null,
    vendor: parsed.vendor ?? null,
    transaction_date: parsed.transaction_date ?? null,
    attendees: parsed.attendees ?? null,
    business_purpose: parsed.business_purpose ?? null,
    business_miles: parsed.business_miles ?? null,
    location_city: parsed.location_city ?? null,
    raw_text: parsed.raw_text ?? text,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
  };
}

/** One additional distinct charge found in the same text (DEC-083). Slim: the parsed expense fields
 *  + its own category, ready to log via processNewExpense's precomputed-category path. */
export interface ParsedAdditionalExpense {
  parsed: ParsedTextExpense;
  category: CategoryResult;
}

/** Raw additional-charge object as the merged prompt returns it (same fields as the top level). */
type RawAdditional = Partial<ParsedTextExpense> & RawCategoryFields;

/** The message's only number IS the parsed amount ("100 grocery", "$1,200 lens"), so there is
 *  nothing to misread and no conflicting figure: the "did I read that right?" check is noise.
 *  Two+ numbers (overrides, splits, dates) fall back to the model's own confidence. */
export function amountIsUnambiguous(text: string, amount: number | null): boolean {
  if (amount == null) return false;
  const nums = text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  return nums.length === 1 && Number(nums[0].replace(/,/g, '')) === amount;
}

function toParsedExpense(raw: Partial<ParsedTextExpense>, fallbackText: string): ParsedTextExpense {
  const confidence = typeof raw.confidence === 'number' ? raw.confidence : 0;
  return {
    amount: raw.amount ?? null,
    vendor: raw.vendor ?? null,
    transaction_date: raw.transaction_date ?? null,
    attendees: raw.attendees ?? null,
    business_purpose: raw.business_purpose ?? null,
    business_miles: raw.business_miles ?? null,
    location_city: raw.location_city ?? null,
    raw_text: raw.raw_text ?? fallbackText,
    confidence: amountIsUnambiguous(fallbackText, raw.amount ?? null) ? Math.max(confidence, 0.9) : confidence,
  };
}

/**
 * Merged parse + categorize for a text-only expense (one Haiku call) — DEC-063.
 * Replaces the parse-then-categorize two-call chain on the SMS new-expense text path.
 * `additional` carries any SEPARATE charges named in the same message (DEC-083) — empty for the
 * common single-expense case, so callers that don't opt into multi-capture are unaffected.
 */
export async function parseAndCategorizeText(
  text: string,
  user: AppUser,
): Promise<{ parsed: ParsedTextExpense; category: CategoryResult; additional: ParsedAdditionalExpense[] }> {
  const raw = await claudeJSON<Partial<ParsedTextExpense> & RawCategoryFields & { additional_expenses?: RawAdditional[] }>({
    model: HAIKU_MODEL,
    system: TEXT_PARSE_CATEGORIZE_PROMPT,
    userText: `## User Context\n${userContextLine(user)}\n\n## Message\n${text}`,
    cacheSystem: true,
  });
  // Only keep additional charges that actually carry a usable amount or mileage — drop empty/garbage
  // objects so we never log a $0 phantom from an over-eager split.
  const additional: ParsedAdditionalExpense[] = (Array.isArray(raw.additional_expenses) ? raw.additional_expenses : [])
    .filter((a) => a && (a.amount != null || a.business_miles != null))
    // Cap: one text can't log an unbounded batch past the daily receipt cap (checked once, before
    // parsing), each with its own downstream model calls. Five covers real "gas $40, lunch $12..." texts.
    .slice(0, MAX_ADDITIONAL_PER_TEXT)
    .map((a) => ({ parsed: toParsedExpense(a, text), category: toCategoryResult(a) }));
  return {
    parsed: toParsedExpense(raw, text),
    category: toCategoryResult(raw),
    additional,
  };
}

export { RECEIPTS_BUCKET };
