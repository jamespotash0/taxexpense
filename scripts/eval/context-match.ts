// Late-context picker eval (spec: claude_files/specs/late-context-matching.md). Grades the LIVE
// Haiku picker (pickReceiptForContext in src/lib/context-match.ts): given a late detail and the
// user's recent expenses, does it pick the right one, and does it ASK when it can't be sure?
// A confident wrong pick is the failure that matters (it quietly edits the wrong IRS record).
//
//   npm run eval:context            (HAIKU_MODEL=claude-haiku-5-5 npm run eval:context for 5.5)
//
// No DB: receipts are built in memory. pickReceiptForContext swallows API errors into "ask", so a
// 429 would masquerade as a correct ASK. We pace under the 50/min cap AND count context_pick_failed
// warnings; any failure invalidates the run.

import { pickReceiptForContext } from '../../src/lib/context-match';
import { HAIKU_MODEL } from '../../src/lib/claude';
import type { ReceiptRow } from '../../src/lib/receipts';

const NOW = new Date();
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

interface Case { id: string; text: string; rows: ReceiptRow[]; expect: string; mustShortlist?: string[] }

const marriott = r('marriott', 'Marriott Austin', 230, 'travel_lodging', 2 * DAY);
const CASES: Case[] = [
  { id: 'hotel-clear', text: 'that hotel was for the conference',
    rows: [r('starbucks', 'Starbucks', 6.5, 'meals_business', 1 * HOUR), r('uber', 'Uber', 18, 'travel_transportation', 3 * HOUR), marriott],
    expect: 'marriott' },
  { id: 'two-hotels', text: 'that hotel was for the conference',
    rows: [r('starbucks', 'Starbucks', 6.5, 'meals_business', 1 * HOUR), marriott, r('hilton', 'Hilton Denver', 189, 'travel_lodging', 5 * DAY)],
    expect: 'ASK', mustShortlist: ['marriott', 'hilton'] },
  { id: 'bare-fresh', text: 'that one was personal',
    rows: [r('starbucks', 'Starbucks', 6.5, 'meals_business', 20 * MIN), marriott],
    expect: 'starbucks' },
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

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function main() {
  let pickFailures = 0;
  const warn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (args.some((a) => String(a).includes('context_pick_failed'))) pickFailures++;
    warn(...args);
  };

  console.log(`\n# Late-context picker eval (live ${HAIKU_MODEL})\n`);
  console.log('| id | expected | got | ✓ |\n| --- | --- | --- | --- |');
  let passed = 0;
  for (const c of CASES) {
    const pick = await pickReceiptForContext(c.text, c.rows, NOW);
    const got = pick.match ?? `ASK [${pick.shortlist.join(',')}]`;
    const ok = c.expect === 'ASK'
      ? pick.match === null && (c.mustShortlist ?? []).every((id) => pick.shortlist.includes(id))
      : pick.match === c.expect;
    if (ok) passed++;
    console.log(`| ${c.id} | ${c.expect}${c.mustShortlist ? ` [${c.mustShortlist.join(',')}]` : ''} | ${got} | ${ok ? '✓' : '✗'} |`);
    await sleep(1400);
  }
  console.log(`\n## Headline\n${passed}/${CASES.length} passed`);
  if (pickFailures > 0) {
    console.log(`INVALID RUN: ${pickFailures} picker call(s) failed (API error / rate limit); ASK results are not trustworthy.`);
    process.exitCode = 1;
  }
}

main();
