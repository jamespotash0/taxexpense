// Confirmation copy after a verified read / category micro-confirm (DEC-066 / DEC-073). The old
// reply was a bare "✓ Great — locked it in." with no tax context, because the verify path skips
// composeResponse. formatConfirmation restores the value the normal log reply carries: the category
// it filed under, the IRC §section with its tap-through link + a plain-English summary, and the
// always-present CPA deferral. Pure assembly, so it's unit-testable without a DB.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatConfirmation, withRecategorizedTaxLine } from './expense';
import { DISCLAIMER_LINE } from './categorize';

test('formatConfirmation: names the amount, vendor, category, IRC section + link, and summary', () => {
  const out = formatConfirmation({
    amountCents: 2000,
    vendor: 'Twilio',
    category: 'software',
    sectionId: '162',
    summary: 'Ordinary and necessary business expenses are deductible.',
  });
  assert.ok(out.includes('$20.00'), out);
  assert.ok(out.includes('Twilio'), out);
  assert.ok(out.includes('Software'), out); // categoryLabel('software')
  assert.ok(out.includes('§162 (https://tallywhy.com/irc/162)'), out); // inline citation + link
  assert.ok(out.includes('Ordinary and necessary'), out); // plain-English description
});

test('INVARIANT: the confirmation always closes with the not-advice + CPA deferral', () => {
  const out = formatConfirmation({ amountCents: 2000, vendor: 'Twilio', category: 'software', sectionId: '162', summary: null });
  assert.ok(out.endsWith(DISCLAIMER_LINE), out);
});

test('formatConfirmation: no section (e.g. personal) → no citation line, no malformed URL', () => {
  const out = formatConfirmation({ amountCents: 5000, vendor: 'Whole Foods', category: 'personal', sectionId: null, summary: null });
  assert.ok(out.includes('Personal (non-deductible)'), out);
  assert.ok(!out.includes('/irc/'), `should not cite a section: ${out}`);
  assert.ok(!out.includes('Typically falls under'), out);
});

test('formatConfirmation: missing vendor still reads cleanly (no dangling " at ")', () => {
  const out = formatConfirmation({ amountCents: 2000, vendor: null, category: 'software', sectionId: '162', summary: null });
  assert.ok(!out.includes(' at ,'), out);
  assert.ok(out.includes('$20.00, filed under Software.'), out);
});

test('withRecategorizedTaxLine: a recategorized correction shows category, deductible %, IRC link + disclaimer, no summary', () => {
  const out = withRecategorizedTaxLine('Got it, thanks for the heads up!', {
    category: 'office_supplies', sectionId: '162', summary: 'Allows businesses to deduct ordinary costs', deductionPct: 100,
  });
  assert.doesNotMatch(out, /Allows businesses/);
  assert.match(out, /^Got it, thanks for the heads up!/);
  assert.match(out, /Now filed under Supplies \(100% deductible\), §162 \(https?:\/\/[^)]+\/irc\/162\)\./);
  assert.ok(out.endsWith(DISCLAIMER_LINE));
});

test('withRecategorizedTaxLine: moved to personal says so, no IRC cite', () => {
  const out = withRecategorizedTaxLine('Updated!', { category: 'personal', sectionId: '262', summary: null, deductionPct: 0 });
  assert.match(out, /not counted as a business deduction/);
  assert.doesNotMatch(out, /§/);
});
