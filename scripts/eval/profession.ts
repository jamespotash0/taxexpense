// Profession-aware categorization eval (DEC-081 / Spec 09, Piece 1).
//
// Measures the LIFT the business_profile prior gives the categorizer: each profession-specific
// case is run TWICE through the production categorizeExpense() — once with a generic user (no
// profile, today's baseline) and once with the profession's profile attached — and the report
// shows baseline accuracy vs. with-profile accuracy. The cases are deliberately ones a generic
// engine tends to miss or bucket into other_business (MLS/desk fees, staging, CE, closing gifts),
// i.e. exactly the Keeper blind spot the profile is meant to close.
//
// Like the other evals this makes real Haiku calls (non-deterministic, ~$0.001/case) so it lives
// outside `npm test`. Run before changing the profile prompt/shape:
//
//   npm run eval:profession
//
// Requires ANTHROPIC_API_KEY (loaded via --env-file=.env.local in the npm script).

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { categorizeExpense } from '../../src/lib/categorize';
import type { AppUser } from '../../src/lib/users';
import type { BusinessProfile } from '../../src/lib/businessProfile';
import { buildInput, type EvalCase } from './dataset';

const here = dirname(fileURLToPath(import.meta.url));

// The profile a realtor would get from BUSINESS_PROFILE_BUILDER_PROMPT (hand-authored here so the
// eval is deterministic in its INPUT — only the categorizer is the variable under test).
const REALTOR_PROFILE: BusinessProfile = {
  industry: 'real estate agent',
  sells_product: false,
  common_categories: [
    'vehicle_business',
    'advertising',
    'education',
    'business_gifts',
    'home_office',
    'professional_services',
    'insurance',
  ],
  synonyms: {
    MLS: 'professional_services',
    'desk fee': 'professional_services',
    'E&O': 'insurance',
    staging: 'advertising',
    'yard sign': 'advertising',
    CE: 'education',
    'closing gift': 'business_gifts',
  },
  notes_for_categorizer:
    'Real estate agent. Mileage between showings is common and deductible; brokerage/MLS/desk fees ' +
    'are ordinary professional fees; staging, listing marketing, and signage are advertising; ' +
    'license and continuing-education costs are education.',
};

/** A profession case: a profile + the cases that profile should help with. */
interface ProfessionSet {
  label: string;
  profile: BusinessProfile;
  baseBusinessType: string; // what a generic user (no profile) would have as business_type
  cases: EvalCase[];
}

const REALTOR_CASES: EvalCase[] = [
  {
    id: 'mls-dues',
    input: { vendor: 'MLS', amount_cents: 4500, raw_text: '$45 monthly MLS dues' },
    expected: 'professional_services',
    tags: ['edge'],
    note: 'MLS membership dues → professional_services. Generic engine often drifts to other_business.',
  },
  {
    id: 'desk-fee',
    input: { vendor: 'Keller Williams', amount_cents: 30000, raw_text: '$300 monthly desk fee to my brokerage' },
    expected: 'professional_services',
    tags: ['edge'],
    note: 'Brokerage desk fee → professional_services. Generic engine may read it as rent.',
  },
  {
    id: 'eo-insurance',
    input: { vendor: 'Victor', amount_cents: 5500, raw_text: '$55 E&O insurance for the quarter' },
    expected: 'insurance',
    tags: ['edge'],
    note: 'Errors & omissions insurance → insurance. "E&O" is opaque without the profile.',
  },
  {
    id: 'staging',
    input: { vendor: 'Stage Right', amount_cents: 80000, raw_text: '$800 staging the Oak St listing for sale' },
    expected: 'advertising',
    tags: ['edge'],
    note: 'Staging a listing to sell it → advertising. Generic engine may pick home_office/repairs/other.',
  },
  {
    id: 'yard-signs',
    input: { vendor: 'BuildASign', amount_cents: 12000, raw_text: '$120 for new yard signs with my name' },
    expected: 'advertising',
    tags: ['edge'],
    note: 'Listing/branding signage → advertising. Generic engine may pick office_supplies.',
  },
  {
    id: 'ce-license',
    input: { vendor: 'The CE Shop', amount_cents: 20000, raw_text: '$200 continuing education to renew my real estate license' },
    expected: 'education',
    tags: ['edge'],
    note: 'License CE → education. Clear with profile; "license renewal" can confuse a generic engine.',
  },
  {
    id: 'closing-gift',
    input: { vendor: 'Williams Sonoma', amount_cents: 4000, raw_text: '$40 closing gift for my buyers', business_relationship: 'client' },
    expected: 'business_gifts',
    tags: ['edge'],
    note: 'Closing gift to clients → business_gifts (§274(b)). "closing gift" is a realtor term.',
  },
  {
    id: 'showing-mileage',
    input: { business_miles: 32, raw_text: 'drove 32 miles showing houses to the Hendersons', business_purpose: 'showing houses' },
    expected: 'vehicle_business',
    tags: ['edge'],
    note: 'Mileage between showings → vehicle_business. The dominant realtor pattern.',
  },
];

const SETS: ProfessionSet[] = [
  { label: 'real estate agent', profile: REALTOR_PROFILE, baseBusinessType: 'real estate agent', cases: REALTOR_CASES },
];

function userFor(businessType: string, profile: BusinessProfile | null): AppUser {
  return {
    id: 'eval-user',
    organization_id: 'eval-org',
    business_type: businessType,
    entity_type: 'sole_prop',
    default_payment_account: 'mixed',
    business_profile: profile,
  } as unknown as AppUser;
}

interface Outcome {
  set: string;
  c: EvalCase;
  baseGot: string;
  baseOk: boolean;
  profGot: string;
  profOk: boolean;
}

/** Run up to `n` async tasks at a time (gentle on rate limits). */
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

async function grade(job: { set: ProfessionSet; c: EvalCase }): Promise<Outcome> {
  const { set, c } = job;
  const input = buildInput(c.input);
  // Baseline: a user with the profession as bare business_type but NO derived profile (today).
  const base = await categorizeExpense(input, userFor(set.baseBusinessType, null));
  // With the profession profile attached (the feature under test).
  const prof = await categorizeExpense(input, userFor(set.baseBusinessType, set.profile));
  return {
    set: set.label,
    c,
    baseGot: base.category,
    baseOk: base.category === c.expected,
    profGot: prof.category,
    profOk: prof.category === c.expected,
  };
}

function pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(0)}%`;
}

function render(results: Outcome[]): string {
  const L: string[] = [];
  const line = (t = '') => L.push(t);
  const baseOk = results.filter((o) => o.baseOk).length;
  const profOk = results.filter((o) => o.profOk).length;
  const fixed = results.filter((o) => !o.baseOk && o.profOk);
  const broke = results.filter((o) => o.baseOk && !o.profOk);

  line('# Profession-Aware Categorization Eval (lift)');
  line('');
  line(`Cases: ${results.length}. Each run twice via production \`categorizeExpense()\` — baseline (no profile) vs. with the profession profile.`);
  line('');
  line('## Headline');
  line('');
  line('| Metric | Result |');
  line('| --- | --- |');
  line(`| Baseline accuracy (no profile) | ${pct(baseOk, results.length)} (${baseOk}/${results.length}) |`);
  line(`| **With profile** | **${pct(profOk, results.length)}** (${profOk}/${results.length}) |`);
  line(`| ✅ Fixed by the profile | ${fixed.length} |`);
  line(`| ⚠️ Regressed by the profile | ${broke.length} |`);
  line('');
  if (broke.length) {
    line('## ⚠️ Regressions (profile made these WORSE — investigate before shipping prompt changes)');
    line('');
    for (const o of broke) line(`- **${o.c.id}** expected \`${o.c.expected}\`, profile got \`${o.profGot}\` (baseline was right). _${o.c.note}_`);
    line('');
  }
  line('## All results');
  line('');
  line('| set | id | expected | baseline | with profile | lift |');
  line('| --- | --- | --- | --- | --- | --- |');
  for (const o of results) {
    const lift = !o.baseOk && o.profOk ? '✅ fixed' : o.baseOk && !o.profOk ? '⚠️ broke' : o.profOk ? '=' : '✗ both';
    line(`| ${o.set} | ${o.c.id} | ${o.c.expected} | ${o.baseGot}${o.baseOk ? ' ✓' : ''} | ${o.profGot}${o.profOk ? ' ✓' : ''} | ${lift} |`);
  }
  line('');
  line('---');
  line('_Re-run after changing the profile shape, the builder prompt, or userContextLine, and diff this file._');
  return L.join('\n');
}

async function main() {
  const jobs = SETS.flatMap((set) => set.cases.map((c) => ({ set, c })));
  console.log(`Running ${jobs.length} profession cases × 2 (baseline + profile) via live Haiku...\n`);
  const results = await pool(jobs, 4, grade);

  for (const o of results) {
    const lift = !o.baseOk && o.profOk ? '✅ fixed' : o.baseOk && !o.profOk ? '⚠️ broke' : o.profOk ? '  =   ' : '✗ both';
    console.log(`  ${lift}  ${o.c.id.padEnd(18)} expected ${o.c.expected.padEnd(22)} base=${o.baseGot.padEnd(22)} prof=${o.profGot}`);
  }

  const baseOk = results.filter((o) => o.baseOk).length;
  const profOk = results.filter((o) => o.profOk).length;
  console.log('');
  console.log(`Baseline:     ${pct(baseOk, results.length)} (${baseOk}/${results.length})`);
  console.log(`With profile: ${pct(profOk, results.length)} (${profOk}/${results.length})`);

  const md = render(results);
  const outPath = join(here, 'profession-report.md');
  writeFileSync(outPath, md + '\n');
  console.log(`\nWrote ${outPath}`);

  // Gate: fail if the profile REGRESSED any case (made a right answer wrong).
  const broke = results.filter((o) => o.baseOk && !o.profOk);
  if (broke.length) {
    console.log(`\n${broke.length} case(s) regressed with the profile.`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
