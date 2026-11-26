// Turn-interpreter replay eval (spec: claude_files/specs/turn-interpreter.md). Grades the LIVE Haiku
// decision on: the hand-written replay cases (turns-cases.ts), plus every intent and context-match
// eval case, ported. The failure that matters most is a WRONG-TARGET EDIT (it quietly changes the
// wrong IRS record), so it's counted on its own.
//
//   HAIKU_MODEL=claude-haiku-5-5 npm run eval:turns
//
// interpretTurn never throws; a failed call comes back with fallback:true. Those are rate limits or
// API errors, not misroutes, so they're reported separately and invalidate the run.

import { interpretTurn, type TurnDecision } from '../../src/lib/turn';
import { HAIKU_MODEL } from '../../src/lib/claude';
import type { Intent } from '../../src/lib/router';
import { TURN_CASES, NONE, ctxOf, rcpt, type TurnCase } from './turns-cases';
import { CASES as INTENT_CASES, ADVERSARIAL, type IntentCase } from './intent-cases';
import { CASES as CONTEXT_CASES } from './context-cases';

const GAP_MS = 1300; // ≈46 req/min, under the 50/min Haiku cap

type Graded = { id: string; tags: string; ok: boolean; wrongTarget: boolean; fallback: boolean; expect: string; got: string };

/** View a decision through the old Intent shape so ported intent checks apply unchanged. */
function asIntent(d: TurnDecision): Intent {
  switch (d.action) {
    case 'new_expense': return { kind: 'capture' };
    case 'edit_expense': return { kind: 'context_statement' };
    case 'answer_open_question':
      return d.resolution ? { kind: 'receipt_resolution', resolution: d.resolution } : { kind: 'context_statement' };
    case 'receipt_resolution': return { kind: 'receipt_resolution', resolution: d.resolution ?? 'later' };
    case 'query': return d.query ? { kind: 'query', ...d.query } : { kind: 'help' };
    case 'command': return d.command ? { kind: 'command', command: d.command } : { kind: 'help' };
    case 'explain_why': return { kind: 'help' };
    default: return { kind: d.action };
  }
}

const describe = (d: TurnDecision) =>
  [d.action, d.receiptId && `→${d.receiptId}`, d.answer, d.resolution, d.candidates.length ? `[${d.candidates.join(',')}]` : ''].filter(Boolean).join(' ');

// A recent meal + gas so ported "that lunch was with a client" style cases have something to edit.
const DEFAULT_RECEIPTS = [rcpt('lunch', 'Chipotle', 24, 'meals_business', 12), rcpt('gas', 'Shell', 42, 'vehicle_business', 180)];

function portIntent(c: IntentCase): { id: string; tags: string; run: () => Promise<Graded> } {
  const receipts = c.ctx?.awaitingReceipt ? [rcpt('flagged', 'Marriott', 230, 'travel_lodging', 3), ...DEFAULT_RECEIPTS] : DEFAULT_RECEIPTS;
  const open = c.ctx?.awaitingReceipt
    ? { ...NONE, question: { receiptId: 'flagged', contextState: 'awaiting_receipt' as const, questionText: 'Mind snapping a photo of the receipt?' } }
    : NONE;
  const ctx = ctxOf({ receipts, open, flaggedCount: c.ctx?.flaggedCount ?? 0 });
  return {
    id: `intent:${c.id}`,
    tags: c.tags.join(','),
    run: async () => {
      const d = await interpretTurn(c.text, ctx, new Date());
      return { id: `intent:${c.id}`, tags: c.tags.join(','), ok: c.check(asIntent(d)), wrongTarget: false, fallback: d.fallback, expect: c.expect, got: describe(d) };
    },
  };
}

function portContext(c: (typeof CONTEXT_CASES)[number]): { id: string; tags: string; run: () => Promise<Graded> } {
  const tc: TurnCase = {
    id: `context:${c.id}`,
    ctx: ctxOf({ receipts: c.rows }),
    text: c.text,
    expect: { action: 'edit_expense', receiptId: c.expect === 'ASK' ? null : c.expect, mustCandidates: c.mustShortlist },
    tags: ['edge'],
  };
  return wrap(tc);
}

function grade(c: TurnCase, d: TurnDecision & { fallback: boolean }): Graded {
  const e = c.expect;
  let ok = d.action === e.action;
  if (ok && e.receiptId !== undefined) ok = d.receiptId === e.receiptId;
  if (ok && e.answer) ok = d.answer === e.answer;
  if (ok && e.resolution) ok = d.resolution === e.resolution;
  if (ok && e.mustCandidates) ok = e.mustCandidates.every((id) => d.candidates.includes(id));
  // Wrong-target: an edit applied to an expense other than the expected one (or when we expected ASK).
  const wrongTarget = d.action === 'edit_expense' && d.receiptId !== null && e.receiptId !== undefined && d.receiptId !== e.receiptId;
  const want = [e.action, e.receiptId === null ? 'ASK' : e.receiptId && `→${e.receiptId}`, e.answer, e.resolution].filter(Boolean).join(' ');
  return { id: c.id, tags: c.tags.join(','), ok, wrongTarget, fallback: d.fallback, expect: want, got: describe(d) };
}

function wrap(c: TurnCase) {
  return { id: c.id, tags: c.tags.join(','), run: async () => grade(c, await interpretTurn(c.text, c.ctx, new Date())) };
}

async function main() {
  const jobs = [...TURN_CASES.map(wrap), ...[...INTENT_CASES, ...ADVERSARIAL].map(portIntent), ...CONTEXT_CASES.map(portContext)];
  const only = process.argv[2];
  const selected = only ? jobs.filter((j) => j.id.includes(only)) : jobs;
  console.log(`Running ${selected.length} turn cases on ${HAIKU_MODEL}...\n`);

  const results: Graded[] = [];
  for (const j of selected) {
    results.push(await j.run());
    await new Promise((r) => setTimeout(r, GAP_MS));
  }

  for (const r of results) {
    const mark = r.fallback ? '!' : r.tags.includes('ambiguous') ? (r.ok ? '≈' : '~') : r.ok ? '✓' : '✗';
    if (mark !== '✓' && mark !== '≈') console.log(`  ${mark} ${r.id.padEnd(34)} want ${r.expect.padEnd(28)} got ${r.got}`);
  }
  const scored = results.filter((r) => !r.tags.includes('ambiguous') && !r.fallback);
  const passed = scored.filter((r) => r.ok).length;
  const wrong = results.filter((r) => r.wrongTarget).length;
  const fallbacks = results.filter((r) => r.fallback).length;
  console.log(`\nScored (excl. ambiguous): ${passed}/${scored.length}`);
  console.log(`Wrong-target edits:       ${wrong}`);
  console.log(`API failures (fallback):  ${fallbacks}${fallbacks ? '  ← run invalid, re-run' : ''}`);
  process.exitCode = passed === scored.length && wrong === 0 && fallbacks === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
