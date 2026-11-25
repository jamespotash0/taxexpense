// Second-opinion eval: does sending uncertain categories to the stronger model help, and at
// what confidence cutoff? Runs Haiku (production first pass) on every case, then the second
// opinion on every case below 0.9 so lower cutoffs can be simulated from one run.
// Real API calls (~$0.5-1/run). Sequential to stay under the Haiku rate limit.
//
//   HAIKU_MODEL=claude-haiku-5-5 node --import tsx --env-file=.env.local scripts/eval/second-opinion.ts

import { categorizeExpense, secondOpinionCategory } from '../../src/lib/categorize';
import { HAIKU_MODEL, OPUS_MODEL } from '../../src/lib/claude';
import type { AppUser } from '../../src/lib/users';
import { DATASET, buildInput } from './dataset';

const USER = {
  id: 'eval-user',
  organization_id: 'eval-org',
  business_type: 'freelance photographer',
  entity_type: 'sole_prop',
  default_payment_account: 'mixed',
} as unknown as AppUser;

async function main() {
const rows: { expected: string; first: string; conf: number; second: string | null; secondConf: number | null }[] = [];
for (const c of DATASET) {
  const input = buildInput(c.input);
  const first = await categorizeExpense(input, USER).catch(() => null);
  const conf = first?.confidence ?? 0;
  const second = conf < 0.9 ? await secondOpinionCategory(input, USER) : null;
  rows.push({ expected: c.expected, first: first?.category ?? 'ERROR', conf, second: second?.category ?? null, secondConf: second?.confidence ?? null });
  process.stdout.write('.');
}

console.log(`\n\nFirst pass: ${HAIKU_MODEL} · second opinion: ${OPUS_MODEL} · ${rows.length} cases\n`);
console.log('| Cutoff | Escalated | Accuracy | Wrong |');
console.log('|---|---|---|---|');
for (const cutoff of [0, 0.6, 0.7, 0.8, 0.9]) {
  let right = 0, escalated = 0;
  for (const r of rows) {
    const useSecond = r.conf < cutoff && r.second != null;
    if (useSecond) escalated++;
    if ((useSecond ? r.second : r.first) === r.expected) right++;
  }
  console.log(`| ${cutoff === 0 ? 'none' : `< ${cutoff}`} | ${escalated} | ${right}/${rows.length} | ${rows.length - right} |`);
}
console.log('\nCases below 0.9:');
for (const r of rows.filter((r) => r.conf < 0.9)) {
  console.log(`  ${r.expected.padEnd(22)} haiku=${r.first} (${r.conf.toFixed(2)})  opus=${r.second} (${r.secondConf?.toFixed(2) ?? '-'})`);
}
}

main().catch((e) => { console.error(e); process.exit(1); });
