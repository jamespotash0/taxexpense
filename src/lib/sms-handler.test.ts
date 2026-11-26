// Unit tests for sms-handler's pure helpers: the gibberish guard (hasExpenseSignal) and the
// multi-charge note (summarizeExtra / formatBatchNote). Routing (new expense vs. reply vs. edit) is
// the turn interpreter's job now: unit tests in turn.test.ts, live replay in scripts/eval/turns.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasExpenseSignal, summarizeExtra, formatBatchNote } from './sms-handler';
import type { ParsedAdditionalExpense } from './ocr';

// hasExpenseSignal — the gibberish guard. A parsed text with NO amount/miles/vendor/purpose/
// attendees/place isn't an expense (→ ask to rephrase, not "how much?").
const PARSED_EMPTY = {
  amount: null,
  business_miles: null,
  vendor: null,
  business_purpose: null,
  attendees: null,
  location_city: null,
};

test('hasExpenseSignal: gibberish / empty parse has no signal', () => {
  assert.equal(hasExpenseSignal(PARSED_EMPTY), false);
  assert.equal(hasExpenseSignal({ ...PARSED_EMPTY, vendor: '   ' }), false); // whitespace-only ≠ signal
});

test('hasExpenseSignal: an amount or miles is a signal', () => {
  assert.equal(hasExpenseSignal({ ...PARSED_EMPTY, amount: 30 }), true);
  assert.equal(hasExpenseSignal({ ...PARSED_EMPTY, business_miles: 40 }), true);
  assert.equal(hasExpenseSignal({ ...PARSED_EMPTY, amount: 0 }), true); // explicit $0 is still a stated amount
});

test('hasExpenseSignal: a vendor/purpose/attendee/place (no amount) is a real expense missing its amount', () => {
  assert.equal(hasExpenseSignal({ ...PARSED_EMPTY, vendor: 'Starbucks' }), true);
  assert.equal(hasExpenseSignal({ ...PARSED_EMPTY, business_purpose: 'lunch with a client' }), true);
  assert.equal(hasExpenseSignal({ ...PARSED_EMPTY, attendees: 'John from Acme' }), true);
  assert.equal(hasExpenseSignal({ ...PARSED_EMPTY, location_city: 'Chicago' }), true);
});

// Multi-charge text capture (DEC-083): a single text naming several charges logs the primary on the
// normal flow and each ADDITIONAL charge too, then summarizes them in one note (no second question).
function extra(parsed: Partial<ParsedAdditionalExpense['parsed']>, category: string): ParsedAdditionalExpense {
  return {
    parsed: {
      amount: null, vendor: null, transaction_date: null, attendees: null, business_purpose: null,
      business_miles: null, location_city: null, raw_text: '', confidence: 0.9, ...parsed,
    },
    category: { category, confidence: 0.9, reasoning: '' },
  };
}

test('summarizeExtra: amount + vendor + category label', () => {
  assert.equal(summarizeExtra(extra({ amount: 15, vendor: 'Vercel' }, 'software')), '$15.00 Vercel (Software)');
});

test('summarizeExtra: mileage entry shows miles, no $; missing vendor reads cleanly', () => {
  assert.equal(summarizeExtra(extra({ business_miles: 40 }, 'vehicle_business')), '40 mi (Vehicle / Mileage)');
  assert.equal(summarizeExtra(extra({ amount: 12 }, 'travel_transportation')), '$12.00 (Travel: Transportation)');
});

test('formatBatchNote: lists each extra; pluralizes; no dashboard pointer when all complete', () => {
  const note = formatBatchNote(['$15 Vercel (Software)', '$12 parking (Travel: Transportation)'], false, 'https://tallywhy.com');
  assert.ok(note.includes('I also logged 2 more:'), note);
  assert.ok(note.includes('$15 Vercel (Software)') && note.includes('$12 parking'), note);
  assert.ok(!note.includes('dashboard'), note); // nothing incomplete → no pointer
});

test('formatBatchNote: singular phrasing + dashboard pointer when an extra is incomplete', () => {
  const note = formatBatchNote(['$80 dinner (Business Meals)'], true, 'https://tallywhy.com');
  assert.ok(note.includes('I also logged one more:'), note);
  assert.ok(note.includes('documentation complete'), note); // approved copy, never "audit-ready"
  assert.ok(note.includes('https://tallywhy.com'), note);
});
