// Data retention: purge short-lived security records once they've served their purpose.
// Runs from the daily trial-reminders cron (Hobby allows few cron slots). Best-effort: a failed
// purge is logged and retried tomorrow, never failing the cron's real job.
import { getSupabaseAdmin } from './supabase';
import { log } from './log';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function purgeExpiredRecords(now = new Date()): Promise<void> {
  const ago = (days: number) => new Date(now.getTime() - days * DAY_MS).toISOString();
  const admin = getSupabaseAdmin();
  const jobs = [
    // Login codes live 10 minutes; a day of history is plenty for abuse investigation.
    admin.from('auth_codes').delete().lt('created_at', ago(1)),
    admin.from('sessions').delete().lt('expires_at', now.toISOString()),
    // Providers stop retrying within hours (Stripe: 3 days); 30 days is a wide margin.
    admin.from('webhook_events').delete().lt('created_at', ago(30)),
    // Longest quota window is a day.
    admin.from('rate_events').delete().lt('created_at', ago(2)),
  ];
  const results = await Promise.all(jobs);
  const failed = results.filter((r) => r.error).length;
  if (failed) log.warn('retention_purge_partial', { failed });
  else log.info('retention_purge_done');
}
