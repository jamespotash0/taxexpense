// AI decision / evaluation log (DEC-080). One append-only row per AI decision the workflow makes,
// captured AT DECISION TIME — see migration 0027_ai_events.sql for why this can't be backfilled
// (in-place edits to receipts destroy the "what the model guessed" signal on write).
//
// This is the source for the future internal eval dashboard: correction rate, over-ask rate, drift
// rate, cost-per-expense. No message text / PII — the transcript stays in [[conversations.ts]];
// this table holds decisions + cost only, keyed to a receipt. Fire-and-forget: a logging failure
// must NEVER break the SMS flow (mirrors logConversation).

import { getSupabaseAdmin } from './supabase';
import { log } from './log';

/** 'categorize' = a fresh AI categorization decision. 'correction' = the user told us the right
 *  answer (the labeled eval example). */
export type AiEventKind = 'categorize' | 'correction';

/** Why the workflow decided to ask the user something (null when we logged silently). The
 *  over-asking rate — asked / total — is the metric the product's positioning lives on. */
export type AskReason = 'context' | 'receipt' | 'amount_verify' | 'category_confirm';

export interface AiEventParams {
  organizationId: string;
  userId?: string | null;
  receiptId?: string | null;
  kind: AiEventKind;
  model?: string | null;
  // Decision fields (kind='categorize').
  category?: string | null;
  ircSection?: string | null;
  confidence?: number | null;
  asked?: boolean;
  askReason?: AskReason | null;
  drifted?: boolean;
  fromMemory?: boolean;
  flaggedReview?: boolean;
  reviewReason?: string | null;
  // Label fields (kind='correction').
  categoryChanged?: boolean | null;
  fromCategory?: string | null;
  toCategory?: string | null;
  amountCorrected?: boolean | null;
  // Cost / latency.
  inputTokens?: number | null;
  outputTokens?: number | null;
  latencyMs?: number | null;
}

export async function logAiEvent(p: AiEventParams): Promise<void> {
  const { error } = await getSupabaseAdmin().from('ai_events').insert({
    organization_id: p.organizationId,
    user_id: p.userId ?? null,
    receipt_id: p.receiptId ?? null,
    kind: p.kind,
    model: p.model ?? null,
    category: p.category ?? null,
    irc_section: p.ircSection ?? null,
    confidence: p.confidence ?? null,
    asked: p.asked ?? false,
    ask_reason: p.askReason ?? null,
    drifted: p.drifted ?? false,
    from_memory: p.fromMemory ?? false,
    flagged_review: p.flaggedReview ?? false,
    review_reason: p.reviewReason ?? null,
    category_changed: p.categoryChanged ?? null,
    from_category: p.fromCategory ?? null,
    to_category: p.toCategory ?? null,
    amount_corrected: p.amountCorrected ?? null,
    input_tokens: p.inputTokens ?? null,
    output_tokens: p.outputTokens ?? null,
    latency_ms: p.latencyMs ?? null,
  });
  // Logging failures must not break the SMS flow — warn and continue.
  if (error) log.warn('log_ai_event_failed', { kind: p.kind, org: p.organizationId });
}
