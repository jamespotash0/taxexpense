// One-tap subscribe magic-link token (DEC-062). Pure crypto — set the secret in-process so the
// round-trip, tamper, expiry, and missing-secret-fallback behaviours are deterministic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSubscribeToken, verifySubscribeToken, subscribeUrl } from './subscribe-link';

// The module reads SUBSCRIBE_LINK_SECRET lazily (optionalEnv at call time), so setting it at
// module load — before any test runs — is enough; no dynamic import needed.
process.env.SUBSCRIBE_LINK_SECRET = 'test-secret-key';

const ORG = '11111111-2222-3333-4444-555555555555';
const NOW = 1_700_000_000_000;

test('round-trips a valid token back to the org id', () => {
  const token = makeSubscribeToken(ORG, NOW)!;
  assert.ok(token);
  assert.equal(verifySubscribeToken(token, NOW + 1000), ORG);
});

test('token is deterministic within a UTC day (same org → identical token, so the paywall link is cacheable)', () => {
  const a = makeSubscribeToken(ORG, NOW)!;
  const b = makeSubscribeToken(ORG, NOW + 60_000)!; // a minute later, same UTC day
  assert.equal(a, b);
});

test('rejects a tampered token', () => {
  const token = makeSubscribeToken(ORG, NOW)!;
  const flipped = token.slice(0, -2) + (token.endsWith('A') ? 'B' : 'A') + token.slice(-1);
  assert.equal(verifySubscribeToken(flipped, NOW + 1000), null);
});

test('rejects a token for a different org (signature is over org+exp)', () => {
  // Re-sign with the wrong org by hand: decode, swap org, re-encode WITHOUT re-signing → must fail.
  const token = makeSubscribeToken(ORG, NOW)!;
  const decoded = Buffer.from(token, 'base64url').toString('utf8').split('.');
  const forged = Buffer.from(['99999999-0000-0000-0000-000000000000', decoded[1], decoded[2]].join('.')).toString('base64url');
  assert.equal(verifySubscribeToken(forged, NOW + 1000), null);
});

test('rejects an expired token', () => {
  const token = makeSubscribeToken(ORG, NOW)!;
  const wayLater = NOW + 15 * 24 * 60 * 60 * 1000; // TTL is 14 days
  assert.equal(verifySubscribeToken(token, wayLater), null);
});

test('rejects garbage / empty', () => {
  assert.equal(verifySubscribeToken('', NOW), null);
  assert.equal(verifySubscribeToken('not-a-real-token', NOW), null);
  assert.equal(verifySubscribeToken('a.b', NOW), null);
});

test('subscribeUrl returns a magic link when the secret is set', () => {
  const url = subscribeUrl(ORG);
  assert.match(url, /\/api\/billing\/subscribe-link\?t=/);
});

test('with NO secret: token is null and subscribeUrl falls back to /pricing', () => {
  const saved = process.env.SUBSCRIBE_LINK_SECRET;
  delete process.env.SUBSCRIBE_LINK_SECRET;
  try {
    assert.equal(makeSubscribeToken(ORG, NOW), null);
    assert.match(subscribeUrl(ORG), /\/pricing$/);
  } finally {
    process.env.SUBSCRIBE_LINK_SECRET = saved;
  }
});
