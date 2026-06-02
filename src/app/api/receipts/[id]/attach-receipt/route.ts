// POST /api/receipts/:id/attach-receipt — attach a photo to an existing expense from the
// dashboard (TSNAP-041; dashboard equivalent of the SMS attachment flow TSNAP-024).
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { getReceipt, updateReceipt } from '@/lib/receipts';
import { storePhotoBuffer, extractReceiptFromPhoto, getSignedReceiptUrl } from '@/lib/ocr';
import { recomputeReceipt } from '@/lib/expense';
import { log } from '@/lib/log';

export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf'];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;

  const existing = await getReceipt(user.organization_id, id);
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'no_file' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'file_too_large' }, { status: 413 });

  const contentType = file.type || 'image/jpeg';
  if (!ALLOWED.includes(contentType)) return NextResponse.json({ error: 'bad_file_type' }, { status: 415 });

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

    await updateReceipt(user.organization_id, id, { photo_url: path, needs_receipt: false, receipt_reason: null });
    await recomputeReceipt(user.organization_id, id);
    const updated = await getReceipt(user.organization_id, id);
    return NextResponse.json({ receipt: updated });
  } catch (err) {
    log.error('attach_receipt_failed', { user: user.id, message: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
