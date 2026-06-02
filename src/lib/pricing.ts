// Pricing config (DEC-021). Single source of truth — change prices here.
// Competitive default: under Keeper/QuickBooks (~$20/mo), premium vs Hurdlr/Everlance.
// Stripe Price IDs come from env so the same code works across test/live.

export const TRIAL_DAYS = 21;

export type PlanId = 'monthly' | 'annual';

export interface Plan {
  id: PlanId;
  label: string;
  priceCents: number; // charged amount per interval
  interval: 'month' | 'year';
  perMonthCents: number; // for display ("$X/mo")
  stripePriceEnv: string; // env var holding the Stripe Price ID
  badge?: string;
}

export const PLANS: Record<PlanId, Plan> = {
  monthly: {
    id: 'monthly',
    label: 'Monthly',
    priceCents: 1799, // $17.99/mo
    interval: 'month',
    perMonthCents: 1799,
    stripePriceEnv: 'STRIPE_PRICE_MONTHLY',
  },
  annual: {
    id: 'annual',
    label: 'Annual',
    priceCents: 14388, // $143.88/yr
    interval: 'year',
    perMonthCents: 1199, // $11.99/mo billed yearly
    stripePriceEnv: 'STRIPE_PRICE_ANNUAL',
    badge: 'Save 33%',
  },
};

export function isPlanId(v: string): v is PlanId {
  return v === 'monthly' || v === 'annual';
}
