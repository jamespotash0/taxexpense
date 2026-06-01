// Anthropic client + model routing (TSNAP-010).
// Raj: right model for the right job — Haiku 4.5 for OCR (cheap/fast), Sonnet 4.6
// for reasoning + response composition. Enable prompt caching from day 1 (~75%
// cost reduction on repeated system prompts); wired up in EPIC-2 call sites.

import Anthropic from '@anthropic-ai/sdk';
import { requireEnv } from './env';

let _client: Anthropic | null = null;

/** Lazily constructed Anthropic client (server-only; needs ANTHROPIC_API_KEY). */
export function getClaude(): Anthropic {
  if (_client) return _client;
  _client = new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') });
  return _client;
}

// Model IDs. Keep in one place so a model bump is a single-line change.
export const HAIKU_MODEL = 'claude-haiku-4-5-20251001'; // receipt OCR / extraction
export const SONNET_MODEL = 'claude-sonnet-4-6'; // categorization + conversation
