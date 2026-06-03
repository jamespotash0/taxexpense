// Inbound SMS orchestration (TSNAP-016/017/023/024/026). The route validates the
// Twilio signature and parses the body, then hands a clean InboundMessage here.
// This function owns the conversation flow and ALWAYS sends exactly one reply.

import { normalizeToE164 } from './phone';
import { getOrCreateUserByPhone, touchLastActive, updateUser, type AppUser } from './users';
import { logConversation, getPendingContext, type ContextState } from './conversations';
import { handleOnboarding } from './onboarding';
import { fetchTwilioMedia, extractReceiptFromImageData, storePhotoBuffer, parseTextExpense, type OcrResult } from './ocr';
import { processNewExpense, processClarification, processAttachment, type ProcessResult } from './expense';
import { routeTextMessage } from './router';
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
    return handlePhotoAsNewExpense(user, ocr, msg.body, buffer, contentType);
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

  return handleTextAsNewExpense(user, msg.body);
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
  if (['START', 'UNSTOP', 'YES'].includes(keyword)) {
    await updateUser(user.id, { sms_opted_out_at: null });
    await safeSend(phone, "You're re-subscribed to Tally. Send an expense any time.", msg.channel);
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
