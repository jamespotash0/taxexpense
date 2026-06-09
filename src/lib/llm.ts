// Shared Claude call helpers. Centralizes: prompt caching, text extraction, JSON
// parsing with one retry, and a 15s timeout (TSNAP-026). Used by OCR, text parsing,
// categorization, clarification, and attachment flows.

import { getClaude } from './claude';
import { log } from './log';

const DEFAULT_TIMEOUT_MS = 15_000;

/** Join all text blocks from a Claude response into a single string. */
function extractText(content: Array<{ type: string; text?: string }>): string {
  return content.map((b) => (b.type === 'text' && b.text ? b.text : '')).join('').trim();
}

/** Strip ```json fences / stray prose so JSON.parse succeeds on chatty output. */
function stripToJson(raw: string): string {
  let s = raw.trim();
  if (s.startsWith('```')) s = s.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  const first = s.search(/[[{]/);
  const last = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (first >= 0 && last > first) s = s.slice(first, last + 1);
  return s;
}

/** Per-call cost/latency, surfaced via onMeta for the AI eval log (DEC-080). */
export interface CallMeta {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

interface CallOpts {
  model: string;
  system: string;
  userText: string;
  imageUrl?: string;
  /** Inline image bytes (base64) — used to OCR before storing, to avoid orphaned uploads. */
  imageBase64?: string;
  imageMediaType?: string;
  maxTokens?: number;
  /** Cache the system prompt (Anthropic prompt caching, ~75% cost cut on repeats). */
  cacheSystem?: boolean;
  /** Cost/latency sink for the AI eval log (DEC-080). Called once per underlying API call with the
   *  token usage + wall-clock latency. Optional — most callers ignore it. On a claudeJSON retry it
   *  fires per attempt, so a collector should keep the LAST value. */
  onMeta?: (m: CallMeta) => void;
}

function buildArgs(opts: CallOpts) {
  const userContent: Array<Record<string, unknown>> = [];
  if (opts.imageBase64) {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: opts.imageMediaType ?? 'image/jpeg', data: opts.imageBase64 },
    });
  } else if (opts.imageUrl) {
    userContent.push({ type: 'image', source: { type: 'url', url: opts.imageUrl } });
  }
  userContent.push({ type: 'text', text: opts.userText });

  const system = opts.cacheSystem
    ? [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }]
    : opts.system;

  return {
    model: opts.model,
    max_tokens: opts.maxTokens ?? 1024,
    system,
    messages: [{ role: 'user' as const, content: userContent }],
  };
}

/** Call Claude, return the raw SMS/plain-text response. */
export async function claudeText(opts: CallOpts): Promise<string> {
  const startedAt = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await getClaude().messages.create(buildArgs(opts) as any, {
    timeout: DEFAULT_TIMEOUT_MS,
  });
  if (opts.onMeta) {
    const usage = (res as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
    opts.onMeta({
      model: opts.model,
      inputTokens: usage?.input_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
      latencyMs: Date.now() - startedAt,
    });
  }
  return extractText(res.content as Array<{ type: string; text?: string }>);
}

/** Call Claude expecting JSON; parse with one retry on malformed output. */
export async function claudeJSON<T>(opts: CallOpts): Promise<T> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const text = await claudeText({ ...opts, maxTokens: opts.maxTokens ?? 1024 });
    try {
      return JSON.parse(stripToJson(text)) as T;
    } catch {
      if (attempt === 2) {
        log.error('claude_json_parse_failed', { model: opts.model, preview: text.slice(0, 120) });
        throw new Error('claude_json_parse_failed');
      }
    }
  }
  throw new Error('unreachable');
}
