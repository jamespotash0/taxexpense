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
  raw_text: string;
  confidence: number;
}

// Media types Claude vision accepts. Others (e.g. HEIC) fall back to jpeg for the OCR
// call (Twilio transcodes MMS to jpeg in practice).
const VISION_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
function visionMediaType(contentType: string): string {
  return VISION_TYPES.has(contentType) ? contentType : 'image/jpeg';
}

/**
 * Download an MMS photo from Twilio into memory (NO storage write). We OCR from these
 * bytes first and only persist to Storage once we know the image will be linked to a
 * receipt — this prevents orphaned uploads from non-receipt / unmatched photos.
 */
export async function fetchTwilioMedia(twilioMediaUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  const sid = requireEnv('TWILIO_ACCOUNT_SID');
  const token = requireEnv('TWILIO_AUTH_TOKEN');
  // Twilio media requires basic auth; use the Authorization header (don't inline creds in URL).
  const res = await fetch(twilioMediaUrl, {
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}` },
  });
  if (!res.ok) throw new Error(`twilio_media_fetch_failed_${res.status}`);
  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

/** Remove every stored photo for a user (account deletion / data-purge — SEC-001). */
export async function deleteAllUserPhotos(userId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage.from(RECEIPTS_BUCKET).list(userId);
  if (error || !data || data.length === 0) return;
  const paths = data.map((f) => `${userId}/${f.name}`);
  await admin.storage.from(RECEIPTS_BUCKET).remove(paths);
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
): Promise<{ ocr: OcrResult; category: CategoryResult | null }> {
  try {
    const note = caption.trim() ? `\n\n## Note the user texted with the photo\n${caption.trim()}` : '';
    const parsed = await claudeJSON<ExtractedReceipt & { error?: string } & RawCategoryFields>({
      model: HAIKU_MODEL,
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
    raw_text: parsed.raw_text ?? text,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
  };
}

/**
 * Merged parse + categorize for a text-only expense (one Haiku call) — DEC-063.
 * Replaces the parse-then-categorize two-call chain on the SMS new-expense text path.
 */
export async function parseAndCategorizeText(
  text: string,
  user: AppUser,
): Promise<{ parsed: ParsedTextExpense; category: CategoryResult }> {
  const raw = await claudeJSON<Partial<ParsedTextExpense> & RawCategoryFields>({
    model: HAIKU_MODEL,
    system: TEXT_PARSE_CATEGORIZE_PROMPT,
    userText: `## User Context\n${userContextLine(user)}\n\n## Message\n${text}`,
    cacheSystem: true,
  });
  return {
    parsed: {
      amount: raw.amount ?? null,
      vendor: raw.vendor ?? null,
      transaction_date: raw.transaction_date ?? null,
      attendees: raw.attendees ?? null,
      business_purpose: raw.business_purpose ?? null,
      business_miles: raw.business_miles ?? null,
      raw_text: raw.raw_text ?? text,
      confidence: typeof raw.confidence === 'number' ? raw.confidence : 0,
    },
    category: toCategoryResult(raw),
  };
}

export { RECEIPTS_BUCKET };
