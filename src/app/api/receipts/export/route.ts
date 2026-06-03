// GET /api/receipts/export?format=csv|quickbooks — download receipts as CSV (TSNAP-042/043).
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api';
import { getAllReceiptsForExport } from '@/lib/receipts';
import { toStandardCsv, toQuickbooksCsv } from '@/lib/csv';
import { todayISO } from '@/lib/format';

export async function GET(req: Request): Promise<NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const format = new URL(req.url).searchParams.get('format') === 'quickbooks' ? 'quickbooks' : 'csv';
  const receipts = await getAllReceiptsForExport(user.organization_id);
  const body = format === 'quickbooks' ? toQuickbooksCsv(receipts) : toStandardCsv(receipts);

  const date = todayISO();
  const filename = `tally-export${format === 'quickbooks' ? '-quickbooks' : ''}-${date}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
