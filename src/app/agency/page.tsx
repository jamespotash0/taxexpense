// Agency staff view (Spec 10, Fix 2/4) — the "who's missing what" board across all managed
// creators, sorted by who needs the most attention. Internal B2B tool: English-only for now
// (deliberately not wired through the consumer i18n dictionaries). Read-only — creators still edit
// via their own login. Server Component.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { getUserAgencyIds, listAgencyCreators } from '@/lib/agency';
import { formatMoney } from '@/lib/format';
import { formatUsPhone } from '@/lib/phone';

export default async function AgencyPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?returnTo=/agency');

  // Only agency staff belong here; everyone else goes to their own dashboard.
  if ((await getUserAgencyIds(user.id)).length === 0) redirect('/dashboard');

  const creators = await listAgencyCreators(user);
  const needingAttention = creators.filter((c) => c.summary.needs_attention_count > 0).length;

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Tally · Agency</h1>
        <nav className="flex items-center gap-4 text-sm text-muted">
          <Link href="/dashboard" className="hover:text-foreground">My dashboard</Link>
          <form action="/api/auth/logout" method="post" className="flex">
            <button type="submit" className="cursor-pointer bg-transparent p-0 [font:inherit] text-inherit hover:text-foreground">Log out</button>
          </form>
        </nav>
      </header>

      <section className="mt-6 rounded-lg border border-border bg-surface p-5 shadow-sm">
        <p className="text-sm text-muted">Clients</p>
        <p className="mt-1 text-3xl font-semibold">{creators.length}</p>
        <p className="mt-1 text-sm text-muted">
          {needingAttention === 0 ? 'Everyone is up to date ✓' : `${needingAttention} need attention this month`}
        </p>
      </section>

      <section className="mt-6">
        {creators.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted shadow-sm">
            No creators yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {creators.map((c) => (
              <li key={c.orgId}>
                <Link href={`/agency/${c.orgId}`} className="block rounded-lg border border-border bg-surface p-3 shadow-sm hover:bg-neutral-50">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-medium">{c.name}</p>
                    <span className="shrink-0 text-sm text-muted tabular-nums">{c.phone ? formatUsPhone(c.phone) : ''}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted">
                    <span className="truncate">
                      {c.summary.count} this month · {formatMoney(c.summary.total_cents)} · {formatMoney(c.summary.deductible_cents)} deductible
                    </span>
                    {c.summary.needs_attention_count > 0 ? (
                      <span className="shrink-0 font-medium text-warning-700">{c.summary.needs_attention_count} need attention</span>
                    ) : (
                      <span className="shrink-0 text-success-700">up to date ✓</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
