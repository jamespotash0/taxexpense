// normalizeTrafficSource (DEC-084) — the pure cleaner behind /api/traffic. Decides whether a visit
// carries an attribution signal (utm_source/ref param or an EXTERNAL referrer) and reduces it to a
// no-PII, length-capped row. The DB insert is service-role and not unit-tested (matches the codebase).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTrafficSource } from './traffic';

const SELF = ['tallywhy.com', 'www.tallywhy.com', 'localhost'];

test('Product Hunt ref param → recorded, lowercased', () => {
  const row = normalizeTrafficSource({ source: 'ProductHunt', path: '/', locale: 'en' }, SELF);
  assert.ok(row);
  assert.equal(row!.source, 'producthunt');
  assert.equal(row!.landing_path, '/');
  assert.equal(row!.locale, 'en');
});

test('external referrer with no param → recorded as the referrer host only (no path)', () => {
  const row = normalizeTrafficSource({ referrer: 'https://www.producthunt.com/posts/tally?abc=1', path: '/' }, SELF);
  assert.ok(row);
  assert.equal(row!.source, null);
  assert.equal(row!.referrer_host, 'www.producthunt.com'); // host only — query/path dropped
});

test('utm trio is captured and capped/lowercased', () => {
  const row = normalizeTrafficSource(
    { source: 'producthunt', medium: 'Launch', campaign: 'Summer2026', path: '/' },
    SELF,
  );
  assert.ok(row);
  assert.equal(row!.medium, 'launch');
  assert.equal(row!.campaign, 'summer2026');
});

test('direct visit (no param, no referrer) → null, so nothing is logged', () => {
  assert.equal(normalizeTrafficSource({ path: '/' }, SELF), null);
});

test('internal navigation (referrer is our own host) is NOT a referral → null', () => {
  assert.equal(normalizeTrafficSource({ referrer: 'https://tallywhy.com/pricing', path: '/' }, SELF), null);
  assert.equal(normalizeTrafficSource({ referrer: 'https://localhost:3000/', path: '/' }, SELF), null);
});

test('unparseable referrer is ignored (no crash, no host)', () => {
  assert.equal(normalizeTrafficSource({ referrer: 'not-a-url', path: '/' }, SELF), null);
});

test('a param survives even when the referrer is internal (source still counts)', () => {
  const row = normalizeTrafficSource({ source: 'producthunt', referrer: 'https://tallywhy.com/', path: '/' }, SELF);
  assert.ok(row);
  assert.equal(row!.source, 'producthunt');
  assert.equal(row!.referrer_host, null); // internal referrer dropped, but the param kept the row
});

test('garbage landing path (no leading slash) → null path, still records on the signal', () => {
  const row = normalizeTrafficSource({ source: 'producthunt', path: 'javascript:alert(1)' }, SELF);
  assert.ok(row);
  assert.equal(row!.landing_path, null);
});

test('over-long source is capped to 60 chars', () => {
  const row = normalizeTrafficSource({ source: 'x'.repeat(200), path: '/' }, SELF);
  assert.ok(row);
  assert.equal(row!.source!.length, 60);
});
