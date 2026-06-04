// Subscription notifications (DEC-059/060). The one-time "welcome / you're locked in" SMS sent
// when a user FIRST subscribes. Kept out of the webhook route so the route stays a thin dispatcher
// and we avoid import cycles. Best-effort — a failed notification must never fail the webhook.
//
// Idempotency lives HERE, not in the caller: `claim` flips organizations.subscription_welcomed_at
// from null exactly once (race-safe in Postgres), so no matter how many times Stripe re-delivers
// checkout.session.completed, the welcome goes out at most once. `deps` is injectable so the
// idempotency + opt-out logic is unit-testable without a DB.

import { getOrgOwnerContact } from './users';
import { subscriptionWelcome } from './prompts';
import { claimSubscriptionWelcome } from './subscription';
import { sendMessage } from './twilio';
import { PUBLIC_ENV } from './env';
import { log } from './log';

export interface WelcomeDeps {
  /** Atomically claim the one-time welcome; true only for the first caller. */
  claim: (orgId: string) => Promise<boolean>;
  getOwner: (orgId: string) => Promise<{ phone_number: string; full_name: string | null; optedOut: boolean } | null>;
  send: (to: string, body: string) => Promise<unknown>;
}

const realDeps: WelcomeDeps = {
  claim: claimSubscriptionWelcome,
  getOwner: getOrgOwnerContact,
  send: (to, body) => sendMessage(to, body, 'sms'),
};

/**
 * Send the one-time subscribe-welcome SMS to the org owner. Idempotent (atomic claim) and
 * opt-out-aware (TCPA). Order matters: resolve the owner and opt-out FIRST so we don't burn the
 * claim on an owner we'd never text; then claim (at-most-once); then send. Returns what happened
 * (useful for tests/logs). Throwing is the caller's to swallow.
 */
export async function sendSubscriptionWelcome(
  orgId: string,
  deps: WelcomeDeps = realDeps,
): Promise<'sent' | 'already_sent' | 'no_owner' | 'opted_out'> {
  const owner = await deps.getOwner(orgId);
  if (!owner) {
    log.warn('subscription_welcome_no_owner', { org: orgId });
    return 'no_owner';
  }
  if (owner.optedOut) {
    log.info('subscription_welcome_skipped_opted_out', { org: orgId });
    return 'opted_out';
  }
  // Claim AFTER we know we'd actually send — so an opted-out owner doesn't consume the one-shot.
  const claimed = await deps.claim(orgId);
  if (!claimed) {
    log.info('subscription_welcome_already_sent', { org: orgId });
    return 'already_sent';
  }
  const firstName = owner.full_name?.trim().split(/\s+/)[0] || undefined;
  const body = subscriptionWelcome(PUBLIC_ENV.appUrl || 'https://tallywhy.com', firstName);
  await deps.send(owner.phone_number, body);
  log.info('subscription_welcome_sent', { org: orgId });
  return 'sent';
}
