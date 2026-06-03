import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeToE164 } from './phone';

test('normalizeToE164 handles common US formats', () => {
  assert.equal(normalizeToE164('+14155551234'), '+14155551234');
  assert.equal(normalizeToE164('4155551234'), '+14155551234');
  assert.equal(normalizeToE164('(415) 555-1234'), '+14155551234');
  assert.equal(normalizeToE164('1-415-555-1234'), '+14155551234');
  assert.equal(normalizeToE164('415.555.1234'), '+14155551234');
});

test('normalizeToE164 rejects junk', () => {
  assert.equal(normalizeToE164(''), null);
  assert.equal(normalizeToE164('hello'), null);
  assert.equal(normalizeToE164('12345'), null);
});

test('normalizeToE164 rejects non-US numbers (toll-fraud guard)', () => {
  assert.equal(normalizeToE164('+447911123456'), null); // UK
  assert.equal(normalizeToE164('+8801712345678'), null); // Bangladesh
  assert.equal(normalizeToE164('+33123456789'), null); // France
  assert.equal(normalizeToE164('447911123456'), null); // UK without +
});
