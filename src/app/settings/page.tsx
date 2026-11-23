// Settings page (DEC-014). Server loads current values; client form saves them.
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { SettingsForm } from '@/components/SettingsForm';
import { EmailAccountantButton } from '@/components/EmailAccountantButton';
import { DeleteAccountButton } from '@/components/DeleteAccountButton';
import { ManageBillingButton } from '@/components/ManageBillingButton';
import { CoOwners } from '@/components/CoOwners';
import { AppShell } from '@/components/AppShell';
import { getUserAgencyIds } from '@/lib/agency';
import { getOrgEntitlement } from '@/lib/subscription';
import { getOrgMembers, getOrgOwnerId } from '@/lib/users';
import { MAX_CO_OWNERS } from '@/lib/pricing';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/config';
import { formatUsPhone } from '@/lib/phone';

function Section({ title, body, tone, children }: { title: string; body?: string; tone?: 'danger'; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-8">
      <h2 className={`text-lg font-bold tracking-[-0.02em] ${tone === 'danger' ? 'text-error-700' : ''}`}>{title}</h2>
      {body && <p className="mb-4 mt-1 text-[0.9375rem] text-muted">{body}</p>}
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?returnTo=/settings');

  const { t } = await getI18n();
  const s = t.app.settings;

  const [{ data: org }, entitlement, members, ownerId, agencyIds] = await Promise.all([
    getSupabaseAdmin().from('organizations').select('name').eq('id', user.organization_id).maybeSingle(),
    getOrgEntitlement(user.organization_id),
    getOrgMembers(user.organization_id),
    getOrgOwnerId(user.organization_id),
    getUserAgencyIds(user.id),
  ]);
  const isOwner = ownerId === user.id;

  const billingLine =
    entitlement.reason === 'active'
      ? s.billingActive
      : entitlement.reason === 'trialing'
        ? fmt(entitlement.trialDaysLeft === 1 ? s.billingTrialOne : s.billingTrialOther, { days: entitlement.trialDaysLeft })
        : s.billingLapsed;

  return (
    <AppShell nav={t.app.nav} active="settings" showAgency={agencyIds.length > 0} width="max-w-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[2rem] font-bold leading-tight tracking-[-0.03em]">{s.title}</h1>
          <p className="mt-1 text-[0.9375rem] text-muted">{fmt(s.loggedInAs, { phone: formatUsPhone(user.phone_number) })}</p>
        </div>
      </div>
      <div className="mt-8 pb-8">
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

      <Section title={s.accountant} body={s.accountantBody}>
        <EmailAccountantButton hasAccountantEmail={!!user.accountant_email} t={t.app.emailAccountant} />
      </Section>

      <Section title={s.billing} body={billingLine}>
        <ManageBillingButton t={t.app.billing} />
      </Section>

      {isOwner && (
        <section className="border-t border-border py-8">
          <CoOwners
            t={t.app.coOwners}
            members={members}
            currentUserId={user.id}
            entitled={entitlement.entitled}
            atCap={members.length >= 1 + MAX_CO_OWNERS}
          />
        </section>
      )}

      <Section title={s.dangerZone} body={s.dangerBody} tone="danger">
        <DeleteAccountButton t={t.app.deleteAccount} />
      </Section>
    </AppShell>
  );
}
