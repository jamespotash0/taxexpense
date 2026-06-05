// Image categorization eval — grades the PHOTO path end-to-end: the production
// extractAndCategorizeReceiptFromImageData() (src/lib/ocr.ts, RECEIPT_EXTRACT_CATEGORIZE_PROMPT /
// Haiku Vision) PLUS the deterministic substantiation tree it feeds. This is the only eval that
// covers DEC-068 (a photographed receipt is a business-intent signal) — run.ts/merged.ts feed text.
//
// For each committed fixture it asserts (a) the category the model returns and (b) the resulting
// substantiation STATE — i.e. whether Tally would actually ask for the WHY. (b) is computed by the
// REAL evaluateSubstantiation(); only the rule DATA is inlined below (mirrors the seed) so the eval
// stays dependency-free — Haiku only, no DB — like the other harnesses.
//
//   npm run eval:image
//
// Requires ANTHROPIC_API_KEY (loaded via --env-file=.env.local in the npm script).
// Regenerate the fixtures with: node --import tsx scripts/eval/fixtures/gen-receipts.ts

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { extractAndCategorizeReceiptFromImageData } from '../../src/lib/ocr';
import { evaluateSubstantiation, type SubstantiationRule } from '../../src/lib/substantiation';
import type { AppUser } from '../../src/lib/users';
import { IMAGE_DATASET, type ImageCase } from './image-dataset';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures');

// Same fixed user as the other evals so we measure the prompt, not user variance.
const TEST_USER = {
  id: 'eval-user',
  organization_id: 'eval-org',
  business_type: 'freelance photographer',
  entity_type: 'sole_prop',
  default_payment_account: 'mixed',
} as unknown as AppUser;

// Substantiation rules for the categories under test — mirror supabase/migrations/
// 0002_seed_substantiation_rules.sql (source of truth). Inlined to keep the eval DB-free; the
// LOGIC that consumes them is the real production evaluateSubstantiation().
const RULES: Record<string, SubstantiationRule> = {
  meals_business: { category: 'meals_business', irc_section: '274', substantiation_level: 'strict', receipt_threshold_cents: 7500, always_receipt: false, required_context_fields: ['attendees', 'business_purpose'], deduction_percentage: 50, deduction_cap_cents: null },
  travel_lodging: { category: 'travel_lodging', irc_section: '162', substantiation_level: 'strict', receipt_threshold_cents: 0, always_receipt: true, required_context_fields: ['business_purpose'], deduction_percentage: 100, deduction_cap_cents: null },
  travel_transportation: { category: 'travel_transportation', irc_section: '162', substantiation_level: 'strict', receipt_threshold_cents: 7500, always_receipt: false, required_context_fields: ['business_purpose'], deduction_percentage: 100, deduction_cap_cents: null },
  personal: { category: 'personal', irc_section: '262', substantiation_level: 'general', receipt_threshold_cents: null, always_receipt: false, required_context_fields: [], deduction_percentage: 0, deduction_cap_cents: null },
  office_supplies: { category: 'office_supplies', irc_section: '162', substantiation_level: 'general', receipt_threshold_cents: null, always_receipt: false, required_context_fields: [], deduction_percentage: 100, deduction_cap_cents: null },
};

type State = 'awaiting_context' | 'awaiting_receipt' | 'complete';

interface Outcome {
  c: ImageCase;
  got: string;
  confidence: number;
  state: State | 'n/a';
  missing: string[];
  catOk: boolean;
  stateOk: boolean;
  missingOk: boolean;
  error?: string;
}

/** Mirror of nextContextState() in src/lib/expense.ts (kept tiny + local). */
function toState(needsReceipt: boolean, missing: string[]): State {
  if (missing.length > 0) return 'awaiting_context';
  if (needsReceipt) return 'awaiting_receipt';
  return 'complete';
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
}

async function grade(c: ImageCase): Promise<Outcome> {
  const base: Outcome = { c, got: '', confidence: 0, state: 'n/a', missing: [], catOk: false, stateOk: false, missingOk: true };
  try {
    const buffer = readFileSync(join(fixtureDir, c.file));
    const { ocr, category } = await extractAndCategorizeReceiptFromImageData(buffer, 'image/png', TEST_USER, c.caption);
    if (!ocr.ok || !category) {
      return { ...base, got: ocr.ok ? 'NO_CATEGORY' : `OCR_${ocr.error}`, error: 'not a usable receipt' };
    }
    const got = category.category;
    const catOk = got === c.expectedCategory;

    // Replicate the production photo input mapping (ocrToInput in sms-handler.ts): the photo gives
    // has_photo + amount; the caption flows into business_purpose; attendees stay unset.
    const rule = RULES[got];
    let state: State | 'n/a' = 'n/a';
    let missing: string[] = [];
    if (rule) {
      const decision = evaluateSubstantiation(rule, {
        amount_cents: ocr.data.total_amount != null ? Math.round(ocr.data.total_amount * 100) : 0,
        has_photo: true,
        captured_fields: {
          attendees: null,
          business_purpose: c.caption.trim() || null,
          business_relationship: null,
          location_city: null,
          business_miles: null,
        },
      });
      missing = decision.missing_context_fields;
      state = toState(decision.needs_receipt, missing);
    }

    const stateOk = state === c.expectedState;
    const missingOk = c.expectedMissing ? sameSet(missing, c.expectedMissing) : true;
    return { ...base, got, confidence: category.confidence, state, missing, catOk, stateOk, missingOk };
  } catch (err) {
    return { ...base, got: 'ERROR', error: err instanceof Error ? err.message : 'unknown' };
  }
}

async function main() {
  console.log(`Running ${IMAGE_DATASET.length} image cases (live Haiku Vision, real receipt PNGs)...\n`);
  // Sequential — small set, and keeps Vision calls gentle.
  const results: Outcome[] = [];
  for (const c of IMAGE_DATASET) results.push(await grade(c));

  for (const o of results) {
    const pass = o.catOk && o.stateOk && o.missingOk;
    const mark = pass ? '✓' : '✗';
    const detail: string[] = [];
    if (!o.catOk) detail.push(`cat: expected ${o.c.expectedCategory}, got ${o.got}`);
    if (!o.stateOk) detail.push(`state: expected ${o.c.expectedState}, got ${o.state}`);
    if (!o.missingOk) detail.push(`missing: expected [${o.c.expectedMissing}], got [${o.missing}]`);
    if (o.error) detail.push(o.error);
    const asks = o.state === 'awaiting_context' ? `asks: ${o.missing.join('+') || '—'}` : o.state;
    console.log(
      `  ${mark} ${o.c.id.padEnd(22)} ${o.got.padEnd(22)} conf ${o.confidence.toFixed(2)}  ${asks.padEnd(26)} ${detail.join(' | ')}`,
    );
  }

  const pass = results.filter((o) => o.catOk && o.stateOk && o.missingOk).length;
  const catPass = results.filter((o) => o.catOk).length;
  console.log(`\nCategory:        ${catPass}/${results.length}`);
  console.log(`Full (cat+state): ${pass}/${results.length}`);
  if (pass < results.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
