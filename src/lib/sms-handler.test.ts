// Unit tests for the partial-capture ("how much was this?") guardrail (DEC-064).
// `replyStartsNewExpense` decides whether a reply, arriving while we're awaiting an amount,
// is the user ANSWERING the amount (→ combine with the remembered text) or starting a FRESH
// expense (→ log it alone, let the stale partial expire). The orchestration around it is
// integration-level (LLM + DB) and not unit-tested, matching router.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replyStartsNewExpense, looksLikeCorrection, looksLikeNoReceipt, looksLikeNoReceiptEver, hasExpenseSignal, summarizeExtra, formatBatchNote } from './sms-handler';
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

test('bare amount answers stay answers (combine with the remembered text)', () => {
  assert.equal(replyStartsNewExpense('$167'), false);
  assert.equal(replyStartsNewExpense('$167.50'), false);
  assert.equal(replyStartsNewExpense('it was $167'), false);
  assert.equal(replyStartsNewExpense('about $40'), false);
});

test('bare numbers (no $) are answers — the LLM re-parse handles them', () => {
  // No "$" / "dollars" → not a fast-path capture, so treated as an answer and combined.
  assert.equal(replyStartsNewExpense('167'), false);
  assert.equal(replyStartsNewExpense('it was 167'), false);
});

test('a self-contained expense in the reply is a fresh capture (Priya edge a)', () => {
  // Amount/miles PLUS a real description → the user moved on; log it alone, don't glue it on.
  assert.equal(replyStartsNewExpense('$50 gas to Acme'), true);
  assert.equal(replyStartsNewExpense('$45 lunch with a client'), true);
  assert.equal(replyStartsNewExpense('drove 40 miles to the job site'), true);
});

test('an amount-only correction is NOT a fresh expense (it edits the prior receipt)', () => {
  // Only a correction marker survives the strip — no new vendor/description → not fresh, so it
  // flows into the correction window and fixes the last receipt's amount (limitation A).
  assert.equal(replyStartsNewExpense('actually it was $200'), false);
  assert.equal(replyStartsNewExpense('make it $200'), false);
  assert.equal(replyStartsNewExpense('should be $200 not $167'), false);
  // ...but a marker that ALSO introduces a new vendor/description is still a fresh expense.
  assert.equal(replyStartsNewExpense('actually $40 lunch with a client'), true);
});

test('questions are never treated as a fresh capture', () => {
  assert.equal(replyStartsNewExpense('how much did I spend?'), false);
  assert.equal(replyStartsNewExpense('did I really spend $200 on software?'), false);
});

test('empty / non-expense replies are answers (fall through to combine)', () => {
  assert.equal(replyStartsNewExpense(''), false);
  assert.equal(replyStartsNewExpense('a restaurant downtown'), false); // no amount → not "fresh"
});

// ---------------------------------------------------------------------------
// looksLikeCorrection — the post-log correction-window gate (DEC-064, #2)
// ---------------------------------------------------------------------------

test('correction markers are detected as edits', () => {
  assert.equal(looksLikeCorrection('it was a business meal', null), true);
  assert.equal(looksLikeCorrection('that was personal', null), true);
  assert.equal(looksLikeCorrection('actually that was for the office', null), true);
  assert.equal(looksLikeCorrection("no that's not right, change it to meals", null), true);
  assert.equal(looksLikeCorrection('add John and Sarah to that', null), true);
});

test('naming the just-logged vendor is treated as a correction', () => {
  // The real transcript: "Tabernacle is a restaurant" right after logging a Tabernacle receipt.
  assert.equal(looksLikeCorrection('Tabernacle is a restaurant', 'Tabernacle'), true);
  assert.equal(looksLikeCorrection('the Tabernacle charge was a client dinner', 'Tabernacle'), true);
});

test('descriptive restatement is a correction even when the vendor was mis-parsed', () => {
  // Real transcript: OCR logged the vendor as "Tablenacle"; the user types "Tabernacle is a
  // restaurant". The vendor spelling doesn't match, so the "is a" marker must carry it.
  assert.equal(looksLikeCorrection('Tabernacle is a restaurant', 'Tablenacle'), true);
  assert.equal(looksLikeCorrection('that was a client dinner', 'Tablenacle'), true);
});

test('a fresh amount-less expense is NOT a correction (falls through to awaiting_amount)', () => {
  // No marker, doesn't name the recent vendor → must not hijack; it should become a new capture.
  assert.equal(looksLikeCorrection('lunch with a client', 'ShopRite'), false);
  assert.equal(looksLikeCorrection('parking downtown', 'Adobe'), false);
});

test('an amount correction is recognized as an edit (limitation A)', () => {
  // The marker carries it; the gate (replyStartsNewExpense=false) lets it reach the window.
  assert.equal(looksLikeCorrection('actually it was $200', 'Tabernacle'), true);
  assert.equal(looksLikeCorrection('make it $200', 'Tabernacle'), true);
  assert.equal(looksLikeCorrection('should be $200 not $167', 'Tabernacle'), true);
});

test('short/common vendor tokens do not false-trigger the vendor match', () => {
  // "a"/"is" etc. are < 4 chars; only meaningful tokens count.
  assert.equal(looksLikeCorrection('coffee this morning', 'A1 Gas'), false);
});

// looksLikeNoReceipt — a text reply while awaiting a receipt that means "I don't/can't give one"
// (DEC-072). Must catch the natural phrasings so they're acknowledged, not treated as new expenses.
test('looksLikeNoReceipt: catches "do not have it" phrasings', () => {
  assert.equal(looksLikeNoReceipt("I don't have a receipt"), true);
  assert.equal(looksLikeNoReceipt('dont have one'), true);
  assert.equal(looksLikeNoReceipt('no receipt'), true);
  assert.equal(looksLikeNoReceipt("didn't keep it"), true);
  assert.equal(looksLikeNoReceipt('I lost the receipt'), true);
  assert.equal(looksLikeNoReceipt('threw it out'), true);
  assert.equal(looksLikeNoReceipt('no photo of it'), true);
});

test('looksLikeNoReceipt: catches "later / will send" deferrals', () => {
  assert.equal(looksLikeNoReceipt("I'll send it later"), true);
  assert.equal(looksLikeNoReceipt('later'), true);
  assert.equal(looksLikeNoReceipt('will send tonight'), true);
});

test('looksLikeNoReceipt: does NOT fire on unrelated replies', () => {
  assert.equal(looksLikeNoReceipt('it was with John from Acme'), false);
  assert.equal(looksLikeNoReceipt('$84 dinner'), false);
  assert.equal(looksLikeNoReceipt('why do you need it?'), false);
  assert.equal(looksLikeNoReceipt('here you go'), false);
});

// looksLikeNoReceiptEver — the PERMANENT "there is no receipt" signal that WAIVES future reminders
// (DEC-078). Must catch "lost it / never had one / only the bill" but NOT "later" deferrals, so a
// "I'll send it" reply keeps getting nudged while a genuine "I don't have it" stops.
test('looksLikeNoReceiptEver: fires on permanent "no receipt" phrasings', () => {
  assert.equal(looksLikeNoReceiptEver("I don't have a receipt"), true);
  assert.equal(looksLikeNoReceiptEver('lost it'), true);
  assert.equal(looksLikeNoReceiptEver('threw it out'), true);
  assert.equal(looksLikeNoReceiptEver("didn't keep it"), true);
  assert.equal(looksLikeNoReceiptEver('never got one'), true);
  assert.equal(looksLikeNoReceiptEver('no receipt'), true);
  assert.equal(looksLikeNoReceiptEver('I only have the bill'), true);
  assert.equal(looksLikeNoReceiptEver("can't find it"), true);
});

test('looksLikeNoReceiptEver: does NOT fire on "later" deferrals (those stay flagged)', () => {
  assert.equal(looksLikeNoReceiptEver("I'll send it later"), false);
  assert.equal(looksLikeNoReceiptEver('later'), false);
  assert.equal(looksLikeNoReceiptEver('will send tonight'), false);
  assert.equal(looksLikeNoReceiptEver('not now'), false);
  // ...and not on unrelated replies
  assert.equal(looksLikeNoReceiptEver('it was with John from Acme'), false);
  assert.equal(looksLikeNoReceiptEver('here you go'), false);
});

// Still used by the LIVE awaiting_receipt branch (a permanent "no receipt" reply while we just asked
// for one). Reminder replies (no live context) are handled by reasoning in routeTextMessage instead.
test('looksLikeNoReceiptEver: catches the verbose "skip it" phrasing', () => {
  assert.equal(looksLikeNoReceiptEver("Don't have a receipt for it so you can skip it"), true);
  assert.equal(looksLikeNoReceiptEver('no receipt, skip these'), true);
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
  assert.ok(note.includes('documentation-complete'), note); // approved copy, never "audit-ready"
  assert.ok(note.includes('https://tallywhy.com'), note);
});
