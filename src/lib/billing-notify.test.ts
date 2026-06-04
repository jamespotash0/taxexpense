// Subscribe-welcome idempotency + opt-out guard (DEC-060). Drives the real sendSubscriptionWelcome
// with injected deps — no DB, fully deterministic. The atomic claim is trusted (Postgres); these
// tests pin the ORCHESTRATION: send at most once, never to an opted-out owner, never burn the claim.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendSubscriptionWelcome, type WelcomeDeps } from './billing-notify';

type Owner = { phone_number: string; full_name: string | null; optedOut: boolean } | null;

/** A harness whose claim() returns true exactly once (mirrors the atomic DB claim). */
function harness(owner: Owner) {
  const sends: { to: string; body: string }[] = [];
  let claims = 0;
  let claimGranted = false;
  const deps: WelcomeDeps = {
    claim: async () => {
      claims++;
      if (claimGranted) return false; // already claimed once → all later callers lose
      claimGranted = true;
      return true;
    },
    getOwner: async () => owner,
    send: async (to, body) => {
      sends.push({ to, body });
    },
  };
  return { deps, sends, claimCalls: () => claims };
}

const OWNER: Owner = { phone_number: '+15551230000', full_name: 'Jane Doe', optedOut: false };

test('sends exactly once on first activation', async () => {
  const h = harness(OWNER);
  const result = await sendSubscriptionWelcome('org1', h.deps);
  assert.equal(result, 'sent');
  assert.equal(h.sends.length, 1);
  assert.match(h.sends[0].body, /locked in, Jane/); // first name only
  assert.equal(h.sends[0].to, '+15551230000');
});

test('idempotent: repeated webhook deliveries never double-send', async () => {
  const h = harness(OWNER);
  const results = [];
  for (let i = 0; i < 5; i++) results.push(await sendSubscriptionWelcome('org1', h.deps));
  assert.deepEqual(results, ['sent', 'already_sent', 'already_sent', 'already_sent', 'already_sent']);
  assert.equal(h.sends.length, 1); // only the first delivery sent
});

test('concurrent deliveries: only the claim winner sends', async () => {
  const h = harness(OWNER);
  const results = await Promise.all(
    Array.from({ length: 4 }, () => sendSubscriptionWelcome('org1', h.deps)),
  );
  assert.equal(results.filter((r) => r === 'sent').length, 1);
  assert.equal(h.sends.length, 1);
});

test('opted-out owner: never texted, and the one-shot claim is NOT consumed (TCPA)', async () => {
  const h = harness({ ...OWNER, optedOut: true });
  const result = await sendSubscriptionWelcome('org1', h.deps);
  assert.equal(result, 'opted_out');
  assert.equal(h.sends.length, 0);
  assert.equal(h.claimCalls(), 0, 'must not claim for an owner we will never text');
});

test('no owner on file: returns no_owner, sends nothing', async () => {
  const h = harness(null);
  const result = await sendSubscriptionWelcome('org1', h.deps);
  assert.equal(result, 'no_owner');
  assert.equal(h.sends.length, 0);
  assert.equal(h.claimCalls(), 0);
});

test('owner with no name still gets a (nameless) welcome', async () => {
  const h = harness({ ...OWNER, full_name: null });
  const result = await sendSubscriptionWelcome('org1', h.deps);
  assert.equal(result, 'sent');
  assert.match(h.sends[0].body, /You're locked in 🎉/);
});
