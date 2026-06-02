// GET /api/receipts — list the authed user's receipts (TSNAP-039).
// Org-scoped (DEC-001). Query params: filter=all|needs_attention|this_month, limit, offset.
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { listReceipts, type ReceiptFilter } from '@/lib/receipts';

export async function GET(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const filter = (url.searchParams.get('filter') as ReceiptFilter) || 'all';
  const limit = Number(url.searchParams.get('limit') ?? 20);
  const offset = Number(url.searchParams.get('offset') ?? 0);

  const { rows, hasMore } = await listReceipts(user.organization_id, { filter, limit, offset });
  return NextResponse.json({ receipts: rows, hasMore });
}
