// SMS segment/encoding analyzer tests (messaging-cost-levers.md A.1). The key assertions encode
// the A.1 hypothesis: a single ✓ or → forces UCS-2 and inflates segment count.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSegments, redactNonGsmForLog } from './sms-segments';

test('plain ASCII stays GSM-7, one segment', () => {
  const r = analyzeSegments('Logged $48 lunch with Sarah, 50% deductible.');
  assert.equal(r.encoding, 'gsm7');
  assert.equal(r.segments, 1);
  assert.deepEqual(r.nonGsmChars, []);
});

test('§ and $ are GSM-7 (do NOT force UCS-2)', () => {
  const r = analyzeSegments('Typically §274, 50% deductible ($24).');
  assert.equal(r.encoding, 'gsm7');
  assert.deepEqual(r.nonGsmChars, []);
});

test('HYPOTHESIS: a single ✓ forces UCS-2', () => {
  const r = analyzeSegments('Logged ✓');
  assert.equal(r.encoding, 'ucs2');
  assert.deepEqual(r.nonGsmChars, ['✓']);
});

test('HYPOTHESIS: → forces UCS-2', () => {
  const r = analyzeSegments('§162 in plain English → tallywhy.com/irc/162');
  assert.equal(r.encoding, 'ucs2');
  assert.ok(r.nonGsmChars.includes('→'));
});

test('em dash forces UCS-2 (hyphen does not)', () => {
  assert.equal(analyzeSegments('meals — 50% deductible').encoding, 'ucs2');
  assert.equal(analyzeSegments('meals - 50% deductible').encoding, 'gsm7');
});

test('GSM-7 segment boundaries: 160 single, 161 -> 2 @153', () => {
  assert.equal(analyzeSegments('a'.repeat(160)).segments, 1);
  assert.equal(analyzeSegments('a'.repeat(161)).segments, 2);
  assert.equal(analyzeSegments('a'.repeat(306)).segments, 2); // 2 * 153
  assert.equal(analyzeSegments('a'.repeat(307)).segments, 3);
});

test('GSM-7 extension chars cost 2 septets', () => {
  // 80 euro signs = 160 septets = still 1 segment; 81 = 162 septets -> 2 segments
  assert.equal(analyzeSegments('€'.repeat(80)).segments, 1);
  assert.equal(analyzeSegments('€'.repeat(81)).segments, 2);
});

test('UCS-2 segment boundaries: 70 single, 71 -> 2 @67', () => {
  // include one non-GSM char so the whole thing is UCS-2, then pad with ASCII
  assert.equal(analyzeSegments('✓' + 'a'.repeat(69)).segments, 1); // 70 units
  assert.equal(analyzeSegments('✓' + 'a'.repeat(70)).segments, 2); // 71 units
});

test('A.1 punchline: same reply, ✓ vs no-✓ changes segment count', () => {
  const body = 'Logged $48 lunch with Sarah, meals & entertainment, 50% deductible ($24). Documentation complete';
  const withCheck = analyzeSegments(body + ' ✓');
  const without = analyzeSegments(body + '.');
  assert.equal(without.encoding, 'gsm7');
  assert.equal(without.segments, 1);
  assert.equal(withCheck.encoding, 'ucs2');
  assert.ok(withCheck.segments > without.segments, `${withCheck.segments} should exceed ${without.segments}`);
});

test('astral emoji counts as 2 UTF-16 units', () => {
  const r = analyzeSegments('🎉');
  assert.equal(r.encoding, 'ucs2');
  assert.equal(r.chars, 1); // one code point
  assert.equal(r.segments, 1);
});

test('empty body is one segment, gsm7', () => {
  const r = analyzeSegments('');
  assert.equal(r.segments, 1);
  assert.equal(r.encoding, 'gsm7');
});

// --- redactNonGsmForLog: PII-safety (DEC-003 / Jordan) ---

test('PII-SAFE: non-GSM letters are never logged, only counted', () => {
  // CJK + Cyrillic name fragments -> count only, no content surfaces
  const r = redactNonGsmForLog(['田', '中', 'Ж']);
  assert.deepEqual(r.symbols, []);
  assert.equal(r.letterCount, 3);
});

test('symbols/arrows/emoji ARE surfaced (the cost culprits, no identity)', () => {
  const r = redactNonGsmForLog(['✓', '→', '—', '🎉']);
  assert.deepEqual(r.symbols, ['✓', '→', '—', '🎉']);
  assert.equal(r.letterCount, 0);
});

test('mixed: symbols surface, letters bucketed', () => {
  const r = redactNonGsmForLog(['✓', '北', '→', '京']);
  assert.deepEqual(r.symbols, ['✓', '→']);
  assert.equal(r.letterCount, 2);
});

test('end-to-end: a reply with a CJK vendor logs no name content', () => {
  const seg = analyzeSegments('Logged $20 at 海底捞 ✓');
  const { symbols, letterCount } = redactNonGsmForLog(seg.nonGsmChars);
  assert.ok(symbols.includes('✓'));
  assert.ok(!symbols.some((c) => /\p{L}/u.test(c)), 'no letters in logged symbols');
  assert.ok(letterCount >= 3); // the three CJK chars, counted not logged
});
