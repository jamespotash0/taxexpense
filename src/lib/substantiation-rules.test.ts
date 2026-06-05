// Taxonomy ↔ substantiation_rules coverage guard.
//
// WHY: the categorizer can assign any ALLOWED_CATEGORIES key, and expense.ts looks that key up in
// the substantiation_rules table. If a key has no rule row, loadRuleOrFallback silently downgrades
// it to "general" (no receipt, no required context, complete) — which is exactly how a business
// meal got logged without ever being asked for its §274(d) context. This test fails if any
// taxonomy key is missing from the seed/migration SQL, so the drift can't reach production
// unnoticed. (Runtime also warns via 'substantiation_rule_missing', but this catches it in CI.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWED_CATEGORIES } from './categories';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '../../supabase/migrations');

/** Every category that any migration seeds into substantiation_rules. */
function seededCategories(): Set<string> {
  const seeded = new Set<string>();
  for (const file of readdirSync(migrationsDir)) {
    if (!file.endsWith('.sql')) continue;
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    if (!sql.includes('substantiation_rules')) continue;
    // VALUES rows look like:  ('meals_business', '274', 'strict', ...) — the category is the
    // first single-quoted token of a row that's immediately followed by an IRC-section string.
    for (const m of sql.matchAll(/\(\s*'([a-z_]+)'\s*,\s*'[^']*'\s*,\s*'(?:strict|general)'/g)) {
      seeded.add(m[1]);
    }
  }
  return seeded;
}

test('every taxonomy category has a substantiation rule', () => {
  const seeded = seededCategories();
  const missing = [...ALLOWED_CATEGORIES].filter((c) => !seeded.has(c));
  assert.deepEqual(
    missing,
    [],
    `Categories in ALLOWED_CATEGORIES with no substantiation_rules row (they would silently fall back to "general" and never ask for required context): ${missing.join(', ')}`,
  );
});

test('business meals require the §274(d) business relationship', () => {
  // The specific gap this suite was added for: a meal must capture the relationship of the person
  // entertained, or substantiation_complete can flip true without it.
  const seed = readFileSync(join(migrationsDir, '0002_seed_substantiation_rules.sql'), 'utf8');
  const row = seed.split('\n').find((l) => l.includes("'meals_business'") && l.includes("'strict'"));
  assert.ok(row, 'meals_business strict rule not found in 0002 seed');
  assert.ok(
    row.includes('business_relationship'),
    'meals_business required_context_fields must include business_relationship',
  );
});
