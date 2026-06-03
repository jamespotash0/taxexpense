// PATCH/DELETE /api/receipts/:id — edit or remove a receipt (TSNAP-040).
// Org-scoped; user has final say (AI overridable). Edits recompute substantiation.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/session';
import { getReceipt, updateReceipt } from '@/lib/receipts';
import { recomputeReceipt } from '@/lib/expense';
import { getSupabaseAdmin } from '@/lib/supabase';
import { RECEIPTS_BUCKET } from '@/lib/ocr';

// Only these fields are user-editable from the dashboard.
const Patch = z
  .object({
    vendor: z.string().max(255).nullable(),
    amount_cents: z.number().int().min(0),
    transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    category: z.string().max(100),
    payment_account: z.enum(['business', 'personal', 'unknown']),
    business_purpose: z.string().nullable(),
    attendees: z.string().nullable(),
    business_relationship: z.string().nullable(),
    location_city: z.string().max(100).nullable(),
    business_miles: z.number().int().nullable(),
    notes: z.string().nullable(),
    flagged_for_cpa: z.boolean(),
  })
  .partial();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const existing = await getReceipt(user.organization_id, id);
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await updateReceipt(user.organization_id, id, parsed.data);
  await recomputeReceipt(user.organization_id, id); // re-derive substantiation after edit
  const updated = await getReceipt(user.organization_id, id);
  return NextResponse.json({ receipt: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;

  const existing = await getReceipt(user.organization_id, id);
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Delete the stored photo too (Jordan: deletion must remove Storage objects, not just rows).
  if (existing.photo_url) {
    await getSupabaseAdmin().storage.from(RECEIPTS_BUCKET).remove([existing.photo_url]).catch(() => {});
  }
  const { error } = await getSupabaseAdmin()
    .from('receipts')
    .delete()
    .eq('organization_id', user.organization_id)
    .eq('id', id);
  if (error) return NextResponse.json({ error: 'server_error' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
