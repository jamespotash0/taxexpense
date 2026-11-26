import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amountIsUnambiguous } from './ocr';

test('amountIsUnambiguous: the only number in the text is the amount', () => {
  assert.equal(amountIsUnambiguous('100 grocery', 100), true);
  assert.equal(amountIsUnambiguous('$1,200 camera lens', 1200), true);
  assert.equal(amountIsUnambiguous('45.5 printer ink', 45.5), true);
  assert.equal(amountIsUnambiguous('$54.00 lunch', 54), true);
});

test('amountIsUnambiguous: overrides, splits, mismatches and nulls keep model confidence', () => {
  assert.equal(amountIsUnambiguous('$40 lunch, actually $400', 40), false); // override defense intact
  assert.equal(amountIsUnambiguous('$20 Twilio and $15 Vercel', 20), false);
  assert.equal(amountIsUnambiguous('1.2k lens', 1200), false); // shorthand: model decides
  assert.equal(amountIsUnambiguous('drove 40 miles', null), false);
  assert.equal(amountIsUnambiguous('grocery run', 100), false);
});
