// GET /api/cleanup?year=YYYY&memo=1 — year-end tax cleanup scan (TSNAP-EPIC-9).
// Org-scoped (DEC-001). Deterministic checks always run; the vague-memo LLM pass
// runs only when memo=1 (it costs a Haiku call). Defaults to the current year.
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api';
import { getReceiptsForYear } from '@/lib/receipts';
import { scanReceipts, scanWithMemoReview } from '@/lib/cleanup';

export async function GET(req: Request): Promise<NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const url = new URL(req.url);
  const yearParam = Number(url.searchParams.get('year'));
  const year =
    Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100
      ? yearParam
      : new Date().getFullYear();
  const withMemo = url.searchParams.get('memo') === '1';

  const receipts = await getReceiptsForYear(user.organization_id, year);
  const report = withMemo
    ? await scanWithMemoReview(receipts, year)
    : scanReceipts(receipts, year);

  return NextResponse.json(report);
}
