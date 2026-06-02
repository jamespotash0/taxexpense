// Unit tests for entitlement (DEC-021) — gating correctness.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeEntitlement, type OrgBilling } from './subscription';

const now = new Date('2026-06-02T12:00:00Z');
const inDays = (d: number) => new Date(now.getTime() + d * 86400000).toISOString();

test('active subscription within period → entitled', () => {
  const org: OrgBilling = { subscription_status: 'active', current_period_end: inDays(20), trial_ends_at: inDays(-5) };
  const e = computeEntitlement(org, now);
  assert.equal(e.entitled, true);
  assert.equal(e.reason, 'active');
});

test('active with no period end → entitled', () => {
  const org: OrgBilling = { subscription_status: 'active', current_period_end: null, trial_ends_at: null };
  assert.equal(computeEntitlement(org, now).entitled, true);
});

test('active but period ended → not entitled (expired)', () => {
  const org: OrgBilling = { subscription_status: 'active', current_period_end: inDays(-1), trial_ends_at: null };
  const e = computeEntitlement(org, now);
  assert.equal(e.entitled, false);
  assert.equal(e.reason, 'expired');
});

test('trialing within trial → entitled with days left', () => {
  const org: OrgBilling = { subscription_status: 'trialing', trial_ends_at: inDays(10), current_period_end: null };
  const e = computeEntitlement(org, now);
  assert.equal(e.entitled, true);
  assert.equal(e.reason, 'trialing');
  assert.equal(e.trialDaysLeft, 10);
});

test('trialing but trial ended → not entitled (paywall)', () => {
  const org: OrgBilling = { subscription_status: 'trialing', trial_ends_at: inDays(-1), current_period_end: null };
  const e = computeEntitlement(org, now);
  assert.equal(e.entitled, false);
  assert.equal(e.reason, 'expired');
  assert.equal(e.trialDaysLeft, 0);
});

test('past_due → not entitled', () => {
  const org: OrgBilling = { subscription_status: 'past_due', trial_ends_at: inDays(-5), current_period_end: inDays(-1) };
  assert.equal(computeEntitlement(org, now).entitled, false);
});

test('canceled → not entitled', () => {
  const org: OrgBilling = { subscription_status: 'canceled', trial_ends_at: null, current_period_end: null };
  assert.equal(computeEntitlement(org, now).entitled, false);
});

test('trialDaysLeft rounds up partial days', () => {
  const org: OrgBilling = { subscription_status: 'trialing', trial_ends_at: new Date(now.getTime() + 1.2 * 86400000).toISOString(), current_period_end: null };
  assert.equal(computeEntitlement(org, now).trialDaysLeft, 2);
});
