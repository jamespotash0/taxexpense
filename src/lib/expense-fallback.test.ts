// Fallback reply when the composed reply fails: friendly, no em dashes, and it asks exactly what
// the conversation state expects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fallbackLogMessage } from './expense';
import type { ExpenseInput } from './categorize';
import type { SubstantiationResult } from './substantiation';

const input = { amount_cents: 14000, vendor: 'Nobu' } as ExpenseInput;
const decision = (missing: string[]): SubstantiationResult => ({
  needs_receipt: false,
  receipt_reason: null,
  missing_context_fields: missing,
  substantiation_complete: missing.length === 0,
  deduction_percentage: 50,
  deductible_amount_cents: 7000,
});

test('complete: confirms and says all set', () => {
  const m = fallbackLogMessage(input, 'meals_business', '274(d)', decision([]), null);
  assert.equal(m, "Got it! $140.00 at Nobu is saved under Business Meals (§274(d)). You're all set ✓");
});

test('needs context: asks for the missing fields in plain words', () => {
  const m = fallbackLogMessage(input, 'meals_business', '274(d)', decision(['attendees', 'business_purpose']), 'awaiting_context');
  assert.match(m, /Can you tell me who it was with and what it was for\?/);
});

test('needs receipt: asks for a photo', () => {
  const m = fallbackLogMessage(input, 'travel_lodging', '162', decision([]), 'awaiting_receipt');
  assert.match(m, /snap a pic of the receipt/);
});

test('never uses em dashes', () => {
  for (const s of [null, 'awaiting_context', 'awaiting_receipt'] as const) {
    assert.ok(!fallbackLogMessage(input, 'software', null, decision(['business_purpose']), s).includes('—'));
  }
});
