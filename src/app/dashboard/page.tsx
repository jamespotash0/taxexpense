// Dashboard (TSNAP-038/039/044): summary widget + receipt list + export. Server Component.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { getMonthlySummary, listReceipts, type ReceiptFilter } from '@/lib/receipts';
import { getOrgEntitlement } from '@/lib/subscription';
import { SubstantiationBadge } from '@/components/SubstantiationBadge';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { formatMoney, formatDate } from '@/lib/format';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/config';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?returnTo=/dashboard');

  const { locale, t } = await getI18n();
  const d = t.app.dashboard;
  const catLabel = (c: string | null): string =>
    c && c in t.app.categories ? (t.app.categories as Record<string, string>)[c] : t.app.categories.uncategorized;

  const FILTERS: { key: ReceiptFilter; label: string }[] = [
    { key: 'all', label: d.filterAll },
    { key: 'needs_attention', label: d.filterNeedsAttention },
    { key: 'this_month', label: d.filterThisMonth },
  ];

  const { filter: filterParam } = await searchParams;
  const filter: ReceiptFilter =
    filterParam === 'needs_attention' || filterParam === 'this_month' ? filterParam : 'all';

  const [summary, { rows }, entitlement] = await Promise.all([
    getMonthlySummary(user.organization_id),
    listReceipts(user.organization_id, { filter, limit: 50 }),
    getOrgEntitlement(user.organization_id),
  ]);

  const completePct = summary.count > 0 ? Math.round((summary.complete_count / summary.count) * 100) : 0;
  const tallyNumber = process.env.TWILIO_PHONE_NUMBER ?? 'your Tally number';

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Tally</h1>
        <nav className="flex items-center gap-4 text-sm text-muted">
          <LocaleSwitcher current={locale} />
          <Link href="/settings" className="hover:text-foreground">{t.app.nav.settings}</Link>
          <form action="/api/auth/logout" method="post" className="flex">
            <button type="submit" className="cursor-pointer bg-transparent p-0 [font:inherit] text-inherit hover:text-foreground">{t.app.nav.logout}</button>
          </form>
        </nav>
      </header>

      {/* Trial / paywall banner (DEC-021) */}
      {!entitlement.entitled ? (
        <div className="mt-6 rounded-lg border border-warning-600 bg-warning-50 p-4">
          <p className="font-medium text-warning-700">{d.trialEndedTitle}</p>
          <p className="mt-1 text-sm text-muted">{d.trialEndedBody}</p>
          <Link href="/pricing" className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover">
            {d.seePlans}
          </Link>
        </div>
      ) : entitlement.reason === 'trialing' ? (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-sm shadow-sm">
          <span className="text-muted">
            {fmt(entitlement.trialDaysLeft === 1 ? d.trialDaysLeftOne : d.trialDaysLeftOther, { days: entitlement.trialDaysLeft })}
          </span>
          <Link href="/pricing" className="font-medium text-accent hover:underline">{d.subscribe}</Link>
        </div>
      ) : null}

      {/* Summary widget */}
      <section className="mt-6 rounded-lg border border-border bg-surface p-5 shadow-sm">
        <p className="text-sm text-muted">{d.thisMonth}</p>
        <p className="mt-1 text-3xl font-semibold">{formatMoney(summary.total_cents)}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-muted">{d.receipts}</dt><dd className="font-medium">{summary.count}</dd></div>
          <div><dt className="text-muted">{d.deductible}</dt><dd className="font-medium">{formatMoney(summary.deductible_cents)}</dd></div>
          <div><dt className="text-muted">{d.documented}</dt><dd className="font-medium">{summary.complete_count} ({completePct}%)</dd></div>
          <div>
            <dt className="text-muted">{d.needsAttention}</dt>
            <dd className="font-medium">
              {summary.needs_attention_count > 0 ? (
                <Link href="/dashboard?filter=needs_attention" className="text-warning-700 underline">
                  {summary.needs_attention_count}
                </Link>
              ) : (0)}
            </dd>
          </div>
        </dl>
      </section>

      {/* Filters + export */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 text-sm">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/dashboard?filter=${f.key}`}
              className={`rounded-md px-3 py-1 ${filter === f.key ? 'bg-primary text-white' : 'text-muted hover:bg-primary-50'}`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/dashboard/cleanup" className="rounded-md border border-border bg-surface px-3 py-1 hover:bg-neutral-50">{d.cleanupLink}</Link>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not navigation */}
          <a href="/api/receipts/export?format=csv" className="rounded-md border border-border bg-surface px-3 py-1 hover:bg-neutral-50">{d.exportCsv}</a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not navigation */}
          <a href="/api/receipts/export?format=quickbooks" className="rounded-md border border-border bg-surface px-3 py-1 hover:bg-neutral-50">{d.quickbooks}</a>
        </div>
      </div>

      {/* Receipt list */}
      <section className="mt-4 divide-y divide-border rounded-lg border border-border bg-surface shadow-sm">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            {(() => {
              const [before, after] = d.emptyState.split('{number}');
              return (<>{before}<span className="font-medium text-foreground">{tallyNumber}</span>{after}</>);
            })()}
          </div>
        ) : (
          rows.map((r) => (
            <Link
              key={r.id}
              href={`/receipts/${r.id}`}
              className="flex items-center justify-between gap-3 p-3 hover:bg-neutral-50"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{r.vendor ?? d.unknownVendor}</p>
                <p className="text-xs text-muted">
                  {formatDate(r.transaction_date)} · {catLabel(r.category)}
                  {r.payment_account && r.payment_account !== 'unknown' ? ` · ${r.payment_account}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {r.needs_review && (
                  <span
                    title={r.review_reason ?? undefined}
                    className="inline-flex items-center rounded-md bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700 ring-1 ring-inset ring-warning-600/20"
                  >
                    {t.app.badge.review}
                  </span>
                )}
                <SubstantiationBadge
                  substantiationComplete={r.substantiation_complete}
                  needsReceipt={r.needs_receipt}
                  missingFields={r.substantiation_missing_fields}
                  labels={t.app.badge}
                />
                <span className="w-20 text-right font-medium">{formatMoney(r.amount_cents)}</span>
              </div>
            </Link>
          ))
        )}
      </section>
    </main>
  );
}
