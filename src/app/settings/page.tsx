// Settings page (DEC-014). Server loads current values; client form saves them.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { SettingsForm } from '@/components/SettingsForm';
import { EmailAccountantButton } from '@/components/EmailAccountantButton';
import { DeleteAccountButton } from '@/components/DeleteAccountButton';
import { ManageBillingButton } from '@/components/ManageBillingButton';
import { CoOwners } from '@/components/CoOwners';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { getOrgEntitlement } from '@/lib/subscription';
import { getOrgMembers, getOrgOwnerId } from '@/lib/users';
import { MAX_CO_OWNERS } from '@/lib/pricing';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/config';
import { formatUsPhone } from '@/lib/phone';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?returnTo=/settings');

  const { locale, t } = await getI18n();
  const s = t.app.settings;

  const [{ data: org }, entitlement, members, ownerId] = await Promise.all([
    getSupabaseAdmin().from('organizations').select('name').eq('id', user.organization_id).maybeSingle(),
    getOrgEntitlement(user.organization_id),
    getOrgMembers(user.organization_id),
    getOrgOwnerId(user.organization_id),
  ]);
  const isOwner = ownerId === user.id;

  const billingLine =
    entitlement.reason === 'active'
      ? s.billingActive
      : entitlement.reason === 'trialing'
        ? fmt(entitlement.trialDaysLeft === 1 ? s.billingTrialOne : s.billingTrialOther, { days: entitlement.trialDaysLeft })
        : s.billingLapsed;

  return (
    <main className="mx-auto max-w-lg p-4 sm:p-8">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">{t.app.nav.back}</Link>
        <LocaleSwitcher current={locale} />
      </div>
      <h1 className="mt-4 text-xl font-semibold">{s.title}</h1>
      <p className="mt-1 text-sm text-muted">{fmt(s.loggedInAs, { phone: formatUsPhone(user.phone_number) })}</p>
      <div className="mt-6">
        <SettingsForm
          t={t.app.settingsForm}
          initial={{
            full_name: user.full_name ?? '',
            email: user.email ?? '',
            organization_name: (org?.name as string | null) ?? '',
            accountant_email: user.accountant_email ?? '',
            business_type: user.business_type ?? '',
          }}
        />
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <h2 className="text-sm font-medium">{s.accountant}</h2>
        <p className="mb-3 mt-1 text-sm text-muted">{s.accountantBody}</p>
        <EmailAccountantButton hasAccountantEmail={!!user.accountant_email} t={t.app.emailAccountant} />
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <h2 className="text-sm font-medium">{s.billing}</h2>
        <p className="mb-3 mt-1 text-sm text-muted">{billingLine}</p>
        <ManageBillingButton t={t.app.billing} />
      </div>

      {isOwner && (
        <div className="mt-8 border-t border-border pt-6">
          <CoOwners
            t={t.app.coOwners}
            members={members}
            currentUserId={user.id}
            entitled={entitlement.entitled}
            atCap={members.length >= 1 + MAX_CO_OWNERS}
          />
        </div>
      )}

      <div className="mt-8 border-t border-border pt-6">
        <h2 className="text-sm font-medium text-error-700">{s.dangerZone}</h2>
        <p className="mb-3 mt-1 text-sm text-muted">{s.dangerBody}</p>
        <DeleteAccountButton t={t.app.deleteAccount} />
      </div>
    </main>
  );
}
