// Context-match eval cases (data only). Shared by context-match.ts and turns.ts.
import type { ReceiptRow } from '../../src/lib/receipts';

export const NOW = new Date();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function r(key: string, vendor: string, dollars: number, category: string, agoMs: number): ReceiptRow {
  return {
    id: key, vendor, amount_cents: Math.round(dollars * 100), category,
    transaction_date: new Date(NOW.getTime() - agoMs).toISOString().slice(0, 10),
    created_at: new Date(NOW.getTime() - agoMs).toISOString(),
  } as ReceiptRow;
}

export interface Case { id: string; text: string; rows: ReceiptRow[]; expect: string; mustShortlist?: string[] }

const marriott = r('marriott', 'Marriott Austin', 230, 'travel_lodging', 2 * DAY);
export const CASES: Case[] = [
  { id: 'hotel-clear', text: 'that hotel was for the conference',
    rows: [r('starbucks', 'Starbucks', 6.5, 'meals_business', 1 * HOUR), r('uber', 'Uber', 18, 'travel_transportation', 3 * HOUR), marriott],
    expect: 'marriott' },
  { id: 'two-hotels', text: 'that hotel was for the conference',
    rows: [r('starbucks', 'Starbucks', 6.5, 'meals_business', 1 * HOUR), marriott, r('hilton', 'Hilton Denver', 189, 'travel_lodging', 5 * DAY)],
    expect: 'ASK', mustShortlist: ['marriott', 'hilton'] },
  { id: 'bare-fresh', text: 'that one was personal',
    rows: [r('starbucks', 'Starbucks', 6.5, 'meals_business', 20 * MIN), marriott],
    expect: 'starbucks' },
  // Real texts (2026-11-25): "its for business" after Netflix logged personal → shortlisted the
  // already-business expenses instead of the one just logged.
  { id: 'business-fresh-personal', text: 'its for business',
    rows: [r('netflix', 'Netflix', 50, 'personal', 1 * MIN), r('optimum', 'Optimum', 200, 'internet_phone', 10 * MIN), r('anthropic', 'Anthropic', 100, 'software', 21 * MIN)],
    expect: 'netflix' },
  { id: 'log-as-business-fresh', text: 'Log as business expense',
    rows: [r('netflix', 'Netflix', 50, 'personal', 1 * MIN), r('optimum', 'Optimum', 200, 'internet_phone', 10 * MIN)],
    expect: 'netflix' },
  { id: 'bare-stale', text: 'that one was personal',
    rows: [r('starbucks', 'Starbucks', 6.5, 'meals_business', 5 * HOUR), marriott],
    expect: 'ASK' },
  { id: 'dinner-person', text: 'dinner with Sarah was about the Q3 deal',
    rows: [r('shell', 'Shell', 52, 'vehicle_fuel', 2 * HOUR), r('nopa', 'Nopa', 84, 'meals_business', 1 * DAY)],
    expect: 'nopa' },
  { id: 'by-amount', text: 'the $18 one was to the airport',
    rows: [r('lyft', 'Lyft', 22, 'travel_transportation', 1 * DAY), r('uber', 'Uber', 18, 'travel_transportation', 3 * DAY)],
    expect: 'uber' },
  { id: 'same-trip', text: 'the Austin trip one was for a client',
    rows: [r('staples', 'Staples', 65, 'office_supplies', 1 * HOUR), marriott, r('delta', 'Delta (AUS)', 312, 'travel_transportation', 2 * DAY)],
    expect: 'ASK', mustShortlist: ['marriott', 'delta'] },
  { id: 'no-fit', text: 'the gym membership is for a client',
    rows: [r('starbucks', 'Starbucks', 6.5, 'meals_business', 1 * HOUR), r('shell', 'Shell', 52, 'vehicle_fuel', 1 * DAY)],
    expect: 'ASK' },
];
