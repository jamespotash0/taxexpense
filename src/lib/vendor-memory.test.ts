// Unit tests for the pure halves of per-org vendor memory (DEC-070): the vendor-key normalizer
// and the model-result merge. The DB read/write paths (rememberVendorCategory / applyVendorMemory)
// are integration-level and covered by the eval/manual flows. Run: npm run test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vendorKey, applyMemoryToResult } from './vendor-memory';
import type { CategoryResult } from './categorize';

test('vendorKey: lowercases, strips possessives + punctuation, collapses whitespace', () => {
  assert.equal(vendorKey("Morton's Steakhouse"), 'mortons steakhouse');
  assert.equal(vendorKey('mortons   steakhouse'), 'mortons steakhouse');
  assert.equal(vendorKey('  Adobe, Inc. '), 'adobe inc');
  assert.equal(vendorKey('WeWork'), 'wework');
});

test('vendorKey: same key for variants that should match', () => {
  assert.equal(vendorKey("Morton's"), vendorKey('mortons'));
  assert.equal(vendorKey('THE LOFT'), vendorKey('the loft'));
});

test('vendorKey: returns null for empty / too-short / punctuation-only', () => {
  assert.equal(vendorKey(null), null);
  assert.equal(vendorKey(''), null);
  assert.equal(vendorKey('  '), null);
  assert.equal(vendorKey('!!!'), null);
  assert.equal(vendorKey('a'), null); // single char → not a usable key
});

const base = (category: string, confidence = 0.7): CategoryResult => ({
  category,
  confidence,
  reasoning: 'model guess',
});

test('applyMemoryToResult: overrides the model when memory differs', () => {
  const out = applyMemoryToResult('meals_business', base('venue_rental'), 'Tabernacle');
  assert.equal(out.category, 'meals_business');
  assert.equal(out.fromMemory, true);
  assert.ok(out.confidence >= 0.95);
  assert.match(out.reasoning, /previous correction/i);
  assert.match(out.reasoning, /Tabernacle/);
});

test('applyMemoryToResult: no-op when memory agrees with the model', () => {
  const model = base('software', 0.9);
  const out = applyMemoryToResult('software', model, 'Adobe');
  assert.equal(out, model); // returned unchanged
  assert.equal(out.fromMemory, undefined);
});

test('applyMemoryToResult: no-op when there is no learned mapping', () => {
  const model = base('software');
  assert.equal(applyMemoryToResult(null, model, 'Adobe'), model);
});

test('applyMemoryToResult: ignores an invalid stored category (defensive)', () => {
  const model = base('software');
  assert.equal(applyMemoryToResult('not_a_real_category', model, 'Adobe'), model);
});

test('applyMemoryToResult: keeps the higher confidence', () => {
  // Model was already very confident (but wrong per the user); override keeps that confidence.
  const out = applyMemoryToResult('meals_business', base('venue_rental', 0.99), 'Tabernacle');
  assert.equal(out.confidence, 0.99);
});
