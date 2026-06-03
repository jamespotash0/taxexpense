// Inbound SMS orchestration (TSNAP-016/017/023/024/026). The route validates the
// Twilio signature and parses the body, then hands a clean InboundMessage here.
// This function owns the conversation flow and ALWAYS sends exactly one reply.

import { normalizeToE164 } from './phone';
import { getOrCreateUserByPhone, touchLastActive, updateUser, type AppUser } from './users';
import { logConversation, getPendingContext, countRecentInbound, getPendingFlagChoice, type ContextState, type PendingContext } from './conversations';
import { getSubstantiationRule } from './substantiation';
import { categoryLabel } from './categories';
import { handleOnboarding } from './onboarding';
import { fetchTwilioMedia, extractReceiptFromImageData, storePhotoBuffer, parseTextExpense, type OcrResult } from './ocr';
import { processNewExpense, processClarification, processAttachment, type ProcessResult } from './expense';
import { routeTextMessage, resolveFlagChoice } from './router';
import { getReceipt } from './receipts';
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

// "Why / what's the purpose" questions → answered DETERMINISTICALLY from the substantiation
// rule + IRC summary (no LLM call, so explaining can't drive up charges — DEC-036).
const EXPLAIN_RE = /\b(why|what for|what'?s (the )?(point|reason|purpose)|how come|explain|what do you (need|mean)|why (do|are|would) you|the purpose)\b/i;

// User-facing error/help copy (TSNAP-026 / Sofia — human, not technical).
const MSG = {
  notReceipt: "That doesn't look like a receipt. Want to describe the expense in text instead?",
  unreadable: "That photo's a bit blurry. Can you snap another, or just text me the details?",
  needAmount: 'Got it — quick: how much was this?',
  help: 'Send me a business expense — a receipt photo, text like "$30 gas to client site", or "drove 40 miles to Acme".',
  failure: "Hmm, that didn't go through on my end. Mind sending it once more?",
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
    location_city: null,
    business_miles: null,
    has_photo: true,
    raw_text: purpose,
    items: data.items,
  };
}

async function handlePhotoAsNewExpense(
  user: AppUser,
  ocr: OcrResult,
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
  return processNewExpense(user, ocrToInput(ocr.data, bodyText), path);
}

async function handleTextAsNewExpense(user: AppUser, body: string): Promise<ProcessResult> {
  if (!body.trim()) return { smsText: MSG.help, receiptId: null, contextState: null };

  const parsed = await parseTextExpense(body);
  if (parsed.amount == null && parsed.business_miles == null) {
    return { smsText: MSG.needAmount, receiptId: null, contextState: null };
  }

  const input: ExpenseInput = {
    amount_cents: parsed.amount != null ? Math.round(parsed.amount * 100) : null,
    vendor: parsed.vendor,
    transaction_date: parsed.transaction_date,
    attendees: parsed.attendees,
    business_purpose: parsed.business_purpose,
    business_relationship: null,
    location_city: null,
    business_miles: parsed.business_miles,
    has_photo: false,
    raw_text: parsed.raw_text,
    items: [],
  };
  return processNewExpense(user, input, null);
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

  if (hasPhoto) {
    // OCR from the bytes FIRST; we only write to Storage once we know the image links
    // to a receipt (prevents orphaned uploads from non-receipt / unmatched photos).
    const { buffer, contentType } = await fetchTwilioMedia(msg.mediaUrls[0]);
    const ocr = await extractReceiptFromImageData(buffer, contentType);

    // If a receipt is awaiting a photo, try to attach this one first (stores on match).
    if (pending) {
      const attached = await processAttachment(user, ocr, buffer, contentType);
      if (attached) return attached;
    }
    return maybeOfferRecurring(user, await handlePhotoAsNewExpense(user, ocr, msg.body, buffer, contentType));
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

  return maybeOfferRecurring(user, await handleTextAsNewExpense(user, msg.body));
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
  } catch (err) {
    log.error('user_lookup_failed', { phone: maskPhone(phone), message: errMsg(err) });
    await safeSend(phone, MSG.failure, msg.channel);
    return;
  }

  // Log inbound + bump activity (best-effort).
  await logConversation({
    userId: user.id,
    organizationId: user.organization_id,
    direction: 'inbound',
    messageText: msg.body || null,
    mediaUrl: msg.mediaUrls[0] ?? null,
  });
  await touchLastActive(user.id);

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

  // Hybrid paywall (DEC-021): after the 21-day trial (and no active subscription),
  // gate continued use. New users are always within trial, so onboarding is unaffected.
  const entitlement = await getOrgEntitlement(user.organization_id);
  if (!entitlement.entitled) {
    const base = PUBLIC_ENV.appUrl || 'https://tallywhy.com';
    const paywall = `Your Tally trial has ended. Subscribe to keep logging expenses: ${base}/pricing`;
    await safeSend(phone, paywall, msg.channel);
    await logConversation({
      userId: user.id,
      organizationId: user.organization_id,
      direction: 'outbound',
      messageText: paywall,
    });
    return;
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
