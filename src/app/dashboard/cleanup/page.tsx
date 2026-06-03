// Year-end cleanup panel (TSNAP-EPIC-9). Server Component. Scans a tax year's
// receipts and lists fixable gaps, each linking to the receipt to resolve.
// Deterministic by default; ?memo=1 adds the vague-memo Haiku pass. We SUGGEST,
// never advise (CLAUDE.md #1); copy says "documentation complete" (CLAUDE.md #5).
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { getReceiptsForYear, getReceiptYears } from '@/lib/receipts';
import { scanReceipts, scanWithMemoReview, type CleanupIssueType } from '@/lib/cleanup';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/config';

const GROUP_LABEL = {
  needs_receipt: 'groupNeedsReceipt',
  missing_context: 'groupMissingContext',
  duplicate: 'groupDuplicate',
  mixed_account: 'groupMixedAccount',
  vague_memo: 'groupVagueMemo',
} as const satisfies Record<CleanupIssueType, string>;

const GROUP_ORDER: CleanupIssueType[] = [
  'needs_receipt',
  'missing_context',
  'duplicate',
  'mixed_account',
  'vague_memo',
];

export default async function CleanupPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; memo?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?returnTo=/dashboard/cleanup');

  const { t } = await getI18n();
  const c = t.app.cleanup;

  const { year: yearParam, memo: memoParam } = await searchParams;
  const parsed = Number(yearParam);
  const year =
    Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100
      ? parsed
      : new Date().getFullYear();
  const withMemo = memoParam === '1';
  const memoQuery = withMemo ? '&memo=1' : '';

  const [receipts, years] = await Promise.all([
    getReceiptsForYear(user.organization_id, year),
    getReceiptYears(user.organization_id),
  ]);
  // Make sure the requested year is always selectable, even if it has no receipts.
  const yearOptions = years.includes(year) ? years : [year, ...years].sort((a, b) => b - a);
  const report = withMemo
    ? await scanWithMemoReview(receipts, year)
    : scanReceipts(receipts, year);

  // Group issues by type, preserving the resolve-priority order.
  const grouped = GROUP_ORDER.map((type) => ({
    type,
    issues: report.issues.filter((i) => i.type === type),
  })).filter((g) => g.issues.length > 0);

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{c.title}</h1>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
          {c.back}
        </Link>
      </header>

      <p className="mt-2 text-sm text-gray-600">{fmt(c.subtitle, { year })}</p>
      <p className="mt-1 text-xs text-gray-400">{fmt(c.scanned, { count: report.scanned_count, year })}</p>

      {yearOptions.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-1 text-sm">
          {yearOptions.map((y) => (
            <Link
              key={y}
              href={`/dashboard/cleanup?year=${y}${memoQuery}`}
              aria-current={y === year ? 'page' : undefined}
              className={`rounded-md px-3 py-1 ${y === year ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {y}
            </Link>
          ))}
        </div>
      )}

      {grouped.length === 0 ? (
        <div className="mt-8 rounded-lg border border-success-600 bg-success-50 p-6 text-center text-sm text-success-700">
          {fmt(c.allClear, { year })}
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {grouped.map((g) => (
            <section key={g.type} className="rounded-lg border border-gray-200">
              <h2 className="flex items-center justify-between border-b border-gray-100 px-4 py-2 text-sm font-medium">
                <span>{c[GROUP_LABEL[g.type]]}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{g.issues.length}</span>
              </h2>
              <ul className="divide-y divide-gray-100">
                {g.issues.map((issue, idx) => (
                  <li key={`${issue.type}-${idx}`} className="flex items-center justify-between gap-3 px-4 py-3">
                    <p className="min-w-0 text-sm text-gray-700">{issue.message}</p>
                    <Link
                      href={`/receipts/${issue.receipt_ids[0]}`}
                      className="shrink-0 rounded-md border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
                    >
                      {issue.receipt_ids.length > 1
                        ? fmt(c.openCount, { count: issue.receipt_ids.length })
                        : c.open}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Deep scan toggle — runs the vague-memo Haiku pass on top of deterministic checks. */}
      {!withMemo && (
        <div className="mt-6">
          <Link
            href={`/dashboard/cleanup?year=${year}&memo=1`}
            className="text-sm text-accent hover:underline"
          >
            {c.deepScan}
          </Link>
        </div>
      )}
    </main>
  );
}
