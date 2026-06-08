// POST /api/receipts/:id/attach-receipt — attach a photo to an existing expense from the
// dashboard (TSNAP-041; dashboard equivalent of the SMS attachment flow TSNAP-024).
import { NextResponse } from 'next/server';
import { requireUser, jsonError, serverError } from '@/lib/api';
import { getReceipt, updateReceipt } from '@/lib/receipts';
import { storePhotoBuffer, extractReceiptFromPhoto, getSignedReceiptUrl } from '@/lib/ocr';
import { recomputeReceipt } from '@/lib/expense';

export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf'];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const existing = await getReceipt(user.organization_id, id);
  if (!existing) return jsonError('not_found', 404);

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return jsonError('no_file', 400);
  if (file.size > MAX_BYTES) return jsonError('file_too_large', 413);

  const contentType = file.type || 'image/jpeg';
  if (!ALLOWED.includes(contentType)) return jsonError('bad_file_type', 415);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { path } = await storePhotoBuffer(buffer, contentType, user.id);

    // OCR is best-effort for dashboard uploads — attaching the photo is what matters.
    if (contentType !== 'application/pdf') {
      try {
        const signed = await getSignedReceiptUrl(path);
        await extractReceiptFromPhoto(signed);
      } catch {
        /* ignore OCR failure; photo is still attached */
      }
    }

    const patched = await updateReceipt(user.organization_id, id, { photo_url: path, needs_receipt: false, receipt_reason: null, receipt_waived_at: null });
    const updated = await recomputeReceipt(user.organization_id, id, patched ?? undefined);
    return NextResponse.json({ receipt: updated ?? patched });
  } catch (err) {
    return serverError('attach_receipt_failed', err, { user: user.id });
  }
}
