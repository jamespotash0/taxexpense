// Per-user LLM cost tracking (DEC-097; not to be confused with usage.ts, the receipt caps). Every Claude call inside one unit of work (an inbound
// message, a month-end review) adds its tokens to an async-local tally; at the end the tally is
// written to ai_events as one 'llm_usage' row per model, in a single insert. The LLM wrappers
// (llm.ts, agent.ts) don't need to know who the user is. Calls outside a unit (evals, scripts)
// record nothing.
import { AsyncLocalStorage } from 'node:async_hooks';
import { getSupabaseAdmin } from './supabase';
import { log } from './log';

interface Tally {
  organizationId: string | null;
  userId: string | null;
  byModel: Map<string, { input: number; output: number; cacheRead: number }>;
}

const store = new AsyncLocalStorage<Tally>();

/** Run `fn` as one unit of work; flush its token usage when it finishes (even on error). */
export async function withUsage<T>(fn: () => Promise<T>): Promise<T> {
  const tally: Tally = { organizationId: null, userId: null, byModel: new Map() };
  return store.run(tally, async () => {
    try {
      return await fn();
    } finally {
      await flush(tally);
    }
  });
}

/** Attribute the current unit to a user (call once the user is known). */
export function setUsageOwner(organizationId: string, userId: string | null): void {
  const t = store.getStore();
  if (t) {
    t.organizationId = organizationId;
    t.userId = userId;
  }
}

type Usage = { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number | null } | undefined;

/** Add one API response's usage to the current unit. No-op outside a unit. */
export function recordUsage(model: string, usage: Usage): void {
  const t = store.getStore();
  if (!t || !usage) return;
  const m = t.byModel.get(model) ?? { input: 0, output: 0, cacheRead: 0 };
  m.input += usage.input_tokens ?? 0;
  m.output += usage.output_tokens ?? 0;
  m.cacheRead += usage.cache_read_input_tokens ?? 0;
  t.byModel.set(model, m);
}

async function flush(t: Tally): Promise<void> {
  if (!t.organizationId || t.byModel.size === 0) return;
  // input_tokens = uncached input + cache reads at their 0.1x price, so the cost report can price
  // every row as input*in_rate + output*out_rate. ponytail: cache writes (1.25x) priced as plain
  // input; add a column if caching volume makes that error matter.
  const rows = [...t.byModel].map(([model, m]) => ({
    organization_id: t.organizationId,
    user_id: t.userId,
    kind: 'llm_usage',
    model,
    input_tokens: Math.round(m.input + m.cacheRead * 0.1),
    output_tokens: m.output,
  }));
  try {
    const { error } = await getSupabaseAdmin().from('ai_events').insert(rows);
    if (error) throw error;
  } catch {
    log.warn('llm_usage_flush_failed', { org: t.organizationId });
  }
}
