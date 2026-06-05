// Prompt-caching audit (EMPIRICAL). For each system prompt, makes two back-to-back live calls
// with cache_control on, and reports whether the 2nd call actually READ from cache. Live usage is
// the source of truth — static "minimum cacheable prefix" tables are conservative and can be wrong.
//   npm run cache:check   (needs ANTHROPIC_API_KEY via .env.local)

import { getClaude, HAIKU_MODEL, SONNET_MODEL } from '../../src/lib/claude';
import * as P from '../../src/lib/prompts';

const PROMPTS: Array<{ name: string; model: string; text: string }> = [
  { name: 'RECEIPT_EXTRACTION_PROMPT', model: HAIKU_MODEL, text: P.RECEIPT_EXTRACTION_PROMPT },
  { name: 'TEXT_EXPENSE_PARSE_PROMPT', model: HAIKU_MODEL, text: P.TEXT_EXPENSE_PARSE_PROMPT },
  { name: 'CATEGORIZATION_HELPER_PROMPT', model: HAIKU_MODEL, text: P.CATEGORIZATION_HELPER_PROMPT },
  { name: 'TEXT_PARSE_CATEGORIZE_PROMPT', model: HAIKU_MODEL, text: P.TEXT_PARSE_CATEGORIZE_PROMPT },
  { name: 'RECEIPT_EXTRACT_CATEGORIZE_PROMPT', model: HAIKU_MODEL, text: P.RECEIPT_EXTRACT_CATEGORIZE_PROMPT },
  { name: 'CATEGORIZATION_RESPONSE_PROMPT', model: SONNET_MODEL, text: P.CATEGORIZATION_RESPONSE_PROMPT },
  { name: 'CLARIFICATION_PROMPT', model: SONNET_MODEL, text: P.CLARIFICATION_PROMPT },
  { name: 'CORRECTION_PROMPT', model: SONNET_MODEL, text: P.CORRECTION_PROMPT },
  { name: 'RECEIPT_ATTACHMENT_PROMPT', model: SONNET_MODEL, text: P.RECEIPT_ATTACHMENT_PROMPT },
];

interface Usage {
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  input_tokens: number;
}

async function call(model: string, system: string): Promise<Usage> {
  const r = await getClaude().messages.create({
    model,
    max_tokens: 1,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: 'ping' }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  return r.usage as Usage;
}

async function main() {
  console.log('\nEmpirical prompt-caching audit — two back-to-back calls per prompt\n');
  console.log(`${'prompt'.padEnd(36)} ${'model'.padEnd(10)} prefix  read?  (write→read)`);
  for (const p of PROMPTS) {
    const u1 = await call(p.model, p.text); // writes
    const u2 = await call(p.model, p.text); // should read
    const read = u2.cache_read_input_tokens ?? 0;
    const wrote = u1.cache_creation_input_tokens ?? 0;
    const model = p.model.includes('haiku') ? 'haiku-4.5' : 'sonnet-4.6';
    const caches = read > 0;
    console.log(
      `${p.name.padEnd(36)} ${model.padEnd(10)} ${String(wrote || u1.input_tokens).padStart(5)}  ${caches ? '✅ yes' : '❌ NO '}  (${wrote}→${read})`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
