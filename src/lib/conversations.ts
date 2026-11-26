// Conversation logging + pending-question state (TSNAP-016, TSNAP-023).
// Every inbound and outbound SMS is logged — this IS the written record for sub-$75
// strict expenses (SPEC note 7 / IRS Reg §1.274-5(c)(2)(iii)). Never store PII beyond
// the message itself; phone lives on the users row.

import { getSupabaseAdmin } from './supabase';
import { log } from './log';

/** When an outbound message asks a question, we tag it so the next inbound is treated as the answer. */
export type ContextState =
  | 'awaiting_context'
  | 'awaiting_receipt'
  | 'awaiting_recurring_optin'
  | 'awaiting_flag_choice'
  // We asked "which expense was that about?" for a late context detail. pending_data carries the
  // candidate ids + the detail text to apply once the user replies with a number.
  | 'awaiting_context_choice'
  | 'awaiting_amount'
  // A low-confidence read was just logged and we asked the user to verify the amount (DEC-066).
  // The next reply confirms it ("yes") or corrects it. Carries the logged receipt_id.
  | 'awaiting_confirm';

const PENDING_WINDOW_HOURS = 24; // pending questions expire after this (TSNAP-023)

// A partial-capture ("how much was this?") expires much faster than the 24h question window:
// after a few minutes a bare "$167" is almost certainly a fresh expense, not a late answer to a
// half-parsed one. Keeps a stale priorText from gluing onto an unrelated later message (DEC-064).
const PENDING_AMOUNT_WINDOW_MIN = 15;

/** Structured payload for a multi-value pending interaction (e.g. flag-disambiguation candidates). */
export interface PendingData {
  candidateIds?: string[];
  /** The late context detail waiting for its expense (awaiting_context_choice). */
  contextText?: string;
  /** The text we already parsed when we had to ask for the amount (awaiting_amount). */
  priorText?: string;
  /** How many times we've re-asked for the amount, to cap the loop (awaiting_amount). */
  amountAttempts?: number;
}

export interface LogConversationParams {
  userId: string;
  organizationId: string;
  direction: 'inbound' | 'outbound';
  messageText?: string | null;
  mediaUrl?: string | null;
  receiptId?: string | null;
  contextState?: ContextState | null;
  pendingData?: PendingData | null;
}

/** Returns the new row's id (null if logging failed). */
export async function logConversation(p: LogConversationParams): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin().from('conversations').insert({
    user_id: p.userId,
    organization_id: p.organizationId,
    direction: p.direction,
    message_text: p.messageText ?? null,
    media_url: p.mediaUrl ?? null,
    receipt_id: p.receiptId ?? null,
    context_state: p.contextState ?? null,
    pending_data: p.pendingData ?? null,
  }).select('id').single();
  // Logging failures must not break the SMS flow — warn and continue.
  if (error) log.warn('log_conversation_failed', { direction: p.direction, user: p.userId });
  return data?.id ?? null;
}

/** True if `id` is this user's newest inbound message (ties broken by id, so concurrent handlers
 *  agree). Used to answer only the last of an onboarding burst. Fails open. */
export async function isNewestInbound(userId: string, id: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1);
  if (error || !data?.length) return true;
  return data[0].id === id;
}

/** Count a user's inbound messages since `sinceIso` — for inbound rate limiting (cost/abuse). */
export async function countRecentInbound(userId: string, sinceIso: string): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('direction', 'inbound')
    .gte('created_at', sinceIso);
  if (error) throw error;
  return count ?? 0;
}

export interface PendingContext {
  receiptId: string;
  contextState: ContextState;
  questionText: string | null;
}

/**
 * Find the most recent unanswered question for a user (an outbound message tagged with a
 * context_state + receipt_id, within the 24h window). Returns null if none — caller then
 * treats the inbound message as a new expense.
 */
export async function getPendingContext(userId: string): Promise<PendingContext | null> {
  const cutoff = new Date(Date.now() - PENDING_WINDOW_HOURS * 3600 * 1000).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from('conversations')
    .select('receipt_id, context_state, message_text, created_at')
    .eq('user_id', userId)
    .eq('direction', 'outbound')
    .not('receipt_id', 'is', null)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(20); // ponytail: scan cap; a question buried under 20+ replies in 24h is treated as stale
  if (error) throw error;
  return pickPendingContext(data ?? []);
}

/** The newest open question, unless a LATER reply on the same receipt carries no context_state
 *  (the question was answered). A clean log of a different expense doesn't close it, so a late
 *  receipt photo can still attach. Pure, for tests. */
export function pickPendingContext(
  rows: Array<{ receipt_id: string | null; context_state: string | null; message_text: string | null; created_at: string }>,
): PendingContext | null {
  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const i = sorted.findIndex((r) => r.receipt_id && r.context_state);
  if (i < 0) return null;
  const row = sorted[i];
  if (sorted.slice(0, i).some((r) => r.receipt_id === row.receipt_id)) return null; // answered
  return { receiptId: row.receipt_id!, contextState: row.context_state as ContextState, questionText: row.message_text ?? null };
}

export interface PendingAmount {
  priorText: string;
  attempts: number;
}

/**
 * A partial expense awaiting its amount (an outbound tagged `awaiting_amount` within the short
 * amount window). Returns the text we'd already parsed + how many times we've re-asked, so the
 * caller can combine it with the user's reply and re-parse. Null if none — caller treats the
 * inbound as a fresh message. Receipt-id-independent (no draft receipt; state lives in
 * pending_data, like the flag-choice flow). DEC-064.
 */
export async function getPendingAmount(userId: string): Promise<PendingAmount | null> {
  const cutoff = new Date(Date.now() - PENDING_AMOUNT_WINDOW_MIN * 60 * 1000).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from('conversations')
    .select('pending_data, context_state, created_at')
    .eq('user_id', userId)
    .eq('direction', 'outbound')
    .eq('context_state', 'awaiting_amount')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const pd = data?.[0]?.pending_data as PendingData | null;
  const priorText = pd?.priorText;
  if (!priorText) return null;
  return { priorText, attempts: pd?.amountAttempts ?? 0 };
}

export type PendingChoice = { kind: 'flag' | 'context'; candidateIds: string[]; contextText?: string };

/** Of the numbered-choice prompts we sent (flag or late-context), the newest wins. Pure, for tests. */
export function pickPendingChoice(
  rows: Array<{ context_state: string | null; pending_data: PendingData | null; created_at: string }>,
): PendingChoice | null {
  // Only the NEWEST outbound counts: any later message (an answer, a new question) closes the list,
  // so a stray digit days later can't write an old detail onto the wrong expense.
  const newest = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const ids = newest?.pending_data?.candidateIds;
  if (!newest || !ids || ids.length === 0) return null;
  if (newest.context_state === 'awaiting_context_choice') {
    return { kind: 'context', candidateIds: ids, contextText: newest.pending_data?.contextText };
  }
  if (newest.context_state === 'awaiting_flag_choice') return { kind: 'flag', candidateIds: ids };
  return null;
}

/**
 * The newest "which one? reply 1/2/3" prompt within the window: a flag disambiguation (DEC-039) or a
 * late-context "which expense was that about?". Null if none; the caller treats the inbound as normal.
 */
export async function getPendingChoice(userId: string): Promise<PendingChoice | null> {
  const cutoff = new Date(Date.now() - PENDING_WINDOW_HOURS * 3600 * 1000).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from('conversations')
    .select('pending_data, context_state, created_at')
    .eq('user_id', userId)
    .eq('direction', 'outbound')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return pickPendingChoice((data ?? []) as Array<{ context_state: string | null; pending_data: PendingData | null; created_at: string }>);
}
