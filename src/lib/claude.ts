// Anthropic client + model routing (TSNAP-010).
// Raj: right model for the right job — Haiku 4.5 for OCR (cheap/fast), Sonnet 4.6
// for reasoning + response composition. Enable prompt caching from day 1 (~75%
// cost reduction on repeated system prompts); wired up in EPIC-2 call sites.

import Anthropic from '@anthropic-ai/sdk';
import { optionalEnv, requireEnv } from './env';

let _client: Anthropic | null = null;

/** Lazily constructed Anthropic client (server-only; needs ANTHROPIC_API_KEY). */
export function getClaude(): Anthropic {
  if (_client) return _client;
  _client = new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') });
  return _client;
}

// Model IDs. Keep in one place so a model bump is a single-line change.
// HAIKU_MODEL env override lets us A/B claude-haiku-5-5 against 4.5 without a deploy-time code change.
export const HAIKU_MODEL = optionalEnv('HAIKU_MODEL') ?? 'claude-haiku-4-5-20251001'; // receipt OCR / extraction
// Sonnet 5.5 (founder, 2026-11-25): $2/$10 vs 4.6's $3/$15. Runs at effort low via effortFor().
// Set SONNET_MODEL=claude-sonnet-4-6 in Vercel to roll back without a deploy.
export const SONNET_MODEL = optionalEnv('SONNET_MODEL') ?? 'claude-sonnet-5-5'; // categorization + conversation

// Stronger model for rare, high-stakes calls only (month-end review, business profile, second
// opinion on an uncertain category). Never on the per-message path. Opus 5.5 always thinks
// (effort default medium), and thinking counts toward max_tokens, so give these calls headroom.
export const OPUS_MODEL = optionalEnv('OPUS_MODEL') ?? 'claude-opus-5-5';

/** 5.x Haiku/Sonnet think by default (Sonnet 5.5 at effort high). Our jobs are short
 *  classify/compose calls, so keep thinking minimal: thinking tokens bill as output and add latency. */
export function effortFor(model: string): { output_config?: { effort: 'low' } } {
  return /^claude-(haiku|sonnet)-5/.test(model) ? { output_config: { effort: 'low' } } : {};
}
