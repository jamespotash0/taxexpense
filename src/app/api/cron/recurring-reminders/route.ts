// GET /api/cron/recurring-reminders — monthly "did your subscription renew?" nudge (DEC-033).
// For each active recurring template that's due, mark it awaiting_confirm and text the user
// "Did it? Reply Y to log it, N to skip." Nothing is logged until they confirm (never auto-
// creates a tax record). Also auto-skips nudges that went unanswered past the window so a
// template can't get stuck. Secured by CRON_SECRET. Run daily via Vercel Cron.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendSms } from '@/lib/twilio';
import { optionalEnv } from '@/lib/env';
import { log, maskPhone } from '@/lib/log';
import {
  getDueRecurring,
  getStaleAwaitingConfirm,
  markAwaitingConfirm,
  advanceRecurring,
  confirmRenewalMsg,
} from '@/lib/recurring';

export async function GET(req: Request): Promise<NextResponse> {
  const secret = optionalEnv('CRON_SECRET');
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
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
