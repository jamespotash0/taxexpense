// CSV building for export (TSNAP-042/043). No dependency — just correct escaping.
import type { ReceiptRow } from './receipts';
import { categoryLabel, qboAccount } from './categories';

/** RFC-4180 field escaping. */
function cell(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(cells: unknown[]): string {
  return cells.map(cell).join(',');
}

function dollars(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toFixed(2);
}

/** Standard Tally CSV (TSNAP-042). */
export function toStandardCsv(receipts: ReceiptRow[]): string {
  const header = [
    'Date', 'Vendor', 'Amount', 'Category', 'IRC Section', 'Deductible Amount',
    'Payment Account', 'Business Purpose', 'Attendees', 'Notes', 'Documentation Complete',
  ];
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
      r.substantiation_complete ? 'Yes' : 'No',
    ]),
  );
  return [row(header), ...lines].join('\n');
}

/** QuickBooks-compatible CSV (TSNAP-043): Date, Description, Amount, Account. */
export function toQuickbooksCsv(receipts: ReceiptRow[]): string {
  const header = ['Date', 'Description', 'Amount', 'Account'];
  const lines = receipts.map((r) =>
    row([
      r.transaction_date ?? '',
      [r.vendor, r.business_purpose].filter(Boolean).join(' — ') || categoryLabel(r.category),
      dollars(r.amount_cents),
      qboAccount(r.category),
    ]),
  );
  return [row(header), ...lines].join('\n');
}
