// Read-only per-creator view for agency staff (Spec 10, Fix 2). The receipt rows are deliberately
// NOT linked to /receipts/[id] (that route is the creator's own edit view, scoped to the logged-in
// user's org): the agency view is read-only by construction. Category/badge labels reuse the i18n
// dictionary; the page chrome is English (internal tool). Server Component.
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { assertCanAccessOrg } from '@/lib/agency';
import { getOrgOwner } from '@/lib/users';
import { getMonthlySummary, listReceipts } from '@/lib/receipts';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/AppIcons';
import { ReceiptRow } from '@/components/ReceiptRow';
import { formatMoney } from '@/lib/format';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/config';

export default async function AgencyCreatorPage({ params }: { params: Promise<{ orgId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { orgId } = await params;

  // SECURITY (Spec 10, Fix 2): the cross-org guard. A staffer may only view creators under their
  // own agency. Anything else 404s rather than leaking that the org exists.
  if (!(await assertCanAccessOrg(user, orgId))) notFound();

  const { t } = await getI18n();
  const d = t.app.dashboard;
  const catLabel = (c: string | null): string =>
    c && c in t.app.categories ? (t.app.categories as Record<string, string>)[c] : t.app.categories.uncategorized;

  const [summary, { rows }, owner] = await Promise.all([
    getMonthlySummary(orgId),
    listReceipts(orgId, { filter: 'all', limit: 100 }),
    getOrgOwner(orgId),
  ]);
  const name = owner?.full_name || 'Creator';
  const completePct = summary.count > 0 ? Math.round((summary.complete_count / summary.count) * 100) : 0;

  return (
    <AppShell nav={t.app.nav} active="agency" showAgency>
      <div className="flex items-center justify-between gap-3">
        <Link href="/agency" className="flex items-center gap-1 rounded-full bg-fill py-2 pl-2.5 pr-4 text-sm font-semibold hover:bg-fill-strong">
          <Icon name="back" size={18} />
          All clients
        </Link>
        <span className="chip chip-muted h-8 px-3"><Icon name="eye" size={14} />Read-only</span>
      </div>

      <h1 className="mt-6 text-[1.375rem] font-bold tracking-[-0.02em]">{name}</h1>
      <p className="mt-1 text-sm font-semibold text-muted">{d.spent}</p>
      <p className="display-amount mt-2">{formatMoney(summary.total_cents)}</p>
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
        <div><dt className="text-muted">{d.deductible}</dt><dd className="num mt-0.5 text-base font-semibold">{formatMoney(summary.deductible_cents)}</dd></div>
        <div><dt className="text-muted">{d.receipts}</dt><dd className="num mt-0.5 text-base font-semibold">{summary.count}</dd></div>
        <div><dt className="text-muted">{d.documented}</dt><dd className="num mt-0.5 text-base font-semibold">{summary.complete_count} <span className="font-medium text-muted">({completePct}%)</span></dd></div>
        <div><dt className="text-muted">{d.needsAttention}</dt><dd className={`num mt-0.5 text-base font-semibold ${summary.needs_attention_count > 0 ? 'text-warning-700' : ''}`}>{summary.needs_attention_count}</dd></div>
      </dl>

      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-[-0.02em]">{d.activity}</h2>
        {rows.length === 0 ? (
          <p className="mt-4 rounded-3xl bg-fill px-6 py-10 text-center text-muted">No receipts yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id}>
                <ReceiptRow
                  r={r}
                  vendorFallback={d.unknownVendor}
                  category={catLabel(r.category)}
                  taxLine={r.deduction_percentage === 0 ? d.nonDeductible : fmt(d.pctDeductible, { pct: r.deduction_percentage ?? 100 })}
                  labels={t.app.badge}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
