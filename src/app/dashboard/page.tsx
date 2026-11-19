// Dashboard (TSNAP-038/039/044). Two deliberately different layouts over the same data:
//  - Phone: an app-style feed. To-do panel, the month, then activity grouped by month.
//  - Desktop (lg+): a workspace. Sticky left rail (to-do, month, export) beside a ledger
//    table of activity grouped by month.
// Server Component.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { getMonthlySummary, listReceipts, type ReceiptFilter } from '@/lib/receipts';
import { getOrgEntitlement } from '@/lib/subscription';
import { getUserAgencyIds, getOrgAgencyId } from '@/lib/agency';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/AppIcons';
import { ReceiptRow, ReceiptLedgerRow } from '@/components/ReceiptRow';
import { MonthEndReview } from '@/components/MonthEndReview';
import { formatMoney } from '@/lib/format';
import { formatUsPhone } from '@/lib/phone';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/config';
import { publicSmsNumber } from '@/lib/env';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; sub?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?returnTo=/dashboard');

  const { locale, t } = await getI18n();
  const d = t.app.dashboard;
  const dateLocale = locale === 'es' ? 'es-US' : 'en-US';
  const catLabel = (c: string | null): string =>
    c && c in t.app.categories ? (t.app.categories as Record<string, string>)[c] : t.app.categories.uncategorized;

  const FILTERS: { key: ReceiptFilter; label: string }[] = [
    { key: 'all', label: d.filterAll },
    { key: 'needs_attention', label: d.filterNeedsAttention },
    { key: 'this_month', label: d.filterThisMonth },
  ];

  const { filter: filterParam, sub } = await searchParams;
  const filter: ReceiptFilter =
    filterParam === 'needs_attention' || filterParam === 'this_month' ? filterParam : 'all';
  const justSubscribed = sub === 'success';

  const [summary, { rows }, entitlement, agencyIds, managedAgencyId] = await Promise.all([
    getMonthlySummary(user.organization_id),
    listReceipts(user.organization_id, { filter, limit: 50 }),
    getOrgEntitlement(user.organization_id),
    getUserAgencyIds(user.id),
    getOrgAgencyId(user.organization_id),
  ]);
  // Agency staff get a link to the multi-client view (Spec 10). A MANAGED creator (their org is
  // owned by an agency) pays nothing and sees no billing UI. The agency covers them.
  const isAgencyStaff = agencyIds.length > 0;
  const isManaged = managedAgencyId !== null;

  const completePct = summary.count > 0 ? Math.round((summary.complete_count / summary.count) * 100) : 0;
  const smsNumber = publicSmsNumber();
  const tallyNumber = smsNumber ? formatUsPhone(smsNumber) : 'your Tally number';
  const monthName = new Date().toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' });
  const needCount = summary.needs_attention_count;
  const needing = rows.filter(
    (r) => !r.substantiation_complete && (r.needs_receipt || (r.substantiation_missing_fields?.length ?? 0) > 0),
  );

  // Activity grouped by month (rows arrive newest first, so groups do too).
  const months: { key: string; label: string; total: number; rows: typeof rows }[] = [];
  for (const r of rows) {
    const key = r.transaction_date?.slice(0, 7) ?? 'none';
    let g = months.find((m) => m.key === key);
    if (!g) {
      const label = key === 'none' ? d.noDate : new Date(`${key}-01T00:00:00`).toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' });
      g = { key, label, total: 0, rows: [] };
      months.push(g);
    }
    g.rows.push(r);
    g.total += r.amount_cents;
  }

  const rowProps = (r: (typeof rows)[number]) => ({
    r,
    href: `/receipts/${r.id}`,
    vendorFallback: d.unknownVendor,
    category: `${catLabel(r.category)}${r.payment_account === 'business' ? ` · ${t.app.receipt.business}` : r.payment_account === 'personal' ? ` · ${t.app.receipt.personal}` : ''}`,
    taxLine: r.deduction_percentage === 0 ? d.nonDeductible : fmt(d.pctDeductible, { pct: r.deduction_percentage ?? 100 }),
    labels: t.app.badge,
  });

  const emptyLine = (() => {
    const [before, after] = d.emptyState.split('{number}');
    return (<>{before}<span className="whitespace-nowrap font-semibold">{tallyNumber}</span>{after}</>);
  })();

  // ── Shared pieces ─────────────────────────────────────────────────────────────
  const subscribed = justSubscribed && (
    <div className="rise-in rounded-3xl bg-success-50 px-5 py-4">
      <p className="font-semibold text-success-700">{d.subSuccessTitle}</p>
      <p className="mt-1 text-sm text-success-700/80">{d.subSuccessBody}</p>
    </div>
  );

  // Trial / paywall (DEC-021). Suppressed for managed creators (Spec 10).
  const trial = isManaged ? null : !entitlement.entitled ? (
    <div className="flex flex-col gap-3 rounded-3xl bg-warning-50 px-5 py-4">
      <div>
        <p className="font-semibold text-warning-700">{d.trialEndedTitle}</p>
        <p className="mt-1 text-sm text-warning-700/85">{d.trialEndedBody}</p>
      </div>
      <Link href="/pricing" className="btn btn-primary btn-sm self-start">{d.seePlans}</Link>
    </div>
  ) : entitlement.reason === 'trialing' ? (
    <div className="flex items-center justify-between gap-3 rounded-full bg-fill py-1.5 pl-4 pr-1.5 text-sm">
      <span className="text-muted">
        {fmt(entitlement.trialDaysLeft === 1 ? d.trialDaysLeftOne : d.trialDaysLeftOther, { days: entitlement.trialDaysLeft })}
      </span>
      <Link href="/pricing" className="btn btn-white btn-sm">{d.subscribe}</Link>
    </div>
  ) : null;

  // What still needs the user. `compact` = desktop rail size.
  const todo = (compact: boolean) =>
    summary.count === 0 ? (
      <section className={`rounded-[28px] bg-primary text-white ${compact ? 'p-6' : 'px-6 py-7'}`}>
        <h1 className="text-[1.75rem] font-bold leading-[1.15] tracking-[-0.03em] text-balance">{emptyLine}</h1>
      </section>
    ) : needCount > 0 ? (
      <section className={`rounded-[28px] bg-primary text-white ${compact ? 'p-6' : 'px-6 py-7'}`}>
        <h1 className={`font-bold leading-[1.15] tracking-[-0.03em] text-balance ${compact ? 'text-[1.5rem]' : 'text-[1.75rem]'}`}>
          {fmt(needCount === 1 ? d.todoOne : d.todoOther, { count: needCount })}
        </h1>
        {!compact && <p className="mt-2 text-[0.9375rem] text-white/80">{d.todoBody}</p>}
        <div className="mt-5 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={completePct} aria-valuemin={0} aria-valuemax={100} aria-label={fmt(d.documentedPct, { pct: completePct })}>
            <div className="bar-fill h-full rounded-full bg-white" style={{ width: `${completePct}%` }} />
          </div>
          <span className="num shrink-0 text-sm font-semibold">{fmt(d.documentedPct, { pct: completePct })}</span>
        </div>
        {needing.length > 0 && (
          <ul className="mt-5 space-y-2">
            {needing.slice(0, 3).map((r) => (
              <li key={r.id}>
                <Link href={`/receipts/${r.id}`} className="flex items-center gap-3 rounded-2xl bg-white/12 px-4 py-3 transition-colors hover:bg-white/20">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.vendor ?? d.unknownVendor}</span>
                    <span className="block truncate text-sm text-white/80">{r.needs_receipt ? t.app.badge.needsReceipt : t.app.badge.needsContext}</span>
                  </span>
                  <span className="num shrink-0 font-semibold">{formatMoney(r.amount_cents)}</span>
                  <Icon name="chevron" size={18} className="text-white/70" />
                </Link>
              </li>
            ))}
            {needCount > 3 && (
              <li>
                <Link href="/dashboard?filter=needs_attention" className="block px-1 pt-1 text-sm font-semibold text-white/85 hover:text-white">
                  {fmt(d.moreCount, { count: needCount - Math.min(3, needing.length) })}
                </Link>
              </li>
            )}
          </ul>
        )}
        <Link href="/dashboard?filter=needs_attention" className={`btn btn-white mt-5 ${compact ? 'w-full' : ''}`}>
          {d.todoCta}
          <Icon name="chevron" size={18} />
        </Link>
      </section>
    ) : (
      <section className="flex items-start gap-4 rounded-[28px] bg-success-50 px-6 py-7">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success-500 text-white">
          <Icon name="check" size={26} />
        </span>
        <div>
          <h1 className="text-[1.5rem] font-bold leading-tight tracking-[-0.03em] text-success-700">{d.allDoneTitle}</h1>
          <p className="mt-1 text-[0.9375rem] text-success-700/85">{d.allDoneBody}</p>
        </div>
      </section>
    );

  const stats = (
    <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
      <div><dt className="text-muted">{d.deductible}</dt><dd className="num mt-0.5 text-base font-semibold">{formatMoney(summary.deductible_cents)}</dd></div>
      <div><dt className="text-muted">{d.receipts}</dt><dd className="num mt-0.5 text-base font-semibold">{summary.count}</dd></div>
      <div><dt className="text-muted">{d.documented}</dt><dd className="num mt-0.5 text-base font-semibold">{summary.complete_count} <span className="font-medium text-muted">({completePct}%)</span></dd></div>
    </dl>
  );

  const filters = (
    <nav className="seg" aria-label={d.activity}>
      {FILTERS.map((f) => (
        <Link key={f.key} href={`/dashboard?filter=${f.key}`} aria-current={filter === f.key ? 'page' : undefined}>
          {f.label}
        </Link>
      ))}
    </nav>
  );

  const exportLinks = (cls: string) => (
    <>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not navigation */}
      <a href="/api/receipts/export?format=csv" className={cls}><Icon name="download" size={16} />{d.exportCsv}</a>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not navigation */}
      <a href="/api/receipts/export?format=quickbooks" className={cls}><Icon name="download" size={16} />{d.quickbooks}</a>
    </>
  );

  const empty = <p className="mt-6 rounded-3xl bg-fill px-6 py-10 text-center text-[0.9375rem] text-muted">{emptyLine}</p>;

  return (
    <AppShell nav={t.app.nav} active="home" showAgency={isAgencyStaff} width="max-w-3xl lg:max-w-7xl">
      {/* ── Phone / tablet: app-style feed ─────────────────────────────────────── */}
      <div className="space-y-4 lg:hidden">
        {subscribed}
        {todo(false)}
        {trial}

        <section className="pt-5">
          <p className="text-sm font-semibold text-muted">{d.spent} · <span className="capitalize">{monthName}</span></p>
          <p className="display-amount mt-2">{formatMoney(summary.total_cents)}</p>
          <div className="mt-4">{stats}</div>
        </section>

        <section className="pt-6">
          <h2 className="text-xl font-bold tracking-[-0.02em]">{d.activity}</h2>
          <div className="mt-3 overflow-x-auto">{filters}</div>
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">{exportLinks('btn btn-secondary btn-sm')}</div>

          {rows.length === 0 ? empty : months.map((m) => (
            <section key={m.key} className="mt-6">
              {/* Sticky month header under the top bar while scrolling that month. */}
              <h3 className="sticky top-14 z-10 -mx-4 flex items-baseline justify-between bg-white/95 px-4 py-2 backdrop-blur">
                <span className="text-[0.9375rem] font-bold capitalize">{m.label}</span>
                <span className="num text-sm font-semibold text-muted">{formatMoney(m.total)}</span>
              </h3>
              <ul className="divide-y divide-border">
                {m.rows.map((r) => <li key={r.id}><ReceiptRow {...rowProps(r)} /></li>)}
              </ul>
            </section>
          ))}
        </section>
      </div>

      {/* ── Desktop: workspace with a sticky rail and a month-by-month ledger ───── */}
      <div className="hidden lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-12">
        <aside className="sticky top-24 space-y-5 self-start">
          {subscribed}
          {todo(true)}
          <section className="sheet p-6">
            <p className="text-sm font-semibold text-muted">{d.spent} · <span className="capitalize">{monthName}</span></p>
            <p className="mt-2 text-[2.25rem] font-[650] leading-none tracking-[-0.04em] num">{formatMoney(summary.total_cents)}</p>
            <div className="mt-5">{stats}</div>
          </section>
          {trial}
          <div className="flex flex-wrap gap-2">{exportLinks('btn btn-secondary btn-sm')}</div>
        </aside>

        <section className="min-w-0">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[1.75rem] font-bold tracking-[-0.03em]">{d.activity}</h2>
            {filters}
          </div>

          {rows.length === 0 ? empty : (
            <div className="mt-6">
              <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_7.5rem_12rem_6.5rem] gap-4 border-b border-border px-3 pb-2 text-xs font-semibold text-muted">
                <span>{t.app.receipt.date}</span>
                <span>{t.app.receipt.vendor}</span>
                <span>{d.deductible}</span>
                <span>{d.colStatus}</span>
                <span className="text-right">{d.colAmount}</span>
              </div>
              {months.map((m) => (
                <section key={m.key}>
                  <h3 className="sticky top-16 z-10 flex items-baseline justify-between border-b border-border bg-white/95 px-3 pb-2 pt-6 backdrop-blur">
                    <span className="text-base font-bold capitalize">{m.label}</span>
                    <span className="text-sm text-muted">
                      {fmt(d.monthCount, { count: m.rows.length })} · <span className="num font-semibold text-foreground">{formatMoney(m.total)}</span>
                    </span>
                  </h3>
                  <ul className="divide-y divide-border">
                    {m.rows.map((r) => <li key={r.id}><ReceiptLedgerRow {...rowProps(r)} taxLine={r.deduction_percentage === 0 ? d.nonDeductible : `${r.deduction_percentage ?? 100}%`} /></li>)}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Month-end review agent (Phase 2, AGENTS-VS-WORKFLOWS.md): on-demand, draft-only. One
          instance (it holds draft state), placed after both layouts. */}
      <div className="lg:ml-[calc(22rem+3rem)]">
        <MonthEndReview hasAccountantEmail={!!user.accountant_email} />
      </div>
    </AppShell>
  );
}
