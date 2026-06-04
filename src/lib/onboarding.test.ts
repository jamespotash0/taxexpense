// Unit tests for onboarding parsing + config (DEC-013).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEntityType, parsePaymentAccount, parseName, parseBusinessName, hasNamedEntity, ONBOARDING_QUESTIONS } from './onboarding';
import type { AppUser } from './users';

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
  assert.equal(parseEntityType('S-corp'), 's_corp');
  assert.equal(parseEntityType('s corp'), 's_corp');
  assert.equal(parseEntityType('C corp'), 'c_corp');
  assert.equal(parseEntityType('c-corporation'), 'c_corp');
  // An LLC taxed as an S-corp is an S-corp for tax purposes (check S/C-corp before LLC).
  assert.equal(parseEntityType('LLC taxed as an s-corp'), 's_corp');
  assert.equal(parseEntityType('not sure'), 'unknown');
  assert.equal(parseEntityType('🤷'), 'unknown');
});

test('parsePaymentAccount maps keywords; "mixed" → unknown', () => {
  assert.equal(parsePaymentAccount('business'), 'business');
  assert.equal(parsePaymentAccount('my personal card'), 'personal');
  assert.equal(parsePaymentAccount('mixed'), 'unknown');
  assert.equal(parsePaymentAccount('both honestly'), 'unknown');
});

test('onboarding config: name, work, entity, business name, payment — in order (DEC-058)', () => {
  assert.deepEqual(
    ONBOARDING_QUESTIONS.map((q) => q.key),
    ['full_name', 'business_type', 'entity_type', 'organization_name', 'default_payment_account'],
  );
  // Business name persists to the org, after entity, and is the only gated question.
  const biz = ONBOARDING_QUESTIONS.find((q) => q.key === 'organization_name')!;
  assert.equal(biz.target, 'org');
  assert.ok(biz.when, 'business-name question must be conditional');
  assert.ok(
    ONBOARDING_QUESTIONS.findIndex((q) => q.key === 'entity_type') <
      ONBOARDING_QUESTIONS.findIndex((q) => q.key === 'organization_name'),
    'entity type must be asked before business name',
  );
});

test('parseBusinessName: keeps real names, nulls explicit skips', () => {
  assert.equal(parseBusinessName('Acme Photography'), 'Acme Photography');
  assert.equal(parseBusinessName('  Blue Door LLC '), 'Blue Door LLC');
  assert.equal(parseBusinessName('skip'), null);
  assert.equal(parseBusinessName('just me'), null);
  assert.equal(parseBusinessName('n/a'), null);
  assert.equal(parseBusinessName(''), null);
});

test('hasNamedEntity: business-name gate — ask for real entities, skip 1099/not-sure', () => {
  const u = (entity_type: AppUser['entity_type']): AppUser => ({ entity_type } as AppUser);
  assert.equal(hasNamedEntity(u('sole_prop')), true);
  assert.equal(hasNamedEntity(u('smllc')), true);
  assert.equal(hasNamedEntity(u('s_corp')), true);
  assert.equal(hasNamedEntity(u('c_corp')), true);
  assert.equal(hasNamedEntity(u('unknown')), false); // "not sure" / 1099 → skip
  assert.equal(hasNamedEntity(u(null)), false);
});
