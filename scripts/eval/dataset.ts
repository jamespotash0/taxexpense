// Golden categorization dataset for the eval harness (scripts/eval/run.ts).
//
// Each case is a realistic inbound expense + the category we expect Prompt 6
// (CATEGORIZATION_HELPER_PROMPT, src/lib/prompts.ts) to return. "expected" is
// graded against the *prompt's own guidelines* — e.g. the prompt explicitly maps
// "rent a venue for a client meeting" → rent (not venue_rental), and "solo coffee,
// no business contact" → personal. Where the guideline is genuinely ambiguous the
// case is tagged 'ambiguous' and excluded from the headline accuracy number.
//
// Tags:
//   easy      — unambiguous, should basically never regress
//   edge      — a documented tripwire from the prompt's Guidelines section
//   ambiguous — reasonable people / the prompt could justify >1 label; reported separately
//
// This file is data only — no API calls. Run: npm run eval:categorize

import type { ExpenseInput } from '../../src/lib/categorize';

export interface EvalCase {
  id: string;
  /** Compact partial; buildInput() fills the rest of ExpenseInput with nulls. */
  input: Partial<ExpenseInput> & { raw_text: string };
  expected: string;
  tags: Array<'easy' | 'edge' | 'ambiguous'>;
  note: string;
}

/** Expand a compact case into the full ExpenseInput the production fn expects. */
export function buildInput(p: EvalCase['input']): ExpenseInput {
  return {
    amount_cents: p.amount_cents ?? null,
    vendor: p.vendor ?? null,
    transaction_date: p.transaction_date ?? null,
    attendees: p.attendees ?? null,
    business_purpose: p.business_purpose ?? null,
    business_relationship: p.business_relationship ?? null,
    location_city: p.location_city ?? null,
    business_miles: p.business_miles ?? null,
    has_photo: p.has_photo ?? false,
    raw_text: p.raw_text,
    items: p.items ?? [],
  };
}

export const DATASET: EvalCase[] = [
  // ---- Easy / canonical mappings (one per category) ----------------------
  {
    id: 'software-adobe',
    input: { vendor: 'Adobe', amount_cents: 5499, raw_text: 'Adobe Creative Cloud $54.99', items: ['Creative Cloud subscription'] },
    expected: 'software',
    tags: ['easy'],
    note: 'SaaS subscription → software (§162).',
  },
  {
    id: 'ads-meta',
    input: { vendor: 'Meta', amount_cents: 12000, raw_text: '$120 Facebook ads for my photography page' },
    expected: 'advertising',
    tags: ['easy'],
    note: 'Paid promotion → advertising.',
  },
  {
    id: 'legal-fees',
    input: { vendor: 'Jones Law', amount_cents: 45000, raw_text: '$450 to my lawyer to review a client contract' },
    expected: 'professional_services',
    tags: ['easy'],
    note: 'Outbound legal fee → professional_services.',
  },
  {
    id: 'equipment-laptop',
    input: { vendor: 'Apple', amount_cents: 189900, raw_text: 'new MacBook Pro for work $1899', items: ['MacBook Pro 14"'] },
    expected: 'equipment',
    tags: ['easy'],
    note: 'Large durable purchase → equipment (may qualify §179).',
  },
  {
    id: 'office-supplies',
    input: { vendor: 'Staples', amount_cents: 2399, raw_text: '$23.99 printer paper and pens', items: ['printer paper', 'pens'] },
    expected: 'office_supplies',
    tags: ['easy'],
    note: 'Small consumables → office_supplies.',
  },
  {
    id: 'insurance',
    input: { vendor: 'Hiscox', amount_cents: 6800, raw_text: '$68 monthly business liability insurance' },
    expected: 'insurance',
    tags: ['easy'],
    note: 'Business policy premium → insurance.',
  },
  {
    id: 'education-course',
    input: { vendor: 'Udemy', amount_cents: 1999, raw_text: '$19.99 advanced Lightroom course' },
    expected: 'education',
    tags: ['easy'],
    note: 'Skills training → education.',
  },
  {
    id: 'flight',
    input: { vendor: 'United', amount_cents: 32000, raw_text: '$320 flight to Denver for the Acme shoot', business_purpose: 'Acme shoot' },
    expected: 'travel_transportation',
    tags: ['easy'],
    note: 'Business airfare → travel_transportation.',
  },
  {
    id: 'lodging',
    input: { vendor: 'Marriott', amount_cents: 18900, raw_text: '$189 hotel in Denver for the conference', business_purpose: 'conference' },
    expected: 'travel_lodging',
    tags: ['easy'],
    note: 'Business hotel → travel_lodging (always_receipt category).',
  },
  {
    id: 'gift-wine',
    input: { vendor: 'Wine.com', amount_cents: 6000, raw_text: '$60 bottle of wine for my client as a thank-you', business_relationship: 'client' },
    expected: 'business_gifts',
    tags: ['easy'],
    note: 'Client gift → business_gifts (§274(b), $25 cap territory).',
  },

  // ---- Edge cases: the prompt's own Guidelines tripwires ------------------
  {
    id: 'solo-coffee-no-context',
    input: { vendor: 'Starbucks', amount_cents: 575, raw_text: 'coffee $5.75' },
    expected: 'personal',
    tags: ['edge'],
    note: 'Solo coffee, NO business contact → personal, NOT meals_business. Guideline: don\'t force a strict category.',
  },
  {
    id: 'client-lunch',
    input: { vendor: "Morton's", amount_cents: 8400, raw_text: '$84 lunch with John from Acme re Q3 roadmap', attendees: 'John (Acme)', business_purpose: 'Q3 roadmap', business_relationship: 'client' },
    expected: 'meals_business',
    tags: ['edge'],
    note: 'Clear client + purpose → meals_business (50%). The positive control for the solo-coffee case.',
  },
  {
    id: 'team-lunch-with-staff',
    input: { vendor: 'Chipotle', amount_cents: 9600, raw_text: 'team lunch for my 3 employees $96', business_purpose: 'team lunch for staff' },
    expected: 'team_event',
    tags: ['edge'],
    note: 'Meal primarily for OWN employees → team_event (100%, §274(e)).',
  },
  {
    id: 'solo-party-no-employees',
    input: { vendor: 'Local Bar', amount_cents: 7000, raw_text: 'celebrated landing a big client, drinks $70, just me' },
    expected: 'personal',
    tags: ['edge', 'ambiguous'],
    note: 'Solo "party", no employees, no client present → personal (NOT team_event). Could arguably be meals_business if reframed.',
  },
  {
    id: 'gas-to-client',
    input: { vendor: 'Shell', amount_cents: 4200, raw_text: '$42 gas driving to the client site' },
    expected: 'vehicle_business',
    tags: ['edge'],
    note: 'Gas/fuel for business driving → vehicle_business, NOT a generic category.',
  },
  {
    id: 'parking-client',
    input: { vendor: 'LAZ Parking', amount_cents: 1800, raw_text: '$18 parking at the client meeting' },
    expected: 'vehicle_business',
    tags: ['edge'],
    note: 'Parking at a business location → vehicle_business per guideline.',
  },
  {
    id: 'coworking-daypass',
    input: { vendor: 'WeWork', amount_cents: 3500, raw_text: '$35 day pass at WeWork to meet a client' },
    expected: 'rent',
    tags: ['edge'],
    note: 'Coworking/desk for ongoing work → rent (per the resolved guideline; DEC). NOT venue_rental.',
  },
  {
    id: 'venue-for-event',
    input: { vendor: 'The Loft', amount_cents: 30000, raw_text: '$300 to rent a hall for a client workshop' },
    expected: 'venue_rental',
    tags: ['edge'],
    note: 'Renting a hall/venue for a SPECIFIC event → venue_rental, the more specific category (DEC resolved the old rent/venue_rental contradiction). Both export to QBO Rent or Lease.',
  },
  {
    id: 'home-internet',
    input: { vendor: 'Comcast', amount_cents: 8000, raw_text: '$80 home internet, I work from home' },
    expected: 'internet_phone',
    tags: ['edge'],
    note: 'Home internet used for business → internet_phone (NOT home_office).',
  },
  {
    id: 'home-office-cleaning',
    input: { vendor: 'MerryMaids', amount_cents: 12000, raw_text: '$120 cleaning for my dedicated home office' },
    expected: 'home_office',
    tags: ['edge', 'ambiguous'],
    note: 'Service for a dedicated home-office space → home_office (business-use portion). Could be read as repairs/personal.',
  },
  {
    id: 'concert-tickets',
    input: { vendor: 'Ticketmaster', amount_cents: 22000, raw_text: '$220 concert tickets, took a client' },
    expected: 'personal',
    tags: ['edge', 'ambiguous'],
    note: 'Entertainment is generally NON-deductible post-TCJA (§274(a)). Guideline says use personal unless it is really a meal. Hard case.',
  },
  {
    id: 'equipment-repair',
    input: { vendor: 'CameraFix', amount_cents: 9000, raw_text: '$90 to repair my work camera' },
    expected: 'repairs',
    tags: ['edge'],
    note: 'Maintenance of business equipment → repairs (NOT equipment).',
  },

  // ---- Clear non-business control ----------------------------------------
  {
    id: 'groceries-personal',
    input: { vendor: 'Safeway', amount_cents: 8700, raw_text: 'weekly groceries $87' },
    expected: 'personal',
    tags: ['easy'],
    note: 'Obvious personal spend → personal (§262). Guards against over-categorization.',
  },
];
