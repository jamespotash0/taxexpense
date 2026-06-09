// GET /api/cron/trial-reminders — proactive trial-EXPIRY notice (DEC-061, narrowed by DEC-079).
// Runs daily via Vercel Cron (see vercel.json). Secured by CRON_SECRET. Sends ONE "trial ended"
// message per trial, only AFTER it lapses — stamped on the org so it's never re-sent. There is NO
// pre-expiry nudge by design: the trial-start is announced on the first text, and we stay quiet
// until expiry. Catches silent drifters who'd otherwise never come back.
//
// Marcus: trial-end is the #1 conversion moment. Jordan: factual + opt-out respected (TCPA).

import { NextResponse } from 'next/server';
import { requireCron, jsonError } from '@/lib/api';
import { listTrialingForReminder, stampTrialReminder, trialReminderDue } from '@/lib/subscription';
import { getOrgOwnerContact } from '@/lib/users';
import { trialEndedSms } from '@/lib/prompts';
import { subscribeUrl } from '@/lib/subscribe-link';
import { sendSms } from '@/lib/twilio';
import { log, maskPhone } from '@/lib/log';

export async function GET(req: Request): Promise<NextResponse> {
  const denied = requireCron(req);
  if (denied) return denied;

  const now = new Date();

  let orgs;
  try {
    orgs = await listTrialingForReminder(now);
  } catch {
    return jsonError('query_failed', 500);
  }

  let ended = 0;
  let skippedOptedOut = 0;

  for (const org of orgs) {
    if (!trialReminderDue(org, now)) continue;

    const owner = await getOrgOwnerContact(org.id);
    if (!owner) continue;
    if (owner.optedOut) {
      // Respect opt-out but still stamp, so we don't re-evaluate this org every day.
      await stampTrialReminder(org.id).catch(() => {});
      skippedOptedOut++;
      continue;
    }

    const firstName = owner.full_name?.trim().split(/\s+/)[0] || undefined;
    const link = subscribeUrl(org.id); // one-tap magic link (falls back to /pricing if unconfigured)

    try {
      await sendSms(owner.phone_number, trialEndedSms(link, firstName));
      // Stamp only after a successful send, so a transient failure retries tomorrow.
      await stampTrialReminder(org.id);
      ended++;
    } catch (err) {
      log.warn('trial_reminder_send_failed', { org: org.id, phone: maskPhone(owner.phone_number), message: err instanceof Error ? err.message : 'unknown' });
    }
  }

  log.info('trial_reminders_sent', { ended, skippedOptedOut, scanned: orgs.length });
  return NextResponse.json({ ok: true, ended, skippedOptedOut });
}
