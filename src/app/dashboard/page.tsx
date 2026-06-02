// Dashboard (TSNAP-038/039/044): summary widget + receipt list + export. Server Component.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { getMonthlySummary, listReceipts, type ReceiptFilter } from '@/lib/receipts';
import { SubstantiationBadge } from '@/components/SubstantiationBadge';
import { categoryLabel } from '@/lib/categories';
import { formatMoney, formatDate } from '@/lib/format';

const FILTERS: { key: ReceiptFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'needs_attention', label: 'Needs attention' },
  { key: 'this_month', label: 'This month' },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?returnTo=/dashboard');

  const { filter: filterParam } = await searchParams;
  const filter: ReceiptFilter =
    filterParam === 'needs_attention' || filterParam === 'this_month' ? filterParam : 'all';

  const [summary, { rows }] = await Promise.all([
    getMonthlySummary(user.organization_id),
    listReceipts(user.organization_id, { filter, limit: 50 }),
  ]);

  const completePct = summary.count > 0 ? Math.round((summary.complete_count / summary.count) * 100) : 0;
  const tallyNumber = process.env.TWILIO_PHONE_NUMBER ?? 'your Tally number';

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Tally</h1>
        <nav className="flex items-center gap-4 text-sm text-gray-500">
          <Link href="/settings" className="hover:text-gray-900">Settings</Link>
          <a href="/api/auth/logout" className="hover:text-gray-900">Log out</a>
        </nav>
      </header>

      {/* Summary widget */}
      <section className="mt-6 rounded-lg border border-gray-200 p-5">
        <p className="text-sm text-gray-500">This month</p>
        <p className="mt-1 text-3xl font-semibold">{formatMoney(summary.total_cents)}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-gray-500">Receipts</dt><dd className="font-medium">{summary.count}</dd></div>
          <div><dt className="text-gray-500">Deductible</dt><dd className="font-medium">{formatMoney(summary.deductible_cents)}</dd></div>
          <div><dt className="text-gray-500">Documented</dt><dd className="font-medium">{summary.complete_count} ({completePct}%)</dd></div>
          <div>
            <dt className="text-gray-500">Needs attention</dt>
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
              className={`rounded-md px-3 py-1 ${filter === f.key ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-2 text-sm">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not navigation */}
          <a href="/api/receipts/export?format=csv" className="rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-50">Export CSV</a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not navigation */}
          <a href="/api/receipts/export?format=quickbooks" className="rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-50">QuickBooks</a>
        </div>
      </div>

      {/* Receipt list */}
      <section className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No receipts yet. Text <span className="font-medium text-gray-900">{tallyNumber}</span> to get started.
          </div>
        ) : (
          rows.map((r) => (
            <Link
              key={r.id}
              href={`/receipts/${r.id}`}
              className="flex items-center justify-between gap-3 p-3 hover:bg-gray-50"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{r.vendor ?? 'Unknown vendor'}</p>
                <p className="text-xs text-gray-500">
                  {formatDate(r.transaction_date)} · {categoryLabel(r.category)}
                  {r.payment_account && r.payment_account !== 'unknown' ? ` · ${r.payment_account}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <SubstantiationBadge
                  substantiationComplete={r.substantiation_complete}
                  needsReceipt={r.needs_receipt}
                  missingFields={r.substantiation_missing_fields}
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
