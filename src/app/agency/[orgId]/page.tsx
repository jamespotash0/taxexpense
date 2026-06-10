// Read-only per-creator view for agency staff (Spec 10, Fix 2). The receipt cards are deliberately
// NOT linked to /receipts/[id] (that route is the creator's own edit view, scoped to the logged-in
// user's org) — the agency view is read-only by construction. Category/badge labels reuse the i18n
// dictionary; the page chrome is English (internal tool). Server Component.
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { assertCanAccessOrg } from '@/lib/agency';
import { getOrgOwner } from '@/lib/users';
import { getMonthlySummary, listReceipts } from '@/lib/receipts';
import { StatusIcons } from '@/components/StatusIcons';
import { formatMoney, formatDate } from '@/lib/format';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/config';

export default async function AgencyCreatorPage({ params }: { params: Promise<{ orgId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { orgId } = await params;

  // SECURITY (Spec 10, Fix 2): the cross-org guard — a staffer may only view creators under their
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
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Link href="/agency" className="text-sm text-muted hover:text-foreground">← All clients</Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{name}</h1>
        </div>
        <span className="shrink-0 rounded-md border border-border bg-surface px-2 py-1 text-xs text-muted">Read-only</span>
      </header>

      <section className="mt-6 rounded-lg border border-border bg-surface p-5 shadow-sm">
        <p className="text-sm text-muted">{d.thisMonth}</p>
        <p className="mt-1 text-3xl font-semibold">{formatMoney(summary.total_cents)}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-muted">{d.receipts}</dt><dd className="font-medium">{summary.count}</dd></div>
          <div><dt className="text-muted">{d.deductible}</dt><dd className="font-medium">{formatMoney(summary.deductible_cents)}</dd></div>
          <div><dt className="text-muted">{d.documented}</dt><dd className="font-medium">{summary.complete_count} ({completePct}%)</dd></div>
          <div><dt className="text-muted">{d.needsAttention}</dt><dd className="font-medium">{summary.needs_attention_count}</dd></div>
        </dl>
      </section>

      <section className="mt-4">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted shadow-sm">No receipts yet.</div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg border border-border bg-surface p-3 shadow-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-medium">{r.vendor ?? d.unknownVendor}</p>
                  <span className="shrink-0 font-semibold tabular-nums">{formatMoney(r.amount_cents)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="truncate text-xs text-muted">{formatDate(r.transaction_date)} · {catLabel(r.category)}</p>
                  <StatusIcons
                    substantiationComplete={r.substantiation_complete}
                    needsReceipt={r.needs_receipt}
                    missingFields={r.substantiation_missing_fields}
                    needsReview={r.needs_review}
                    reviewReason={r.review_reason}
                    labels={t.app.badge}
                  />
                </div>
                <p className="mt-1 truncate text-xs text-muted">
                  {r.deduction_percentage === 0 ? d.nonDeductible : fmt(d.pctDeductible, { pct: r.deduction_percentage ?? 100 })}
                  {r.irc_section ? ` · §${r.irc_section}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
