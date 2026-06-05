// Prompt-caching audit: measures each system prompt's token count and checks it against the
// model's MINIMUM cacheable prefix. Below the minimum, cache_control is silently ignored
// (cache_creation_input_tokens=0, no error) — so `cacheSystem: true` is a no-op.
//   Sonnet 4.6 min = 2048 tokens · Haiku 4.5 min = 4096 tokens.
//   npm run cache:check   (needs ANTHROPIC_API_KEY via .env.local)

import { getClaude, HAIKU_MODEL, SONNET_MODEL } from '../../src/lib/claude';
import * as P from '../../src/lib/prompts';

const MIN: Record<string, number> = { [HAIKU_MODEL]: 4096, [SONNET_MODEL]: 2048 };

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

async function tokens(model: string, system: string): Promise<number> {
  const r = await getClaude().messages.countTokens({
    model,
    system: [{ type: 'text', text: system }],
    messages: [{ role: 'user', content: 'x' }],
  });
  return r.input_tokens;
}

async function main() {
  console.log('\nPrompt-caching prefix audit (system-prompt tokens vs model minimum)\n');
  console.log(`${'prompt'.padEnd(36)} ${'model'.padEnd(10)} tokens  min   caches?`);
  for (const p of PROMPTS) {
    const t = await tokens(p.model, p.text);
    const min = MIN[p.model];
    const model = p.model.includes('haiku') ? 'haiku-4.5' : 'sonnet-4.6';
    const ok = t >= min;
    console.log(`${p.name.padEnd(36)} ${model.padEnd(10)} ${String(t).padStart(5)}  ${String(min).padStart(4)}  ${ok ? '✅ yes' : '❌ NO (silent)'}`);
  }
  console.log('\nNote: ~5 of these tokens are the placeholder user turn, not the system prefix.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
