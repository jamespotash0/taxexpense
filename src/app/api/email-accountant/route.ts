// POST /api/email-accountant — email this month's summary (CSV attached) to the user's
// configured accountant (TSNAP-048, EPIC-8). PDF generation deferred (DEC-015).
// Jordan: only send to the configured accountant_email; never an arbitrary address.
import { NextResponse } from 'next/server';
import { requireUser, jsonError, serverError } from '@/lib/api';
import { getMonthlySummary, getAllReceiptsForExport } from '@/lib/receipts';
import { toStandardCsv } from '@/lib/csv';
import { sendEmail } from '@/lib/email';
import { formatMoney } from '@/lib/format';

export const maxDuration = 30;

export async function POST(): Promise<NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (!user.accountant_email) {
    return jsonError('no_accountant_email', 400, { message: 'Add your accountant’s email in Settings first.' });
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
        <h2 style="margin:0 0 8px">Tally · Monthly Expense Summary</h2>
        <p style="color:#555">${who} · ${monthLabel}</p>
        <table style="border-collapse:collapse;font-size:14px;margin-top:12px">
          <tr><td style="padding:4px 12px 4px 0;color:#555">Total this month</td><td><b>${formatMoney(summary.total_cents)}</b></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#555">Deductible</td><td>${formatMoney(summary.deductible_cents)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#555">Receipts</td><td>${summary.count}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#555">Documentation complete</td><td>${summary.complete_count} of ${summary.count}</td></tr>
        </table>
        <p style="color:#555;font-size:14px;margin-top:16px">A full CSV of all expenses is attached.${
          flaggedCount > 0
            ? ` <b>${flaggedCount} item${flaggedCount === 1 ? '' : 's'} flagged for your review</b>. See the "Flagged for CPA" column.`
            : ''
        }</p>
        <p style="color:#999;font-size:12px;margin-top:16px">This is a recordkeeping export, not tax advice.</p>
      </div>`;

    await sendEmail({
      to: user.accountant_email,
      subject: `Tally Monthly Summary · ${who} · ${monthLabel}`,
      html,
      attachments: [{ filename: `tally-${monthLabel.replace(/\s/g, '-').toLowerCase()}.csv`, content: Buffer.from(csv, 'utf8') }],
    });

    return NextResponse.json({ ok: true, sent_to: user.accountant_email });
  } catch (err) {
    return serverError('email_accountant_failed', err, { user: user.id });
  }
}
