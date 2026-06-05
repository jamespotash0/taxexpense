// Merged-path categorization eval — grades parseAndCategorizeText() (src/lib/ocr.ts),
// the single Haiku call that the production SMS *text* path now uses to extract + categorize
// in one round trip (DEC-064). Companion to run.ts (which grades the standalone Prompt 6).
//
// Same golden dataset, but each case's raw_text is fed in as the inbound user message — so
// this measures the merged prompt end-to-end the way a real text expense hits it. Run it
// alongside run.ts before changing CATEGORY_TAXONOMY or the merged prompts.
//
//   npm run eval:merged
//
// Requires ANTHROPIC_API_KEY (loaded via --env-file=.env.local in the npm script).

import { parseAndCategorizeText } from '../../src/lib/ocr';
import type { AppUser } from '../../src/lib/users';
import { DATASET, type EvalCase } from './dataset';

// Same fixed user as run.ts so the eval measures the prompt, not user variance.
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
  correct: boolean;
  error?: string;
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

async function grade(c: EvalCase): Promise<Outcome> {
  try {
    const { category } = await parseAndCategorizeText(c.input.raw_text, TEST_USER);
    return { c, got: category.category, confidence: category.confidence, correct: category.category === c.expected };
  } catch (err) {
    return { c, got: 'ERROR', confidence: 0, correct: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}

function pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(0)}%`;
}

async function main() {
  console.log(`Running ${DATASET.length} merged-path cases (live Haiku, via raw_text)...\n`);
  const results = await pool(DATASET, 5, grade);

  for (const o of results) {
    const ambiguous = o.c.tags.includes('ambiguous');
    const mark = o.correct ? '✓' : ambiguous ? '~' : '✗';
    const detail = o.correct ? '' : `expected ${o.c.expected}, got ${o.got}`;
    console.log(`  ${mark} ${o.c.id.padEnd(26)} ${o.got.padEnd(22)} conf ${o.confidence.toFixed(2)}  ${detail}`);
  }

  const scored = results.filter((o) => !o.c.tags.includes('ambiguous'));
  const correct = scored.filter((o) => o.correct).length;
  const edge = scored.filter((o) => o.c.tags.includes('edge'));
  const edgeCorrect = edge.filter((o) => o.correct).length;
  const confidentWrong = scored.filter((o) => !o.correct && o.confidence >= 0.8).length;

  console.log(`\nOverall (scored): ${pct(correct, scored.length)}  (${correct}/${scored.length})`);
  console.log(`Edge:             ${pct(edgeCorrect, edge.length)}`);
  console.log(`Confident-wrong:  ${confidentWrong}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
