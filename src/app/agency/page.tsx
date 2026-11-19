// Agency staff view (Spec 10, Fix 2/4): the "who's missing what" board across all managed
// creators, sorted by who needs the most attention. Internal B2B tool: page copy is English-only
// for now (deliberately not wired through the consumer i18n dictionaries). Read-only: creators
// still edit via their own login. Server Component.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { getUserAgencyIds, listAgencyCreators } from '@/lib/agency';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/AppIcons';
import { formatMoney } from '@/lib/format';
import { formatUsPhone } from '@/lib/phone';
import { getI18n } from '@/i18n/server';

export default async function AgencyPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?returnTo=/agency');

  // Only agency staff belong here; everyone else goes to their own dashboard.
  if ((await getUserAgencyIds(user.id)).length === 0) redirect('/dashboard');

  const [creators, { t }] = await Promise.all([listAgencyCreators(user), getI18n()]);
  const needingAttention = creators.filter((c) => c.summary.needs_attention_count > 0).length;

  return (
    <AppShell nav={t.app.nav} active="agency" showAgency>
      <section className={`rounded-[28px] px-6 py-7 sm:px-8 ${needingAttention > 0 ? 'bg-primary text-white' : 'bg-success-50 text-success-700'}`}>
        <h1 className="text-[1.75rem] font-bold leading-tight tracking-[-0.03em] sm:text-[2rem]">
          {needingAttention === 0 ? 'Everyone is up to date' : `${needingAttention} need attention this month`}
        </h1>
        <p className={`mt-2 text-[0.9375rem] ${needingAttention > 0 ? 'text-white/80' : 'text-success-700/85'}`}>Across {creators.length} clients</p>
      </section>

      <section className="mt-8">
        {creators.length === 0 ? (
          <p className="rounded-3xl bg-fill px-6 py-10 text-center text-muted">No creators yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {creators.map((c) => {
              const need = c.summary.needs_attention_count;
              return (
                <li key={c.orgId}>
                  <Link href={`/agency/${c.orgId}`} className="row-press -mx-3 flex items-center gap-3.5 rounded-2xl px-3 py-3.5">
                    <span aria-hidden="true" className={`flex size-11 shrink-0 items-center justify-center rounded-full text-[1.0625rem] font-bold ${need > 0 ? 'bg-warning-50 text-warning-700' : 'bg-fill'}`}>
                      {c.name.trim().charAt(0).toUpperCase() || '·'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.9375rem] font-semibold">{c.name}</span>
                      <span className="mt-0.5 block truncate text-[0.8125rem] text-muted">
                        {c.summary.count} this month · <span className="num">{formatMoney(c.summary.total_cents)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        <span className="num">{formatMoney(c.summary.deductible_cents)}</span> deductible{c.phone && <> · <span className="num">{formatUsPhone(c.phone)}</span></>}
                      </span>
                      {need > 0 && <span className="mt-0.5 block text-xs font-semibold text-warning-700 sm:hidden">{need} need attention</span>}
                    </span>
                    {need > 0 ? (
                      <span className="chip chip-need"><span className="num">{need}</span><span className="hidden sm:inline">need attention</span></span>
                    ) : (
                      <span className="chip chip-done"><Icon name="check" size={14} label="Up to date" /><span className="hidden sm:inline">Up to date</span></span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
