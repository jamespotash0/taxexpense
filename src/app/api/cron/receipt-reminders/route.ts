// GET /api/cron/receipt-reminders — weekly nudge for expenses still missing a receipt
// (EPIC-3: TSNAP weekly reminder system). Run via Vercel Cron (see vercel.json).
// Secured by CRON_SECRET so it can't be triggered by the public.
//
// Priya's flag: 30-50% of users forget to send the receipt — this closes that loop.
//
// SUPPRESSION (DEC-078): we never nag forever. The query excludes receipts the user has WAIVED
// ("no receipt available") and caps reminders per receipt at RECEIPT_REMINDER_CAP. The capping
// nudge says so explicitly (Alex/Jordan: not silent), and un-receipted expenses stay visible in
// the dashboard cleanup list + on the export. Each successful send increments the per-receipt
// counter (bumpReceiptReminderCounts) so a receipt drops out after the cap.
//
// CADENCE NOTE (Hobby plan): Vercel's Hobby tier only runs crons once per day and
// can't express a weekly schedule, so vercel.json schedules this DAILY ("0 17 * * *")
// and we gate to Mondays here to preserve the intended weekly cadence. On Pro, set the
// schedule back to "0 17 * * 1" and the guard becomes a no-op (it'll still only run Mon).

import { NextResponse } from 'next/server';
import { requireCron, jsonError } from '@/lib/api';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendSms } from '@/lib/twilio';
import { log, maskPhone } from '@/lib/log';
import {
  listReceiptsNeedingReminder,
  bumpReceiptReminderCounts,
  type ReminderCandidate,
} from '@/lib/receipts';

// Only remind about receipts at least this old (don't nag the same day).
const MIN_AGE_HOURS = 24;
// Stop nudging a given receipt after this many weekly reminders (DEC-078) — silence ≠ infinite
// nagging. The last nudge tells the user we're stopping; the gap then lives on the dashboard/export.
const RECEIPT_REMINDER_CAP = 4;
// Weekly cadence preserved on a daily cron: only send on Mondays (UTC). The cron fires
// at 17:00 UTC, so the day never straddles a boundary here.
const WEEKLY_RUN_DAY = 1; // 0=Sun … 1=Mon

/** Compose the per-user nudge. `lastNudge` switches to the explicit "I'll stop asking" copy when
 *  any of the user's receipts will hit the cap on this send (pure — easy to eyeball/test). */
function reminderMessage(firstName: string | null, n: number, lastNudge: boolean): string {
  const lead = firstName ? `Hey ${firstName} — ` : 'Hey — ';
  const noun = n === 1 ? 'expense is' : 'expenses are';
  if (lastNudge) {
    return (
      `${lead}last receipt nudge: ${n} ${noun} still missing a photo. I'll stop asking after this — ` +
      `add one anytime from your dashboard. Note: expenses over $75 need a receipt for your taxes.`
    );
  }
  return (
    `${lead}quick nudge from Tally: ${n} ${noun} still missing a receipt photo. Snap & send when you ` +
    `can and I'll match it up — or reply "no receipt" if you don't have it and I'll stop asking.`
  );
}

export async function GET(req: Request): Promise<NextResponse> {
  const denied = requireCron(req);
  if (denied) return denied;

  if (new Date().getUTCDay() !== WEEKLY_RUN_DAY) {
    return NextResponse.json({ ok: true, reminded: 0, skipped: 'not_weekly_run_day' });
  }

  const admin = getSupabaseAdmin();

  // Flagged, not-waived, under-cap receipts (DEC-078), grouped by user.
  let candidates: ReminderCandidate[];
  try {
    candidates = await listReceiptsNeedingReminder(RECEIPT_REMINDER_CAP, MIN_AGE_HOURS);
  } catch {
    return jsonError('query_failed', 500);
  }
  if (candidates.length === 0) return NextResponse.json({ ok: true, reminded: 0 });

  const byUser = new Map<string, ReminderCandidate[]>();
  for (const r of candidates) {
    const list = byUser.get(r.user_id) ?? [];
    list.push(r);
    byUser.set(r.user_id, list);
  }

  // Recipients: only users who haven't opted out (TCPA — Jordan).
  const { data: users } = await admin
    .from('users')
    .select('id, phone_number, full_name')
    .in('id', [...byUser.keys()])
    .is('sms_opted_out_at', null);

  let reminded = 0;
  let capped = 0;
  for (const u of (users as { id: string; phone_number: string; full_name: string | null }[]) ?? []) {
    const rows = byUser.get(u.id) ?? [];
    if (rows.length === 0) continue;
    const firstName = u.full_name?.split(/\s+/)[0] ?? null;
    // "Last nudge" copy when any of this user's receipts hits the cap on this send.
    const lastNudge = rows.some((r) => r.receipt_reminder_count + 1 >= RECEIPT_REMINDER_CAP);
    try {
      await sendSms(u.phone_number, reminderMessage(firstName, rows.length, lastNudge));
      // Only burn a nudge on a successful send (so a Twilio failure doesn't push a receipt to its cap).
      await bumpReceiptReminderCounts(rows);
      reminded++;
      if (lastNudge) capped++;
    } catch (err) {
      log.warn('reminder_send_failed', { phone: maskPhone(u.phone_number), message: err instanceof Error ? err.message : 'unknown' });
    }
  }

  log.info('receipt_reminders_sent', { reminded, capped });
  return NextResponse.json({ ok: true, reminded, capped });
}
