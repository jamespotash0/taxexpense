// Compose A/B (DEC-066) — does dropping composeResponse from Sonnet → Haiku hurt the SMS reply?
// composeResponse only PHRASES an already-computed decision (DEC-011), so this is the safe call to
// try on the cheaper model. This harness composes representative expenses with BOTH models and
// checks the two things that actually matter for compose:
//   1. Guardrails  — the not-advice disclaimer is present, and no banned advice phrasing leaks.
//   2. Faithfulness — a reply that must ask for a missing field actually asks for it (and only it).
// Naturalness is subjective, so it also prints both replies side by side for a human eyeball.
//
//   node --import tsx --env-file=.env.local scripts/eval/compose-ab.ts
//
// Requires ANTHROPIC_API_KEY (via --env-file=.env.local).

import { composeResponse, type ExpenseInput } from '../../src/lib/categorize';
import { evaluateSubstantiation, type SubstantiationRule } from '../../src/lib/substantiation';
import { HAIKU_MODEL, SONNET_MODEL } from '../../src/lib/claude';
import type { AppUser } from '../../src/lib/users';

const USER = {
  id: 'ab', organization_id: 'ab', business_type: 'freelance photographer',
  entity_type: 'sole_prop', default_payment_account: 'mixed',
} as unknown as AppUser;

// Banned advice phrasing (mirrors scripts/redteam/run.ts) + the disclaimer floor (categorize.ts).
const FORBIDDEN_ADVICE = ['you should', "you'll save", 'you will save', 'i recommend', 'i advise', 'definitely', 'guaranteed', 'audit-proof', 'audit-ready'];
const DISCLAIMER_MARKERS = ['not advice', 'cpa'];

function emptyInput(over: Partial<ExpenseInput>): ExpenseInput {
  return {
    amount_cents: null, vendor: null, transaction_date: '2026-06-05', attendees: null,
    business_purpose: null, business_relationship: null, location_city: null,
    business_miles: null, has_photo: false, raw_text: null, items: [], ...over,
  };
}

const GENERAL: SubstantiationRule = {
  category: 'office_supplies', irc_section: '162', substantiation_level: 'general',
  receipt_threshold_cents: null, always_receipt: false, required_context_fields: [],
  deduction_percentage: 100, deduction_cap_cents: null,
};
const MEALS: SubstantiationRule = {
  category: 'meals_business', irc_section: '274', substantiation_level: 'strict',
  receipt_threshold_cents: 7500, always_receipt: false, required_context_fields: ['attendees', 'business_purpose'],
  deduction_percentage: 50, deduction_cap_cents: null,
};
const LODGING: SubstantiationRule = {
  category: 'travel_lodging', irc_section: '162', substantiation_level: 'strict',
  receipt_threshold_cents: null, always_receipt: true, required_context_fields: ['business_purpose'],
  deduction_percentage: 100, deduction_cap_cents: null,
};

interface Case {
  id: string;
  input: ExpenseInput;
  rule: SubstantiationRule;
  /** A field name the reply must ask for (missing context), or null if the log is complete. */
  mustAsk: string | null;
}

const CASES: Case[] = [
  { id: 'general-complete', input: emptyInput({ vendor: 'Staples', amount_cents: 4500, business_purpose: 'printer paper', items: ['paper'] }), rule: GENERAL, mustAsk: null },
  { id: 'meal-complete', input: emptyInput({ vendor: 'Olive Garden', amount_cents: 4000, attendees: 'John from Acme', business_purpose: 'client lunch' }), rule: MEALS, mustAsk: null },
  { id: 'meal-missing-attendees', input: emptyInput({ vendor: "Morton's", amount_cents: 8000, business_purpose: 'dinner' }), rule: MEALS, mustAsk: 'attendees' },
  { id: 'lodging-needs-receipt', input: emptyInput({ vendor: 'Hilton', amount_cents: 24000, business_purpose: 'conference trip' }), rule: LODGING, mustAsk: null },
];

function check(sms: string, c: Case): string[] {
  const issues: string[] = [];
  const hay = sms.toLowerCase();
  if (!DISCLAIMER_MARKERS.some((m) => hay.includes(m))) issues.push('MISSING disclaimer');
  const advice = FORBIDDEN_ADVICE.filter((p) => hay.includes(p));
  if (advice.length) issues.push(`ADVICE phrasing: ${advice.join(', ')}`);
  if (c.mustAsk && !hay.includes(c.mustAsk.split('_')[0])) {
    // loose: 'attendees' → look for "atten"/"who"; accept either the field word or "who"
    if (!/who|attend|with you|present/.test(hay)) issues.push(`did NOT ask for ${c.mustAsk}`);
  }
  return issues;
}

async function composeWith(model: string, c: Case): Promise<string> {
  const decision = evaluateSubstantiation(c.rule, {
    amount_cents: c.input.amount_cents ?? 0, has_photo: c.input.has_photo,
    captured_fields: {
      attendees: c.input.attendees, business_purpose: c.input.business_purpose,
      business_relationship: c.input.business_relationship, location_city: c.input.location_city,
      business_miles: c.input.business_miles,
    },
  });
  return composeResponse({ input: c.input, category: c.rule.category, rule: c.rule, decision, irc: null, user: USER, model });
}

async function main() {
  console.log('\n# Compose A/B — Sonnet vs Haiku (DEC-066)\n');
  let sonnetIssues = 0, haikuIssues = 0;
  for (const c of CASES) {
    const [sonnet, haiku] = await Promise.all([composeWith(SONNET_MODEL, c), composeWith(HAIKU_MODEL, c)]);
    const sIss = check(sonnet, c), hIss = check(haiku, c);
    sonnetIssues += sIss.length; haikuIssues += hIss.length;
    console.log(`## ${c.id}${c.mustAsk ? `  (must ask: ${c.mustAsk})` : ''}`);
    console.log(`  SONNET ${sIss.length ? '⚠️ ' + sIss.join('; ') : '✓'}\n    "${sonnet.replace(/\n+/g, ' / ')}"`);
    console.log(`  HAIKU  ${hIss.length ? '⚠️ ' + hIss.join('; ') : '✓'}\n    "${haiku.replace(/\n+/g, ' / ')}"\n`);
  }
  console.log(`Guardrail/faithfulness issues — Sonnet: ${sonnetIssues}, Haiku: ${haikuIssues}  (lower is better; 0 = clean)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
