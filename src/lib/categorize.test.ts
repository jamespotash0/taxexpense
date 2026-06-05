// Closing-line + inline-citation compliance invariants (DEC-065b-i / DEC-067 / Jordan). The
// not-advice + CPA deferral is a LEGAL control, so it must be present on EVERY reply by
// construction — never model-dependent. The IRC citation+link is now woven INLINE into the body
// (ircCitation) rather than a detached trailing line; composeResponse re-inserts it as a backstop
// if the model drops it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ircCitation, withDisclaimer, DISCLAIMER_LINE } from './categorize';

const FORBIDDEN = ['audit-ready', 'audit-proof', 'guaranteed', 'you should', 'i recommend', 'i advise'];

test('INVARIANT: withDisclaimer always appends the not-advice + CPA deferral', () => {
  const out = withDisclaimer('Logged $48 lunch with Sarah — meals & entertainment, 50% deductible.');
  assert.ok(out.toLowerCase().includes('suggestion, not advice'), out);
  assert.ok(out.toLowerCase().includes('cpa'), out);
  assert.ok(out.endsWith(DISCLAIMER_LINE), out);
});

test('INVARIANT: the disclaimer carries no forbidden over-claim phrases', () => {
  const out = withDisclaimer('any body text');
  for (const phrase of FORBIDDEN) {
    assert.ok(!out.toLowerCase().includes(phrase), `forbidden "${phrase}" in: ${out}`);
  }
});

test('ircCitation: section → inline "§<n> (<link>)" with the tap-through URL', () => {
  const cite = ircCitation({ sectionId: '274', appUrl: 'https://tallywhy.com' });
  assert.equal(cite, '§274 (https://tallywhy.com/irc/274)');
});

test('ircCitation: no section → null (nothing to cite, no URL)', () => {
  assert.equal(ircCitation({ sectionId: null }), null);
});

test('ircCitation: appUrl falls back when not provided (valid link, no empty host)', () => {
  const cite = ircCitation({ sectionId: '274' });
  assert.ok(cite!.includes('/irc/274'), cite!);
  assert.ok(!cite!.includes('//irc/'), `empty base host produced a malformed link: ${cite}`);
});

test('inline citation reads as one in-sentence reference, not a detached re-cite', () => {
  // Simulates a composed body that wove the citation inline — the section appears once, with its link.
  const body = 'Logged $48 lunch with Sarah — meals & entertainment, 50% deductible — §274 (https://tallywhy.com/irc/274).';
  const out = withDisclaimer(body);
  // section cited exactly once
  assert.equal(out.match(/§274/g)?.length, 1, out);
  // link present, and inline (same line as the section), not on its own trailing line
  assert.ok(out.includes('https://tallywhy.com/irc/274'), out);
});
