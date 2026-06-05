// Multi-turn conversation eval (DEC-064) — grades the LLM-dependent halves of the conversation
// state machine that the unit tests can't reach:
//   1. CORRECTION_PROMPT  — post-log edits: recategorize, fix the amount, add context.
//   2. parseAndCategorizeText — the awaiting_amount "combined re-parse" (priorText + the reply).
//
// The deterministic routing gates (replyStartsNewExpense / looksLikeCorrection) are unit-tested in
// src/lib/sms-handler.test.ts; this harness measures whether the model actually does the right
// thing once a message is routed to a correction or an amount-completion.
//
//   npm run eval:conversation
//
// Requires ANTHROPIC_API_KEY (loaded via --env-file=.env.local in the npm script).

import { claudeJSON } from '../../src/lib/llm';
import { SONNET_MODEL } from '../../src/lib/claude';
import { CORRECTION_PROMPT } from '../../src/lib/prompts';
import { parseAndCategorizeText } from '../../src/lib/ocr';
import type { AppUser } from '../../src/lib/users';

const TEST_USER = {
  id: 'eval-user',
  organization_id: 'eval-org',
  business_type: 'freelance photographer',
  entity_type: 'sole_prop',
  default_payment_account: 'mixed',
} as unknown as AppUser;

// A synthetic just-logged receipt the correction acts on.
interface ReceiptLike {
  vendor: string | null;
  amount: number; // dollars
  category: string;
  attendees?: string | null;
  business_purpose?: string | null;
}

interface CorrectionResult {
  updates?: {
    amount?: number | null;
    business_purpose?: string | null;
    attendees?: string | null;
    business_relationship?: string | null;
    location_city?: string | null;
    business_miles?: number | null;
    payment_account?: string | null;
  };
  category_change_needed?: boolean;
  new_category?: string | null;
  confirmation_message?: string;
}

// Mirrors the userText built in processCorrection (src/lib/expense.ts). Keep in sync if that changes.
function correctionUserText(r: ReceiptLike, userMessage: string): string {
  return [
    `## Just-Logged Receipt (the one being corrected)`,
    JSON.stringify(
      {
        vendor: r.vendor,
        amount: r.amount,
        category: r.category,
        attendees: r.attendees ?? null,
        business_purpose: r.business_purpose ?? null,
        business_relationship: null,
        business_miles: null,
      },
      null,
      2,
    ),
    `## User's Correction\n${userMessage}`,
  ].join('\n\n');
}

type Check = (r: CorrectionResult) => boolean;

interface CorrectionCase {
  id: string;
  receipt: ReceiptLike;
  message: string;
  expect: string; // human-readable expectation, for the report
  check: Check;
}

const oneOf = (cats: string[]): Check => (r) =>
  r.category_change_needed === true && !!r.new_category && cats.includes(r.new_category);
const noCategoryChange: Check = (r) => r.category_change_needed !== true;
const amountIs = (dollars: number): Check => (r) =>
  typeof r.updates?.amount === 'number' && Math.abs(r.updates.amount - dollars) < 0.01;
const amountUnchanged: Check = (r) => r.updates?.amount == null;

const CORRECTION_CASES: CorrectionCase[] = [
  {
    id: 'restaurant-recat',
    receipt: { vendor: 'Tablenacle', amount: 167, category: 'venue_rental', business_purpose: 'interview meeting' },
    message: 'Tabernacle is a restaurant',
    expect: 'recategorize venue_rental → a meal',
    check: oneOf(['meals_business', 'meals', 'personal']),
  },
  {
    id: 'business-meal-recat',
    receipt: { vendor: 'Tabernacle', amount: 167, category: 'venue_rental' },
    message: 'it was a business meal',
    expect: 'recategorize → meals_business',
    check: oneOf(['meals_business', 'meals']),
  },
  {
    id: 'mark-personal',
    receipt: { vendor: 'ShopRite', amount: 35, category: 'office_supplies' },
    message: 'actually that was personal, not for the business',
    expect: 'recategorize → personal',
    check: oneOf(['personal']),
  },
  {
    id: 'amount-fix-actually',
    receipt: { vendor: 'Adobe', amount: 167, category: 'software' },
    message: 'actually it was $200',
    expect: 'amount → $200, category unchanged',
    check: (r) => amountIs(200)(r) && noCategoryChange(r),
  },
  {
    id: 'amount-fix-makeit',
    receipt: { vendor: 'Adobe', amount: 167, category: 'software' },
    message: 'make it $200',
    expect: 'amount → $200',
    check: amountIs(200),
  },
  {
    id: 'amount-fix-notxy',
    receipt: { vendor: 'Adobe', amount: 167, category: 'software' },
    message: 'should be $200 not $167',
    expect: 'amount → $200',
    check: amountIs(200),
  },
  {
    id: 'add-attendees',
    receipt: { vendor: 'Olive Garden', amount: 60, category: 'meals_business', business_purpose: 'client lunch' },
    message: 'add John and Sarah from Acme',
    expect: 'attendees captured, no category change, amount unchanged',
    check: (r) => !!r.updates?.attendees && noCategoryChange(r) && amountUnchanged(r),
  },
];

// The awaiting_amount "combined re-parse": priorText + the user's amount reply → one parse.
interface ReparseCase {
  id: string;
  combined: string;
  expectAmount: number; // dollars
  expectCategoryOneOf?: string[];
}

const REPARSE_CASES: ReparseCase[] = [
  { id: 'tabernacle-167', combined: 'Tabernacle is a restaurant $167', expectAmount: 167 },
  { id: 'client-lunch-45', combined: 'lunch with a client $45', expectAmount: 45, expectCategoryOneOf: ['meals_business', 'meals'] },
  { id: 'gas-50', combined: 'gas to the client site $50', expectAmount: 50, expectCategoryOneOf: ['vehicle_business'] },
];

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

function pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(0)}%`;
}

async function gradeCorrection(c: CorrectionCase): Promise<{ id: string; ok: boolean; detail: string }> {
  try {
    const r = await claudeJSON<CorrectionResult>({
      model: SONNET_MODEL,
      system: CORRECTION_PROMPT,
      userText: correctionUserText(c.receipt, c.message),
      cacheSystem: true,
      maxTokens: 512,
    });
    const ok = c.check(r);
    const got = `change=${r.category_change_needed ?? false} new=${r.new_category ?? '-'} amount=${r.updates?.amount ?? '-'}`;
    return { id: c.id, ok, detail: ok ? '' : `want ${c.expect}; got ${got}` };
  } catch (err) {
    return { id: c.id, ok: false, detail: `ERROR ${err instanceof Error ? err.message : 'unknown'}` };
  }
}

async function gradeReparse(c: ReparseCase): Promise<{ id: string; ok: boolean; detail: string }> {
  try {
    const { parsed, category } = await parseAndCategorizeText(c.combined, TEST_USER);
    const amountOk = parsed.amount != null && Math.abs(parsed.amount - c.expectAmount) < 0.01;
    const catOk = !c.expectCategoryOneOf || c.expectCategoryOneOf.includes(category.category);
    const ok = amountOk && catOk;
    return { id: c.id, ok, detail: ok ? '' : `want $${c.expectAmount}${c.expectCategoryOneOf ? `/${c.expectCategoryOneOf.join('|')}` : ''}; got $${parsed.amount ?? '-'}/${category.category}` };
  } catch (err) {
    return { id: c.id, ok: false, detail: `ERROR ${err instanceof Error ? err.message : 'unknown'}` };
  }
}

async function main() {
  console.log(`\n# Conversation eval (live Sonnet/Haiku) — DEC-064\n`);

  console.log(`## Corrections (${CORRECTION_CASES.length} cases — CORRECTION_PROMPT)`);
  const corr = await pool(CORRECTION_CASES, 4, gradeCorrection);
  for (const o of corr) console.log(`  ${o.ok ? '✓' : '✗'} ${o.id.padEnd(22)} ${o.detail}`);

  console.log(`\n## Amount completion (${REPARSE_CASES.length} cases — combined re-parse)`);
  const rep = await pool(REPARSE_CASES, 3, gradeReparse);
  for (const o of rep) console.log(`  ${o.ok ? '✓' : '✗'} ${o.id.padEnd(22)} ${o.detail}`);

  const all = [...corr, ...rep];
  const passed = all.filter((o) => o.ok).length;
  console.log(`\nOverall: ${pct(passed, all.length)}  (${passed}/${all.length})`);
  if (passed < all.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
