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

type Check = (i: Intent) => boolean;

interface IntentCase {
  id: string;
  text: string;
  expect: string; // human-readable, for the report
  tags: Array<'easy' | 'edge' | 'ambiguous'>;
  check: Check;
  note?: string;
}

const isKind = (k: Intent['kind']): Check => (i) => i.kind === k;
const isQuery = (tool?: string, period?: string): Check => (i) =>
  i.kind === 'query' && (tool == null || i.tool === tool) && (period == null || i.period === period);

const CASES: IntentCase[] = [
  // ---- capture vs context_statement (no amount; a detail about a logged expense) ----
  { id: 'ctx-client-meal', text: 'that lunch was with a client about the Q3 deal', expect: 'context_statement',
    tags: ['edge'], check: isKind('context_statement'), note: 'Adds who/why to a logged meal, no amount.' },
  { id: 'ctx-team', text: 'the dinner was for my own team', expect: 'context_statement',
    tags: ['edge'], check: isKind('context_statement') },
  { id: 'ctx-personal', text: 'that one was actually personal', expect: 'context_statement',
    tags: ['edge'], check: isKind('context_statement') },
  { id: 'ctx-vendor', text: 'Tabernacle is a restaurant', expect: 'context_statement',
    tags: ['edge'], check: isKind('context_statement'), note: 'Vendor clarification, no amount.' },

  // ---- capture (records a NEW expense; phrased without an obvious $ the fast-path catches) ----
  { id: 'cap-no-symbol', text: 'spent forty bucks on gas to the client site', expect: 'capture',
    tags: ['edge'], check: isKind('capture'), note: '"forty bucks" — no $-digit, fast-path may miss; must still capture.' },
  { id: 'cap-coffee-detail', text: 'bought printer paper at staples for the office', expect: 'capture',
    tags: ['edge'], check: isKind('capture'), note: 'New expense, no amount stated → still a capture.' },

  // ---- query: tool + period/category extraction ----
  { id: 'q-meals-year', text: 'how much have I spent on meals this year?', expect: 'query/aggregate/this_year',
    tags: ['easy'], check: isQuery('aggregate', 'this_year') },
  { id: 'q-recent', text: 'what are my last 3 charges?', expect: 'query/recent',
    tags: ['easy'], check: isQuery('recent') },
  { id: 'q-breakdown', text: 'show me my spending by category', expect: 'query/breakdown',
    tags: ['easy'], check: isQuery('breakdown') },
  { id: 'q-review', text: 'review my year', expect: 'query/review_year',
    tags: ['easy'], check: isQuery('review_year') },
  { id: 'q-total-software', text: 'total software spend last month', expect: 'query/aggregate/last_month',
    tags: ['edge'], check: isQuery('aggregate', 'last_month') },

  // ---- advice (must deflect to CPA, not answer) ----
  { id: 'adv-owe', text: 'how much will I owe in taxes this year?', expect: 'advice',
    tags: ['edge'], check: isKind('advice') },
  { id: 'adv-deductible', text: 'is my home office deductible?', expect: 'advice',
    tags: ['edge'], check: isKind('advice'), note: 'Deductibility question = advice, NOT a query about logged data.' },
  { id: 'adv-should', text: 'should I buy the camera before year end for the writeoff?', expect: 'advice',
    tags: ['ambiguous'], check: isKind('advice') },

  // ---- command ----
  { id: 'cmd-export', text: 'export my data', expect: 'command/export',
    tags: ['easy'], check: (i) => i.kind === 'command' && i.command === 'export' },
  { id: 'cmd-email', text: 'email my accountant', expect: 'command/email_accountant',
    tags: ['easy'], check: (i) => i.kind === 'command' && i.command === 'email_accountant' },

  // ---- help / greeting ----
  { id: 'help-hi', text: 'hey', expect: 'help', tags: ['easy'], check: isKind('help') },
  { id: 'help-what', text: 'what can you do?', expect: 'help', tags: ['easy'], check: isKind('help') },
  { id: 'help-thanks', text: 'thanks!', expect: 'help', tags: ['ambiguous'], check: isKind('help') },

  // ---- other (off-topic; must NOT be captured as a phantom expense) ----
  { id: 'other-weather', text: "what's the weather tomorrow?", expect: 'other', tags: ['edge'], check: isKind('other') },
  { id: 'other-flight', text: 'book me a flight to Denver', expect: 'other',
    tags: ['edge'], check: isKind('other'), note: 'Action we can\'t do — not a travel EXPENSE.' },
  { id: 'other-poem', text: 'write me a poem about taxes', expect: 'other', tags: ['easy'], check: isKind('other') },
];

// ---------------------------------------------------------------------------
// Adversarial round — deliberately messy/realistic SMS the clean cases don't cover:
// mixed-intent, typos/shorthand, code-switching, terse fragments, advice disguised as a
// query, and off-topic messages that USE expense vocabulary. Many are genuinely ambiguous
// (a human could justify >1 label) and are tagged so — they're observed, not scored. The
// point is to find where the classifier actually cracks, which is the real basis for few-shot.
// ---------------------------------------------------------------------------
const oneOfKind = (...ks: Intent['kind'][]): Check => (i) => ks.includes(i.kind);

const ADVERSARIAL: IntentCase[] = [
  // ---- mixed-intent: logs AND asks in one message ----
  { id: 'mix-log-and-ask', text: 'logged $40 gas to the client, also how much on meals this year?',
    expect: 'capture|query (mixed)', tags: ['ambiguous'], check: oneOfKind('capture', 'query'),
    note: 'Two intents in one SMS; classifier must pick one — either is defensible.' },
  { id: 'mix-greeting-query', text: 'hey! how much did I spend on software?',
    expect: 'query (greeting prefix must not win)', tags: ['edge'], check: isQuery('aggregate') },

  // ---- typos / SMS shorthand ----
  { id: 'typo-meals-year', text: 'hw mch on meals ths yr', expect: 'query/aggregate', tags: ['edge'], check: isQuery('aggregate') },
  { id: 'typo-recent', text: 'wat wer my lst 3 chrgs', expect: 'query/recent', tags: ['edge'], check: isQuery('recent') },

  // ---- code-switching (Spanish) ----
  { id: 'es-query', text: '¿cuánto gasté en comidas este año?', expect: 'query/aggregate', tags: ['edge'], check: isQuery('aggregate') },
  { id: 'es-capture', text: 'gasté $40 en gasolina yendo al cliente', expect: 'capture', tags: ['edge'], check: isKind('capture') },

  // ---- terse fragments ----
  { id: 'terse-meals', text: 'meals this year?', expect: 'query/aggregate', tags: ['ambiguous'], check: isQuery() },
  { id: 'terse-my-year', text: 'my year', expect: 'query/review_year', tags: ['ambiguous'], check: oneOfKind('query', 'help') },

  // ---- advice disguised as a query about their data ----
  { id: 'adv-writeoff-car', text: 'what can I write off for my car?', expect: 'advice', tags: ['edge'], check: isKind('advice') },
  { id: 'adv-categorize', text: 'should I categorize my home internet as office?', expect: 'advice', tags: ['ambiguous'], check: oneOfKind('advice') },
  { id: 'adv-1099', text: "what's a 1099?", expect: 'advice|help|other', tags: ['ambiguous'], check: oneOfKind('advice', 'help', 'other') },

  // ---- query vs capture: references an existing charge (no NEW expense) ----
  { id: 'q-already-logged', text: 'did I already log the $200 adobe charge?', expect: 'query (asks about logged data)', tags: ['edge'], check: isKind('query') },

  // ---- commands phrased indirectly ----
  { id: 'cmd-send-records', text: 'can you send my records to my accountant?', expect: 'command/email_accountant', tags: ['edge'], check: (i) => i.kind === 'command' && i.command === 'email_accountant' },
  { id: 'cmd-need-csv', text: 'i need a csv of everything', expect: 'command/export', tags: ['edge'], check: (i) => i.kind === 'command' && i.command === 'export' },

  // ---- off-topic that USES expense vocabulary (must NOT phantom-capture) ----
  { id: 'other-lend', text: 'can you lend me $20 for lunch?', expect: 'other (request, not an expense log)', tags: ['edge'], check: oneOfKind('other', 'help') },
  { id: 'other-best-app', text: "what's the best expense tracking app?", expect: 'other|help', tags: ['ambiguous'], check: oneOfKind('other', 'help', 'advice') },
];

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
    const i = await classifyIntent(c.text);
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
