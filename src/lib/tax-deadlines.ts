// US federal tax deadlines for Schedule-C self-employed (DEC-024). Pure logic so the
// "is a reminder due today?" decision is unit-testable; the cron route does the I/O.
//
// NOTE: nominal dates. Real deadlines shift for weekends/holidays — these are reminders,
// not filing dates, and every message defers to a CPA. §6654 (estimated) + annual filing.

export type DeadlineKind = 'estimated' | 'filing';

export interface Deadline {
  id: string;
  label: string;
  month: number; // 1-12
  day: number;
  kind: DeadlineKind;
}

export const DEADLINES: Deadline[] = [
  { id: 'q4', label: 'Q4 estimated taxes', month: 1, day: 15, kind: 'estimated' },
  // 1099-NEC: due Jan 31 for anyone who paid a contractor $600+ last year.
  { id: '1099nec', label: '1099-NEC filing', month: 1, day: 31, kind: 'filing' },
  { id: 'filing', label: 'annual tax filing', month: 4, day: 15, kind: 'filing' },
  { id: 'q1', label: 'Q1 estimated taxes', month: 4, day: 15, kind: 'estimated' },
  { id: 'q2', label: 'Q2 estimated taxes', month: 6, day: 15, kind: 'estimated' },
  { id: 'q3', label: 'Q3 estimated taxes', month: 9, day: 15, kind: 'estimated' },
];

export interface DeadlineReminder {
  dateISO: string; // YYYY-MM-DD of the deadline
  daysUntil: number;
  labels: string[]; // may combine same-date deadlines (e.g., Apr 15 = filing + Q1)
}

const DAY = 86400000;
function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Next occurrence (this year or next) of a month/day relative to `todayMs`. */
function nextOccurrence(month: number, day: number, todayMs: number): { dateISO: string; daysUntil: number } {
  const year = new Date(todayMs).getUTCFullYear();
  let dMs = Date.UTC(year, month - 1, day);
  if (dMs < todayMs) dMs = Date.UTC(year + 1, month - 1, day);
  return { dateISO: new Date(dMs).toISOString().slice(0, 10), daysUntil: Math.round((dMs - todayMs) / DAY) };
}

/**
 * Which deadline reminders are due today, grouped by date. Default leads: 7 days out
 * and 1 day out. Returns [] on non-reminder days.
 */
export function remindersDueOn(today: Date, leadDays: number[] = [7, 1]): DeadlineReminder[] {
  const t = utcMidnight(today);
  const byDate = new Map<string, DeadlineReminder>();
  for (const dl of DEADLINES) {
    const { dateISO, daysUntil } = nextOccurrence(dl.month, dl.day, t);
    if (!leadDays.includes(daysUntil)) continue;
    const existing = byDate.get(dateISO);
    if (existing) existing.labels.push(dl.label);
    else byDate.set(dateISO, { dateISO, daysUntil, labels: [dl.label] });
  }
  return [...byDate.values()];
}
