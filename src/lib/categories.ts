// Category display labels + QuickBooks account mapping (TSNAP-043).
// Shared by the dashboard UI and CSV export.

export const CATEGORY_LABELS: Record<string, string> = {
  meals_business: 'Business Meals',
  meals_travel: 'Travel Meals',
  travel_transportation: 'Travel — Transportation',
  travel_lodging: 'Travel — Lodging',
  business_gifts: 'Business Gifts',
  vehicle_business: 'Vehicle / Mileage',
  software: 'Software',
  office_supplies: 'Office Supplies',
  professional_services: 'Professional Services',
  advertising: 'Advertising',
  internet_phone: 'Internet & Phone',
  equipment: 'Equipment',
  insurance: 'Insurance',
  rent: 'Rent',
  repairs: 'Repairs',
  education: 'Education',
  home_office: 'Home Office',
  venue_rental: 'Venue / Event Rental',
  team_event: 'Team / Company Event',
  // Controlled catch-all (IRC §162). NOT offered to the LLM in the categorization prompt — it
  // exists ONLY as the drift fallback in canonicalizeCategory(), so an invented/unknown category
  // lands in ONE deliberate bucket instead of leaking as a one-off column. DEC-065.
  other_business: 'Other Business Expense',
  personal: 'Personal (non-deductible)',
};

export function categoryLabel(category: string | null): string {
  if (!category) return 'Uncategorized';
  return CATEGORY_LABELS[category] ?? category;
}

// The closed set of valid category keys — single source of truth for validation. Every
// LLM-returned category MUST be coerced into this set before it's stored (see
// canonicalizeCategory). The prompt tells the model "never invent a category," but nothing
// structurally enforced that until now: an invented "meals_client" / "subscription" sailed
// through and showed up on the dashboard + CSV export as a brand-new one-off category — the
// "million categories" sprawl. DEC-065.
export const ALLOWED_CATEGORIES: ReadonlySet<string> = new Set(Object.keys(CATEGORY_LABELS));

export function isValidCategory(category: string | null | undefined): boolean {
  return !!category && ALLOWED_CATEGORIES.has(category);
}

export type CategoryDriftStatus = 'ok' | 'normalized' | 'empty' | 'drift';

export interface CanonicalCategory {
  category: string;
  status: CategoryDriftStatus;
}

/** Light formatting fix so trivial drift ("Meals_Business", "meals business", "vehicle-business")
 *  maps back to the real category instead of falling to the catch-all. */
function normalizeCategoryKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Coerce a raw LLM category string into a valid canonical category — the enforcement point for
 * the closed taxonomy (DEC-065). Resolution order:
 *   - empty/missing  → 'personal'        (the model extracted nothing usable)
 *   - exact match    → as-is             (status 'ok')
 *   - formatting fix → matched key        (status 'normalized')
 *   - unknown value  → 'other_business'   (status 'drift')
 * Drift falls to the business catch-all, NOT 'personal', so a real deductible expense is never
 * silently marked non-deductible just because the model invented a label. The status lets the
 * caller emit a drift metric.
 */
export function canonicalizeCategory(raw: string | null | undefined): CanonicalCategory {
  if (!raw || !raw.trim()) return { category: 'personal', status: 'empty' };
  if (ALLOWED_CATEGORIES.has(raw)) return { category: raw, status: 'ok' };
  const normalized = normalizeCategoryKey(raw);
  if (ALLOWED_CATEGORIES.has(normalized)) return { category: normalized, status: 'normalized' };
  return { category: 'other_business', status: 'drift' };
}

// Best-match QuickBooks Online chart-of-accounts names (TSNAP-043).
export const QBO_ACCOUNTS: Record<string, string> = {
  meals_business: 'Meals and Entertainment',
  meals_travel: 'Travel Meals',
  travel_transportation: 'Travel',
  travel_lodging: 'Travel',
  business_gifts: 'Meals and Entertainment',
  vehicle_business: 'Automobile Expense',
  software: 'Software',
  office_supplies: 'Office Supplies',
  professional_services: 'Legal & Professional Fees',
  advertising: 'Advertising/Promotional',
  internet_phone: 'Utilities',
  equipment: 'Equipment',
  insurance: 'Insurance',
  rent: 'Rent or Lease',
  repairs: 'Repairs & Maintenance',
  education: 'Continuing Education',
  home_office: 'Home Office',
  venue_rental: 'Rent or Lease',
  team_event: 'Meals and Entertainment',
  other_business: 'Other Business Expenses',
  personal: 'Owner Draw',
};

export function qboAccount(category: string | null): string {
  if (!category) return 'Uncategorized Expense';
  return QBO_ACCOUNTS[category] ?? 'Other Business Expenses';
}
