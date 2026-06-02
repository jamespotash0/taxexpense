// Display formatters (shared by dashboard server + client components).

export function formatMoney(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  // date is YYYY-MM-DD; render as e.g. "Apr 15" / "Apr 15, 2025" if not current year.
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === now.getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' };
  return d.toLocaleDateString('en-US', opts);
}
