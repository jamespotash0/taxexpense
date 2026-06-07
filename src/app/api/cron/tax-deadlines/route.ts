// GET /api/cron/tax-deadlines — daily check; on the 7-day and 1-day marks before a
// federal tax deadline, text opted-in users a heads-up (DEC-024). Phase-2 feature pulled
// forward. Secured by CRON_SECRET (same as the receipt-reminders cron).
//
// NOT tax advice — every message defers to a CPA. Respects STOP (sms_opted_out_at).
//
// ⚠️ NOT SCHEDULED on the Vercel Hobby plan (cron limit = 2; we keep trial-reminders +
// receipt-reminders). Code is kept for reference and still runs if hit directly with the
// CRON_SECRET. To re-enable, add it back to vercel.json "crons" ("0 14 * * *") on Vercel Pro.
import { NextResponse } from 'next/server';
import { requireCron } from '@/lib/api';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendSms } from '@/lib/twilio';
import { PUBLIC_ENV } from '@/lib/env';
import { remindersDueOn } from '@/lib/tax-deadlines';
import { log, maskPhone } from '@/lib/log';

export const maxDuration = 60;

function niceDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
function joinLabels(labels: string[]): string {
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

export async function GET(req: Request): Promise<NextResponse> {
  const denied = requireCron(req);
  if (denied) return denied;

  const due = remindersDueOn(new Date());
  if (due.length === 0) return NextResponse.json({ ok: true, due: 0, sent: 0 });

  const base = PUBLIC_ENV.appUrl || 'https://tallywhy.com';
  const messages = due.map(
    (r) =>
      `📅 Heads up — ${joinLabels(r.labels)} ${r.daysUntil === 1 ? 'is due tomorrow' : `due in ${r.daysUntil} days`} (${niceDate(r.dateISO)}). ` +
      `Good time to review your expenses in Tally: ${base}/dashboard. Not tax advice — confirm with your CPA.`,
  );

  // Recipients: onboarded users who haven't opted out.
  const { data: users, error } = await getSupabaseAdmin()
    .from('users')
    .select('id, phone_number')
    .eq('onboarding_completed', true)
    .is('sms_opted_out_at', null);
  if (error) throw error;

  let sent = 0;
  for (const u of (users as { id: string; phone_number: string }[]) ?? []) {
    for (const body of messages) {
      try {
        await sendSms(u.phone_number, body);
        sent++;
      } catch (err) {
        log.warn('tax_reminder_send_failed', { phone: maskPhone(u.phone_number), message: err instanceof Error ? err.message : 'unknown' });
      }
    }
  }
  log.info('tax_deadline_reminders', { due: due.length, recipients: users?.length ?? 0, sent });
  return NextResponse.json({ ok: true, due: due.length, sent });
}
