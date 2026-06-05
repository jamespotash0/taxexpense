// Founder/admin notifications (abuse monitoring). Sends an email to ADMIN_NOTIFY_EMAIL when a
// brand-new user signs up (first inbound SMS = a fresh org, see getOrCreateUserByPhone).
//
// Best-effort by design: a failed or unconfigured notification must NEVER fail the signup flow.
// If ADMIN_NOTIFY_EMAIL is unset (e.g. local dev), we skip silently rather than throw — so the
// hook is safe to leave in everywhere. The phone number is sent UNMASKED here (unlike logs):
// it goes only to the founder's own inbox, who needs the real number to spot/curb abuse.

import { sendEmail } from './email';
import { optionalEnv, PUBLIC_ENV } from './env';
import { log } from './log';
import type { AppUser } from './users';

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
}

/**
 * Email the founder when a new user signs up. Returns what happened (for tests/logs).
 * Throwing is the caller's to swallow — but it also self-swallows the actual send so a flaky
 * Resend call can't bubble into the SMS handler.
 */
export async function notifyAdminNewSignup(user: AppUser): Promise<'sent' | 'not_configured' | 'failed'> {
  const to = optionalEnv('ADMIN_NOTIFY_EMAIL');
  if (!to) return 'not_configured';

  const appUrl = PUBLIC_ENV.appUrl || 'https://tallywhy.com';
  const when = new Date().toISOString();
  const rows: Array<[string, string]> = [
    ['Phone', user.phone_number],
    ['User ID', user.id],
    ['Org ID', user.organization_id],
    ['Signed up', when],
  ];
  const html = `
    <h2>New Tally signup</h2>
    <p>A new user just texted in for the first time (fresh org + trial created).</p>
    <table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
      ${rows
        .map(
          ([k, v]) =>
            `<tr><td style="color:#666">${esc(k)}</td><td><strong>${esc(v)}</strong></td></tr>`,
        )
        .join('')}
    </table>
    <p style="font-size:13px;color:#666">Dashboard: <a href="${esc(appUrl)}">${esc(appUrl)}</a></p>
  `;

  try {
    await sendEmail({ to, subject: `New Tally signup — ${user.phone_number}`, html });
    log.info('admin_signup_notified', { org: user.organization_id });
    return 'sent';
  } catch (err) {
    log.warn('admin_signup_notify_failed', {
      org: user.organization_id,
      message: err instanceof Error ? err.message : String(err),
    });
    return 'failed';
  }
}
