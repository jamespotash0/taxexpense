// Inbound SMS orchestration (TSNAP-016/017/023/024/026). The route validates the
// Twilio signature and parses the body, then hands a clean InboundMessage here.
// This function owns the conversation flow and ALWAYS sends exactly one reply.

import { normalizeToE164 } from './phone';
import { getOrCreateUserByPhone, getUserByPhone, touchLastActive, updateUser, resolveJoinConsent, type AppUser } from './users';
import { notifyAdminNewSignup } from './admin-notify';
import { loadTurnContext, interpretTurn, canSkipInterpreter, type TurnContext, type TurnDecision } from './turn';
import { logConversation, isNewestInbound, getPendingContext, countRecentInbound, getPendingAmount, type ContextState, type PendingContext } from './conversations';
import { getSubstantiationRule } from './substantiation';
import { categoryLabel } from './categories';
import { handleOnboarding, handleSetupCheckin } from './onboarding';
import {
  fetchInboundMedia,
  extractAndCategorizeReceiptFromImageData,
  storePhotoBuffer,
  parseAndCategorizeText,
  type OcrResult,
  type ParsedTextExpense,
  type ParsedAdditionalExpense,
} from './ocr';
import { processNewExpense, processClarification, processCorrection, processAttachment, confirmReceiptMessage, type ProcessResult } from './expense';
import type { CategoryResult } from './categorize';
import { ensureBusinessProfile } from './businessProfile';
import { routeDecision, routeFastPath, resolveFlagChoice, resolveContextChoice } from './router';
import { subscribeUrl } from './subscribe-link';
import { getReceipt, waiveReceipt, updateReceipt, getReceiptBySourceMessage } from './receipts';
import { reactLinq, shareContactCard, type SendOptions } from './linq';
import { DEFAULT_AGENT_NAME } from './prompts';
import { todayISO } from './format';
import {
  isAffirmative,
  isNegative,
  advanceRecurring,
  templateToExpenseInput,
  createRecurringFromReceipt,
  hasRecurring,
  priorOccurrenceCount,
  isRecurringLikely,
  offerRecurring,
  recurringCreatedMsg,
  skippedRenewalMsg,
  type RecurringRow,
} from './recurring';
import type { ExpenseInput } from './categorize';
import { sendMessage, type Channel } from './twilio';
import { getOrgEntitlement } from './subscription';
import { getUsageCounts, decideUsage, ANNUAL_RECEIPT_QUOTA, type UsageDecision } from './usage';
import { PUBLIC_ENV } from './env';
import { log, maskPhone } from './log';
import { SONNET_MODEL } from './claude';
import { withUsage, setUsageOwner } from './llm-usage';

export interface InboundMessage {
  from: string;
  body: string;
  numMedia: number;
  mediaUrls: string[];
  channel: Channel;
  /** Linq ids for this message (iMessage extras: reactions, threading, edits). Absent on Twilio. */
  linq?: { messageId: string; chatId: string };
}

// Inbound rate limits (DEC-034/036): cap LLM-heavy processing per user to blunt cost/abuse.
// ponytail: fixed 1.5s window for onboarding bursts; widen if bursts arrive further apart.
const ONBOARDING_BURST_MS = 1500;
// A 10-min burst cap stops floods; a daily cap backstops sustained low-rate abuse. Generous
// enough for a real burst of receipts.
const INBOUND_WINDOW_MIN = 10;
const INBOUND_MAX = 25;
// ~3 texts per expense (photo, WHY, a follow-up), so 40 ≈ a heavy travel or catch-up day of
// 10-13 expenses. Caps worst-case LLM spend near ~$1.50/user/day (founder, 2026-11-25).
const INBOUND_MAX_PER_DAY = 40;

// Partial-capture ("how much was this?") retry cap (DEC-064). After this many re-asks with
// still no amount, give up cleanly rather than loop. 1 = at most two prompts total.
const MAX_AMOUNT_RETRIES = 1;

// User-facing error/help copy (TSNAP-026 / Sofia — human, not technical).
const MSG = {
  notReceipt: "Hmm, that doesn't look like a receipt to me 🤔 Want to just text me what it was instead?",
  unreadable: "Ah, that photo came out a little blurry. Mind snapping another, or just texting me the details?",
  needAmount: 'Got it! Quick one: how much was it?',
  // After re-asking once with no amount, stop the loop gracefully (DEC-064). Don't log a $0
  // phantom — just invite a clean resend so the next message starts fresh.
  amountGiveUp:
    "No worries! I didn't catch an amount, so I haven't logged this one yet. Whenever you have it, send something like \"$45 lunch with a client\" and I'll take it from there.",
  help: 'Send me any business expense! A receipt photo, a note like "$30 gas to client site", or "drove 40 miles to Acme" all work.',
  // Acknowledge a "later / I'll send it" reply while awaiting a receipt (DEC-072): keep it flagged
  // so the photo can be added later, confirm everything else is captured. The weekly nudge still
  // fires until it arrives (or the user waives it). Never re-asks the amount.
  noReceiptAck:
    "No problem, it's logged! I'll keep it flagged for a receipt, so snap the photo whenever and it'll attach. Everything else is captured ✓",
  // Acknowledge a PERMANENT "there's no receipt" reply (DEC-078): waive future reminders, keep the
  // expense, and be honest that it's an un-receipted gap for the CPA. Never marks it complete.
  noReceiptWaived:
    "Totally fine, I won't ask about this one again. Your text is the record, and I noted there's no receipt so it's clear for your accountant. Everything else is captured ✓",
  failure: "Oops, something hiccuped on my end 😅 Mind sending that one more time?",
  // Parser failed (not a delivery failure — the message arrived and is saved). Sofia copy.
  couldntRead: "Hmm, I couldn't quite make that one out. Mind rephrasing? Something like \"$30 gas to client site\" works great.",
};

function ocrToInput(data: Extract<OcrResult, { ok: true }>['data'], bodyText: string): ExpenseInput {
  const purpose = bodyText.trim() || null;
  return {
    amount_cents: data.total_amount != null ? Math.round(data.total_amount * 100) : null,
    vendor: data.vendor,
    transaction_date: data.transaction_date,
    attendees: null,
    business_purpose: purpose,
    business_relationship: null,
    location_city: data.location_city,
    business_miles: null,
    has_photo: true,
    raw_text: purpose,
    items: data.items,
  };
}

async function handlePhotoAsNewExpense(
  user: AppUser,
  ocr: OcrResult,
  category: CategoryResult | null,
  bodyText: string,
  buffer: Buffer,
  contentType: string,
): Promise<ProcessResult> {
  if (!ocr.ok) {
    // Not a usable receipt → DON'T store the image (no orphan). Just guide the user.
    return {
      smsText: ocr.error === 'not_a_receipt' ? MSG.notReceipt : MSG.unreadable,
      receiptId: null,
      contextState: null,
    };
  }
  // Confirmed a receipt → persist the image now and link it.
  const { path } = await storePhotoBuffer(buffer, contentType, user.id);
  // Pass the OCR confidence so a shaky read (blurry photo → wrong amount) gets verified instead
  // of silently logged (DEC-066).
  return processNewExpense(user, ocrToInput(ocr.data, bodyText), path, category, ocr.data.confidence);
}

/** Did the parser extract ANY expense signal — an amount, miles, vendor, purpose, attendees, or
 *  place? When none of these are present the message isn't an expense description (gibberish, a
 *  stray fragment, a misfired text), so we ask the user to rephrase rather than assuming an expense
 *  and asking "how much?" Pure + exported for tests. */
export function hasExpenseSignal(
  parsed: Pick<
    ParsedTextExpense,
    'amount' | 'business_miles' | 'vendor' | 'business_purpose' | 'attendees' | 'location_city'
  >,
): boolean {
  return Boolean(
    parsed.amount != null ||
      parsed.business_miles != null ||
      parsed.vendor?.trim() ||
      parsed.business_purpose?.trim() ||
      parsed.attendees?.trim() ||
      parsed.location_city?.trim(),
  );
}

/** Map a parsed text expense to the canonical ExpenseInput (text path → no photo, no items). */
function textParsedToInput(parsed: ParsedTextExpense): ExpenseInput {
  return {
    amount_cents: parsed.amount != null ? Math.round(parsed.amount * 100) : null,
    vendor: parsed.vendor,
    transaction_date: parsed.transaction_date,
    attendees: parsed.attendees,
    business_purpose: parsed.business_purpose,
    business_relationship: null,
    location_city: parsed.location_city,
    business_miles: parsed.business_miles,
    has_photo: false,
    raw_text: parsed.raw_text,
    items: [],
  };
}

/** Parse + log the PRIMARY text expense, returning its result and any ADDITIONAL distinct charges
 *  the same message named (DEC-083). The result is the existing single-expense behavior verbatim;
 *  callers that don't opt into multi-capture just read `.result` and ignore `.extras`. */
async function parseLogPrimaryText(
  user: AppUser,
  body: string,
): Promise<{ result: ProcessResult; extras: ParsedAdditionalExpense[] }> {
  if (!body.trim()) return { result: { smsText: MSG.help, receiptId: null, contextState: null }, extras: [] };

  // The inbound text is already persisted by handleInboundSms before we parse, so a parser
  // failure loses nothing — reply helpfully instead of letting it throw to the generic
  // failure path (red-team graceful_fail; team DEC). The merged call has no internal fallback.
  let parsed: ParsedTextExpense;
  let category: CategoryResult;
  let extras: ParsedAdditionalExpense[] = [];
  try {
    ({ parsed, category, additional: extras } = await parseAndCategorizeText(body, user));
  } catch (err) {
    log.warn('text_parse_failed', { user: user.id, message: errMsg(err) });
    return { result: { smsText: MSG.couldntRead, receiptId: null, contextState: null }, extras: [] };
  }
  if (parsed.amount == null && parsed.business_miles == null) {
    // No amount AND no other expense signal (vendor/purpose/attendees/place) → this isn't an expense
    // description (gibberish, a stray fragment). Ask the user to rephrase instead of assuming an
    // expense and arming an awaiting_amount wait on a phantom. Metric tracks the unanticipated-
    // message rate so we can tell whether this needs more than a rephrase nudge (Priya).
    if (!hasExpenseSignal(parsed)) {
      log.info('inbound_unrecognized', { user: user.id, confidence: parsed.confidence });
      return { result: { smsText: MSG.couldntRead, receiptId: null, contextState: null }, extras: [] };
    }
    // A real expense missing only its amount ("lunch with a client at Mortons"). Don't fire-and-
    // forget: remember what we already parsed so the user's "$167" reply can be combined + re-parsed
    // into THIS expense instead of a new contextless one (the §262/$0 phantom + "how much?" loop).
    // DEC-064. Completion is owned by handleExpenseFlow. A bare-amount primary carries no usable
    // extras either, so drop them.
    return {
      result: {
        smsText: MSG.needAmount,
        receiptId: null,
        contextState: 'awaiting_amount',
        pendingData: { priorText: body, amountAttempts: 0 },
      },
      extras: [],
    };
  }

  // Pass the parse confidence so an ambiguous text read (e.g. conflicting amounts) gets verified
  // instead of silently logged (DEC-066).
  const result = await processNewExpense(user, textParsedToInput(parsed), null, category, parsed.confidence);
  return { result, extras };
}

async function handleTextAsNewExpense(user: AppUser, body: string): Promise<ProcessResult> {
  return (await parseLogPrimaryText(user, body)).result;
}

/** A short "$15 Vercel (Software)" line for an additional charge, for the batch note. Pure. */
export function summarizeExtra(extra: ParsedAdditionalExpense): string {
  const p = extra.parsed;
  const money =
    p.amount != null ? `$${p.amount.toFixed(2)}` : p.business_miles != null ? `${p.business_miles} mi` : '';
  const vendor = p.vendor ? ` ${p.vendor}` : '';
  return `${money}${vendor} (${categoryLabel(extra.category.category)})`.trim();
}

/** The batch note appended after the primary reply when a text named several charges (DEC-083).
 *  Pure + exported so the copy is unit-testable without logging real expenses. */
export function formatBatchNote(summaries: string[], anyIncomplete: boolean, dashboardUrl: string): string {
  const lead = summaries.length === 1 ? 'one more' : `${summaries.length} more`;
  let note = `I also logged ${lead}: ${summaries.join(', ')}.`;
  if (anyIncomplete) {
    note += ` A couple might need a quick detail to be documentation complete. You can add it on your dashboard: ${dashboardUrl}.`;
  }
  return note;
}

/**
 * Multi-charge text capture (DEC-083). The primary expense already logged on the full conversational
 * path (it may own a live question / recurring offer — unchanged). Log each ADDITIONAL distinct
 * charge from the same message too (no silent loss), then append ONE summary note rather than
 * stacking a second pending question. Recurring offers are skipped for a batch by design (we never
 * stack two questions). If any extra is still incomplete, point to the dashboard to finish it.
 */
async function captureTextExpense(user: AppUser, body: string): Promise<ProcessResult> {
  const { result, extras } = await parseLogPrimaryText(user, body);
  if (extras.length === 0) return maybeOfferRecurring(user, result);

  const summaries: string[] = [];
  let anyIncomplete = false;
  for (const extra of extras) {
    const logged = await processNewExpense(
      user,
      textParsedToInput(extra.parsed),
      null,
      extra.category,
      extra.parsed.confidence,
    );
    if (logged.receiptId) {
      summaries.push(summarizeExtra(extra));
      if (logged.contextState !== null) anyIncomplete = true;
    }
  }
  if (summaries.length === 0) return maybeOfferRecurring(user, result);

  log.info('multi_expense_text', { user: user.id, extras: summaries.length });
  const note = formatBatchNote(summaries, anyIncomplete, appBase());
  return { ...result, smsText: `${result.smsText}\n\n${note}` };
}

/** Recurring (DEC-033): after a COMPLETE log, offer to track it monthly when it's
 *  subscription-shaped — either the AI category implies a subscription/bill (software,
 *  internet/phone, insurance, rent → offer on the FIRST log) OR we've seen the same
 *  vendor+amount before (a repeat → offer in any category). Only on a clean log (no pending
 *  receipt/context) so we never stack two questions, and never if already tracked. */
async function maybeOfferRecurring(user: AppUser, result: ProcessResult): Promise<ProcessResult> {
  if (result.contextState !== null || !result.receiptId) return result;
  const receipt = await getReceipt(user.organization_id, result.receiptId);
  if (!receipt?.vendor || receipt.amount_cents <= 0) return result;
  if (await hasRecurring(user.organization_id, receipt.vendor, receipt.amount_cents)) return result;

  const priors = await priorOccurrenceCount(user.organization_id, receipt.vendor, receipt.amount_cents, receipt.id);
  const subscription = isRecurringLikely(receipt.category);
  if (priors < 1 && !subscription) return result; // neither a repeat nor a subscription-type → no offer

  const reason = priors >= 1 ? 'repeat' : 'subscription';
  // Its own text after the log reply (DEC-103): keeps the confirmation short.
  return {
    ...result,
    followUp: offerRecurring(receipt.vendor, receipt.amount_cents, reason),
    contextState: 'awaiting_recurring_optin',
  };
}

/** "YES" to a recurring offer → create the monthly template from the source receipt. */
async function handleRecurringOptin(user: AppUser, receiptId: string): Promise<ProcessResult | null> {
  const receipt = await getReceipt(user.organization_id, receiptId);
  if (!receipt) return null;
  await createRecurringFromReceipt(receipt, todayISO());
  return { smsText: recurringCreatedMsg(), receiptId, contextState: null };
}

/** Y/N to a monthly "did it renew?" nudge → log the occurrence (normal flow) or skip; roll forward. */
async function handleRenewalConfirm(user: AppUser, tmpl: RecurringRow, body: string): Promise<ProcessResult> {
  if (isAffirmative(body)) {
    const result = await processNewExpense(user, templateToExpenseInput(tmpl), null);
    await advanceRecurring(tmpl.id, todayISO(), true);
    return result;
  }
  await advanceRecurring(tmpl.id, todayISO(), false);
  return { smsText: skippedRenewalMsg(tmpl.vendor), receiptId: null, contextState: null };
}

function appBase(): string {
  return PUBLIC_ENV.appUrl || 'https://tallywhy.com';
}

// Usage-cap replies (DEC-050). A "block" reply never logs a receipt: the daily one stays
// friendly (a genuinely heavy day), the annual one upsells high-volume use to support.
function cappedReply(decision: Extract<UsageDecision, { kind: 'block_daily' | 'block_annual' }>): ProcessResult {
  const smsText =
    decision.kind === 'block_daily'
      ? `Wow, busy day! 😅 I've saved every one so far. Give me a bit to catch up on new ones so nothing gets garbled. Everything so far is on your dashboard: ${appBase()}.`
      : `You've hit your plan's expense limit for the year. Everything's saved and exportable! If you're logging this much, see the plans at ${appBase()}/pricing.`;
  return { smsText, receiptId: null, contextState: null };
}

/** A user can attach several photos to one MMS, but the conversation + substantiation flow is
 *  per-receipt (one live question at a time). We process the first photo and, instead of silently
 *  dropping the rest — invisible data loss, the worst failure for a records product — tell the user
 *  to resend them one at a time (DEC-066). Full batch logging is a larger follow-up (cost + per-
 *  receipt state). */
function withExtraPhotosNote(result: ProcessResult, extraPhotos: number): ProcessResult {
  if (extraPhotos <= 0) return result;
  const them = extraPhotos === 1 ? 'it' : 'them';
  const noun = extraPhotos === 1 ? 'one more photo' : `${extraPhotos} more photos`;
  return {
    ...result,
    smsText: `${result.smsText}\n\nI also spotted ${noun} in there! I log them one at a time, so send ${them} again separately and I'll catch each one.`,
  };
}

/** Append a one-line annual-quota nudge to an otherwise-normal reply (only fires at milestones). */
function withAnnualNudge(decision: UsageDecision, result: ProcessResult): ProcessResult {
  if (decision.kind !== 'warn_annual') return result;
  return {
    ...result,
    smsText: `${result.smsText}\n\nHeads up, you're getting close to your yearly expense limit (${decision.used}/${ANNUAL_RECEIPT_QUOTA}). Logging a lot? See the plans at ${appBase()}/pricing.`,
  };
}

// Closing line on any tax-guidance reply (suggest-not-advise + CPA deferral).
const CPA_NOTE = 'Suggestion, not advice. For your situation, check with a CPA.';

/** Explain WHY Tally is asking / how it works — deterministic, from the substantiation rule +
 *  IRC summary (no LLM). Keeps any pending question open so the user can still answer it.
 *  Always closes with the CPA deferral. */
async function explainWhy(user: AppUser, pending: PendingContext | null): Promise<ProcessResult> {
  const base = appBase();
  const reply = (body: string, p: PendingContext | null): ProcessResult => ({
    smsText: `${body}\n\n${CPA_NOTE}`,
    receiptId: p?.receiptId ?? null,
    contextState: p?.contextState ?? null, // keep any open question intact
  });

  if (pending?.contextState === 'awaiting_context') {
    const receipt = await getReceipt(user.organization_id, pending.receiptId);
    if (receipt?.category) {
      const rule = await getSubstantiationRule(receipt.category);
      const section = rule?.irc_section ?? receipt.irc_section ?? '274';
      const missing = (receipt.substantiation_missing_fields ?? []).join(', ');
      const need = missing ? ` notes on ${missing}` : ' a little more detail';
      return reply(
        `Good question! ${categoryLabel(receipt.category)} is a strict category, so to deduct it the IRS (§${section}) needs${need}. That's the only reason I asked. Everything else I just log.\n\n§${section} in plain English: ${base}/irc/${section}`,
        pending,
      );
    }
  }

  if (pending?.contextState === 'awaiting_receipt') {
    return reply(
      `Good question! For strict categories (meals, travel, gifts) the IRS wants a receipt photo once an expense hits $75 (lodging at any amount). Under $75 your text is the record, so I only ask when the tax code requires it.`,
      pending,
    );
  }

  if (pending?.contextState === 'awaiting_recurring_optin') {
    return reply(
      `I noticed this one repeats! Tracking it means I'll check in each month so you don't have to re-text it. Nothing gets logged until you say so. Reply YES to track it.`,
      pending,
    );
  }

  return reply(
    `I capture the WHY behind each expense so your deductions hold up — and I only ask for details when the IRS actually requires them (like who was at a meal, per §274). Everything else I just log.\n\n§162 in plain English → ${base}/irc/162`,
    null,
  );
}

/** Decide the reply for an onboarded user. */
async function handleExpenseFlow(user: AppUser, msg: InboundMessage): Promise<ProcessResult> {
  const hasPhoto = msg.numMedia > 0 && msg.mediaUrls.length > 0;
  const pending = await getPendingContext(user.id);

  // Usage caps (DEC-050): gate only NEW expense logging. Answering a pending question, "why?",
  // recurring confirmations and read-only queries below all flow through uncapped.
  const decision = decideUsage(await getUsageCounts(user.organization_id));
  const blocked = decision.kind === 'block_daily' || decision.kind === 'block_annual';

  if (hasPhoto) {
    // A photo with NO pending question is a new expense → short-circuit BEFORE OCR when capped,
    // so a blocked user never incurs the OCR cost. (A photo answering a pending receipt completes
    // an expense that already counted, so it's allowed.)
    if (!pending && blocked) return cappedReply(decision);

    // Several photos in one MMS: we process only the first (the substantiation flow is per-receipt)
    // and tell the user about the rest rather than dropping them silently (DEC-066).
    const extraPhotos = Math.max(0, msg.mediaUrls.length - 1);

    // A photo can be the ANSWER to "how much was this?" — if a partial is awaiting its amount, fold
    // the text we already had into the caption so the photo supplies vendor+amount while the prior
    // note supplies the WHY, instead of logging a context-less new expense (DEC-064, limitation B).
    // (awaiting_amount carries no receipt_id, so getPendingContext above is null on this path.)
    const pendingAmt = pending ? null : await getPendingAmount(user.id);
    const caption = pendingAmt ? `${pendingAmt.priorText} ${msg.body}`.trim() : msg.body;

    // OCR + categorize from the bytes FIRST (one merged Haiku call, DEC-063); we only write
    // to Storage once we know the image links to a receipt (prevents orphaned uploads from
    // non-receipt / unmatched photos). On the attachment path below the category is unused.
    const { buffer, contentType } = await fetchInboundMedia(msg.mediaUrls[0]);
    let { ocr, category } = await extractAndCategorizeReceiptFromImageData(buffer, contentType, user, caption);
    // Hard receipt (blurry, crumpled, handwritten): Haiku couldn't read it or is unsure of the
    // amount. Retry once with the stronger vision model before asking the user. Not for
    // "not a receipt" (a selfie won't improve). Rare, so cost stays pennies (2026-11-25).
    if ((!ocr.ok && ocr.error === 'unreadable') || (ocr.ok && ocr.data.confidence < 0.7)) {
      const retry = await extractAndCategorizeReceiptFromImageData(buffer, contentType, user, caption, SONNET_MODEL);
      log.info('ocr_retry_stronger_model', { user: user.id, before_ok: ocr.ok, after_ok: retry.ocr.ok });
      if (retry.ocr.ok && (!ocr.ok || retry.ocr.data.confidence > ocr.data.confidence)) ({ ocr, category } = retry);
    }

    // If a receipt is awaiting a photo, try to attach this one first (stores on match). Looser
    // 'photo' lookup: a newer expense logged in between doesn't rule out a late receipt photo.
    if (pending ?? (await getPendingContext(user.id, 'photo'))) {
      const attached = await processAttachment(user, ocr, buffer, contentType);
      if (attached) return withExtraPhotosNote(attached, extraPhotos);
    }
    // Fell through to a new expense (no match) → re-check the cap before logging.
    if (blocked) return cappedReply(decision);
    return withExtraPhotosNote(
      withAnnualNudge(decision, await maybeOfferRecurring(user, await handlePhotoAsNewExpense(user, ocr, category, caption, buffer, contentType))),
      extraPhotos,
    );
  }

  // Text path: turn interpreter (claude_files/specs/turn-interpreter.md). Deterministic fast paths
  // first; everything else gets ONE Haiku decision that sees the recent conversation, what's open,
  // and recent expenses, then the existing handlers run.
  const text = msg.body;
  const ctx = await loadTurnContext(user);
  const { open } = ctx;

  // Bare digit → the open "which one?" list.
  if (/^\s*[1-9]\s*$/.test(text) && open.choice) {
    const n = parseInt(text.trim(), 10);
    if (open.choice.kind === 'flag') return resolveFlagChoice(user, open.choice.candidateIds, n);
    return resolveContextChoice(user, open.choice.candidateIds, open.choice.contextText ?? '', n);
  }

  // Bare yes / no to a yes-no question. Verify first, so its "yes" isn't taken as a renewal.
  if (isAffirmative(text) || isNegative(text)) {
    const yes = isAffirmative(text);
    if (yes && open.question?.contextState === 'awaiting_confirm') return confirmReceiptMessage(user.organization_id, open.question.receiptId);
    if (open.renewal) return handleRenewalConfirm(user, open.renewal, text);
    if (yes && open.question?.contextState === 'awaiting_recurring_optin') {
      const optin = await handleRecurringOptin(user, open.question.receiptId);
      if (optin) return optin;
    }
  }

  const fast = await routeFastPath(user, text);
  if (fast) return fast;

  if (!canSkipInterpreter(text, ctx, new Date())) {
    const d = await interpretTurn(text, ctx);
    log.info('turn_decision', { user: user.id, action: d.action, answer: d.answer, has_receipt: !!d.receiptId, fallback: d.fallback });
    const routed = await routeDecision(user, text, d, ctx);
    if (routed) return routed;

    if (d.action === 'explain_why') {
      if (open.amount && !open.question) {
        return {
          smsText: 'I just need the amount to log it. What did it come to?',
          receiptId: null,
          contextState: 'awaiting_amount',
          pendingData: { priorText: open.amount.priorText, amountAttempts: open.amount.attempts },
        };
      }
      return explainWhy(user, open.question);
    }
    if (d.action === 'answer_open_question' || d.action === 'receipt_resolution') {
      const answered = await answerOpenQuestion(user, text, d, ctx, decision);
      if (answered) return answered;
      // Nothing open after all (or the receipt vanished) → treat it as a new expense below.
    }
  }

  // New text expense → usage caps apply. captureTextExpense logs the primary AND any additional
  // distinct charges in the same text (DEC-083), folding in the recurring offer.
  if (blocked) return cappedReply(decision);
  return withAnnualNudge(decision, await captureTextExpense(user, text));
}

/** Dispatch an answer to whatever is open (spec's dispatch table). Null = nothing to answer. */
async function answerOpenQuestion(
  user: AppUser,
  text: string,
  d: TurnDecision,
  ctx: TurnContext,
  decision: UsageDecision,
): Promise<ProcessResult | null> {
  const q = ctx.open.question;
  const live = (r: ProcessResult) => (r.receiptId !== null ? r : null); // receipt vanished → null
  if (q) {
    switch (q.contextState) {
      case 'awaiting_confirm':
        if (d.answer === 'affirm') return confirmReceiptMessage(user.organization_id, q.receiptId);
        return live(await processCorrection(user, q.receiptId, text));
      case 'awaiting_context':
        return live(await processClarification(user, q.receiptId, q.questionText, text));
      case 'awaiting_receipt':
        if (d.resolution === 'none') {
          await waiveReceipt(user.organization_id, q.receiptId);
          log.info('receipt_waived', { user: user.id, receipt: q.receiptId, source: 'sms' });
          return { smsText: MSG.noReceiptWaived, receiptId: q.receiptId, contextState: null };
        }
        if (d.resolution === 'later' || d.answer === 'decline') {
          return { smsText: MSG.noReceiptAck, receiptId: q.receiptId, contextState: null };
        }
        return live(await processCorrection(user, q.receiptId, text));
      case 'awaiting_recurring_optin':
        if (d.answer === 'affirm') return handleRecurringOptin(user, q.receiptId);
        if (d.answer === 'decline') return { smsText: "No problem, I won't track it.", receiptId: q.receiptId, contextState: null };
        break;
    }
  }
  const amt = ctx.open.amount;
  if (amt) {
    if (decision.kind === 'block_daily' || decision.kind === 'block_annual') return cappedReply(decision);
    const combined = `${amt.priorText} ${text}`.trim();
    const result = await maybeOfferRecurring(user, await handleTextAsNewExpense(user, combined));
    if (result.contextState !== 'awaiting_amount') return withAnnualNudge(decision, result);
    // Still no amount. Re-ask once more, then give up cleanly — never log a $0 phantom.
    if (amt.attempts >= MAX_AMOUNT_RETRIES) return { smsText: MSG.amountGiveUp, receiptId: null, contextState: null };
    return { ...result, pendingData: { priorText: combined, amountAttempts: amt.attempts + 1 } };
  }
  if (ctx.open.renewal && d.answer) return handleRenewalConfirm(user, ctx.open.renewal, d.answer === 'affirm' ? 'yes' : 'no');
  return null;
}

/** Top-level inbound handler. Always sends exactly one SMS reply. Token usage of every Claude
 *  call made while handling it is attributed to the sender (DEC-097). */
export function handleInboundSms(msg: InboundMessage): Promise<void> {
  return withUsage(() => handleInboundSmsInner(msg));
}

async function handleInboundSmsInner(msg: InboundMessage): Promise<void> {
  const phone = normalizeToE164(msg.from);
  if (!phone) {
    log.warn('inbound_unparseable_from', { from: maskPhone(msg.from) });
    return;
  }

  let user: AppUser;
  try {
    const result = await getOrCreateUserByPhone(phone);
    user = result.user;
    setUsageOwner(user.organization_id, user.id);
    // Best-effort founder notification on brand-new signups (abuse monitoring). Never let a
    // flaky email fail the signup — the helper self-swallows, but guard the call anyway.
    if (result.isNew) {
      void notifyAdminNewSignup(user).catch(() => {});
    }
  } catch (err) {
    log.error('user_lookup_failed', { phone: maskPhone(phone), message: errMsg(err) });
    await safeSend(phone, MSG.failure, msg.channel);
    return;
  }

  // Log inbound + bump activity (best-effort). Two independent writes — run them together
  // so every reply (the deterministic onboarding path especially) pays one round trip, not
  // two (DEC-063).
  const [inboundId] = await Promise.all([
    logConversation({
      userId: user.id,
      organizationId: user.organization_id,
      direction: 'inbound',
      messageText: msg.body || null,
      mediaUrl: msg.mediaUrls[0] ?? null,
    }),
    touchLastActive(user.id),
  ]);

  // TCPA opt-out / opt-in keywords (EPIC-7). Twilio also handles STOP at the carrier
  // level; we record state so reminders/outbound respect it.
  // Trailing punctuation/emoji-free: "Stop." and "stop!" are opt-outs too.
  const keyword = msg.body.trim().toUpperCase().replace(/[^A-Z]+$/, '');
  if (['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(keyword)) {
    await updateUser(user.id, { sms_opted_out_at: new Date().toISOString() });
    return; // Twilio sends the carrier opt-out confirmation; stay silent.
  }
  // HELP/INFO → compliant program reply (brand + support + opt-out). Matches the registered
  // A2P campaign. If Twilio Advanced Opt-Out is enabled it intercepts HELP before the webhook;
  // this covers the case where it isn't, so HELP always works.
  if (['HELP', 'INFO'].includes(keyword)) {
    await safeSend(
      phone,
      `Tally here! I log your business expenses by text. Recordkeeping, not tax advice. Need a hand? Visit ${appBase()}. Msg & data rates may apply. Reply STOP to opt out.`,
      msg.channel,
    );
    return;
  }
  // "YES" only means re-subscribe when actually opted out — otherwise it's a normal reply
  // (e.g. confirming a recurring renewal/offer, DEC-033) and must flow through to processing.
  const isResubscribe = ['START', 'UNSTOP'].includes(keyword) || (keyword === 'YES' && !!user.sms_opted_out_at);
  if (isResubscribe) {
    await updateUser(user.id, { sms_opted_out_at: null });
    await safeSend(phone, "Welcome back! 👋 You're re-subscribed to Tally. Send me an expense anytime.", msg.channel);
    return;
  }
  // Opted out: the text is logged above (it's still their record), but no processing and no
  // reply until they send START. The carrier would block a reply anyway; this also stops the
  // LLM spend, and WhatsApp has no carrier-level STOP to rely on.
  if (user.sms_opted_out_at) return;

  // Inbound rate limit (DEC-034): STOP/START already handled above so opt-out always works.
  // On a flood, skip the LLM-heavy processing to cap cost/abuse — tell them once near the
  // threshold, then go silent to avoid amplifying an SMS loop.
  const since = new Date(Date.now() - INBOUND_WINDOW_MIN * 60 * 1000).toISOString();
  const recentInbound = await countRecentInbound(user.id, since);
  if (recentInbound > INBOUND_MAX) {
    if (recentInbound <= INBOUND_MAX + 5) {
      await safeSend(phone, "Whoa, that's a lot at once! Give me a few minutes to catch up, then resend anything I missed.", msg.channel);
    }
    log.warn('inbound_rate_limited', { user: user.id, recent: recentInbound });
    return;
  }
  // Daily cap: catches sustained use the 10-min cap would miss. Tell them once (on the first
  // message over), then stay silent to avoid amplifying an SMS loop.
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const dayInbound = await countRecentInbound(user.id, dayAgo);
  if (dayInbound > INBOUND_MAX_PER_DAY) {
    if (dayInbound === INBOUND_MAX_PER_DAY + 1) {
      await safeSend(phone, "That's a big day! I've hit my limit for today. Send anything else tomorrow and I'll log it.", msg.channel);
    }
    log.warn('inbound_daily_capped', { user: user.id });
    return;
  }

  // Co-owner invite not yet accepted: nothing they send reaches the inviter's books until they
  // reply YES (NO moves them to their own account and onboarding continues normally).
  if (user.join_status) {
    const consent = await resolveJoinConsent(user, msg.body);
    user = consent.user;
    if (consent.reply) {
      await safeSend(phone, consent.reply, msg.channel);
      await logConversation({ userId: user.id, organizationId: user.organization_id, direction: 'outbound', messageText: consent.reply });
      return;
    }
  }

  // Hybrid paywall (DEC-021): after the 21-day trial (and no active subscription), gate
  // continued use. Skipped entirely until onboarding is finished (DEC-063): a brand-new user
  // is always inside the trial, so the entitlement lookup would just be a wasted round trip on
  // the latency-sensitive, LLM-free setup path — and we'd never want to paywall someone partway
  // through signup anyway.
  if (user.onboarding_completed) {
    const entitlement = await getOrgEntitlement(user.organization_id);
    if (!entitlement.entitled) {
      // One-tap magic link (falls back to /pricing if SUBSCRIBE_LINK_SECRET isn't set) — DEC-062.
      // The subscribe token is deterministic per UTC day (subscribe-link.ts), so a repeatedly-
      // blocked user gets the identical paywall message — no caching layer needed here.
      const paywall = `Your Tally trial has ended. Subscribe to keep logging expenses: ${subscribeUrl(user.organization_id)}`;
      await safeSend(phone, paywall, msg.channel);
      await logConversation({
        userId: user.id,
        organizationId: user.organization_id,
        direction: 'outbound',
        messageText: paywall,
      });
      return;
    }
  }

  let reply: ProcessResult;
  try {
    // One-time "we've made some changes" check-in (setup-checkin.ts). Only a clear answer is
    // consumed; anything else (expense, photo, question) falls through and is logged normally.
    // An open expense question wins: its "yes"/"no" must not be read as a check-in answer.
    const checkin =
      user.onboarding_completed && user.setup_checkin_at && msg.numMedia === 0 && !(await getPendingContext(user.id))
        ? await handleSetupCheckin(user, msg.body)
        : null;
    if (checkin) {
      reply = { smsText: checkin, receiptId: null, contextState: null };
    } else if (user.onboarding_completed) {
      // Profession-aware categorization prior (Spec 09): lazily derive + persist the business
      // profile on the first post-onboarding message so the user's first logged expense is already
      // profession-aware. Best-effort — ensureBusinessProfile self-heals and never throws, returning
      // the user unchanged on failure (retried next message). No-op once the profile exists.
      const enriched = await ensureBusinessProfile(user);
      reply = await handleExpenseFlow(enriched, msg);
    } else {
      // Setup asks one question at a time, so a burst of texts (e.g. three "hi"s Linq released at
      // once) would each answer it and each get a reply. Wait a beat and answer only the newest.
      // Not done after onboarding: two quick texts there can be two real expenses.
      if (inboundId) {
        await new Promise((r) => setTimeout(r, ONBOARDING_BURST_MS));
        if (!(await isNewestInbound(user.id, inboundId))) {
          log.info('onboarding_burst_skipped', { user: user.id });
          return;
        }
      }
      const smsText = await handleOnboarding(user, msg.body);
      // Finishing setup is a milestone: confetti (DEC-087). onboardingComplete() always opens this way.
      const done = /^You're all set/.test(smsText);
      reply = { smsText, receiptId: null, contextState: null, effect: done ? 'confetti' : undefined };
    }
  } catch (err) {
    log.error('sms_processing_failed', { user: user.id, message: errMsg(err) });
    reply = { smsText: MSG.failure, receiptId: null, contextState: null };
  }

  // Follow-up questions thread under the message they're about (DEC-087).
  const opts: SendOptions = {
    chatId: msg.linq?.chatId,
    replyTo: reply.contextState ? msg.linq?.messageId : undefined,
    effect: reply.effect,
  };
  for (const text of [reply.smsText, reply.followUp]) {
    if (!text) continue;
    await safeSend(phone, text, msg.channel, opts);
    // Both carry the same receipt + state; the follow-up is logged last, so it's the open question.
    await logConversation({
      userId: user.id,
      organizationId: user.organization_id,
      direction: 'outbound',
      messageText: text,
      receiptId: reply.receiptId,
      contextState: reply.contextState,
      pendingData: reply.pendingData,
    });
  }
  if (msg.linq) await afterLinqReply(user, msg, reply, msg.linq);
}

/**
 * iMessage extras after a reply lands (DEC-087), all best-effort:
 *  - Logged with nothing left to ask → tapback the user's message (❤️ a receipt photo, 👍 a text).
 *  - Remember which message created the receipt, so an iMessage edit of it can correct it.
 *  - Drop Penny's contact card into the chat once (skipped for users who renamed her, since the
 *    card is set per line and would say "Penny").
 */
async function afterLinqReply(
  user: AppUser,
  msg: InboundMessage,
  reply: ProcessResult,
  linq: { messageId: string; chatId: string },
): Promise<void> {
  try {
    if (reply.receiptId) {
      await updateReceipt(user.organization_id, reply.receiptId, { source_message_id: linq.messageId });
      if (!reply.contextState) await reactLinq(linq.messageId, msg.numMedia > 0 ? 'love' : 'like');
    }
    const keepsPenny = !user.agent_name || user.agent_name === DEFAULT_AGENT_NAME;
    if (keepsPenny && !user.linq_card_shared_at && (await shareContactCard(linq.chatId))) {
      await updateUser(user.id, { linq_card_shared_at: new Date().toISOString() });
    }
  } catch (err) {
    log.warn('linq_extras_failed', { user: user.id, message: errMsg(err) });
  }
}

/**
 * The user edited one of their texts in iMessage (DEC-087), e.g. "$45 lunch" → "$54 lunch". If that
 * message created a receipt, apply the new text as a correction (the same trusted edit path as a
 * post-log correction) and reply in a thread under it. Edits of anything else are ignored.
 */
export async function handleInboundEdit(edit: { from: string; messageId: string; chatId: string; text: string }): Promise<void> {
  const phone = normalizeToE164(edit.from);
  const user = phone ? await getUserByPhone(phone) : null;
  if (!phone || !user || user.sms_opted_out_at) return;
  const receipt = await getReceiptBySourceMessage(user.organization_id, edit.messageId);
  if (!receipt) return;

  await logConversation({
    userId: user.id,
    organizationId: user.organization_id,
    direction: 'inbound',
    messageText: `[edited] ${edit.text}`,
    receiptId: receipt.id,
  });
  let result: ProcessResult;
  try {
    result = await processCorrection(
      user,
      receipt.id,
      `I edited my original message for this expense. It now reads: "${edit.text}"`,
    );
  } catch (err) {
    log.error('inbound_edit_failed', { user: user.id, message: errMsg(err) });
    return;
  }
  await safeSend(phone, result.smsText, 'sms', { chatId: edit.chatId, replyTo: edit.messageId });
  await logConversation({
    userId: user.id,
    organizationId: user.organization_id,
    direction: 'outbound',
    messageText: result.smsText,
    receiptId: result.receiptId,
    contextState: result.contextState,
    pendingData: result.pendingData,
  });
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : 'unknown';
}

async function safeSend(to: string, body: string, channel: Channel, opts: SendOptions = {}): Promise<void> {
  try {
    await sendMessage(to, body, channel, opts);
  } catch (err) {
    log.error('message_send_failed', { to: maskPhone(to), channel, message: errMsg(err) });
  }
}

// re-export for the route
export type { ContextState };
