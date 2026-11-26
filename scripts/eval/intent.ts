// Intent-classifier eval (DEC-029 router). Grades the LIVE Haiku classifier
// (classifyIntent / CLASSIFY_PROMPT in src/lib/router.ts) that the unit tests can't reach —
// router.test.ts only covers the pure guardrails (looksLikeExpenseCapture / sanitizeIntent).
//
// This harness probes the HARD intent boundaries the prose descriptions leave fuzzy:
//   capture ⟷ context_statement ⟷ query ⟷ advice ⟷ help ⟷ other,
// plus query tool/period extraction. It's the signal for which few-shot examples to add to
// CLASSIFY_PROMPT (and the regression guard after adding them).
//
//   npm run eval:intent
//
// Requires ANTHROPIC_API_KEY (loaded via --env-file=.env.local in the npm script).
// NOTE: cases here are messages that DON'T hit the regex fast-path (looksLikeExpenseCapture) —
// those bypass the classifier entirely and are unit-tested separately. We call classifyIntent
// directly to grade the model, not the fast-path.

import { classifyIntent, type Intent } from '../../src/lib/router';
import { CASES, ADVERSARIAL, type IntentCase } from './intent-cases';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Paced sequential runner. The org cap is 50 Haiku req/min and classifyIntent SWALLOWS a 429
// into a `capture` fallback — so a burst doesn't error, it silently corrupts results as phantom
// "capture" misses. We stay well under the cap (~1.4s gap ≈ 43/min) so every result is a real
// classification, not a rate-limit artifact.
async function paced<T, R>(items: T[], gapMs: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i++) {
    out.push(await fn(items[i]));
    if (i < items.length - 1) await sleep(gapMs);
  }
  return out;
}

function pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(0)}%`;
}

function describe(i: Intent): string {
  if (i.kind === 'query') return `query/${i.tool}${i.period ? `/${i.period}` : ''}${i.category ? `(${i.category})` : ''}`;
  if (i.kind === 'command') return `command/${i.command}`;
  return i.kind;
}

async function grade(c: IntentCase): Promise<{ id: string; tags: string; ok: boolean; expect: string; got: string }> {
  try {
    const i = await classifyIntent(c.text, c.ctx);
    return { id: c.id, tags: c.tags.join(','), ok: c.check(i), expect: c.expect, got: describe(i) };
  } catch (err) {
    return { id: c.id, tags: c.tags.join(','), ok: false, expect: c.expect, got: `ERROR ${err instanceof Error ? err.message : 'unknown'}` };
  }
}

function table(rows: Array<{ id: string; tags: string; ok: boolean; expect: string; got: string }>) {
  console.log(`| id | tags | expected | got | ✓ |`);
  console.log(`| --- | --- | --- | --- | --- |`);
  for (const r of rows) console.log(`| ${r.id} | ${r.tags} | ${r.expect} | ${r.got} | ${r.ok ? '✓' : '✗'} |`);
}

async function main() {
  console.log(`\n# Intent-classifier eval (live Haiku) — CLASSIFY_PROMPT\n`);

  // Paced sequentially to stay under the 50 req/min Haiku cap (a 429 is swallowed into a
  // `capture` fallback, which would masquerade as a misclassification — see paced()).
  const GAP_MS = 1400;
  const all0 = await paced([...CASES, ...ADVERSARIAL], GAP_MS, grade);
  const res = all0.slice(0, CASES.length);
  const adv = all0.slice(CASES.length);

  console.log(`## Round 1 — clean boundaries (${CASES.length} cases)`);
  table(res);

  console.log(`\n## Round 2 — adversarial / messy SMS (${ADVERSARIAL.length} cases)`);
  table(adv);

  const all = [...res, ...adv];
  const scored = all.filter((r) => !r.tags.includes('ambiguous'));
  const passed = scored.filter((r) => r.ok).length;
  const misses = all.filter((r) => !r.ok);

  console.log(`\n## Headline`);
  console.log(`Scored (excl. ambiguous): ${pct(passed, scored.length)}  (${passed}/${scored.length})`);
  const ambig = all.filter((r) => r.tags.includes('ambiguous'));
  const ambigOk = ambig.filter((r) => r.ok).length;
  console.log(`Ambiguous (observed only): ${ambigOk}/${ambig.length} landed on an acceptable label`);

  if (misses.length) {
    console.log(`\n## Misses (drive few-shot selection)`);
    for (const m of misses) console.log(`  ${m.tags.includes('ambiguous') ? '≈' : '✗'} ${m.id.padEnd(18)} want ${m.expect}; got ${m.got}`);
  }
  if (passed < scored.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
