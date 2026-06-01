// POST /api/receipts/:id/attach-receipt — attach a photo to an existing expense.
// OWNER: Emma + Raj. EPIC-4, Day 7.
// Upload to Supabase Storage -> OCR (Haiku) -> recompute substantiation_complete.
import { NextResponse } from 'next/server';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await params; // TODO(EPIC-4): validate file type/size, upload, OCR, set needs_receipt=false.
  return NextResponse.json({ error: 'not_implemented' }, { status: 501 });
}
