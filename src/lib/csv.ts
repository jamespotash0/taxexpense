// CSV building for export (TSNAP-042/043). No dependency — just correct escaping.
import type { ReceiptRow } from './receipts';
import { categoryLabel, qboAccount } from './categories';

/** RFC-4180 field escaping. `emptyAs` is substituted for null/empty values (e.g. '-'). */
function cell(value: unknown, emptyAs = ''): string {
  const s = value == null || value === '' ? emptyAs : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(cells: unknown[], emptyAs = ''): string {
  return cells.map((c) => cell(c, emptyAs)).join(',');
}

function dollars(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toFixed(2);
}

/** Receipt status for the export so a CPA can see un-receipted gaps at a glance (DEC-078). A
 *  "waived" expense (user has no receipt) is called out distinctly from one still being chased. */
function receiptStatus(r: ReceiptRow): string {
  if (r.photo_url) return 'On file';
  if (!r.needs_receipt) return 'Not required';
  return r.receipt_waived_at ? 'None (no receipt available)' : 'Missing';
}

/** Standard Tally CSV (TSNAP-042). */
export function toStandardCsv(receipts: ReceiptRow[]): string {
  const header = [
    'Date', 'Vendor', 'Amount', 'Category', 'IRC Section', 'Deductible Amount',
    'Payment Account', 'Business Purpose', 'Attendees', 'Notes', 'Receipt', 'Documentation Complete', 'Flagged for CPA', 'Needs Review',
  ];
  // Empty fields render as '-' so blank cells read as "intentionally empty" in a spreadsheet.
  const lines = receipts.map((r) =>
    row([
      r.transaction_date ?? '',
      r.vendor ?? '',
      dollars(r.amount_cents),
      categoryLabel(r.category),
      r.irc_section ? `§${r.irc_section}` : '',
      dollars(r.deductible_amount_cents),
      r.payment_account ?? '',
      r.business_purpose ?? '',
      r.attendees ?? '',
      r.notes ?? '',
      receiptStatus(r),
      r.substantiation_complete ? 'Yes' : 'No',
      r.flagged_for_cpa ? 'Yes' : '',
      r.needs_review ? 'Yes' : '',
    ], '-'),
  );
  return [row(header), ...lines].join('\n');
}

/** QuickBooks-compatible CSV (TSNAP-043): Date, Description, Amount, Account. */
export function toQuickbooksCsv(receipts: ReceiptRow[]): string {
  const header = ['Date', 'Description', 'Amount', 'Account'];
  const lines = receipts.map((r) =>
    row([
      r.transaction_date ?? '',
      [r.vendor, r.business_purpose].filter(Boolean).join(' · ') || categoryLabel(r.category),
      dollars(r.amount_cents),
      qboAccount(r.category),
    ]),
  );
  return [row(header), ...lines].join('\n');
}
