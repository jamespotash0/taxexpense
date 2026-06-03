// Unit tests for the pure recurring-expense helpers (DEC-033): month math, Y/N parsing,
// message copy, and template→input mapping. Run: npm run test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addOneMonth,
  isAffirmative,
  isNegative,
  isRecurringLikely,
  offerRecurring,
  recurringCreatedMsg,
  confirmRenewalMsg,
  templateToExpenseInput,
  type RecurringRow,
} from './recurring';

test('addOneMonth: simple', () => {
  assert.equal(addOneMonth('2026-06-15'), '2026-07-15');
});

test('addOneMonth: rolls into the next year in December', () => {
  assert.equal(addOneMonth('2026-12-31'), '2027-01-31');
});

test('addOneMonth: clamps the day to a shorter target month', () => {
  assert.equal(addOneMonth('2026-01-31'), '2026-02-28'); // Feb (non-leap 2026)
  assert.equal(addOneMonth('2026-03-31'), '2026-04-30'); // Apr has 30
});

test('addOneMonth: leap February', () => {
  assert.equal(addOneMonth('2028-01-31'), '2028-02-29'); // 2028 is a leap year
});

test('isAffirmative: clear yeses', () => {
  for (const t of ['Y', 'yes', 'Yep', 'yeah', 'sure', 'ok', 'log it', '👍']) {
    assert.equal(isAffirmative(t), true, t);
  }
});

test('isAffirmative: not a yes', () => {
  for (const t of ['no', 'nope', '$20 uber', 'maybe later', 'what?']) {
    assert.equal(isAffirmative(t), false, t);
  }
});

test('isNegative: clear nos', () => {
  for (const t of ['N', 'no', 'nope', 'skip', "didn't", 'cancel']) {
    assert.equal(isNegative(t), true, t);
  }
});

test('isNegative: a new expense is not a no', () => {
  assert.equal(isNegative('$49 figma'), false);
  assert.equal(isNegative('yes'), false);
});

test('isRecurringLikely: subscription/bill categories vs variable ones', () => {
  for (const c of ['software', 'internet_phone', 'insurance', 'rent']) {
    assert.equal(isRecurringLikely(c), true, c);
  }
  for (const c of ['meals_business', 'travel_transportation', 'vehicle_business', 'office_supplies', null]) {
    assert.equal(isRecurringLikely(c), false, String(c));
  }
});

test('offerRecurring: subscription reason (first log, category-based)', () => {
  const m = offerRecurring('Figma', 4900, 'subscription');
  assert.match(m, /Figma \$49\.00 looks like a recurring subscription/);
  assert.match(m, /Reply YES/);
});

test('offerRecurring: repeat reason (seen before)', () => {
  assert.match(offerRecurring('Figma', 4900, 'repeat'), /logged Figma \$49\.00 before/);
});

test('recurringCreatedMsg copy', () => {
  assert.match(recurringCreatedMsg('Figma', 4900), /Tracking Figma \$49\.00 monthly/);
  assert.match(recurringCreatedMsg('Figma', 4900), /nothing is logged until you confirm/);
});

test('confirmRenewalMsg asks Y/N', () => {
  const m = confirmRenewalMsg('Figma', 4900);
  assert.match(m, /Figma \$49\.00/);
  assert.match(m, /Reply Y to log it, or N to skip/);
});

test('offer copy handles a null vendor gracefully', () => {
  assert.match(offerRecurring(null, 1200, 'repeat'), /that expense \$12\.00/);
  assert.match(offerRecurring(null, 1200, 'subscription'), /^That \$12\.00 looks like/);
});

test('templateToExpenseInput maps fields + defaults to no-photo/today', () => {
  const row = {
    vendor: 'Figma',
    amount_cents: 4900,
    business_purpose: 'design tool',
  } as RecurringRow;
  const input = templateToExpenseInput(row);
  assert.equal(input.amount_cents, 4900);
  assert.equal(input.vendor, 'Figma');
  assert.equal(input.business_purpose, 'design tool');
  assert.equal(input.has_photo, false);
  assert.equal(input.transaction_date, null); // saveReceipt fills today
  assert.equal(input.business_miles, null);
});
