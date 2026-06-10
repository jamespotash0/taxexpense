// Business-profile BUILDER eval (DEC-081 / Spec 09, Piece 1).
//
// Grades what BUSINESS_PROFILE_BUILDER_PROMPT actually GENERATES from a free-text work
// description — the brain of the feature — as opposed to scripts/eval/profession.ts, which grades
// the injection mechanism with a hand-authored profile. Feeds realistic "what do you do?" answers
// through the production generateBusinessProfile() (Sonnet) and checks each result is sane:
//   - industry is non-empty
//   - common_categories are all VALID keys (sanitize backstop) and non-empty
//   - the categories a profession obviously needs are present (recall)
//   - sells_product is right for product vs. service businesses
//   - notes are non-empty
// Synonym recall is reported as INFO (soft — the model phrases hints freely), not a gate.
//
// Profile quality is partly subjective, so the report also dumps each generated profile for a
// human to eyeball. Makes real Sonnet calls (pricier than Haiku, ~$0.02/case), non-deterministic,
// so it lives outside `npm test`:
//
//   npm run eval:profile-build
//
// Requires ANTHROPIC_API_KEY (loaded via --env-file=.env.local in the npm script).

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateBusinessProfile, type BusinessProfile } from '../../src/lib/businessProfile';
import { isValidCategory } from '../../src/lib/categories';

const here = dirname(fileURLToPath(import.meta.url));

interface BuildCase {
  id: string;
  description: string; // the free-text onboarding answer
  entity?: string;
  /** Categories this profession obviously uses — graded as recall (≥50% must appear). */
  expectCategories: string[];
  /** Profession-term → category hints we'd hope to see. Reported as INFO, not a gate. */
  expectSynonyms?: Record<string, string>;
  sellsProduct: boolean;
}

const CASES: BuildCase[] = [
  {
    id: 'realtor',
    description: 'real estate agent',
    expectCategories: ['vehicle_business', 'advertising'],
    expectSynonyms: { MLS: 'professional_services', staging: 'advertising' },
    sellsProduct: false,
  },
  {
    id: 'rideshare',
    description: 'I drive for Uber and Lyft',
    expectCategories: ['vehicle_business'],
    sellsProduct: false,
  },
  {
    id: 'photographer',
    description: 'freelance wedding photographer',
    expectCategories: ['equipment', 'software'],
    sellsProduct: false,
  },
  {
    id: 'sw-consultant',
    description: 'independent software consultant',
    expectCategories: ['software'],
    sellsProduct: false,
  },
  {
    id: 'personal-trainer',
    description: 'self-employed personal trainer',
    expectCategories: ['advertising'],
    sellsProduct: false,
  },
  {
    id: 'barber',
    description: 'barber renting a booth at a shop',
    expectCategories: ['rent'],
    sellsProduct: false,
  },
  {
    id: 'etsy-maker',
    description: 'I make and sell handmade jewelry on Etsy',
    expectCategories: ['advertising'],
    sellsProduct: true,
  },
  {
    id: 'food-truck',
    description: 'I run a taco food truck',
    expectCategories: ['vehicle_business'],
    sellsProduct: true,
  },
  {
    id: 'vague',
    description: 'consultant',
    // Vague input → the prompt is told to keep it broad and not guess; we only require it to
    // produce SOME valid categories and not fabricate a product business.
    expectCategories: [],
    sellsProduct: false,
  },
];

interface Outcome {
  c: BuildCase;
  profile: BusinessProfile | null;
  industryOk: boolean;
  categoriesValid: boolean;
  categoryRecall: number; // 0..1 (1 when nothing expected)
  synonymRecall: number; // info only
  sellsProductOk: boolean;
  notesOk: boolean;
  pass: boolean;
}

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

async function grade(c: BuildCase): Promise<Outcome> {
  const profile = await generateBusinessProfile(c.description, c.entity ?? 'sole_prop');
  if (!profile) {
    return { c, profile: null, industryOk: false, categoriesValid: false, categoryRecall: 0, synonymRecall: 0, sellsProductOk: false, notesOk: false, pass: false };
  }
  const industryOk = profile.industry.trim().length > 0;
  const categoriesValid = profile.common_categories.length > 0 && profile.common_categories.every(isValidCategory);
  const categoryRecall = c.expectCategories.length === 0 ? 1 : c.expectCategories.filter((k) => profile.common_categories.includes(k)).length / c.expectCategories.length;
  const expSyn = Object.entries(c.expectSynonyms ?? {});
  const synonymRecall = expSyn.length === 0 ? 1 : expSyn.filter(([t, cat]) => profile.synonyms[t] === cat).length / expSyn.length;
  const sellsProductOk = profile.sells_product === c.sellsProduct;
  const notesOk = profile.notes_for_categorizer.trim().length > 0;
  const pass = industryOk && categoriesValid && categoryRecall >= 0.5 && sellsProductOk && notesOk;
  return { c, profile, industryOk, categoriesValid, categoryRecall, synonymRecall, sellsProductOk, notesOk, pass };
}

function pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(0)}%`;
}

function render(results: Outcome[]): string {
  const L: string[] = [];
  const line = (t = '') => L.push(t);
  const passed = results.filter((o) => o.pass).length;

  line('# Business-Profile Builder Eval');
  line('');
  line(`Cases: ${results.length}. Each is a work description run through production \`generateBusinessProfile()\` (Sonnet).`);
  line('');
  line('## Headline');
  line('');
  line('| Metric | Result |');
  line('| --- | --- |');
  line(`| **Cases passing all checks** | **${pct(passed, results.length)}** (${passed}/${results.length}) |`);
  line(`| sells_product correct | ${pct(results.filter((o) => o.sellsProductOk).length, results.length)} |`);
  line(`| categories valid + non-empty | ${pct(results.filter((o) => o.categoriesValid).length, results.length)} |`);
  line('');
  line('## Checks per case');
  line('');
  line('| id | pass | industry | cats valid | cat recall | syn recall | sells✓ | notes |');
  line('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const o of results) {
    line(
      `| ${o.c.id} | ${o.pass ? '✅' : '❌'} | ${o.industryOk ? '✓' : '✗'} | ${o.categoriesValid ? '✓' : '✗'} | ${(o.categoryRecall * 100).toFixed(0)}% | ${(o.synonymRecall * 100).toFixed(0)}% | ${o.sellsProductOk ? '✓' : '✗'} | ${o.notesOk ? '✓' : '✗'} |`,
    );
  }
  line('');
  line('## Generated profiles (eyeball quality)');
  line('');
  for (const o of results) {
    line(`### ${o.c.id} — "${o.c.description}"`);
    if (!o.profile) {
      line('- (no profile returned)');
      line('');
      continue;
    }
    line(`- industry: ${o.profile.industry} | sells_product: ${o.profile.sells_product}`);
    line(`- common_categories: ${o.profile.common_categories.join(', ') || '(none)'}`);
    const syn = Object.entries(o.profile.synonyms);
    line(`- synonyms: ${syn.length ? syn.map(([t, cat]) => `${t}→${cat}`).join(', ') : '(none)'}`);
    line(`- notes: ${o.profile.notes_for_categorizer || '(none)'}`);
    line('');
  }
  line('---');
  line('_Re-run after changing BUSINESS_PROFILE_BUILDER_PROMPT or the BusinessProfile shape, and diff this file._');
  return L.join('\n');
}

async function main() {
  console.log(`Running ${CASES.length} profile-builder cases via live Sonnet...\n`);
  const results = await pool(CASES, 3, grade);

  for (const o of results) {
    const cats = o.profile?.common_categories.join(',') ?? 'ERROR';
    console.log(`  ${o.pass ? '✅' : '❌'} ${o.c.id.padEnd(16)} sells=${String(o.profile?.sells_product ?? '?').padEnd(5)} recall=${(o.categoryRecall * 100).toFixed(0)}%  ${cats}`);
  }

  const passed = results.filter((o) => o.pass).length;
  console.log('');
  console.log(`Passing all checks: ${pct(passed, results.length)} (${passed}/${results.length})`);

  const md = render(results);
  const outPath = join(here, 'profile-build-report.md');
  writeFileSync(outPath, md + '\n');
  console.log(`\nWrote ${outPath}`);

  if (passed < results.length) {
    console.log(`\n${results.length - passed} case(s) failed a check.`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
