// Unit tests for the partial-capture ("how much was this?") guardrail (DEC-064).
// `replyStartsNewExpense` decides whether a reply, arriving while we're awaiting an amount,
// is the user ANSWERING the amount (→ combine with the remembered text) or starting a FRESH
// expense (→ log it alone, let the stale partial expire). The orchestration around it is
// integration-level (LLM + DB) and not unit-tested, matching router.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replyStartsNewExpense, looksLikeCorrection } from './sms-handler';

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
