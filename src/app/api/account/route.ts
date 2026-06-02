// DELETE /api/account — delete the user's account and ALL their data (CCPA/GDPR + SEC-001).
// Purges Storage objects (not covered by DB cascade), then deletes the user (cascades
// receipts/conversations/user_roles/sessions), the org, and any leftover auth codes.
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { deleteAllUserPhotos } from '@/lib/ocr';
import { SESSION_COOKIE } from '@/lib/auth';
import { log, maskPhone } from '@/lib/log';

export async function DELETE(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

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
    res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
    log.info('account_deleted', { phone: maskPhone(user.phone_number) });
    return res;
  } catch (err) {
    log.error('account_delete_failed', { user: user.id, message: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
