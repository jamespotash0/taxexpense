// POST /api/email-accountant — email this month's summary (CSV attached) to the user's
// configured accountant (TSNAP-048, EPIC-8). PDF generation deferred (DEC-015).
// Jordan: only send to the configured accountant_email; never an arbitrary address.
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { getMonthlySummary, getAllReceiptsForExport } from '@/lib/receipts';
import { toStandardCsv } from '@/lib/csv';
import { sendEmail } from '@/lib/email';
import { formatMoney } from '@/lib/format';
import { log } from '@/lib/log';

export const maxDuration = 30;

export async function POST(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!user.accountant_email) {
    return NextResponse.json({ error: 'no_accountant_email', message: 'Add your accountant’s email in Settings first.' }, { status: 400 });
  }

  try {
    const [summary, receipts] = await Promise.all([
      getMonthlySummary(user.organization_id),
      getAllReceiptsForExport(user.organization_id),
    ]);

    const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const who = user.full_name ?? 'A Tally user';
    const csv = toStandardCsv(receipts);
    const flaggedCount = receipts.filter((r) => r.flagged_for_cpa).length;

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px">
        <h2 style="margin:0 0 8px">Tally — Monthly Expense Summary</h2>
        <p style="color:#555">${who} — ${monthLabel}</p>
        <table style="border-collapse:collapse;font-size:14px;margin-top:12px">
          <tr><td style="padding:4px 12px 4px 0;color:#555">Total this month</td><td><b>${formatMoney(summary.total_cents)}</b></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#555">Deductible</td><td>${formatMoney(summary.deductible_cents)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#555">Receipts</td><td>${summary.count}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#555">Documentation complete</td><td>${summary.complete_count} of ${summary.count}</td></tr>
        </table>
        <p style="color:#555;font-size:14px;margin-top:16px">A full CSV of all expenses is attached.${
          flaggedCount > 0
            ? ` <b>${flaggedCount} item${flaggedCount === 1 ? '' : 's'} flagged for your review</b> — see the "Flagged for CPA" column.`
            : ''
        }</p>
        <p style="color:#999;font-size:12px;margin-top:16px">This is a recordkeeping export, not tax advice.</p>
      </div>`;

    await sendEmail({
      to: user.accountant_email,
      subject: `Tally Monthly Summary — ${who} — ${monthLabel}`,
      html,
      attachments: [{ filename: `tally-${monthLabel.replace(/\s/g, '-').toLowerCase()}.csv`, content: Buffer.from(csv, 'utf8') }],
    });

    return NextResponse.json({ ok: true, sent_to: user.accountant_email });
  } catch (err) {
    log.error('email_accountant_failed', { user: user.id, message: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
