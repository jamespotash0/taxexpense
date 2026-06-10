// Agency cross-org access guard (Spec 10, Fix 2) — the multi-tenant boundary. These assert the
// NEGATIVE cases as hard as the positive ones: a bug here is a breach, not a glitch. The decision
// lives in the pure canAccessOrg() so it can be exhaustively tested without a DB; the I/O wrappers
// (assertCanAccessOrg/getAccessibleOrgs) only feed it the same inputs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessOrg } from './agency';

const A = 'agency-A';
const B = 'agency-B';
const OWN = 'org-own';
const SIB = 'org-sibling'; // a different org under agency A
const OTHER = 'org-other'; // an unrelated org

test('own org: always accessible (direct user, no agencies)', () => {
  assert.equal(
    canAccessOrg({ userOrgId: OWN, userAgencyIds: [], targetOrgId: OWN, targetOrgAgencyId: null }),
    true,
  );
});

test('DENY: direct user cannot reach any other org', () => {
  assert.equal(
    canAccessOrg({ userOrgId: OWN, userAgencyIds: [], targetOrgId: OTHER, targetOrgAgencyId: null }),
    false,
  );
});

test('agency staffer (member of A) CAN reach an org managed by A', () => {
  assert.equal(
    canAccessOrg({ userOrgId: OWN, userAgencyIds: [A], targetOrgId: SIB, targetOrgAgencyId: A }),
    true,
  );
});

test('DENY: agency staffer of A cannot reach an org managed by B (cross-agency isolation)', () => {
  assert.equal(
    canAccessOrg({ userOrgId: OWN, userAgencyIds: [A], targetOrgId: OTHER, targetOrgAgencyId: B }),
    false,
  );
});

test('DENY: agency staffer of A cannot reach an UNMANAGED org that is not their own', () => {
  assert.equal(
    canAccessOrg({ userOrgId: OWN, userAgencyIds: [A], targetOrgId: OTHER, targetOrgAgencyId: null }),
    false,
  );
});

test('DENY (the subtle one): a CREATOR under agency A cannot reach a sibling creator under A', () => {
  // A managed creator is NOT an agency_member → userAgencyIds is empty. Being managed BY an agency
  // grants no cross-org access; only staff get that. The sibling is also under A, which must NOT help.
  assert.equal(
    canAccessOrg({ userOrgId: OWN, userAgencyIds: [], targetOrgId: SIB, targetOrgAgencyId: A }),
    false,
  );
});

test('a creator under agency A can still reach their OWN org', () => {
  assert.equal(
    canAccessOrg({ userOrgId: OWN, userAgencyIds: [], targetOrgId: OWN, targetOrgAgencyId: A }),
    true,
  );
});

test('staffer of multiple agencies [A,B] can reach an org managed by B', () => {
  assert.equal(
    canAccessOrg({ userOrgId: OWN, userAgencyIds: [A, B], targetOrgId: OTHER, targetOrgAgencyId: B }),
    true,
  );
});

test('DENY (defense in depth): membership never grants access to an unmanaged non-own org', () => {
  assert.equal(
    canAccessOrg({ userOrgId: OWN, userAgencyIds: [A, B], targetOrgId: OTHER, targetOrgAgencyId: null }),
    false,
  );
});
