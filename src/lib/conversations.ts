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
  | 'awaiting_flag_choice';

const PENDING_WINDOW_HOURS = 24; // pending questions expire after this (TSNAP-023)

/** Structured payload for a multi-value pending interaction (e.g. flag-disambiguation candidates). */
export interface PendingData {
  candidateIds?: string[];
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

export async function logConversation(p: LogConversationParams): Promise<void> {
  const { error } = await getSupabaseAdmin().from('conversations').insert({
    user_id: p.userId,
    organization_id: p.organizationId,
    direction: p.direction,
    message_text: p.messageText ?? null,
    media_url: p.mediaUrl ?? null,
    receipt_id: p.receiptId ?? null,
    context_state: p.contextState ?? null,
    pending_data: p.pendingData ?? null,
  });
  // Logging failures must not break the SMS flow — warn and continue.
  if (error) log.warn('log_conversation_failed', { direction: p.direction, user: p.userId });
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
    .not('context_state', 'is', null)
    .not('receipt_id', 'is', null)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return {
    receiptId: row.receipt_id as string,
    contextState: row.context_state as ContextState,
    questionText: (row.message_text as string | null) ?? null,
  };
}

/**
 * The candidate receipt ids from a recent "which one? reply 1/2/3" flag-disambiguation prompt
 * (an outbound tagged awaiting_flag_choice within the window). Null if none — caller treats the
 * inbound as a normal message. Receipt-id-independent (the candidates live in pending_data).
 */
export async function getPendingFlagChoice(userId: string): Promise<string[] | null> {
  const cutoff = new Date(Date.now() - PENDING_WINDOW_HOURS * 3600 * 1000).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from('conversations')
    .select('pending_data, context_state, created_at')
    .eq('user_id', userId)
    .eq('direction', 'outbound')
    .eq('context_state', 'awaiting_flag_choice')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const ids = (data?.[0]?.pending_data as PendingData | null)?.candidateIds;
  return ids && ids.length > 0 ? ids : null;
}
