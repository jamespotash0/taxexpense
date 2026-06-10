// Business profile (Spec 09, Piece 1) — pure-function invariants. The closed-taxonomy guarantee
// is the load-bearing one: a profile injected into a categorization prompt must NEVER carry a
// category key the categorizer doesn't recognize (a hallucinated "inventory_cogs"/"meals_client"
// hint would otherwise read as authoritative). sanitizeProfile is the backstop; renderProfileForPrompt
// must omit empty sections so the prompt stays compact + cache-friendly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeProfile, renderProfileForPrompt, type BusinessProfile } from './businessProfile';

test('sanitizeProfile drops invalid category keys from common_categories and synonyms', () => {
  const out = sanitizeProfile({
    industry: 'real estate agent',
    sells_product: false,
    common_categories: ['vehicle_business', 'inventory_cogs', 'made_up', 'advertising'],
    synonyms: { MLS: 'professional_services', staging: 'advertising', desk: 'not_a_category' },
    notes_for_categorizer: 'Mileage between showings is common.',
  });
  assert.deepEqual(out.common_categories, ['vehicle_business', 'advertising']);
  assert.deepEqual(out.synonyms, { MLS: 'professional_services', staging: 'advertising' });
});

test('sanitizeProfile coerces missing/garbage fields to safe defaults', () => {
  const out = sanitizeProfile({});
  assert.equal(out.industry, '');
  assert.equal(out.sells_product, false);
  assert.deepEqual(out.common_categories, []);
  assert.deepEqual(out.synonyms, {});
  assert.equal(out.notes_for_categorizer, '');
});

test('sanitizeProfile clamps long free-text and never lets a non-string category through', () => {
  const out = sanitizeProfile({
    industry: 'x'.repeat(200),
    notes_for_categorizer: 'y'.repeat(1000),
    // @ts-expect-error — exercising runtime garbage the model could emit
    common_categories: ['software', 42, null, 'rent'],
    // @ts-expect-error — non-string synonym value
    synonyms: { foo: 99, bar: 'software' },
  });
  assert.equal(out.industry.length, 80);
  assert.equal(out.notes_for_categorizer.length, 600);
  assert.deepEqual(out.common_categories, ['software', 'rent']);
  assert.deepEqual(out.synonyms, { bar: 'software' });
});

test('renderProfileForPrompt marks the profile as a PRIOR and includes all populated sections', () => {
  const profile: BusinessProfile = {
    industry: 'real estate agent',
    sells_product: false,
    common_categories: ['vehicle_business', 'advertising'],
    synonyms: { MLS: 'professional_services' },
    notes_for_categorizer: 'Mileage between showings is common.',
  };
  const out = renderProfileForPrompt(profile);
  assert.match(out, /PRIOR/);
  assert.match(out, /Industry: real estate agent/);
  assert.match(out, /vehicle_business, advertising/);
  assert.match(out, /"MLS" → professional_services/);
  assert.match(out, /Mileage between showings/);
});

test('renderProfileForPrompt omits empty sections (compact prompt)', () => {
  const out = renderProfileForPrompt({
    industry: 'consultant',
    sells_product: false,
    common_categories: [],
    synonyms: {},
    notes_for_categorizer: '',
  });
  assert.doesNotMatch(out, /Common categories/);
  assert.doesNotMatch(out, /Term\/vendor hints/);
  assert.doesNotMatch(out, /Notes:/);
  assert.match(out, /Industry: consultant/);
});
