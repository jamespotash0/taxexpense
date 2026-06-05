// Expense orchestration (the "workflow" — code controls flow, DEC-011).
// processNewExpense  (TSNAP-021/022): categorize → rule → decision tree → save → compose
// processClarification (TSNAP-023, Prompt 4): apply a context answer, recompute, confirm
// processAttachment   (TSNAP-024, Prompt 5): match a late photo to a pending receipt

import { categorizeExpense, composeResponse, type ExpenseInput } from './categorize';
import {
  getSubstantiationRule,
  evaluateSubstantiation,
  MILEAGE_RATE_CENTS_PER_MILE,
  type SubstantiationRule,
} from './substantiation';
import { getIrcSummary } from './irc';
import { assessCategoryReview } from './review';
import { log } from './log';
import {
  saveReceipt,
  getReceipt,
  updateReceipt,
  findReceiptsAwaitingPhoto,
  type ReceiptRow,
} from './receipts';
import type { AppUser } from './users';
import type { ContextState } from './conversations';
import { claudeJSON } from './llm';
import { SONNET_MODEL } from './claude';
import { CLARIFICATION_PROMPT, RECEIPT_ATTACHMENT_PROMPT } from './prompts';
import { storePhotoBuffer, type OcrResult } from './ocr';

export interface ProcessResult {
  smsText: string;
  receiptId: string | null;
  contextState: ContextState | null;
  /** Structured payload persisted with the outbound (e.g. flag-disambiguation candidate ids). */
  pendingData?: import('./conversations').PendingData | null;
}

function generalFallback(category: string): SubstantiationRule {
  return {
    category,
    irc_section: '162',
    substantiation_level: 'general',
    receipt_threshold_cents: null,
    always_receipt: false,
    required_context_fields: [],
    deduction_percentage: 100,
    deduction_cap_cents: null,
  };
}

function capturedFrom(r: {
  attendees: string | null;
  business_purpose: string | null;
  business_relationship: string | null;
  location_city: string | null;
  business_miles: number | null;
}): Record<string, unknown> {
  return {
    attendees: r.attendees,
    business_purpose: r.business_purpose,
    business_relationship: r.business_relationship,
    location_city: r.location_city,
    business_miles: r.business_miles,
  };
}

/** Derive the pending state to tag the outbound question with (so the next reply is the answer). */
function nextContextState(decision: {
  needs_receipt: boolean;
  missing_context_fields: string[];
}): ContextState | null {
  if (decision.missing_context_fields.length > 0) return 'awaiting_context';
  if (decision.needs_receipt) return 'awaiting_receipt';
  return null;
}

/**
 * New expense (from text or photo OCR) → save + SMS reply.
 * @param photoPath Supabase Storage path if this expense came in with a photo, else null.
 */
export async function processNewExpense(
  user: AppUser,
  input: ExpenseInput,
  photoPath: string | null = null,
): Promise<ProcessResult> {
  const cat = await categorizeExpense(input, user);
  const rule = (await getSubstantiationRule(cat.category)) ?? generalFallback(cat.category);

  // Vehicle mileage entries give miles, not dollars — derive the dollar amount from the
  // standard mileage rate (SYSTEM-PROMPTS Example 7).
  if (
    (input.amount_cents == null || input.amount_cents === 0) &&
    cat.category === 'vehicle_business' &&
    input.business_miles != null
  ) {
    input = { ...input, amount_cents: Math.round(input.business_miles * MILEAGE_RATE_CENTS_PER_MILE) };
  }

  const decision = evaluateSubstantiation(rule, {
    amount_cents: input.amount_cents ?? 0,
    has_photo: input.has_photo,
    captured_fields: capturedFrom(input),
  });

  const irc = await getIrcSummary(rule.irc_section);

  // Flag for a quick human glance when the category was uncertain or the note looked
  // instruction-shaped (DEC-055). Deterministic; never blocks logging or adds an SMS question.
  const review = assessCategoryReview({ category: cat.category, confidence: cat.confidence, input });
  if (review.needsReview) {
    log.info('expense_flagged_for_review', { user: user.id, reason: review.reasonCode, confidence: review.confidence });
  }

  const receiptId = await saveReceipt({
    user,
    input,
    category: cat.category,
    rule,
    decision,
    photoPath,
    review,
  });

  const smsText = await composeResponse({ input, category: cat.category, rule, decision, irc, user });

  return { smsText, receiptId, contextState: nextContextState(decision) };
}

/**
 * Reload a receipt and recompute its substantiation flags + deductible from its current
 * fields (DEC-011). Use after any edit (dashboard) or photo attach. Returns the fully
 * updated receipt row, or null if the receipt is missing. Pass `prefetched` when the
 * caller already holds the current row (e.g. straight from updateReceipt) to skip the
 * reload query.
 */
export async function recomputeReceipt(
  orgId: string,
  receiptId: string,
  prefetched?: ReceiptRow,
): Promise<ReceiptRow | null> {
  const r = prefetched ?? (await getReceipt(orgId, receiptId));
  if (!r) return null;
  const category = r.category ?? 'personal';
  const rule = (await getSubstantiationRule(category)) ?? generalFallback(category);
  const decision = evaluateSubstantiation(rule, {
    amount_cents: r.amount_cents,
    has_photo: r.photo_url != null,
    captured_fields: capturedFrom(r),
  });
  return updateReceipt(orgId, receiptId, {
    irc_section: rule.irc_section,
    deduction_percentage: decision.deduction_percentage,
    deductible_amount_cents: decision.deductible_amount_cents,
    needs_receipt: decision.needs_receipt,
    receipt_reason: decision.receipt_reason,
    substantiation_complete: decision.substantiation_complete,
    substantiation_missing_fields: decision.missing_context_fields,
  });
}

interface ClarificationResponse {
  updates: {
    business_purpose: string | null;
    attendees: string | null;
    business_relationship: string | null;
    location_city: string | null;
    business_miles: number | null;
    payment_account: 'business' | 'personal' | null;
  };
  category_change_needed: boolean;
  new_category: string | null;
  confirmation_message: string;
}

/** User answered a pending context question → update receipt, recompute, confirm. */
export async function processClarification(
  user: AppUser,
  receiptId: string,
  questionText: string | null,
  userResponse: string,
): Promise<ProcessResult> {
  const receipt = await getReceipt(user.organization_id, receiptId);
  if (!receipt) {
    // The pending receipt vanished — treat the message as a new expense upstream.
    return { smsText: '', receiptId: null, contextState: null };
  }

  const parsed = await claudeJSON<ClarificationResponse>({
    model: SONNET_MODEL,
    system: CLARIFICATION_PROMPT,
    userText: [
      `## Previous Receipt`,
      JSON.stringify(
        {
          vendor: receipt.vendor,
          amount: receipt.amount_cents / 100,
          category: receipt.category,
          attendees: receipt.attendees,
          business_purpose: receipt.business_purpose,
          business_relationship: receipt.business_relationship,
          business_miles: receipt.business_miles,
        },
        null,
        2,
      ),
      `## Question Asked\n${questionText ?? '(unknown)'}`,
      `## Missing Fields\n${(receipt.substantiation_missing_fields ?? []).join(', ') || '(none)'}`,
      `## User's Response\n${userResponse}`,
    ].join('\n\n'),
    cacheSystem: true,
    maxTokens: 512,
  });

  // Merge updates onto the receipt (only fields the user addressed).
  const u = parsed.updates ?? ({} as ClarificationResponse['updates']);
  const merged = {
    attendees: u.attendees ?? receipt.attendees,
    business_purpose: u.business_purpose ?? receipt.business_purpose,
    business_relationship: u.business_relationship ?? receipt.business_relationship,
    location_city: u.location_city ?? receipt.location_city,
    business_miles: u.business_miles ?? receipt.business_miles,
  };

  // Recompute the authoritative decision in code (DEC-011).
  const category = parsed.category_change_needed && parsed.new_category ? parsed.new_category : receipt.category!;
  const rule = (await getSubstantiationRule(category)) ?? generalFallback(category);
  const decision = evaluateSubstantiation(rule, {
    amount_cents: receipt.amount_cents,
    has_photo: receipt.photo_url != null,
    captured_fields: capturedFrom(merged),
  });

  await updateReceipt(user.organization_id, receiptId, {
    ...merged,
    payment_account: u.payment_account ?? receipt.payment_account,
    category,
    irc_section: rule.irc_section,
    deduction_percentage: decision.deduction_percentage,
    deductible_amount_cents: decision.deductible_amount_cents,
    needs_receipt: decision.needs_receipt,
    receipt_reason: decision.receipt_reason,
    substantiation_complete: decision.substantiation_complete,
    substantiation_missing_fields: decision.missing_context_fields,
  });

  return {
    smsText: parsed.confirmation_message,
    receiptId,
    contextState: nextContextState(decision),
  };
}

interface AttachmentResponse {
  match_confidence: 'high' | 'medium' | 'low';
  discrepancies: string[];
  use_ocr_data: boolean;
  updates: { amount_cents?: number; vendor?: string };
  confirmation_message: string;
}

/**
 * A photo arrived while receipts await one. OCR it, match against pending receipts,
 * attach on high confidence. Returns null if there's no pending receipt to match
 * (caller then treats the photo as a brand-new expense). (TSNAP-024, Prompt 5)
 */
export async function processAttachment(
  user: AppUser,
  ocr: OcrResult,
  buffer: Buffer,
  contentType: string,
): Promise<ProcessResult | null> {
  if (!ocr.ok) return null; // not a readable receipt → let caller handle the OCR error
  const candidates = await findReceiptsAwaitingPhoto(user.organization_id);
  if (candidates.length === 0) return null; // nothing pending → treat as new expense

  const target = candidates[0]; // newest awaiting-photo receipt
  const parsed = await claudeJSON<AttachmentResponse>({
    model: SONNET_MODEL,
    system: RECEIPT_ATTACHMENT_PROMPT,
    userText: [
      `## Existing Receipt`,
      JSON.stringify(
        { vendor: target.vendor, amount: target.amount_cents / 100, date: target.transaction_date },
        null,
        2,
      ),
      `## OCR From New Photo`,
      JSON.stringify(ocr.data, null, 2),
    ].join('\n\n'),
    cacheSystem: true,
    maxTokens: 512,
  });

  if (parsed.match_confidence === 'high') {
    // Only NOW do we persist the image — confirmed it links to a receipt (no orphan).
    const { path } = await storePhotoBuffer(buffer, contentType, user.id);
    const rule = (await getSubstantiationRule(target.category!)) ?? generalFallback(target.category!);
    const decision = evaluateSubstantiation(rule, {
      amount_cents: parsed.use_ocr_data && parsed.updates.amount_cents ? parsed.updates.amount_cents : target.amount_cents,
      has_photo: true,
      captured_fields: capturedFrom(target),
    });
    await updateReceipt(user.organization_id, target.id, {
      photo_url: path,
      needs_receipt: false,
      receipt_reason: null,
      ...(parsed.use_ocr_data ? parsed.updates : {}),
      substantiation_complete: decision.substantiation_complete,
      substantiation_missing_fields: decision.missing_context_fields,
    });
    return {
      smsText: parsed.confirmation_message,
      receiptId: target.id,
      contextState: nextContextState(decision),
    };
  }

  // medium / low confidence — ask the user to confirm; don't attach yet.
  return { smsText: parsed.confirmation_message, receiptId: target.id, contextState: 'awaiting_receipt' };
}
