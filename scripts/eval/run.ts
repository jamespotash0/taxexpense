// Categorization eval harness — grades the PRODUCTION categorizeExpense()
// (src/lib/categorize.ts, Prompt 6 / Haiku) against a golden dataset.
//
// This is NOT a unit test: it makes real Haiku calls (costs ~$0.001/case) and is
// non-deterministic, so it lives outside `npm test`. Run it before changing the
// categorization prompt or bumping the model, and compare the accuracy + confusion
// table to catch regressions.
//
//   npm run eval:categorize
//
// Requires ANTHROPIC_API_KEY (loaded via --env-file=.env.local in the npm script).

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { categorizeExpense } from '../../src/lib/categorize';
import type { AppUser } from '../../src/lib/users';
import { DATASET, buildInput, type EvalCase } from './dataset';

const here = dirname(fileURLToPath(import.meta.url));

// A generic self-employed user — entity/business type are passed to the prompt as
// context. We hold them fixed so the eval measures the prompt, not user variance.
const TEST_USER = {
  id: 'eval-user',
  organization_id: 'eval-org',
  business_type: 'freelance photographer',
  entity_type: 'sole_prop',
  default_payment_account: 'mixed',
} as unknown as AppUser;

interface Outcome {
  c: EvalCase;
  got: string;
  confidence: number;
  reasoning: string;
  correct: boolean;
  error?: string;
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

async function grade(c: EvalCase): Promise<Outcome> {
  try {
    const res = await categorizeExpense(buildInput(c.input), TEST_USER);
    return {
      c,
      got: res.category,
      confidence: res.confidence,
      reasoning: res.reasoning,
      correct: res.category === c.expected,
    };
  } catch (err) {
    return { c, got: 'ERROR', confidence: 0, reasoning: '', correct: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}

function pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(0)}%`;
}

function isAmbiguous(o: Outcome): boolean {
  return o.c.tags.includes('ambiguous');
}

function summarize(results: Outcome[]) {
  const scored = results.filter((o) => !isAmbiguous(o)); // headline excludes ambiguous
  const ambiguous = results.filter(isAmbiguous);
  const edge = scored.filter((o) => o.c.tags.includes('edge'));
  const easy = scored.filter((o) => o.c.tags.includes('easy'));

  const correct = scored.filter((o) => o.correct);
  const wrong = scored.filter((o) => !o.correct);

  // Calibration: where is the model confident-and-wrong, or unsure-and-right?
  const confidentWrong = scored.filter((o) => !o.correct && o.confidence >= 0.8);
  const unsureRight = scored.filter((o) => o.correct && o.confidence < 0.5);
  const avgConfCorrect = correct.length ? correct.reduce((s, o) => s + o.confidence, 0) / correct.length : 0;
  const avgConfWrong = wrong.length ? wrong.reduce((s, o) => s + o.confidence, 0) / wrong.length : 0;

  return { scored, ambiguous, edge, easy, correct, wrong, confidentWrong, unsureRight, avgConfCorrect, avgConfWrong };
}

function render(results: Outcome[]): string {
  const s = summarize(results);
  const L: string[] = [];
  const line = (t = '') => L.push(t);

  line('# Categorization Eval Report');
  line('');
  line(`Dataset: ${results.length} cases (${s.scored.length} scored, ${s.ambiguous.length} ambiguous/excluded).`);
  line(`Model: Haiku via production \`categorizeExpense()\`. Prompt 6.`);
  line('');
  line('## Headline');
  line('');
  line(`| Metric | Result |`);
  line(`| --- | --- |`);
  line(`| **Overall accuracy** (scored) | **${pct(s.correct.length, s.scored.length)}** (${s.correct.length}/${s.scored.length}) |`);
  line(`| Easy cases | ${pct(s.easy.filter((o) => o.correct).length, s.easy.length)} (${s.easy.filter((o) => o.correct).length}/${s.easy.length}) |`);
  line(`| Edge cases | ${pct(s.edge.filter((o) => o.correct).length, s.edge.length)} (${s.edge.filter((o) => o.correct).length}/${s.edge.length}) |`);
  line(`| Avg confidence when correct | ${s.avgConfCorrect.toFixed(2)} |`);
  line(`| Avg confidence when WRONG | ${s.avgConfWrong.toFixed(2)} |`);
  line(`| ⚠️ Confident-but-wrong (conf ≥ 0.8) | ${s.confidentWrong.length} |`);
  line(`| Unsure-but-right (conf < 0.5) | ${s.unsureRight.length} |`);
  line('');

  if (s.confidentWrong.length) {
    line('## ⚠️ Confident-but-wrong (highest-priority failures)');
    line('');
    line('These are the dangerous ones — the model asserted a wrong category with high confidence, so nothing downstream would flag it for review.');
    line('');
    for (const o of s.confidentWrong) {
      line(`- **${o.c.id}** — expected \`${o.c.expected}\`, got \`${o.got}\` (conf ${o.confidence.toFixed(2)}). _${o.c.note}_`);
    }
    line('');
  }

  line('## All results');
  line('');
  line('| id | tags | expected | got | conf | ✓ |');
  line('| --- | --- | --- | --- | --- | --- |');
  for (const o of results) {
    const mark = isAmbiguous(o) ? (o.correct ? '≈' : '~') : o.correct ? '✓' : '✗';
    line(`| ${o.c.id} | ${o.c.tags.join(',')} | ${o.c.expected} | ${o.got}${o.error ? ' (ERR)' : ''} | ${o.confidence.toFixed(2)} | ${mark} |`);
  }
  line('');

  const misses = results.filter((o) => !o.correct);
  if (misses.length) {
    line('## Misses — model reasoning (for prompt tuning)');
    line('');
    for (const o of misses) {
      const kind = isAmbiguous(o) ? 'ambiguous' : o.c.tags.join(',');
      line(`### ${o.c.id} (${kind})`);
      line(`- expected \`${o.c.expected}\`, got \`${o.got}\`${o.error ? ` — ERROR: ${o.error}` : ''}`);
      line(`- case note: ${o.c.note}`);
      if (o.reasoning) line(`- model reasoning: "${o.reasoning}"`);
      line('');
    }
  }

  line('---');
  line('_Legend: ✓/✗ scored · ≈/~ ambiguous (excluded from headline). Re-run after prompt/model changes and diff this file._');
  return L.join('\n');
}

async function main() {
  console.log(`Running ${DATASET.length} categorization cases (live Haiku)...\n`);
  const results = await pool(DATASET, 5, grade);

  // Console summary
  for (const o of results) {
    const mark = o.correct ? '✓' : isAmbiguous(o) ? '~' : '✗';
    const detail = o.correct ? '' : `  expected ${o.c.expected}, got ${o.got}`;
    console.log(`  ${mark} ${o.c.id.padEnd(26)} ${o.got.padEnd(22)} conf ${o.confidence.toFixed(2)}${detail}`);
  }

  const s = summarize(results);
  console.log('');
  console.log(`Overall (scored): ${pct(s.correct.length, s.scored.length)}  (${s.correct.length}/${s.scored.length})`);
  console.log(`Edge:             ${pct(s.edge.filter((o) => o.correct).length, s.edge.length)}`);
  console.log(`Confident-wrong:  ${s.confidentWrong.length}`);

  const md = render(results);
  const outPath = join(here, 'report.md');
  writeFileSync(outPath, md + '\n');
  console.log(`\nWrote ${outPath}`);

  // Non-zero exit if a *scored* (non-ambiguous) case regressed — usable as a gate.
  const scoredMisses = results.filter((o) => !o.correct && !isAmbiguous(o));
  if (scoredMisses.length) {
    console.log(`\n${scoredMisses.length} scored case(s) failed.`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
