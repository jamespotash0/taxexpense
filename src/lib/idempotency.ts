// Webhook idempotency (migration 0035). Providers deliver at-least-once; each delivery claims
// its provider id before processing, and a second claim of the same id means "already handled".
import { getSupabaseAdmin } from './supabase';
import { log } from './log';

/**
 * True if this is the first time we've seen `id` (process it), false for a redelivery (skip).
 * Fails OPEN on any error other than a duplicate, so a DB blip or a missing table never drops
 * a real message: a rare double-process beats a lost expense.
 */
export async function claimWebhookEvent(id: string): Promise<boolean> {
  const { error } = await getSupabaseAdmin().from('webhook_events').insert({ id });
  if (!error) return true;
  if (error.code === '23505') {
    log.info('webhook_duplicate_skipped', { source: id.split(':')[0] });
    return false;
  }
  log.warn('webhook_claim_failed', { source: id.split(':')[0], code: error.code ?? null });
  return true;
}

/** Undo a claim when processing failed, so the provider's retry is processed (Stripe). */
export async function releaseWebhookEvent(id: string): Promise<void> {
  await getSupabaseAdmin().from('webhook_events').delete().eq('id', id);
}
