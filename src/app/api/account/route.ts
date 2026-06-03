// DELETE /api/account — delete the user's account and ALL their data (CCPA/GDPR + SEC-001).
// Purges Storage objects (not covered by DB cascade), then deletes the user (cascades
// receipts/conversations/user_roles/sessions), the org, and any leftover auth codes.
import { NextResponse } from 'next/server';
import { requireUser, serverError } from '@/lib/api';
import { getSupabaseAdmin } from '@/lib/supabase';
import { deleteAllUserPhotos } from '@/lib/ocr';
import { clearSessionCookie } from '@/lib/auth';
import { log, maskPhone } from '@/lib/log';

export async function DELETE(): Promise<NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const admin = getSupabaseAdmin();
  try {
    // 1. Storage (FK cascade does NOT reach Storage objects).
    await deleteAllUserPhotos(user.id);
    // 2. Deleting the user cascades receipts, conversations, user_roles, sessions.
    await admin.from('users').delete().eq('id', user.id);
    // 3. Org (now unreferenced) + leftover phone-keyed auth codes.
    await admin.from('organizations').delete().eq('id', user.organization_id);
    await admin.from('auth_codes').delete().eq('phone_number', user.phone_number);

    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res);
    log.info('account_deleted', { phone: maskPhone(user.phone_number) });
    return res;
  } catch (err) {
    return serverError('account_delete_failed', err, { user: user.id });
  }
}
