// GET /api/cron/trial-reminders — proactive trial-expiry nudges (DEC-061). Runs daily via Vercel
// Cron (see vercel.json). Secured by CRON_SECRET. Sends, per trial, at most ONE "ending soon"
// (T-3) message and ONE "ended" message — each stamped on the org so it's never re-sent. Reaches
// people BEFORE the reactive paywall, and catches silent drifters who'd otherwise never come back.
//
// Marcus: trial-end is the #1 conversion moment. Jordan: factual + opt-out respected (TCPA).

import { NextResponse } from 'next/server';
import { requireCron, jsonError } from '@/lib/api';
import { listTrialingForReminder, stampTrialReminder, trialReminderDue } from '@/lib/subscription';
import { getOrgOwnerContact } from '@/lib/users';
import { trialEndingSoonSms, trialEndedSms } from '@/lib/prompts';
import { subscribeUrl } from '@/lib/subscribe-link';
import { sendSms } from '@/lib/twilio';
import { log, maskPhone } from '@/lib/log';

const DAY_MS = 24 * 60 * 60 * 1000;

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

  let ending = 0;
  let ended = 0;
  let skippedOptedOut = 0;

  for (const org of orgs) {
    const kind = trialReminderDue(org, now);
    if (!kind) continue;

    const owner = await getOrgOwnerContact(org.id);
    if (!owner) continue;
    if (owner.optedOut) {
      // Respect opt-out but still stamp, so we don't re-evaluate this org every day.
      await stampTrialReminder(org.id, kind).catch(() => {});
      skippedOptedOut++;
      continue;
    }

    const firstName = owner.full_name?.trim().split(/\s+/)[0] || undefined;
    const link = subscribeUrl(org.id); // one-tap magic link (falls back to /pricing if unconfigured)
    const body =
      kind === 'ending'
        ? trialEndingSoonSms(link, Math.max(1, Math.ceil((new Date(org.trial_ends_at!).getTime() - now.getTime()) / DAY_MS)), firstName)
        : trialEndedSms(link, firstName);

    try {
      await sendSms(owner.phone_number, body);
      // Stamp only after a successful send, so a transient failure retries tomorrow.
      await stampTrialReminder(org.id, kind);
      if (kind === 'ending') ending++;
      else ended++;
    } catch (err) {
      log.warn('trial_reminder_send_failed', { org: org.id, phone: maskPhone(owner.phone_number), message: err instanceof Error ? err.message : 'unknown' });
    }
  }

  log.info('trial_reminders_sent', { ending, ended, skippedOptedOut, scanned: orgs.length });
  return NextResponse.json({ ok: true, ending, ended, skippedOptedOut });
}
