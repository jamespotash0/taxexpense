// Inbound SMS orchestration (TSNAP-016/017/023/024/026). The route validates the
// Twilio signature and parses the body, then hands a clean InboundMessage here.
// This function owns the conversation flow and ALWAYS sends exactly one reply.

import { normalizeToE164 } from './phone';
import { getOrCreateUserByPhone, touchLastActive, updateUser, type AppUser } from './users';
import { notifyAdminNewSignup } from './admin-notify';
import { logConversation, getPendingContext, countRecentInbound, getPendingFlagChoice, getPendingAmount, type ContextState, type PendingContext } from './conversations';
import { getSubstantiationRule } from './substantiation';
import { categoryLabel } from './categories';
import { handleOnboarding } from './onboarding';
import {
  fetchTwilioMedia,
  extractAndCategorizeReceiptFromImageData,
  storePhotoBuffer,
  parseAndCategorizeText,
  type OcrResult,
} from './ocr';
import { processNewExpense, processClarification, processCorrection, processAttachment, type ProcessResult } from './expense';
import type { CategoryResult } from './categorize';
import { routeTextMessage, resolveFlagChoice, looksLikeExpenseCapture } from './router';
import { subscribeUrl } from './subscribe-link';
import { getReceipt, getLatestReceiptSince } from './receipts';
import { todayISO } from './format';
import {
  isAffirmative,
  isNegative,
  getAwaitingConfirm,
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

export interface InboundMessage {
  from: string;
  body: string;
  numMedia: number;
  mediaUrls: string[];
  channel: Channel;
}

// Inbound rate limits (DEC-034/036): cap LLM-heavy processing per user to blunt cost/abuse.
// A 10-min burst cap stops floods; a daily cap backstops sustained low-rate abuse. Generous
// enough for a real burst of receipts.
const INBOUND_WINDOW_MIN = 10;
const INBOUND_MAX = 25;
const INBOUND_MAX_PER_DAY = 200;

// Partial-capture ("how much was this?") retry cap (DEC-064). After this many re-asks with
// still no amount, give up cleanly rather than loop. 1 = at most two prompts total.
const MAX_AMOUNT_RETRIES = 1;

// Post-log correction / addendum markers (DEC-064). Shared by `looksLikeCorrection` (does this
// follow-up edit the prior receipt?) and `replyStartsNewExpense` (which strips them, so a marker
// word is never mistaken for the "description" that makes a message a fresh expense). One source
// string → a test regex + a global strip regex, so the two never drift.
const _CORRECTION_MARKER_SRC =
  "actually|instead|correction|i meant|nope|wrong|change|fix|that'?s not|it'?s not|not (a|an|the|business|personal)|should be|make (it|that)|set (it|that)|mark (it|that)|it'?s (a|an|the|actually|for|not)|that'?s (a|an|the|actually|for|not)|it was|that was|these were|those were|is (a|an|the)|was (a|an|the)|add ";
const CORRECTION_MARKER_RE = new RegExp(`\\b(${_CORRECTION_MARKER_SRC})`, 'i');
const _CORRECTION_MARKER_G = new RegExp(`\\b(${_CORRECTION_MARKER_SRC})`, 'gi');

// A reply that on its OWN names an expense (an amount/miles PLUS a real description) is the user
// starting a fresh capture, not answering "how much?" or correcting the last one — so we log it
// alone instead of gluing it onto a partial or editing the prior receipt (DEC-064, Priya edge a).
// A bare "$167", or a pure amount-correction like "actually it was $200" (only a marker survives
// the strip), has no description left → NOT fresh.
const _AMOUNT_TOKEN_RE = /\$?\s*\d+(?:\.\d{1,2})?/g;
export function replyStartsNewExpense(text: string): boolean {
  if (!looksLikeExpenseCapture(text)) return false; // no $-amount/miles, or it's a question → not fresh
  const rest = text
    .replace(_AMOUNT_TOKEN_RE, ' ')
    .replace(_CORRECTION_MARKER_G, ' ') // marker words aren't "new expense" content
    .replace(/\b(it|that|this|was|were|is|no|not|nope|yes|about|around|roughly|like|just|the|a|an|for|of|approx|approximately|dollars|bucks|mi|mile|miles)\b/gi, ' ')
    .trim();
  return /[a-z]{3,}/i.test(rest); // a real descriptive word survives → self-contained capture
}

// "Why / what's the purpose" questions → answered DETERMINISTICALLY from the substantiation
// rule + IRC summary (no LLM call, so explaining can't drive up charges — DEC-036).
const EXPLAIN_RE = /\b(why|what for|what'?s (the )?(point|reason|purpose)|how come|explain|what do you (need|mean)|why (do|are|would) you|the purpose)\b/i;

// Confirmations to a "did I read that right?" verify (DEC-066), beyond the yes/yeah that
// isAffirmative already covers — so a plain "looks right" confirms without spending a correction call.
const CONFIRM_RE = /\b(correct|right|looks? (good|right|fine)|that'?s right|perfect|spot on|exactly|yep|yup|all good)\b/i;

// Post-log correction window (DEC-064): how long after a clean log a follow-up may still edit that
// receipt. Tight, so a stale receipt never absorbs an unrelated later message (Priya edge c).
const CORRECTION_WINDOW_MIN = 15;

/** True when a follow-up reads like an edit to the just-logged receipt: it carries a correction/
 *  addendum marker (incl. amount fixes like "actually it was $200"), or it names the receipt's
 *  vendor (e.g. "Tabernacle is a restaurant"). The caller only reaches this for non-fresh messages
 *  (see replyStartsNewExpense), so a self-contained new expense never lands here. */
export function looksLikeCorrection(text: string, vendor: string | null): boolean {
  if (CORRECTION_MARKER_RE.test(text)) return true;
  if (vendor) {
    const lower = text.toLowerCase();
    // Match on a meaningful vendor token (≥4 chars) so short/common words don't false-trigger.
    const hit = vendor
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .some((tok) => tok.length >= 4 && lower.includes(tok));
    if (hit) return true;
  }
  return false;
}

// User-facing error/help copy (TSNAP-026 / Sofia — human, not technical).
const MSG = {
  notReceipt: "That doesn't look like a receipt. Want to describe the expense in text instead?",
  unreadable: "That photo's a bit blurry. Can you snap another, or just text me the details?",
  needAmount: 'Got it — quick: how much was this?',
  // After re-asking once with no amount, stop the loop gracefully (DEC-064). Don't log a $0
  // phantom — just invite a clean resend so the next message starts fresh.
  amountGiveUp:
    "No worries — I didn't catch an amount, so I haven't logged this one. When you have it, send it like \"$45 lunch with a client\" and I'll take it from there.",
  help: 'Send me a business expense — a receipt photo, text like "$30 gas to client site", or "drove 40 miles to Acme".',
  failure: "Hmm, that didn't go through on my end. Mind sending it once more?",
  // Parser failed (not a delivery failure — the message arrived and is saved). Sofia copy.
  couldntRead: "I couldn't quite make that one out. Mind rephrasing it — something like \"$30 gas to client site\" works great.",
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

async function handleTextAsNewExpense(user: AppUser, body: string): Promise<ProcessResult> {
  if (!body.trim()) return { smsText: MSG.help, receiptId: null, contextState: null };

  // The inbound text is already persisted by handleInboundSms before we parse, so a parser
  // failure loses nothing — reply helpfully instead of letting it throw to the generic
  // failure path (red-team graceful_fail; team DEC). The merged call has no internal fallback.
  let parsed: Awaited<ReturnType<typeof parseAndCategorizeText>>['parsed'];
  let category: CategoryResult;
  try {
    ({ parsed, category } = await parseAndCategorizeText(body, user));
  } catch (err) {
    log.warn('text_parse_failed', { user: user.id, message: errMsg(err) });
    return { smsText: MSG.couldntRead, receiptId: null, contextState: null };
  }
  if (parsed.amount == null && parsed.business_miles == null) {
    // Don't fire-and-forget: remember what we already parsed so the user's "$167" reply can be
    // combined + re-parsed into THIS expense instead of being logged as a new contextless one
    // (the §262/$0 phantom + "how much?" loop). DEC-064. Completion is owned by handleExpenseFlow.
    return {
      smsText: MSG.needAmount,
      receiptId: null,
      contextState: 'awaiting_amount',
      pendingData: { priorText: body, amountAttempts: 0 },
    };
  }

  const input: ExpenseInput = {
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
  // Pass the parse confidence so an ambiguous text read (e.g. conflicting amounts) gets verified
  // instead of silently logged (DEC-066).
  return processNewExpense(user, input, null, category, parsed.confidence);
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
  return {
    smsText: `${result.smsText}\n\n${offerRecurring(receipt.vendor, receipt.amount_cents, reason)}`,
    receiptId: result.receiptId,
    contextState: 'awaiting_recurring_optin',
  };
}

/** "YES" to a recurring offer → create the monthly template from the source receipt. */
async function handleRecurringOptin(user: AppUser, receiptId: string): Promise<ProcessResult | null> {
  const receipt = await getReceipt(user.organization_id, receiptId);
  if (!receipt) return null;
  await createRecurringFromReceipt(receipt, todayISO());
  return { smsText: recurringCreatedMsg(receipt.vendor, receipt.amount_cents), receiptId, contextState: null };
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
      ? `That's a lot of expenses in one day — I've saved every one. I'll catch up on new ones shortly so nothing gets garbled; everything so far is on your dashboard: ${appBase()}.`
      : `You've reached your plan's expense limit for the year — everything's saved and exportable. If you're logging this much, let's get you on a plan that fits: email support@tallywhy.com.`;
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
    smsText: `${result.smsText}\n\nI also saw ${noun} in that message — I log them one at a time, so send ${them} again separately and I'll catch each one.`,
  };
}

/** Append a one-line annual-quota nudge to an otherwise-normal reply (only fires at milestones). */
function withAnnualNudge(decision: UsageDecision, result: ProcessResult): ProcessResult {
  if (decision.kind !== 'warn_annual') return result;
  return {
    ...result,
    smsText: `${result.smsText}\n\nHeads up — you're near your yearly expense limit (${decision.used}/${ANNUAL_RECEIPT_QUOTA}). Logging a lot? Email support@tallywhy.com about a high-volume plan.`,
  };
}

// Closing line on any tax-guidance reply (suggest-not-advise + CPA deferral).
const CPA_NOTE = 'Suggestion, not advice — for your situation, check with a CPA.';

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
        `${categoryLabel(receipt.category)} is a strict category — to deduct it the IRS (§${section}) needs${need}. That's the only reason I asked; everything else I just log.\n\n§${section} in plain English → ${base}/irc/${section}`,
        pending,
      );
    }
  }

  if (pending?.contextState === 'awaiting_receipt') {
    return reply(
      `For strict categories (meals, travel, gifts) the IRS asks for a receipt photo once an expense is $75+ (lodging at any amount). Under $75 your text is the record — so I only ask when the code requires it.`,
      pending,
    );
  }

  if (pending?.contextState === 'awaiting_recurring_optin') {
    return reply(
      `I noticed this one repeats — tracking it means I'll check in each month so you don't have to re-text it. Nothing gets logged until you confirm. Reply YES to track it.`,
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
    const { buffer, contentType } = await fetchTwilioMedia(msg.mediaUrls[0]);
    const { ocr, category } = await extractAndCategorizeReceiptFromImageData(buffer, contentType, user, caption);

    // If a receipt is awaiting a photo, try to attach this one first (stores on match).
    if (pending) {
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

  // Verify reply to a low-confidence read (DEC-066). "yes"/"looks right" confirms as-is
  // (deterministic, no LLM); a "why?" falls through to the explain branch (keeps it open); anything
  // else that isn't a fresh self-contained expense is a correction → fix the receipt in place. If
  // they ignore it and send a new expense, fall through and log that (the verify expires in 24h).
  // Checked before the recurring Y/N below so a verify "yes" isn't taken as a renewal confirmation.
  if (pending?.contextState === 'awaiting_confirm') {
    if (isAffirmative(msg.body) || CONFIRM_RE.test(msg.body)) {
      return { smsText: '✓ Great — locked it in.', receiptId: pending.receiptId, contextState: null };
    }
    if (!replyStartsNewExpense(msg.body) && !EXPLAIN_RE.test(msg.body)) {
      const corrected = await processCorrection(user, pending.receiptId, msg.body);
      if (corrected.receiptId !== null) return corrected;
      // receipt vanished mid-flight → fall through to new-expense handling
    }
  }

  // Y/N answer to a monthly recurring nudge (DEC-033). Only query when the reply is a bare
  // yes/no, so normal expenses skip the lookup.
  if (isAffirmative(msg.body) || isNegative(msg.body)) {
    const tmpl = await getAwaitingConfirm(user.id);
    if (tmpl) return handleRenewalConfirm(user, tmpl, msg.body);
  }

  // "YES" to a recurring-tracking offer → create the template.
  if (pending?.contextState === 'awaiting_recurring_optin' && isAffirmative(msg.body)) {
    const optin = await handleRecurringOptin(user, pending.receiptId);
    if (optin) return optin;
  }

  // Numbered reply to a "which one to flag?" disambiguation (DEC-039). Only query when the
  // message is a bare number, so normal messages skip the lookup.
  if (/^\s*[1-9]\s*$/.test(msg.body)) {
    const candidateIds = await getPendingFlagChoice(user.id);
    if (candidateIds) return resolveFlagChoice(user, candidateIds, parseInt(msg.body.trim(), 10));
  }

  // Partial expense awaiting its amount (DEC-064). We asked "how much?" and stashed the text we'd
  // already parsed. Combine it with this reply and re-parse so "$167" completes THIS expense
  // instead of being logged as a new contextless one. Skipped when the reply is itself a fresh,
  // self-contained capture (Priya edge a) — then we just log that and let the stale partial expire.
  const pendingAmt = await getPendingAmount(user.id);
  if (pendingAmt && !replyStartsNewExpense(msg.body)) {
    // "Why do you need it?" mid-ask → explain but KEEP the partial (Priya edge b); don't drop it.
    if (EXPLAIN_RE.test(msg.body)) {
      return {
        smsText: `I just need the amount to log it — what did it come to?\n\n${CPA_NOTE}`,
        receiptId: null,
        contextState: 'awaiting_amount',
        pendingData: { priorText: pendingAmt.priorText, amountAttempts: pendingAmt.attempts },
      };
    }
    if (blocked) return cappedReply(decision);
    const combined = `${pendingAmt.priorText} ${msg.body}`.trim();
    const result = await maybeOfferRecurring(user, await handleTextAsNewExpense(user, combined));
    // Got an amount → it logged normally (contextState is no longer awaiting_amount).
    if (result.contextState !== 'awaiting_amount') return withAnnualNudge(decision, result);
    // Still no amount. Re-ask once more, then give up cleanly — never log a $0 phantom.
    if (pendingAmt.attempts >= MAX_AMOUNT_RETRIES) {
      return { smsText: MSG.amountGiveUp, receiptId: null, contextState: null };
    }
    return { ...result, pendingData: { priorText: combined, amountAttempts: pendingAmt.attempts + 1 } };
  }

  // "Why / what's the purpose" → explain deterministically (no LLM), keeping any open
  // question intact. Checked before clarification so a "why?" isn't taken as the answer.
  if (EXPLAIN_RE.test(msg.body)) {
    return explainWhy(user, pending);
  }

  // Text message answering a pending context question → clarification flow.
  if (pending && pending.contextState === 'awaiting_context') {
    const clar = await processClarification(user, pending.receiptId, pending.questionText, msg.body);
    if (clar.receiptId !== null) return clar;
    // pending receipt vanished → fall through to new expense
  }

  // Conversational router (DEC-029): answer read-only questions ("how much on meals
  // this year?", "last 3 charges", "review my year") and safe commands. Returns null
  // when the message is an expense to capture, so the workflow path below still runs.
  const routed = await routeTextMessage(user, msg.body);
  if (routed) return routed;

  // Post-log correction window (DEC-064): a follow-up right after a clean log that reads like an
  // edit ("Tabernacle is a restaurant", "that was a client meal", "actually it was $200") edits the
  // last receipt instead of creating a duplicate. We only get here for non-fresh messages — a
  // self-contained new expense ("$50 gas to Acme") is filtered by replyStartsNewExpense, which also
  // routes amount-only corrections here. Then we need a recent receipt + a correction marker / vendor
  // mention. Uncapped: it edits an existing receipt, it doesn't log a new one.
  if (!replyStartsNewExpense(msg.body)) {
    const since = new Date(Date.now() - CORRECTION_WINDOW_MIN * 60 * 1000).toISOString();
    const recent = await getLatestReceiptSince(user.organization_id, since);
    if (recent && looksLikeCorrection(msg.body, recent.vendor)) {
      const corrected = await processCorrection(user, recent.id, msg.body);
      if (corrected.receiptId !== null) return corrected;
      // receipt vanished mid-flight → fall through to new-expense handling
    }
  }

  // New text expense → subject to the usage caps (checked after the router so read-only
  // queries above are never blocked, and before parse/categorize so a blocked user costs nothing).
  if (blocked) return cappedReply(decision);
  return withAnnualNudge(decision, await maybeOfferRecurring(user, await handleTextAsNewExpense(user, msg.body)));
}

/** Top-level inbound handler. Always sends exactly one SMS reply. */
export async function handleInboundSms(msg: InboundMessage): Promise<void> {
  const phone = normalizeToE164(msg.from);
  if (!phone) {
    log.warn('inbound_unparseable_from', { from: maskPhone(msg.from) });
    return;
  }

  let user: AppUser;
  try {
    const result = await getOrCreateUserByPhone(phone);
    user = result.user;
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
  await Promise.all([
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
  const keyword = msg.body.trim().toUpperCase();
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
      'Tally: log business expenses by text. Help: support@tallywhy.com. Msg & data rates may apply. Reply STOP to opt out.',
      msg.channel,
    );
    return;
  }
  // "YES" only means re-subscribe when actually opted out — otherwise it's a normal reply
  // (e.g. confirming a recurring renewal/offer, DEC-033) and must flow through to processing.
  const isResubscribe = ['START', 'UNSTOP'].includes(keyword) || (keyword === 'YES' && !!user.sms_opted_out_at);
  if (isResubscribe) {
    await updateUser(user.id, { sms_opted_out_at: null });
    await safeSend(phone, "You're re-subscribed to Tally. Send an expense any time.", msg.channel);
    return;
  }

  // Inbound rate limit (DEC-034): STOP/START already handled above so opt-out always works.
  // On a flood, skip the LLM-heavy processing to cap cost/abuse — tell them once near the
  // threshold, then go silent to avoid amplifying an SMS loop.
  const since = new Date(Date.now() - INBOUND_WINDOW_MIN * 60 * 1000).toISOString();
  const recentInbound = await countRecentInbound(user.id, since);
  if (recentInbound > INBOUND_MAX) {
    if (recentInbound <= INBOUND_MAX + 5) {
      await safeSend(phone, "You're sending a lot at once — I'll catch up. Give it a few minutes and resend anything I missed.", msg.channel);
    }
    log.warn('inbound_rate_limited', { user: user.id, recent: recentInbound });
    return;
  }
  // Daily backstop: well above any real day's usage; catches sustained low-rate abuse the
  // 10-min cap would miss. Stay silent (already warned in-burst) to avoid amplification.
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  if ((await countRecentInbound(user.id, dayAgo)) > INBOUND_MAX_PER_DAY) {
    log.warn('inbound_daily_capped', { user: user.id });
    return;
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
    reply = user.onboarding_completed
      ? await handleExpenseFlow(user, msg)
      : { smsText: await handleOnboarding(user, msg.body), receiptId: null, contextState: null };
  } catch (err) {
    log.error('sms_processing_failed', { user: user.id, message: errMsg(err) });
    reply = { smsText: MSG.failure, receiptId: null, contextState: null };
  }

  await safeSend(phone, reply.smsText, msg.channel);
  await logConversation({
    userId: user.id,
    organizationId: user.organization_id,
    direction: 'outbound',
    messageText: reply.smsText,
    receiptId: reply.receiptId,
    contextState: reply.contextState,
    pendingData: reply.pendingData,
  });
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : 'unknown';
}

async function safeSend(to: string, body: string, channel: Channel): Promise<void> {
  try {
    await sendMessage(to, body, channel);
  } catch (err) {
    log.error('message_send_failed', { to: maskPhone(to), channel, message: errMsg(err) });
  }
}

// re-export for the route
export type { ContextState };
