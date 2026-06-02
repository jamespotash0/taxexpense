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
  personal: 'Personal (non-deductible)',
};

export function categoryLabel(category: string | null): string {
  if (!category) return 'Uncategorized';
  return CATEGORY_LABELS[category] ?? category;
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
  personal: 'Owner Draw',
};

export function qboAccount(category: string | null): string {
  if (!category) return 'Uncategorized Expense';
  return QBO_ACCOUNTS[category] ?? 'Other Business Expenses';
}
