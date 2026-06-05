// Pricing config (DEC-021, weekly-decoy update DEC-044, 3-tier + 70%-margin update DEC-049).
// Single source of truth. Three real tiers now: a steep WEEKLY ($5.99/wk) anchors the ladder,
// MONTHLY ($12.49/mo) is the friendly entry point, and ANNUAL ($119.88/yr ≈ $9.99/mo) is the
// featured plan — priced to the ~70% gross-margin target against a ~1,500-SMS/yr average user.
// Stripe Price IDs come from env so the same code works across test/live.

export const TRIAL_DAYS = 21;

// Co-owners are included on the org's single subscription, but capped to prevent a whole team
// riding one plan (DEC-047). 1 = a spouse/partner. Per-seat billing for teams is deferred (V2).
export const MAX_CO_OWNERS = 1;

export type PlanId = 'weekly' | 'monthly' | 'annual';

export interface Plan {
  id: PlanId;
  label: string;
  priceCents: number; // charged amount per interval
  interval: 'week' | 'month' | 'year';
  displayCents: number; // headline number to show big
  unit: 'wk' | 'mo'; // unit label for the headline (maps to perWk/perMo)
  stripePriceEnv: string; // env var holding the Stripe Price ID
  badge?: string;
}

export const PLANS: Record<PlanId, Plan> = {
  weekly: {
    id: 'weekly',
    label: 'Weekly',
    priceCents: 599, // $5.99/wk (≈ $311/yr if you actually paid weekly) — steepest per-period
    interval: 'week',
    displayCents: 599, // shown as "$5.99/wk"
    unit: 'wk',
    stripePriceEnv: 'STRIPE_PRICE_WEEKLY',
  },
  monthly: {
    id: 'monthly',
    label: 'Monthly',
    priceCents: 1249, // $12.49/mo
    interval: 'month',
    displayCents: 1249, // shown as "$12.49/mo"
    unit: 'mo',
    stripePriceEnv: 'STRIPE_PRICE_MONTHLY',
  },
  annual: {
    id: 'annual',
    label: 'Annual',
    priceCents: 11988, // $119.88/yr
    interval: 'year',
    displayCents: 999, // $9.99/mo billed yearly
    unit: 'mo',
    stripePriceEnv: 'STRIPE_PRICE_ANNUAL',
    badge: 'Save 20%', // vs paying $12.49/mo for a year ($149.88)
  },
};

export function isPlanId(v: string): v is PlanId {
  return v === 'weekly' || v === 'monthly' || v === 'annual';
}
