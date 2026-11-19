// One expense as a list row (dashboard + agency view). Success is quiet (a green check),
// anything that needs the user is loud (an amber chip naming what's missing).
import Link from 'next/link';
import { Icon } from '@/components/AppIcons';
import { formatMoney, formatDate } from '@/lib/format';

interface Row {
  id: string;
  vendor: string | null;
  amount_cents: number;
  transaction_date: string | null;
  irc_section: string | null;
  substantiation_complete: boolean;
  needs_receipt: boolean;
  substantiation_missing_fields: string[] | null;
  needs_review?: boolean;
  review_reason?: string | null;
}

interface Labels {
  complete: string;
  needsReceipt: string;
  needsContext: string;
  pending: string;
  review: string;
}

export function ReceiptRow({
  r,
  href,
  vendorFallback,
  category,
  taxLine,
  labels,
}: {
  r: Row;
  href?: string;
  vendorFallback: string;
  category: string;
  taxLine: string;
  labels: Labels;
}) {
  const vendor = r.vendor ?? vendorFallback;
  const needs = !r.substantiation_complete && (r.needs_receipt || (r.substantiation_missing_fields?.length ?? 0) > 0);

  const status = r.substantiation_complete ? (
    <span className="text-success-600" title={labels.complete}><Icon name="checkCircle" size={20} label={labels.complete} /></span>
  ) : r.needs_receipt ? (
    <span className="chip chip-need"><Icon name="receipt" size={14} /><span className="hidden sm:inline">{labels.needsReceipt}</span></span>
  ) : needs ? (
    <span className="chip chip-need"><Icon name="pen" size={14} /><span className="hidden sm:inline">{labels.needsContext}</span></span>
  ) : (
    <span className="chip chip-muted"><Icon name="clock" size={14} /><span className="hidden sm:inline">{labels.pending}</span></span>
  );
  // On phones the chip shrinks to its icon, so the words move into the text column.
  const needLabel = r.substantiation_complete ? null : r.needs_receipt ? labels.needsReceipt : needs ? labels.needsContext : labels.pending;

  const body = (
    <>
      <span
        aria-hidden="true"
        className={`flex size-11 shrink-0 items-center justify-center rounded-full text-[1.0625rem] font-bold ${
          needs ? 'bg-warning-50 text-warning-700' : 'bg-fill text-foreground'
        }`}
      >
        {vendor.trim().charAt(0).toUpperCase() || '·'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[0.9375rem] font-semibold">{vendor}</span>
          {r.needs_review && (
            <span className="text-warning-700" title={r.review_reason ? `${labels.review}: ${r.review_reason}` : labels.review}>
              <Icon name="eye" size={16} label={r.review_reason ? `${labels.review}: ${r.review_reason}` : labels.review} />
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[0.8125rem] text-muted">
          {formatDate(r.transaction_date)} · {category}
        </span>
        {needLabel && (
          <span className={`mt-0.5 block text-xs font-semibold sm:hidden ${needs ? 'text-warning-700' : 'text-muted'}`}>{needLabel}</span>
        )}
        <span className="mt-0.5 block truncate text-xs text-muted">
          {taxLine}
          {r.irc_section ? ` · §${r.irc_section}` : ''}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="num text-[0.9375rem] font-semibold">{formatMoney(r.amount_cents)}</span>
        {status}
      </span>
    </>
  );

  const cls = 'flex items-center gap-3.5 rounded-2xl px-3 py-3 -mx-3';
  return href ? (
    <Link href={href} className={`${cls} row-press`}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Desktop ledger row: one line per expense, aligned to the dashboard's column header. */
export function ReceiptLedgerRow({
  r,
  href,
  vendorFallback,
  category,
  taxLine,
  labels,
}: {
  r: Row;
  href: string;
  vendorFallback: string;
  category: string;
  taxLine: string;
  labels: Labels;
}) {
  const needs = !r.substantiation_complete && (r.needs_receipt || (r.substantiation_missing_fields?.length ?? 0) > 0);
  const status = r.substantiation_complete ? (
    <span className="chip chip-done"><Icon name="checkCircle" size={14} />{labels.complete}</span>
  ) : r.needs_receipt ? (
    <span className="chip chip-need"><Icon name="receipt" size={14} />{labels.needsReceipt}</span>
  ) : needs ? (
    <span className="chip chip-need"><Icon name="pen" size={14} />{labels.needsContext}</span>
  ) : (
    <span className="chip chip-muted"><Icon name="clock" size={14} />{labels.pending}</span>
  );
  return (
    <Link
      href={href}
      className="row-press grid grid-cols-[4.5rem_minmax(0,1fr)_7.5rem_12rem_6.5rem] items-center gap-4 rounded-xl px-3 py-3 text-sm"
    >
      <span className="num text-muted">{formatDate(r.transaction_date)}</span>
      <span className="min-w-0">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate font-semibold text-[0.9375rem]">{r.vendor ?? vendorFallback}</span>
        {r.needs_review && (
          <span className="text-warning-700" title={r.review_reason ? `${labels.review}: ${r.review_reason}` : labels.review}>
            <Icon name="eye" size={16} label={r.review_reason ? `${labels.review}: ${r.review_reason}` : labels.review} />
          </span>
        )}
      </span>
      <span className="mt-0.5 block truncate text-[0.8125rem] text-muted">{category}</span>
      </span>
      <span className="num truncate text-muted">{taxLine}{r.irc_section ? ` · §${r.irc_section}` : ''}</span>
      <span className="min-w-0">{status}</span>
      <span className="num text-right text-[0.9375rem] font-semibold">{formatMoney(r.amount_cents)}</span>
    </Link>
  );
}
