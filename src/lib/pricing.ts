// Pricing config (DEC-021, weekly-decoy update DEC-044). Single source of truth.
// Strategy: a deliberately steep WEEKLY price ($4.99/wk ≈ $259/yr) makes the ANNUAL
// plan ($79.99/yr ≈ $6.67/mo) the obvious choice — a decoy, not a real option people keep.
// Stripe Price IDs come from env so the same code works across test/live.

export const TRIAL_DAYS = 21;

export type PlanId = 'weekly' | 'annual';

export interface Plan {
  id: PlanId;
  label: string;
  priceCents: number; // charged amount per interval
  interval: 'week' | 'year';
  displayCents: number; // headline number to show big
  unit: 'wk' | 'mo'; // unit label for the headline (maps to perWk/perMo)
  stripePriceEnv: string; // env var holding the Stripe Price ID
  badge?: string;
}

export const PLANS: Record<PlanId, Plan> = {
  weekly: {
    id: 'weekly',
    label: 'Weekly',
    priceCents: 499, // $4.99/wk — the decoy (≈ $259/yr if you actually paid weekly)
    interval: 'week',
    displayCents: 499, // shown as "$4.99/wk"
    unit: 'wk',
    stripePriceEnv: 'STRIPE_PRICE_WEEKLY',
  },
  annual: {
    id: 'annual',
    label: 'Annual',
    priceCents: 7999, // $79.99/yr
    interval: 'year',
    displayCents: 667, // $6.67/mo billed yearly
    unit: 'mo',
    stripePriceEnv: 'STRIPE_PRICE_ANNUAL',
    badge: 'Save 69%', // vs paying $4.99/wk for a year ($259.48)
  },
};

export function isPlanId(v: string): v is PlanId {
  return v === 'weekly' || v === 'annual';
}
