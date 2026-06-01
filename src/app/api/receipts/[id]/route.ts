// PATCH/DELETE /api/receipts/:id — edit or remove a receipt.
// OWNER: Emma. EPIC-4, Day 7. Org-scoped; user has final say (overridable AI).
import { NextResponse } from 'next/server';

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await params; // TODO(EPIC-4): auth + orgTable('receipts').update(patch).eq('id', id).
  return NextResponse.json({ error: 'not_implemented' }, { status: 501 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await params; // TODO(EPIC-4): auth + orgTable('receipts').delete().eq('id', id) + delete photo from Storage.
  return NextResponse.json({ error: 'not_implemented' }, { status: 501 });
}
