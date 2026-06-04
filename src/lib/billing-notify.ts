// Subscription notifications (DEC-059). The one-time "welcome / you're locked in" SMS sent when a
// user FIRST subscribes. Kept out of the webhook route so the route stays a thin dispatcher and we
// avoid import cycles. Best-effort by design — a failed notification must never fail the webhook.

import { getOrgOwnerContact } from './users';
import { subscriptionWelcome } from './prompts';
import { sendMessage } from './twilio';
import { PUBLIC_ENV } from './env';
import { log } from './log';

/**
 * Send the one-time subscribe-welcome SMS to the org owner. Caller guarantees this fires only on
 * the FIRST transition to active (not on renewals/retries — see the billing webhook). Skips an
 * opted-out owner (TCPA). Throws are the caller's to swallow.
 */
export async function sendSubscriptionWelcome(orgId: string): Promise<void> {
  const owner = await getOrgOwnerContact(orgId);
  if (!owner) {
    log.warn('subscription_welcome_no_owner', { org: orgId });
    return;
  }
  if (owner.optedOut) {
    log.info('subscription_welcome_skipped_opted_out', { org: orgId });
    return;
  }
  const firstName = owner.full_name?.trim().split(/\s+/)[0] || undefined;
  const body = subscriptionWelcome(PUBLIC_ENV.appUrl || 'https://tallywhy.com', firstName);
  await sendMessage(owner.phone_number, body, 'sms');
  log.info('subscription_welcome_sent', { org: orgId });
}
