// PATCH/DELETE /api/receipts/:id — edit or remove a receipt (TSNAP-040).
// Org-scoped; user has final say (AI overridable). Edits recompute substantiation.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, parseBody, jsonError } from '@/lib/api';
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
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const body = await parseBody(req, Patch);
  if (body instanceof NextResponse) return body;

  const existing = await getReceipt(user.organization_id, id);
  if (!existing) return jsonError('not_found', 404);

  await updateReceipt(user.organization_id, id, body);
  await recomputeReceipt(user.organization_id, id); // re-derive substantiation after edit
  const updated = await getReceipt(user.organization_id, id);
  return NextResponse.json({ receipt: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const existing = await getReceipt(user.organization_id, id);
  if (!existing) return jsonError('not_found', 404);

  // Delete the stored photo too (Jordan: deletion must remove Storage objects, not just rows).
  if (existing.photo_url) {
    await getSupabaseAdmin().storage.from(RECEIPTS_BUCKET).remove([existing.photo_url]).catch(() => {});
  }
  const { error } = await getSupabaseAdmin()
    .from('receipts')
    .delete()
    .eq('organization_id', user.organization_id)
    .eq('id', id);
  if (error) return jsonError('server_error', 500);
  return NextResponse.json({ ok: true });
}
