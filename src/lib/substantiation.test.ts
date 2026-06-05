// Unit tests for the substantiation decision tree (DEC-011 — tax correctness).
// Run: npm run test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSubstantiation, computeDeductibleCents, type SubstantiationRule } from './substantiation';

const rules: Record<string, SubstantiationRule> = {
  software: {
    category: 'software', irc_section: '162', substantiation_level: 'general',
    receipt_threshold_cents: null, always_receipt: false, required_context_fields: [],
    deduction_percentage: 100, deduction_cap_cents: null,
  },
  meals_business: {
    category: 'meals_business', irc_section: '274', substantiation_level: 'strict',
    receipt_threshold_cents: 7500, always_receipt: false,
    required_context_fields: ['attendees', 'business_purpose'],
    deduction_percentage: 50, deduction_cap_cents: null,
  },
  travel_lodging: {
    category: 'travel_lodging', irc_section: '162', substantiation_level: 'strict',
    receipt_threshold_cents: 0, always_receipt: true,
    required_context_fields: ['business_purpose', 'location_city'], deduction_percentage: 100, deduction_cap_cents: null,
  },
  travel_transportation: {
    category: 'travel_transportation', irc_section: '162', substantiation_level: 'strict',
    receipt_threshold_cents: 7500, always_receipt: false,
    required_context_fields: ['business_purpose', 'location_city'], deduction_percentage: 100, deduction_cap_cents: null,
  },
  business_gifts: {
    category: 'business_gifts', irc_section: '274', substantiation_level: 'strict',
    receipt_threshold_cents: 7500, always_receipt: false,
    required_context_fields: ['attendees', 'business_relationship'],
    deduction_percentage: 100, deduction_cap_cents: 2500,
  },
  vehicle_business: {
    category: 'vehicle_business', irc_section: '162', substantiation_level: 'strict',
    receipt_threshold_cents: null, always_receipt: false,
    required_context_fields: ['business_miles', 'business_purpose'],
    deduction_percentage: 100, deduction_cap_cents: null,
  },
  personal: {
    category: 'personal', irc_section: '262', substantiation_level: 'general',
    receipt_threshold_cents: null, always_receipt: false, required_context_fields: [],
    deduction_percentage: 0, deduction_cap_cents: null,
  },
};

test('general (software): logged, no receipt, complete, 100% deductible', () => {
  const r = evaluateSubstantiation(rules.software, { amount_cents: 4900, has_photo: false, captured_fields: {} });
  assert.equal(r.needs_receipt, false);
  assert.equal(r.substantiation_complete, true);
  assert.equal(r.deductible_amount_cents, 4900);
  assert.deepEqual(r.missing_context_fields, []);
});

test('meal under $75 with full context: complete, no receipt, 50% deductible (Example 3)', () => {
  const r = evaluateSubstantiation(rules.meals_business, {
    amount_cents: 4800, has_photo: false,
    captured_fields: { attendees: 'Sarah', business_purpose: 'partnership' },
  });
  assert.equal(r.needs_receipt, false);
  assert.equal(r.substantiation_complete, true);
  assert.equal(r.deductible_amount_cents, 2400); // $24
});

test('meal over $75, no photo: needs receipt, not complete, 50% (Example 2)', () => {
  const r = evaluateSubstantiation(rules.meals_business, {
    amount_cents: 34000, has_photo: false,
    captured_fields: { attendees: 'John from Acme', business_purpose: 'Q3' },
  });
  assert.equal(r.needs_receipt, true);
  assert.equal(r.substantiation_complete, false);
  assert.equal(r.deductible_amount_cents, 17000); // $170
});

test('meal over $75 WITH photo + context: complete, no receipt', () => {
  const r = evaluateSubstantiation(rules.meals_business, {
    amount_cents: 34000, has_photo: true,
    captured_fields: { attendees: 'John', business_purpose: 'Q3' },
  });
  assert.equal(r.needs_receipt, false);
  assert.equal(r.substantiation_complete, true);
});

test('meal under $75 missing context: asks for missing fields only, not complete', () => {
  const r = evaluateSubstantiation(rules.meals_business, {
    amount_cents: 4800, has_photo: false, captured_fields: { attendees: 'Sarah' },
  });
  assert.equal(r.needs_receipt, false);
  assert.deepEqual(r.missing_context_fields, ['business_purpose']);
  assert.equal(r.substantiation_complete, false);
});

test('lodging always needs a receipt even under $75 (Example 4)', () => {
  const r = evaluateSubstantiation(rules.travel_lodging, {
    amount_cents: 6700, has_photo: false, captured_fields: { business_purpose: 'client visit', location_city: 'Chicago' },
  });
  assert.equal(r.needs_receipt, true);
  assert.equal(r.substantiation_complete, false);
});

test('lodging with photo + purpose + city: complete', () => {
  const r = evaluateSubstantiation(rules.travel_lodging, {
    amount_cents: 6700, has_photo: true, captured_fields: { business_purpose: 'client visit', location_city: 'Chicago' },
  });
  assert.equal(r.needs_receipt, false);
  assert.equal(r.substantiation_complete, true);
});

test('travel requires "place": missing location_city is asked for (§274(d), DEC-071)', () => {
  // Transportation over $75 with a photo + purpose but no city → still incomplete, asks only the city.
  const r = evaluateSubstantiation(rules.travel_transportation, {
    amount_cents: 45000, has_photo: true, captured_fields: { business_purpose: 'client pitch' },
  });
  assert.deepEqual(r.missing_context_fields, ['location_city']);
  assert.equal(r.substantiation_complete, false);
});

test('travel with purpose + city + photo: complete', () => {
  const r = evaluateSubstantiation(rules.travel_transportation, {
    amount_cents: 45000, has_photo: true, captured_fields: { business_purpose: 'client pitch', location_city: 'Chicago' },
  });
  assert.equal(r.needs_receipt, false);
  assert.equal(r.substantiation_complete, true);
});

test('business gift $45 (under $75): capped at $25 deductible, NO receipt, missing context (Example 6)', () => {
  // Seed is source of truth (DEC-012): business_gifts.always_receipt=FALSE, threshold $75.
  // Example 6 confirms a $45 gift gets no receipt ask — only the $25-cap note + context Q.
  const r = evaluateSubstantiation(rules.business_gifts, {
    amount_cents: 4500, has_photo: false, captured_fields: {},
  });
  assert.equal(r.deductible_amount_cents, 2500); // capped at $25
  assert.equal(r.needs_receipt, false); // under $75 + not always_receipt
  assert.deepEqual(r.missing_context_fields, ['attendees', 'business_relationship']);
  assert.equal(r.substantiation_complete, false); // still missing context
});

test('business gift $120 (over $75), no photo: needs receipt + capped $25 deductible', () => {
  const r = evaluateSubstantiation(rules.business_gifts, {
    amount_cents: 12000, has_photo: false,
    captured_fields: { attendees: 'David', business_relationship: 'client' },
  });
  assert.equal(r.needs_receipt, true); // over $75 threshold
  assert.equal(r.deductible_amount_cents, 2500); // still capped at $25
});

test('vehicle: never needs a receipt (threshold null); complete with miles+purpose', () => {
  const r = evaluateSubstantiation(rules.vehicle_business, {
    amount_cents: 6580, has_photo: false,
    captured_fields: { business_miles: 94, business_purpose: 'client visit' },
  });
  assert.equal(r.needs_receipt, false);
  assert.equal(r.substantiation_complete, true);
  assert.equal(r.deductible_amount_cents, 6580);
});

test('vehicle missing miles: not complete, asks for business_miles', () => {
  const r = evaluateSubstantiation(rules.vehicle_business, {
    amount_cents: 6580, has_photo: false, captured_fields: { business_purpose: 'client visit' },
  });
  assert.deepEqual(r.missing_context_fields, ['business_miles']);
  assert.equal(r.substantiation_complete, false);
});

test('personal: 0 deductible, complete (general)', () => {
  const r = evaluateSubstantiation(rules.personal, { amount_cents: 8700, has_photo: false, captured_fields: {} });
  assert.equal(r.deductible_amount_cents, 0);
  assert.equal(r.substantiation_complete, true);
});

test('computeDeductibleCents caps gifts', () => {
  assert.equal(computeDeductibleCents(rules.business_gifts, 4500), 2500);
  assert.equal(computeDeductibleCents(rules.business_gifts, 1000), 1000);
  assert.equal(computeDeductibleCents(rules.meals_business, 34000), 17000);
});
