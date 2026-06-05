// Closing-line compliance invariants (DEC-065b-i / Jordan). The not-advice + CPA deferral is a
// LEGAL control, so it must be present on EVERY return path by construction — never model-dependent.
// The IRC link is pure UX and may be dropped to save an SMS segment.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closingLine } from './categorize';

const FORBIDDEN = ['audit-ready', 'audit-proof', 'guaranteed', 'you should', 'i recommend', 'i advise'];

// Every shape the closing line can take.
const VARIANTS = [
  closingLine({ sectionId: '274', includeLink: true, appUrl: 'https://tallywhy.com' }),
  closingLine({ sectionId: '162', includeLink: false }),
  closingLine({ sectionId: null, includeLink: true }),
  closingLine({ sectionId: null, includeLink: false }),
];

test('INVARIANT: the not-advice disclaimer is present on every return path', () => {
  for (const out of VARIANTS) {
    assert.ok(
      out.toLowerCase().includes('suggestion, not advice'),
      `missing disclaimer floor in: ${out}`,
    );
    assert.ok(out.toLowerCase().includes('cpa'), `missing CPA deferral in: ${out}`);
  }
});

test('INVARIANT: forbidden over-claim phrases never appear', () => {
  for (const out of VARIANTS) {
    for (const phrase of FORBIDDEN) {
      assert.ok(!out.toLowerCase().includes(phrase), `forbidden "${phrase}" in: ${out}`);
    }
  }
});

test('strict category (includeLink) gets the tap-through IRC link', () => {
  const out = closingLine({ sectionId: '274', includeLink: true, appUrl: 'https://tallywhy.com' });
  assert.ok(out.includes('https://tallywhy.com/irc/274'), out);
  assert.ok(out.includes('§274'), out);
});

test('general category (no link) cites the section but carries NO url — saves a segment', () => {
  const out = closingLine({ sectionId: '162', includeLink: false });
  assert.ok(out.includes('§162'), out);
  assert.ok(!out.includes('/irc/'), `should not contain a link: ${out}`);
  assert.ok(!out.includes('http'), `should not contain a url: ${out}`);
});

test('no section → bare disclaimer, no § and no link', () => {
  const out = closingLine({ sectionId: null, includeLink: true });
  assert.ok(!out.includes('§'), out);
  assert.ok(!out.includes('/irc/'), out);
  assert.ok(out.toLowerCase().includes('suggestion, not advice'), out);
});

test('appUrl falls back when not provided (still a valid link, no empty host)', () => {
  const out = closingLine({ sectionId: '274', includeLink: true });
  assert.ok(out.includes('/irc/274'), out);
  assert.ok(!out.includes('//irc/'), `empty base host produced a malformed link: ${out}`);
});
