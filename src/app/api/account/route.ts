// DELETE /api/account — delete the user's account and ALL their data (CCPA/GDPR + SEC-001).
// Cancels billing, purges Storage objects (not covered by DB cascade), then deletes the user
// (cascades receipts/conversations/user_roles/sessions), the org if no co-owner remains, and
// any phone-keyed leftovers (auth codes, leads). supabase-js returns errors instead of
// throwing, so every step is checked: a partial delete must never report success.
import { NextResponse } from 'next/server';
import { requireUser, serverError } from '@/lib/api';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getStripe } from '@/lib/stripe';
import { deleteAllUserPhotos } from '@/lib/ocr';
import { clearSessionCookie } from '@/lib/auth';
import { log, maskPhone } from '@/lib/log';

function check<T extends { error: unknown }>(res: T): T {
  if (res.error) throw res.error;
  return res;
}

export async function DELETE(): Promise<NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const admin = getSupabaseAdmin();
  const orgId = user.organization_id;
  try {
    const { count: others } = check(
      await admin.from('users').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).neq('id', user.id),
    );
    const lastMember = !others;

    // 1. Billing: the last member leaving must stop the charges (the org row and its Stripe ids
    //    are about to go). A co-owner leaving keeps the shared plan running for the other member.
    if (lastMember) {
      const { data: org } = check(await admin.from('organizations').select('stripe_subscription_id').eq('id', orgId).maybeSingle());
      if (org?.stripe_subscription_id) {
        await getStripe().subscriptions.cancel(org.stripe_subscription_id).catch((err: { code?: string }) => {
          if (err?.code !== 'resource_missing') throw err; // already canceled/deleted in Stripe
        });
      }
    }

    // 2. Storage (FK cascade does NOT reach Storage objects).
    await deleteAllUserPhotos(user.id);
    // 3. Deleting the user cascades receipts, conversations, user_roles, sessions.
    check(await admin.from('users').delete().eq('id', user.id));
    // 4. Org only once nobody references it (users.organization_id has no cascade).
    if (lastMember) check(await admin.from('organizations').delete().eq('id', orgId));
    // 5. Phone-keyed rows the cascade can't reach.
    check(await admin.from('auth_codes').delete().eq('phone_number', user.phone_number));
    check(await admin.from('leads').delete().eq('phone_number', user.phone_number));

    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res);
    log.info('account_deleted', { phone: maskPhone(user.phone_number), org_deleted: lastMember });
    return res;
  } catch (err) {
    return serverError('account_delete_failed', err, { user: user.id });
  }
}
