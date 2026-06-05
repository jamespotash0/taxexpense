// Lightweight cookie-based A/B test primitives (edge-safe — no next/headers here).
// Variant is assigned 50/50 in middleware.ts and read server-side in the page so
// the correct copy renders on first paint (no flash that would skew a copy test).
export const AB_HERO_COOKIE = 'ab_hero';
// A and B test COPY (what/why vs. conversational) and are the only arms assigned to live
// traffic (50/50 in proxy.ts). C tests the CTA MECHANISM — it reuses A's copy but swaps the
// sms: link for a Boardy-style phone-input ("text me first") form. C is NOT auto-assigned: it's
// a prototype reachable via a forced `ab_hero=C` cookie, pending the compliance gates in
// JOURNAL DEC-027. Holding copy constant means C-vs-A would isolate the mechanism if re-enabled.
export type HeroVariant = 'A' | 'B' | 'C';

export function isHeroVariant(v: string | undefined | null): v is HeroVariant {
  return v === 'A' || v === 'B' || v === 'C';
}
