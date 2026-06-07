// GET /api/cron/recurring-reminders — monthly "did your subscription renew?" nudge (DEC-033).
// For each active recurring template that's due, mark it awaiting_confirm and text the user
// "Did it? Reply Y to log it, N to skip." Nothing is logged until they confirm (never auto-
// creates a tax record). Also auto-skips nudges that went unanswered past the window so a
// template can't get stuck. Secured by CRON_SECRET. Run daily via Vercel Cron.
//
// ⚠️ NOT SCHEDULED on the Vercel Hobby plan (cron limit = 2; we keep trial-reminders +
// receipt-reminders). Code is kept for reference and still runs if hit directly with the
// CRON_SECRET. To re-enable, add it back to vercel.json "crons" ("0 15 * * *") on Vercel Pro.

import { NextResponse } from 'next/server';
import { requireCron } from '@/lib/api';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendSms } from '@/lib/twilio';
import { todayISO } from '@/lib/format';
import { log, maskPhone } from '@/lib/log';
import {
  getDueRecurring,
  getStaleAwaitingConfirm,
  markAwaitingConfirm,
  advanceRecurring,
  confirmRenewalMsg,
} from '@/lib/recurring';

export async function GET(req: Request): Promise<NextResponse> {
  const denied = requireCron(req);
  if (denied) return denied;

  const admin = getSupabaseAdmin();
  const today = todayISO();
  const now = new Date().toISOString();

  // 1. Auto-skip nudges that were never answered (roll forward so they don't stick).
  let autoSkipped = 0;
  for (const r of await getStaleAwaitingConfirm()) {
    await advanceRecurring(r.id, today, false);
    autoSkipped++;
  }

  // 2. Templates due to recur → ask the user.
  const due = await getDueRecurring(today);
  if (due.length === 0) return NextResponse.json({ ok: true, asked: 0, autoSkipped });

  // Resolve phones, skipping opted-out users (TCPA).
  const userIds = [...new Set(due.map((r) => r.user_id))];
  const { data: users } = await admin
    .from('users')
    .select('id, phone_number, sms_opted_out_at')
    .in('id', userIds);
  const phoneByUser = new Map<string, string>();
  for (const u of (users as { id: string; phone_number: string; sms_opted_out_at: string | null }[]) ?? []) {
    if (!u.sms_opted_out_at) phoneByUser.set(u.id, u.phone_number);
  }

  let asked = 0;
  for (const r of due) {
    const phone = phoneByUser.get(r.user_id);
    if (!phone) continue; // opted out or missing
    try {
      await markAwaitingConfirm(r.id, now);
      await sendSms(phone, confirmRenewalMsg(r.vendor, r.amount_cents));
      asked++;
    } catch (err) {
      log.warn('recurring_reminder_failed', { phone: maskPhone(phone), message: err instanceof Error ? err.message : 'unknown' });
    }
  }

  log.info('recurring_reminders_sent', { asked, autoSkipped });
  return NextResponse.json({ ok: true, asked, autoSkipped });
}
