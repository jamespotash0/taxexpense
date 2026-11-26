// Late-context picker eval (spec: claude_files/specs/late-context-matching.md). Grades the LIVE
// Haiku picker (pickReceiptForContext in src/lib/context-match.ts): given a late detail and the
// user's recent expenses, does it pick the right one, and does it ASK when it can't be sure?
// A confident wrong pick is the failure that matters (it quietly edits the wrong IRS record).
//
//   npm run eval:context            (HAIKU_MODEL=claude-haiku-5-5 npm run eval:context for 5.5)
//
// No DB: receipts are built in memory. pickReceiptForContext swallows API errors into "ask", so a
// 429 would masquerade as a correct ASK. We pace under the 50/min cap AND count context_pick_failed
// warnings; any failure invalidates the run.

import { pickReceiptForContext } from '../../src/lib/context-match';
import { HAIKU_MODEL } from '../../src/lib/claude';
import { CASES, NOW } from './context-cases';

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function main() {
  let pickFailures = 0;
  const warn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (args.some((a) => String(a).includes('context_pick_failed'))) pickFailures++;
    warn(...args);
  };

  console.log(`\n# Late-context picker eval (live ${HAIKU_MODEL})\n`);
  console.log('| id | expected | got | ✓ |\n| --- | --- | --- | --- |');
  let passed = 0;
  for (const c of CASES) {
    const pick = await pickReceiptForContext(c.text, c.rows, NOW);
    const got = pick.match ?? `ASK [${pick.shortlist.join(',')}]`;
    const ok = c.expect === 'ASK'
      ? pick.match === null && (c.mustShortlist ?? []).every((id) => pick.shortlist.includes(id))
      : pick.match === c.expect;
    if (ok) passed++;
    console.log(`| ${c.id} | ${c.expect}${c.mustShortlist ? ` [${c.mustShortlist.join(',')}]` : ''} | ${got} | ${ok ? '✓' : '✗'} |`);
    await sleep(1400);
  }
  console.log(`\n## Headline\n${passed}/${CASES.length} passed`);
  if (pickFailures > 0) {
    console.log(`INVALID RUN: ${pickFailures} picker call(s) failed (API error / rate limit); ASK results are not trustworthy.`);
    process.exitCode = 1;
  }
}

main();
