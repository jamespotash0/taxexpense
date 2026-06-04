// Usage caps (DEC-050): protect unit economics on the flat-price plans, where revenue is
// fixed ($79.99/yr) but Twilio+Claude cost scales at ~$0.045 per logged expense. Two layers,
// both counted on RECEIPTS CREATED (the real cost driver) and ORG-scoped (the org owns the
// plan; a co-owner rides the same subscription). Only NEW expense logging is gated — read-only
// queries, "why?" explanations, exports and recurring confirmations are never capped.
//
// Refines SPEC's "30 receipts/user/day" to per-ORG: cost + billing are org-level, and co-owners
// are capped at 1 (DEC-047), so the practical difference is negligible.
//
//  - DAILY (SPEC): 30 receipts / rolling 24h — a burst/abuse ceiling far above any real day.
//  - ANNUAL: 1,200 receipts / rolling 365d (~$54 COGS, still profitable at $79.99) — the
//    fair-use cost ceiling. Nudge near 90%, allow a small grace overage, then block new
//    logging with a high-volume upsell to support (no separate Stripe tier in V1).

import { countReceiptsSince } from './receipts';

export const DAILY_RECEIPT_CAP = 30;
export const ANNUAL_RECEIPT_QUOTA = 1200;
export const ANNUAL_WARN_AT = 1080; // ~90% — start nudging
export const ANNUAL_WARN_EVERY = 50; // only nudge every N past the warn line (avoid per-msg spam)
export const ANNUAL_GRACE = 50; // overage allowed past the quota before the hard stop
export const ANNUAL_HARD_STOP = ANNUAL_RECEIPT_QUOTA + ANNUAL_GRACE; // 1,250

export interface UsageCounts {
  receiptsToday: number; // rolling 24h
  receiptsYear: number; // rolling 365d
}

export type UsageDecision =
  | { kind: 'ok' }
  | { kind: 'warn_annual'; used: number } // log this one, but append a nudge
  | { kind: 'block_daily' }
  | { kind: 'block_annual' };

/**
 * Pure: decide whether to log a NEW expense given current usage counts (counts are PRE-log —
 * how many already exist). Priority: annual hard stop (most severe) → daily burst cap →
 * near-annual nudge → ok.
 */
export function decideUsage(c: UsageCounts): UsageDecision {
  if (c.receiptsYear >= ANNUAL_HARD_STOP) return { kind: 'block_annual' };
  if (c.receiptsToday >= DAILY_RECEIPT_CAP) return { kind: 'block_daily' };
  if (c.receiptsYear >= ANNUAL_WARN_AT && (c.receiptsYear - ANNUAL_WARN_AT) % ANNUAL_WARN_EVERY === 0) {
    return { kind: 'warn_annual', used: c.receiptsYear };
  }
  return { kind: 'ok' };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Load an org's rolling receipt counts (24h + 365d) for the usage caps. */
export async function getUsageCounts(orgId: string): Promise<UsageCounts> {
  const now = Date.now();
  const dayAgo = new Date(now - DAY_MS).toISOString();
  const yearAgo = new Date(now - 365 * DAY_MS).toISOString();
  const [receiptsToday, receiptsYear] = await Promise.all([
    countReceiptsSince(orgId, dayAgo),
    countReceiptsSince(orgId, yearAgo),
  ]);
  return { receiptsToday, receiptsYear };
}
