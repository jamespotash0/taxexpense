// Smoke test for the month-end review agent's LOOP (src/lib/agent.ts) against the LIVE
// Anthropic API. Backs the tools with in-memory fake receipts so it needs NO Supabase /
// migration / auth — it proves the agent actually fires: drives tool calls, inspects a
// receipt photo via vision, and terminates by calling finish_review.
//
//   npm run agent:smoke      (node --import tsx --env-file=.env.local scripts/agent-smoke.ts)
//
// NOTE: this exercises the loop + the real system prompt + the real tool SCHEMAS. The
// production tool HANDLERS (agent-tools.ts) hit Supabase and are tested separately.

import { deflateSync } from 'node:zlib';
import { runAgent, type AgentTool } from '../src/lib/agent';
import { MONTH_END_REVIEW_AGENT_PROMPT } from '../src/lib/prompts';
import { SONNET_MODEL } from '../src/lib/claude';

// Build a valid solid-color PNG of real dimensions so the live vision API accepts it
// (a 1x1 image is rejected as "could not process"). Dependency-free PNG encoder.
function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const typeData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(typeData));
  return Buffer.concat([len, typeData, crc]);
}
function solidPng(size = 64): string {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, truecolor RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, 0xcc)]); // filter 0 + gray pixels
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
  return png.toString('base64');
}
const TINY_PNG = solidPng();

// Fake month with deliberate triage work: a >$75 strict-category expense with no receipt,
// a low-confidence categorization, and a clean one the agent should leave alone.
const FAKE = [
  { id: 'r1', date: '2026-05-03', vendor: 'The Smith', amount: '$142.00', category: 'meals_business', irc_section: '§274(n)', has_photo: false, needs_receipt: true, needs_review: false, review_reason: null, substantiation_complete: false, missing_fields: ['business_purpose'], flagged_for_cpa: false },
  { id: 'r2', date: '2026-05-09', vendor: 'Staples', amount: '$38.50', category: 'office_supplies', irc_section: '§162', has_photo: true, needs_receipt: false, needs_review: false, review_reason: null, substantiation_complete: true, missing_fields: [], flagged_for_cpa: false },
  { id: 'r3', date: '2026-05-14', vendor: 'Delta Air Lines', amount: '$310.00', category: 'meals_business', irc_section: '§274(n)', has_photo: true, needs_receipt: false, needs_review: true, review_reason: 'low_confidence_category', substantiation_complete: true, missing_fields: [], flagged_for_cpa: false },
];

const log = (...a: unknown[]) => console.log(...a);

const tools: AgentTool[] = [
  {
    name: 'list_month_expenses',
    description: 'List every expense logged in the review month with flags.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => {
      log('  ↳ tool: list_month_expenses');
      return [{ type: 'text', text: JSON.stringify({ month: '2026-05', count: FAKE.length, expenses: FAKE }, null, 2) }];
    },
  },
  {
    name: 'get_expense',
    description: 'Get full detail for one expense by id.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
    handler: async (input) => {
      log(`  ↳ tool: get_expense(${input.id})`);
      const r = FAKE.find((x) => x.id === input.id);
      return [{ type: 'text', text: r ? JSON.stringify(r, null, 2) : 'No expense found.' }];
    },
  },
  {
    name: 'view_receipt_photo',
    description: 'Visually inspect the receipt photo attached to an expense (by id).',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
    handler: async (input) => {
      log(`  ↳ tool: view_receipt_photo(${input.id})  [sending image block to vision]`);
      const r = FAKE.find((x) => x.id === input.id);
      if (!r?.has_photo) return [{ type: 'text', text: 'No receipt photo on file.' }];
      return [
        { type: 'text', text: 'Receipt photo on file:' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: TINY_PNG } },
      ];
    },
  },
  {
    name: 'finish_review',
    description: 'Submit your finished review as a DRAFT for the user to approve.',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
        flagged_expense_ids: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, reason: { type: 'string' } }, required: ['id', 'reason'], additionalProperties: false } },
      },
      required: ['summary', 'subject', 'body', 'flagged_expense_ids'],
      additionalProperties: false,
    },
    handler: async () => [{ type: 'text', text: 'Draft recorded.' }],
  },
];

async function main() {
  log('\n=== Month-end review agent — LIVE smoke test (Sonnet 4.6) ===\n');
  const t0 = Date.now();
  const result = await runAgent({
    model: SONNET_MODEL,
    system: MONTH_END_REVIEW_AGENT_PROMPT,
    userText: 'Review month: 2026-05\n\n## About the user\nFreelance photographer, sole proprietor, mixed payment accounts.\n\nReview this month\'s logged expenses and prepare the draft accountant email.',
    tools,
    stopTool: 'finish_review',
    maxSteps: 8,
    maxTokens: 2000,
  });

  log('\n--- RESULT ---');
  log('stopReason :', result.stopReason);
  log('steps      :', result.steps);
  log('tokens     :', result.usage, `(~${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  log('\ntool trace :');
  result.trace.forEach((s, i) => log(`  ${i + 1}. ${s.tool}(${JSON.stringify(s.input)}) ok=${s.ok}`));

  const d = result.stopToolInput;
  if (d) {
    log('\n--- DRAFT the agent produced ---');
    log('summary :', d.summary);
    log('subject :', d.subject);
    log('flagged :', JSON.stringify(d.flagged_expense_ids, null, 2));
    log('\nbody:\n' + d.body);
  } else {
    log('\n⚠️  Agent never called finish_review. finalText:\n' + result.finalText);
  }

  // Assertions — exit non-zero if the agent didn't actually behave like an agent.
  const calledTools = new Set(result.trace.map((s) => s.tool));
  const ok = result.stopReason === 'stop_tool' && calledTools.has('list_month_expenses') && result.steps >= 2 && Boolean(d);
  log('\n=== ' + (ok ? 'PASS — agent fired, used tools, and terminated cleanly' : 'FAIL — see above') + ' ===\n');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('SMOKE ERROR:', e);
  process.exit(1);
});
