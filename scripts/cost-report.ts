// Per-user LLM cost for a month, from ai_events 'llm_usage' rows (DEC-097). Flags anyone over
// the alert line. AI cost only: Twilio/Linq messaging is billed separately.
//
//   npm run cost:report            # current month
//   npm run cost:report -- 2026-11

import { getSupabaseAdmin } from '../src/lib/supabase';

// $ per 1M tokens [input, output]. input_tokens already folds cache reads in at 0.1x.
const PRICES: Record<string, [number, number]> = {
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-haiku-4-5-20251001': [1, 5],
  'claude-sonnet-4-6': [3, 15],
  'claude-sonnet-5-5': [2, 10],
  'claude-opus-5-5': [4, 20],
};
const ALERT_USD = 8;

async function main() {
  const month = process.argv[2] ?? new Date().toISOString().slice(0, 7);
  const start = `${month}-01T00:00:00Z`;
  const end = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 1)).toISOString();

  const { data, error } = await getSupabaseAdmin()
    .from('ai_events')
    .select('organization_id, model, input_tokens, output_tokens')
    .eq('kind', 'llm_usage')
    .gte('created_at', start)
    .lt('created_at', end);
  if (error) throw error;

  const byOrg = new Map<string, number>();
  const unknown = new Set<string>();
  for (const r of data ?? []) {
    const p = PRICES[r.model ?? ''];
    if (!p) { unknown.add(r.model ?? 'null'); continue; }
    const usd = ((r.input_tokens ?? 0) * p[0] + (r.output_tokens ?? 0) * p[1]) / 1e6;
    byOrg.set(r.organization_id, (byOrg.get(r.organization_id) ?? 0) + usd);
  }

  const rows = [...byOrg].sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);
  console.log(`AI cost ${month}: $${total.toFixed(2)} across ${rows.length} orgs (avg $${(total / (rows.length || 1)).toFixed(2)})\n`);
  for (const [org, usd] of rows.slice(0, 20)) {
    console.log(`${usd >= ALERT_USD ? '⚠️ ' : '   '}${org}  $${usd.toFixed(2)}`);
  }
  if (unknown.size) console.log(`\nNo price for: ${[...unknown].join(', ')} (add to PRICES)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
