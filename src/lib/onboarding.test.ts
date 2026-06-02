// Unit tests for onboarding parsing + config (DEC-013).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEntityType, parsePaymentAccount, parseName, ONBOARDING_QUESTIONS } from './onboarding';

test('parseName strips lead-ins and tidies', () => {
  assert.equal(parseName('Jane'), 'Jane');
  assert.equal(parseName("I'm Jane"), 'Jane');
  assert.equal(parseName('my name is Jane Doe'), 'Jane Doe');
  assert.equal(parseName('hey, this is Sam!'), 'Sam');
});

test('parseEntityType maps keywords; "not sure" → unknown', () => {
  assert.equal(parseEntityType('sole prop'), 'sole_prop');
  assert.equal(parseEntityType('I think a sole proprietor'), 'sole_prop');
  assert.equal(parseEntityType('LLC'), 'smllc');
  assert.equal(parseEntityType('single-member llc'), 'smllc');
  assert.equal(parseEntityType('not sure'), 'unknown');
  assert.equal(parseEntityType('🤷'), 'unknown');
});

test('parsePaymentAccount maps keywords; "mixed" → unknown', () => {
  assert.equal(parsePaymentAccount('business'), 'business');
  assert.equal(parsePaymentAccount('my personal card'), 'personal');
  assert.equal(parsePaymentAccount('mixed'), 'unknown');
  assert.equal(parsePaymentAccount('both honestly'), 'unknown');
});

test('onboarding config: name first, then the three profile fields, in order', () => {
  assert.deepEqual(
    ONBOARDING_QUESTIONS.map((q) => q.key),
    ['full_name', 'business_type', 'entity_type', 'default_payment_account'],
  );
});
