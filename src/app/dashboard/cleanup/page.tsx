// Year-end cleanup panel (TSNAP-EPIC-9). Server Component. Scans a tax year's
// receipts and lists fixable gaps, each linking to the receipt to resolve.
// Deterministic by default; ?memo=1 adds the vague-memo Haiku pass. We SUGGEST,
// never advise (CLAUDE.md #1); copy says "documentation complete" (CLAUDE.md #5).
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { getReceiptsForYear, getReceiptYears } from '@/lib/receipts';
import { scanReceipts, scanWithMemoReview, type CleanupIssueType } from '@/lib/cleanup';
import { getUserAgencyIds } from '@/lib/agency';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/AppIcons';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/config';

const GROUP_LABEL = {
  needs_receipt: 'groupNeedsReceipt',
  missing_context: 'groupMissingContext',
  gift_cap: 'groupGiftCap',
  duplicate: 'groupDuplicate',
  mixed_account: 'groupMixedAccount',
  vehicle_method: 'groupVehicleMethod',
  vague_memo: 'groupVagueMemo',
} as const satisfies Record<CleanupIssueType, string>;

const GROUP_ORDER: CleanupIssueType[] = [
  'needs_receipt',
  'missing_context',
  'gift_cap',
  'duplicate',
  'mixed_account',
  'vehicle_method',
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

  const [receipts, years, agencyIds] = await Promise.all([
    getReceiptsForYear(user.organization_id, year),
    getReceiptYears(user.organization_id),
    getUserAgencyIds(user.id),
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
    <AppShell nav={t.app.nav} active="cleanup" showAgency={agencyIds.length > 0}>
      <h1 className="text-[2rem] font-bold leading-tight tracking-[-0.03em]">{c.title}</h1>
      <p className="mt-2 max-w-lg text-[0.9375rem] text-muted">{fmt(c.subtitle, { year })}</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {yearOptions.length > 1 && (
          <nav className="seg" aria-label="Year">
            {yearOptions.map((y) => (
              <Link key={y} href={`/dashboard/cleanup?year=${y}${memoQuery}`} aria-current={y === year ? 'page' : undefined} className="num">
                {y}
              </Link>
            ))}
          </nav>
        )}
        <span className="text-sm text-muted">{fmt(c.scanned, { count: report.scanned_count, year })}</span>
      </div>

      {grouped.length === 0 ? (
        <section className="mt-8 flex items-start gap-4 rounded-[28px] bg-success-50 px-6 py-7 sm:px-8">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success-500 text-white">
            <Icon name="check" size={26} />
          </span>
          <p className="pt-2.5 text-lg font-semibold text-success-700">{fmt(c.allClear, { year }).replace(/\s*✓$/, '')}</p>
        </section>
      ) : (
        <div className="mt-8 space-y-10">
          {grouped.map((g) => (
            <section key={g.type}>
              <h2 className="flex items-center gap-2.5 text-lg font-bold tracking-[-0.02em]">
                {c[GROUP_LABEL[g.type]]}
                <span className="chip chip-need num">{g.issues.length}</span>
              </h2>
              <ul className="mt-2 divide-y divide-border">
                {g.issues.map((issue, idx) => (
                  <li key={`${issue.type}-${idx}`}>
                    <Link href={`/receipts/${issue.receipt_ids[0]}`} className="row-press -mx-3 flex items-center gap-3 rounded-2xl px-3 py-3.5">
                      <p className="min-w-0 flex-1 text-[0.9375rem]">{issue.message}</p>
                      <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primary">
                        {issue.receipt_ids.length > 1 ? fmt(c.openCount, { count: issue.receipt_ids.length }) : c.open}
                        <Icon name="chevron" size={16} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Deep scan: runs the vague-memo Haiku pass on top of deterministic checks. */}
      {!withMemo && (
        <div className="mt-10 border-t border-border pt-6">
          <Link href={`/dashboard/cleanup?year=${year}&memo=1`} className="btn btn-secondary btn-sm">
            <Icon name="sparkle" size={16} />
            {c.deepScan}
          </Link>
        </div>
      )}
    </AppShell>
  );
}
