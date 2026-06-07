// GET /api/cron/receipt-reminders — weekly nudge for expenses still missing a receipt
// (EPIC-3: TSNAP weekly reminder system). Run via Vercel Cron (see vercel.json).
// Secured by CRON_SECRET so it can't be triggered by the public.
//
// Priya's flag: 30-50% of users forget to send the receipt — this closes that loop.
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

// Only remind about receipts at least this old (don't nag the same day).
const MIN_AGE_HOURS = 24;
// Weekly cadence preserved on a daily cron: only send on Mondays (UTC). The cron fires
// at 17:00 UTC, so the day never straddles a boundary here.
const WEEKLY_RUN_DAY = 1; // 0=Sun … 1=Mon

export async function GET(req: Request): Promise<NextResponse> {
  const denied = requireCron(req);
  if (denied) return denied;

  if (new Date().getUTCDay() !== WEEKLY_RUN_DAY) {
    return NextResponse.json({ ok: true, reminded: 0, skipped: 'not_weekly_run_day' });
  }

  const admin = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - MIN_AGE_HOURS * 3600 * 1000).toISOString();

  // Pending receipts grouped by user.
  const { data: pending, error } = await admin
    .from('receipts')
    .select('user_id')
    .eq('needs_receipt', true)
    .lte('created_at', cutoff);
  if (error) return jsonError('query_failed', 500);

  const counts = new Map<string, number>();
  for (const r of (pending as { user_id: string }[]) ?? []) {
    counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1);
  }
  if (counts.size === 0) return NextResponse.json({ ok: true, reminded: 0 });

  const { data: users } = await admin
    .from('users')
    .select('id, phone_number, full_name')
    .in('id', [...counts.keys()]);

  let reminded = 0;
  for (const u of (users as { id: string; phone_number: string; full_name: string | null }[]) ?? []) {
    const n = counts.get(u.id) ?? 0;
    if (n === 0) continue;
    const name = u.full_name?.split(/\s+/)[0];
    const lead = name ? `Hey ${name} — ` : 'Hey — ';
    const noun = n === 1 ? 'expense is' : 'expenses are';
    try {
      await sendSms(
        u.phone_number,
        `${lead}quick nudge from Tally: ${n} ${noun} still missing a receipt photo. Snap & send when you can and I'll match it up.`,
      );
      reminded++;
    } catch (err) {
      log.warn('reminder_send_failed', { phone: maskPhone(u.phone_number), message: err instanceof Error ? err.message : 'unknown' });
    }
  }

  log.info('receipt_reminders_sent', { reminded });
  return NextResponse.json({ ok: true, reminded });
}
