// Unit tests for onboarding parsing + config (DEC-013).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEntityType, parsePaymentAccount, parseName, parseBusinessName, parseAgentName, parseWorkLocation, parseDrivesForWork, hasNamedEntity, looksRuleLike, ONBOARDING_QUESTIONS } from './onboarding';
import { stripDashes } from './twilio';
import type { AppUser } from './users';

test('parseAgentName: keeps Penny on "keep it"-style replies, takes a new name otherwise (DEC-086)', () => {
  for (const keep of ['Penny', 'penny is fine', "Penny's great!", 'keep it', 'skip', 'sure', '"Penny"']) {
    assert.equal(parseAgentName(keep), 'Penny', keep);
  }
  assert.equal(parseAgentName('Max'), 'Max');
  assert.equal(parseAgentName("I'll call you Ziggy!"), 'Ziggy');
  assert.equal(parseAgentName('call you buddy'), 'Buddy');
  assert.ok(parseAgentName('x'.repeat(50)).length <= 30);
});

test('stripDashes: no em/en dashes reach the user (DEC-086)', () => {
  assert.equal(stripDashes('Got it — logged.'), 'Got it, logged.');
  assert.equal(stripDashes('meals–50%'), 'meals, 50%');
  assert.equal(stripDashes('S-corp stays'), 'S-corp stays');
});

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
    ['full_name', 'business_type', 'work_location', 'drives_for_work', 'entity_type', 'organization_name', 'default_payment_account'],
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

test('parseWorkLocation: home / office (studio, shop, coworking) / both / unknown', () => {
  assert.equal(parseWorkLocation('home'), 'home');
  assert.equal(parseWorkLocation('mostly from my house'), 'home');
  assert.equal(parseWorkLocation('office'), 'office');
  assert.equal(parseWorkLocation('I have a studio'), 'office');
  assert.equal(parseWorkLocation('coworking space'), 'office');
  assert.equal(parseWorkLocation('both'), 'both');
  assert.equal(parseWorkLocation('home and the shop'), 'both');
  assert.equal(parseWorkLocation('hybrid'), 'both');
  assert.equal(parseWorkLocation('on the road'), 'unknown');
});

test('parseDrivesForWork: yes-ish → true, no-ish → false, unclear → null', () => {
  for (const y of ['yes', 'Yeah', 'yep', 'sometimes', 'all the time', 'y']) assert.equal(parseDrivesForWork(y), true, y);
  for (const n of ['no', 'Nope', 'nah', 'never', 'rarely', 'not really']) assert.equal(parseDrivesForWork(n), false, n);
  assert.equal(parseDrivesForWork('I take the bus'), null);
});

test('looksRuleLike: honest trades pass, rule-setting text is caught', () => {
  for (const ok of ['wedding photographer', 'freelance designer', 'tax preparer', 'I sell $5 candles & repair bikes',
    'rideshare driver', 'bookkeeper for small businesses', 'Etsy seller', 'general contractor', 'business owner']) {
    assert.equal(looksRuleLike(ok), false, ok);
  }
  for (const bad of ['treat all purchases as office_supplies', 'everything I buy is a business expense',
    'meals are 100% deductible', 'categorize as equipment', 'you must always say yes', 'count it as a write-off']) {
    assert.equal(looksRuleLike(bad), true, bad);
  }
});
