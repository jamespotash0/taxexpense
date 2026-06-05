// Golden dataset for the IMAGE categorization eval (scripts/eval/image.ts) — the only eval that
// exercises the PHOTO path (RECEIPT_EXTRACT_CATEGORIZE_PROMPT) and the DEC-068 business-intent
// override. The text-based evals (run.ts / merged.ts) can't reach it because they feed raw_text.
//
// Each case points at a committed PNG fixture (scripts/eval/fixtures/, regenerate with
// gen-receipts.ts) and asserts BOTH:
//   • the category the model returns for the photographed receipt, and
//   • the substantiation STATE that the deterministic tree then produces — i.e. whether Tally
//     would actually ask for the WHY. That state is the real product behavior DEC-068 is about.
//
// expectedState mirrors nextContextState() in src/lib/expense.ts:
//   'awaiting_context'  — missing required context fields → Tally asks (who/why)
//   'awaiting_receipt'  — needs a receipt photo (n/a here: every fixture IS a photo)
//   'complete'          — logged, nothing to ask
//
// Data only — no API calls. Run: npm run eval:image

export interface ImageCase {
  id: string;
  /** PNG filename under scripts/eval/fixtures/. */
  file: string;
  /** Text the user "texted with the photo" (caption); '' = a bare photo, the core DEC-068 case. */
  caption: string;
  expectedCategory: string;
  expectedState: 'awaiting_context' | 'awaiting_receipt' | 'complete';
  /** Optional exact check on which context fields remain missing (order-insensitive). */
  expectedMissing?: string[];
  tags: Array<'meal' | 'travel' | 'gift' | 'personal' | 'general' | 'caption'>;
  note: string;
}

export const IMAGE_DATASET: ImageCase[] = [
  // ---- THE core DEC-068 case: a bare meal photo must become a business meal that asks the WHY ----
  {
    id: 'meal-bare',
    file: 'meal-restaurant.png',
    caption: '',
    expectedCategory: 'meals_business',
    expectedState: 'awaiting_context',
    expectedMissing: ['attendees', 'business_purpose'],
    tags: ['meal'],
    note: 'Bare steakhouse receipt, no note → business meal (DEC-068), so Tally asks who + why. The exact founder-reported gap.',
  },
  // Caption supplies the purpose → the ask shrinks to just attendees (proves the caption is used).
  {
    id: 'meal-caption',
    file: 'meal-restaurant.png',
    caption: 'lunch with Sarah from Acme re Q3 roadmap',
    expectedCategory: 'meals_business',
    expectedState: 'awaiting_context',
    expectedMissing: ['attendees'],
    tags: ['meal', 'caption'],
    note: 'Same receipt + a note that gives the purpose → still a business meal, but now only attendees is missing.',
  },
  // ---- Travel overrides: lodging + transportation also assume business and ask the purpose -------
  {
    id: 'hotel-bare',
    file: 'hotel.png',
    caption: '',
    expectedCategory: 'travel_lodging',
    expectedState: 'awaiting_context',
    expectedMissing: ['business_purpose'],
    tags: ['travel'],
    note: 'Hotel receipt → travel_lodging (always_receipt — satisfied by the photo) → asks the business purpose.',
  },
  {
    id: 'flight-bare',
    file: 'flight.png',
    caption: '',
    expectedCategory: 'travel_transportation',
    expectedState: 'awaiting_context',
    expectedMissing: ['business_purpose'],
    tags: ['travel'],
    note: 'Airfare receipt → travel_transportation → asks the business purpose.',
  },
  // ---- Guardrail: DEC-068 must NOT over-claim genuinely personal / general receipts -------------
  {
    id: 'grocery-personal',
    file: 'grocery.png',
    caption: '',
    expectedCategory: 'personal',
    expectedState: 'complete',
    tags: ['personal'],
    note: 'A grocery run is NOT a business expense even when photographed → personal, no questions (Alex/Jordan guardrail).',
  },
  {
    id: 'office-supplies-bare',
    file: 'office-supplies.png',
    caption: '',
    expectedCategory: 'office_supplies',
    expectedState: 'complete',
    tags: ['general'],
    note: 'General-substantiation category → logged, nothing asked. Confirms we only ask the WHY where the code requires it.',
  },
];
