// Expense orchestration (the "workflow" — code controls flow, DEC-011).
// processNewExpense  (TSNAP-021/022): categorize → rule → decision tree → save → compose
// processClarification (TSNAP-023, Prompt 4): apply a context answer, recompute, confirm
// processAttachment   (TSNAP-024, Prompt 5): match a late photo to a pending receipt

import { categorizeExpense, composeResponse, type ExpenseInput, type CategoryResult } from './categorize';
import { applyVendorMemory, rememberVendorCategory } from './vendor-memory';
import {
  getSubstantiationRule,
  evaluateSubstantiation,
  MILEAGE_RATE_CENTS_PER_MILE,
  type SubstantiationRule,
} from './substantiation';
import { getIrcSummary, lookupIrcSectionFlexible } from './irc';
import { categoryLabel } from './categories';
import { ircCitation, withDisclaimer } from './categorize';
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
import { claudeJSON, type CallMeta } from './llm';
import { HAIKU_MODEL, SONNET_MODEL } from './claude';
import { logAiEvent, type AskReason } from './ai-events';
import { CLARIFICATION_PROMPT, CORRECTION_PROMPT, RECEIPT_ATTACHMENT_PROMPT } from './prompts';
import { storePhotoBuffer, type OcrResult } from './ocr';

export interface ProcessResult {
  smsText: string;
  receiptId: string | null;
  contextState: ContextState | null;
  /** Structured payload persisted with the outbound (e.g. flag-disambiguation candidate ids). */
  pendingData?: import('./conversations').PendingData | null;
}

// Below this OCR/parse confidence, the model wasn't sure it read the expense itself right (the
// amount/vendor it extracted) — distinct from the CATEGORY floor in [[review.ts]], which is about
// which deduction class. A confident ✓ on a possibly-wrong NUMBER is the worst failure for a
// system of record (silently corrupts the export the user hands a CPA), so instead of logging
// quietly we ask the user to verify the amount once (DEC-066). Tunable against scripts/eval like
// the category floor.
const EXTRACTION_CONFIDENCE_FLOOR = 0.7;

/** Deterministic "did I read this right?" prompt shown when extraction confidence is low. Surfaces
 *  the amount (and vendor) so the user can catch a misread, plus what it will file the expense under
 *  (category + IRC section) so the verify still carries the tax context, not just a number to OK.
 *  The reply confirms or corrects it. */
function readCheckMessage(input: ExpenseInput, category: string, sectionId: string | null): string {
  const amount = `$${((input.amount_cents ?? 0) / 100).toFixed(2)}`;
  const at = input.vendor ? ` at ${input.vendor}` : '';
  const section = sectionId ? ` (§${sectionId.replace(/^§/, '')})` : '';
  const filing = `, filing under ${categoryLabel(category)}${section}`;
  return `Quick check — I read that as ${amount}${at}${filing}. Reply YES if that's right, or send the correct amount and I'll fix it.`;
}

/**
 * Deterministic confirmation after the user OKs a verified read (DEC-066 awaiting_confirm YES) or a
 * category micro-confirm (DEC-073). Replaces the old bare "✓ Great — locked it in." with the same
 * value the normal log reply carries: the category it filed under, the IRC section it cites (with
 * the tap-through link + a one-line plain-English summary), and the CPA deferral. No LLM call — built
 * straight from the saved receipt + IRC summary, so the verify path keeps its cost win (DEC-066).
 */
export async function confirmReceiptMessage(orgId: string, receiptId: string): Promise<ProcessResult> {
  const receipt = await getReceipt(orgId, receiptId);
  if (!receipt) {
    // Receipt vanished mid-flight — still acknowledge so the user isn't left hanging.
    return { smsText: '✓ Locked it in.', receiptId, contextState: null };
  }
  // Resolve the IRC summary flexibly (receipts store "§274(n)"; section_id keys are bare "274").
  const irc = receipt.irc_section ? await lookupIrcSectionFlexible(receipt.irc_section) : null;
  const sectionId = irc?.section_id ?? (receipt.irc_section ? receipt.irc_section.replace(/§/g, '').replace(/[^0-9A-Za-z]/g, '') : null);
  return {
    smsText: formatConfirmation({
      amountCents: receipt.amount_cents,
      vendor: receipt.vendor,
      category: receipt.category,
      sectionId,
      summary: irc?.short_summary ?? null,
    }),
    receiptId,
    contextState: null,
  };
}

/** Pure assembly of the confirmation copy (category + IRC §section + link + summary + disclaimer).
 *  Split out from confirmReceiptMessage so the wording is unit-testable without a DB. */
export function formatConfirmation(args: {
  amountCents: number;
  vendor: string | null;
  category: string | null;
  sectionId: string | null;
  summary: string | null;
}): string {
  const amount = `$${(args.amountCents / 100).toFixed(2)}`;
  const at = args.vendor ? ` at ${args.vendor}` : '';
  const citation = ircCitation({ sectionId: args.sectionId });
  const lines = [`✓ Locked in — ${amount}${at}, filed under ${categoryLabel(args.category)}.`];
  if (citation) {
    const desc = args.summary ? `: ${args.summary}` : '';
    lines.push(`Typically falls under ${citation}${desc}`);
  }
  return withDisclaimer(lines.join('\n'));
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

/**
 * Load the substantiation rule for `category`, falling back to a permissive "general" rule if the
 * row is missing. The fallback is the failure mode behind "a meal was logged without ever asking
 * for its §274(d) context": a missing/mismatched rule silently downgrades a STRICT category to
 * general (no receipt, no required context, complete). Every ALLOWED_CATEGORIES key is seeded with
 * a rule (migrations 0002/0009/0024 + substantiation-rules.test), so a fallback here means drift —
 * a category outside the taxonomy, or a migration that never ran. Warn loudly so it's not silent.
 */
async function loadRuleOrFallback(category: string): Promise<SubstantiationRule> {
  const rule = await getSubstantiationRule(category);
  if (rule) return rule;
  log.warn('substantiation_rule_missing', { category });
  return generalFallback(category);
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
 * Shared core of every recompute path (DEC-011): look up the rule for `category`, evaluate the
 * authoritative substantiation decision, and produce the receipt-column patch that all callers
 * persist. The merge of WHICH fields changed stays the caller's job; this owns the
 * rule → decision → columns step that recomputeReceipt / processClarification / processCorrection
 * each used to duplicate. Returns the raw decision too (for nextContextState).
 */
async function recomputeDecision(
  category: string,
  amountCents: number,
  hasPhoto: boolean,
  capturedFields: Record<string, unknown>,
) {
  const rule = await loadRuleOrFallback(category);
  const decision = evaluateSubstantiation(rule, {
    amount_cents: amountCents,
    has_photo: hasPhoto,
    captured_fields: capturedFields,
  });
  return {
    decision,
    patch: {
      irc_section: rule.irc_section,
      deduction_percentage: decision.deduction_percentage,
      deductible_amount_cents: decision.deductible_amount_cents,
      needs_receipt: decision.needs_receipt,
      receipt_reason: decision.receipt_reason,
      substantiation_complete: decision.substantiation_complete,
      substantiation_missing_fields: decision.missing_context_fields,
    },
  };
}

/** Overlay the context fields the user just addressed onto the receipt's current values (a null
 *  update leaves the existing value). Shared by clarification + correction. */
function mergeContext(
  receipt: ReceiptRow,
  u: ClarificationResponse['updates'],
) {
  return {
    attendees: u.attendees ?? receipt.attendees,
    business_purpose: u.business_purpose ?? receipt.business_purpose,
    business_relationship: u.business_relationship ?? receipt.business_relationship,
    location_city: u.location_city ?? receipt.location_city,
    business_miles: u.business_miles ?? receipt.business_miles,
  };
}

/**
 * New expense (from text or photo OCR) → save + SMS reply.
 * @param photoPath Supabase Storage path if this expense came in with a photo, else null.
 * @param precomputedCategory category from a merged extract+categorize call (DEC-063) — skips
 *   the standalone Haiku categorize call. Null/omitted → categorize here (recurring-renewal path).
 * @param extractionConfidence the OCR/parse confidence for how well we READ the expense (amount/
 *   vendor), 0..1. Below EXTRACTION_CONFIDENCE_FLOOR on an otherwise-clean log we verify the amount
 *   with the user instead of a silent ✓ (DEC-066). Null/omitted (recurring-renewal, dashboard) →
 *   trusted, no verify.
 */
export async function processNewExpense(
  user: AppUser,
  input: ExpenseInput,
  photoPath: string | null = null,
  precomputedCategory: CategoryResult | null = null,
  extractionConfidence: number | null = null,
): Promise<ProcessResult> {
  // Capture token/latency for the standalone categorize call (DEC-080). Null on the precomputed
  // path — there the category came from the upstream merged OCR extract+categorize, whose usage
  // isn't threaded here yet (see DEC-080 "Deferred").
  let catMeta: CallMeta | null = null;
  const modelCat = precomputedCategory ?? (await categorizeExpense(input, user, (m) => { catMeta = m; }));
  // Per-org vendor memory (DEC-070): if the user has previously corrected this vendor's category,
  // honor that over a fresh model guess so they don't have to correct the same vendor twice.
  const cat = await applyVendorMemory(user.organization_id, input.vendor, modelCat);
  const rule = await loadRuleOrFallback(cat.category);

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

  // Flag for a quick human glance when the category was uncertain or the note looked
  // instruction-shaped (DEC-055). Deterministic; never blocks logging or adds an SMS question.
  const review = assessCategoryReview({ category: cat.category, confidence: cat.confidence, input, drifted: cat.drifted });
  if (review.needsReview) {
    log.info('expense_flagged_for_review', { user: user.id, reason: review.reasonCode, confidence: review.confidence });
  }

  const baseState = nextContextState(decision);

  // Snapshot this categorization decision to the AI eval log (DEC-080) — captured here, at decision
  // time, because a later user edit overwrites the receipt's category in place and destroys "what the
  // model originally guessed." `asked`/`askReason` vary per return path below, so the caller supplies
  // them. Awaited (a single fast insert) so it flushes before the serverless function freezes.
  const emitCategorizeEvent = (rid: string, asked: boolean, askReason: AskReason | null) =>
    logAiEvent({
      organizationId: user.organization_id,
      userId: user.id,
      receiptId: rid,
      kind: 'categorize',
      model: cat.fromMemory ? null : HAIKU_MODEL, // null = the category came from vendor memory, no model
      category: cat.category,
      ircSection: rule.irc_section,
      confidence: cat.confidence,
      asked,
      askReason,
      drifted: cat.drifted ?? false,
      fromMemory: cat.fromMemory ?? false,
      flaggedReview: review.needsReview,
      reviewReason: review.needsReview ? review.reasonCode : null,
      inputTokens: catMeta?.inputTokens ?? null,
      outputTokens: catMeta?.outputTokens ?? null,
      latencyMs: catMeta?.latencyMs ?? null,
    });

  // Low-confidence READ on an otherwise-clean log (DEC-066): we're not sure we got the amount right,
  // and nothing else is being asked. Verify the amount before moving on rather than ✓-ing a possibly
  // wrong number. We skip the Sonnet compose entirely (a deterministic verify question replaces the
  // normal reply) — so this path is actually one model call CHEAPER, not more expensive. The next
  // reply confirms or corrects it via the awaiting_confirm branch in sms-handler.
  const lowConfidence =
    extractionConfidence != null &&
    extractionConfidence < EXTRACTION_CONFIDENCE_FLOOR &&
    (input.amount_cents ?? 0) > 0 &&
    baseState === null;

  if (lowConfidence) {
    const receiptId = await saveReceipt({ user, input, category: cat.category, rule, decision, photoPath, review });
    log.info('expense_low_confidence_verify', { user: user.id, confidence: extractionConfidence });
    await emitCategorizeEvent(receiptId, true, 'amount_verify');
    return { smsText: readCheckMessage(input, cat.category, rule.irc_section), receiptId, contextState: 'awaiting_confirm' };
  }

  const irc = await getIrcSummary(rule.irc_section);

  // Confidence-gated category micro-confirm (DEC-073). When the categorizer was genuinely unsure
  // (the review floor's low_confidence reason) AND the log is otherwise clean — we're not already
  // asking for a receipt/context (baseState null) and the amount read was fine (past the lowConfidence
  // return above) — invite a one-tap category fix in the reply. The user's correction is routed via
  // 'awaiting_confirm' to processCorrection, which re-categorizes and teaches vendor memory (DEC-070),
  // closing the feedback loop. Injection-shaped / drift flags stay dashboard-only (no prompt) by
  // design — only the honest "which deductible class?" uncertainty earns an SMS nudge (Sofia: friction
  // only with purpose; this scopes DEC-055's no-question rule to the low_confidence case alone).
  const categoryUncertain = baseState === null && review.reasonCode === 'low_confidence';

  // Save and compose are independent (compose doesn't use the receipt id) — run them
  // concurrently to shave a DB round trip off the reply latency (DEC-063).
  const [receiptId, smsText] = await Promise.all([
    saveReceipt({ user, input, category: cat.category, rule, decision, photoPath, review }),
    composeResponse({ input, category: cat.category, rule, decision, irc, user, categoryUncertain }),
  ]);

  // Which question (if any) this log triggered — the over-asking signal (DEC-080).
  const askReason: AskReason | null = categoryUncertain
    ? 'category_confirm'
    : baseState === 'awaiting_context'
      ? 'context'
      : baseState === 'awaiting_receipt'
        ? 'receipt'
        : null;
  await emitCategorizeEvent(receiptId, askReason !== null, askReason);

  return { smsText, receiptId, contextState: categoryUncertain ? 'awaiting_confirm' : baseState };
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
  const { patch } = await recomputeDecision(category, r.amount_cents, r.photo_url != null, capturedFrom(r));
  return updateReceipt(orgId, receiptId, patch);
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

// Like a clarification, but a correction may also fix the AMOUNT ("actually it was $200") — the
// one field a context answer never changes. `amount` is in dollars (matches how the receipt is
// shown to the model); converted to cents + recomputed in code. DEC-064.
interface CorrectionResponse extends ClarificationResponse {
  updates: ClarificationResponse['updates'] & { amount: number | null };
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
          location_city: receipt.location_city,
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

  // Merge updates onto the receipt (only fields the user addressed), then recompute the
  // authoritative decision in code (DEC-011).
  const u = parsed.updates ?? ({} as ClarificationResponse['updates']);
  const merged = mergeContext(receipt, u);
  const category = parsed.category_change_needed && parsed.new_category ? parsed.new_category : receipt.category!;
  const { decision, patch } = await recomputeDecision(
    category,
    receipt.amount_cents,
    receipt.photo_url != null,
    capturedFrom(merged),
  );

  await updateReceipt(user.organization_id, receiptId, {
    ...merged,
    payment_account: u.payment_account ?? receipt.payment_account,
    category,
    ...patch,
  });

  return {
    smsText: parsed.confirmation_message,
    receiptId,
    contextState: nextContextState(decision),
  };
}

/**
 * The user texted a correction/addition right after a clean log (DEC-064) — they're editing the
 * just-logged receipt, not creating a new one. Re-categorize + recompute the authoritative
 * decision IN CODE (DEC-011), same as processClarification; only the prompt framing differs
 * (full recategorization + an "Updated ✓" edit confirmation). The detection of WHICH messages
 * are corrections lives in sms-handler (conservative markers + a tight recent-receipt window).
 */
export async function processCorrection(
  user: AppUser,
  receiptId: string,
  userMessage: string,
): Promise<ProcessResult> {
  const receipt = await getReceipt(user.organization_id, receiptId);
  if (!receipt) {
    // The receipt vanished — let the caller fall through to new-expense handling.
    return { smsText: '', receiptId: null, contextState: null };
  }

  const corrMeta: { value: CallMeta | null } = { value: null };
  const parsed = await claudeJSON<CorrectionResponse>({
    onMeta: (m) => { corrMeta.value = m; },
    model: SONNET_MODEL,
    system: CORRECTION_PROMPT,
    userText: [
      `## Just-Logged Receipt (the one being corrected)`,
      JSON.stringify(
        {
          vendor: receipt.vendor,
          amount: receipt.amount_cents / 100,
          category: receipt.category,
          attendees: receipt.attendees,
          business_purpose: receipt.business_purpose,
          business_relationship: receipt.business_relationship,
          location_city: receipt.location_city,
          business_miles: receipt.business_miles,
        },
        null,
        2,
      ),
      `## User's Correction\n${userMessage}`,
    ].join('\n\n'),
    cacheSystem: true,
    maxTokens: 512,
  });

  const u = parsed.updates ?? ({} as CorrectionResponse['updates']);
  const merged = mergeContext(receipt, u);

  // An amount correction changes the $75 substantiation threshold + the deductible, so feed the new
  // amount into the recompute (and persist it). Ignore non-positive/garbage values (DEC-064).
  const amountCorrected = typeof u.amount === 'number' && u.amount > 0;
  const amountCents = amountCorrected ? Math.round(u.amount! * 100) : receipt.amount_cents;

  const categoryChanged = parsed.category_change_needed === true && !!parsed.new_category;
  const category = categoryChanged ? parsed.new_category! : receipt.category!;
  const { decision, patch } = await recomputeDecision(
    category,
    amountCents,
    receipt.photo_url != null,
    capturedFrom(merged),
  );

  await updateReceipt(user.organization_id, receiptId, {
    ...merged,
    amount_cents: amountCents,
    payment_account: u.payment_account ?? receipt.payment_account,
    category,
    ...patch,
  });

  // Correction-rate metric (DEC-065): each correction is an error-driven extra round trip (a
  // Sonnet call + outbound SMS). Tracking how often we're corrected — and how often the fix flips
  // the category — is the leading signal for "are mistakes costing us money / data quality."
  log.info('expense_corrected', {
    user: user.id,
    category_changed: categoryChanged,
    from_category: categoryChanged ? receipt.category : null,
    to_category: categoryChanged ? category : null,
    amount_corrected: amountCorrected,
  });

  // The labeled eval example (DEC-080): the user just told us the right answer. from_category→
  // to_category is a free, real-world correction pair to grade the categorizer against. Keyed to the
  // same receipt as the original 'categorize' event, so the two join into a guessed→corrected row.
  await logAiEvent({
    organizationId: user.organization_id,
    userId: user.id,
    receiptId,
    kind: 'correction',
    model: SONNET_MODEL,
    category,
    ircSection: patch.irc_section,
    categoryChanged,
    fromCategory: categoryChanged ? receipt.category : null,
    toCategory: categoryChanged ? category : null,
    amountCorrected,
    asked: nextContextState(decision) !== null,
    inputTokens: corrMeta.value?.inputTokens ?? null,
    outputTokens: corrMeta.value?.outputTokens ?? null,
    latencyMs: corrMeta.value?.latencyMs ?? null,
  });

  // Per-org vendor memory (DEC-070): an explicit category correction is our strongest "right answer"
  // signal — remember it so future expenses from this vendor categorize correctly the first time.
  if (categoryChanged) {
    await rememberVendorCategory(user.organization_id, receipt.vendor, category);
  }

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
      receipt_waived_at: null, // a photo arrived → un-waive (DEC-078); the gap is closed
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

  // No confident match (medium/low). This photo isn't clearly the awaited receipt — most often it's
  // a DIFFERENT, new expense (e.g. a Morton's $84 photo arriving while an unrelated Irish-pub $80
  // receipt is still pending). Return null so the caller logs it as a NEW expense (storing the photo)
  // instead of stapling it to the wrong record. The old behavior here was a dead end (DEC-071): it
  // asked "reply YES to replace" but never persisted the photo bytes and no handler could fulfill the
  // YES, so the image was silently lost and the bucket stayed empty. Trade-off: a true same-receipt
  // with noisy OCR becomes a separate entry the user can merge — acceptable vs. losing the photo.
  log.info('attachment_no_confident_match', { user: user.id, target: target.id, confidence: parsed.match_confidence });
  return null;
}
