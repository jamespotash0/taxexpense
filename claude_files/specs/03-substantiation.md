# TSNAP-EPIC-3 — Substantiation Logic

**Owner:** Priya Sharma + Raj Patel
**Effort:** 10 hours
**Days:** 4-5 (overlaps with EPIC 2)
**Priority:** P0 (Blocker)

## Epic Description

The intelligence that makes Tally genuinely different from every other receipt tracker. Implements the IRS decision tree determining when to ask for receipts, what context to capture, and when documentation is complete.

**Note:** Much of this work is done IN TANDEM with EPIC 2 (the SMS pipeline integrates substantiation logic into TSNAP-021). This epic captures the substantiation-specific logic as standalone tickets.

## Epic Acceptance Criteria

- [ ] Every receipt category has a defined substantiation rule
- [ ] Decision tree correctly determines when to ask for receipts
- [ ] Decision tree correctly determines what context to capture
- [ ] $75 threshold rule implemented correctly
- [ ] Lodging always-receipt exception implemented
- [ ] Gifts $25 deduction cap implemented
- [ ] Vehicle mileage calculations work
- [ ] Substantiation_complete flag accurately tracks documentation status
- [ ] Weekly reminder system for missing receipts

---

## Tickets in Order

### TSNAP-027 — Substantiation Rules Engine
**Type:** Story
**Owner:** Priya + Raj
**Effort:** 1.5 hours
**Depends on:** TSNAP-007
**Priority:** P0

**Description:**
Build the rules engine that takes a category and returns the substantiation requirements. This is queried by the AI before every response.

**Acceptance Criteria:**
- [ ] Function `getSubstantiationRule(category: string)` in `lib/substantiation.ts`
- [ ] Returns full rule object: level, threshold, always_receipt, required_fields, deduction_pct, deduction_cap
- [ ] Caches rules in memory after first DB fetch (rules don't change often)
- [ ] Throws clear error if category doesn't exist
- [ ] Function `getAllStrictCategories()` returns list of strict categories
- [ ] Function `getAllGeneralCategories()` returns list of general categories

**Technical Notes:**
```typescript
// lib/substantiation.ts
const ruleCache = new Map<string, SubstantiationRule>();

export async function getSubstantiationRule(category: string) {
  if (ruleCache.has(category)) return ruleCache.get(category)!;
  
  const { data, error } = await supabaseAdmin
    .from('substantiation_rules')
    .select('*')
    .eq('category', category)
    .single();
  
  if (error || !data) throw new Error(`Unknown category: ${category}`);
  
  ruleCache.set(category, data);
  return data;
}
```

---

### TSNAP-028 — Decision Tree Implementation
**Type:** Story
**Owner:** Priya + Raj
**Effort:** 2 hours
**Depends on:** TSNAP-027
**Priority:** P0

**Description:**
Implement the decision tree from SPEC.md as a pure function. Given an expense + extracted data, return: should ask for receipt? Should ask for context? Which fields?

**Acceptance Criteria:**
- [ ] Function `runDecisionTree(expense, rule)` in `lib/substantiation.ts`
- [ ] Returns `{ needsReceipt: boolean, missingContextFields: string[], substantiationComplete: boolean, receiptReason?: string }`
- [ ] General category: needsReceipt=false, missingContextFields=[], complete=true
- [ ] Strict category + always_receipt + has photo: needsReceipt=false
- [ ] Strict category + always_receipt + no photo: needsReceipt=true, reason="lodging always requires receipt"
- [ ] Strict category + ≥$75 + has photo: needsReceipt=false, check context fields
- [ ] Strict category + ≥$75 + no photo: needsReceipt=true, reason="$75+ requires receipt"
- [ ] Strict category + <$75: needsReceipt=false, check context fields (SMS is the record)
- [ ] Test: 20 different scenarios covering every branch

**Technical Notes:**
```typescript
export function runDecisionTree(expense: ExpenseData, rule: SubstantiationRule) {
  // General substantiation: always complete, never needs receipt
  if (rule.substantiation_level === 'general') {
    return { needsReceipt: false, missingContextFields: [], substantiationComplete: true };
  }
  
  // Strict substantiation
  const hasPhoto = !!expense.photoUrl;
  const amountCents = expense.amountCents;
  
  // Check required context fields
  const missingFields = rule.required_context_fields.filter(
    field => !expense[field]
  );
  
  // Always-receipt categories (lodging, gifts)
  if (rule.always_receipt) {
    return {
      needsReceipt: !hasPhoto,
      missingContextFields: missingFields,
      substantiationComplete: hasPhoto && missingFields.length === 0,
      receiptReason: !hasPhoto ? `${rule.category} always requires receipt` : undefined
    };
  }
  
  // Threshold check
  const needsReceipt = !hasPhoto && amountCents >= (rule.receipt_threshold_cents || Infinity);
  
  return {
    needsReceipt,
    missingContextFields: missingFields,
    substantiationComplete: !needsReceipt && missingFields.length === 0,
    receiptReason: needsReceipt ? `Over $${rule.receipt_threshold_cents/100} requires receipt` : undefined
  };
}
```

- Priya's responsibility to verify every branch with test cases
- This function MUST be deterministic — same inputs always yield same outputs

---

### TSNAP-029 — Vehicle Mileage Calculation
**Type:** Story
**Owner:** Priya + Raj
**Effort:** 1 hour
**Depends on:** TSNAP-027
**Priority:** P0

**Description:**
Handle vehicle/mileage expenses specially. Calculate deductible amount based on IRS standard mileage rate.

**Acceptance Criteria:**
- [ ] Constant `STANDARD_MILEAGE_RATE_2026 = 0.70` (verify current IRS rate)
- [ ] Function `calculateMileageDeduction(miles: number)` returns dollars
- [ ] When category is `vehicle_business`, AI asks for: business_miles, business_purpose
- [ ] When AI gets miles + purpose, it doesn't ask for receipt (mileage log is the record)
- [ ] Receipt amount_cents stores the deductible amount (miles × rate × 100)
- [ ] Receipt notes field stores: "X miles to/from {destination}"
- [ ] Test: "drove 47 miles to client" → asks for round-trip vs one-way → calculates correctly

**Technical Notes:**
- 2026 standard mileage rate should be verified at https://irs.gov/tax-professionals/standard-mileage-rates
- The rate updates each January — make this configurable
- Alternative: actual expense method (gas, repairs, etc.) — defer to V2

---

### TSNAP-030 — Business Gifts $25 Cap Tracking
**Type:** Story
**Owner:** Priya + Raj
**Effort:** 1 hour
**Depends on:** TSNAP-027
**Priority:** P1

**Description:**
Business gifts are capped at $25 deduction per recipient per year. Track this and warn users when they approach the cap.

**Acceptance Criteria:**
- [ ] When category is `business_gifts`, AI asks for: recipient name, business_relationship
- [ ] Receipt stores: attendees (recipient name), deductible_amount_cents = min(amount_cents, $25)
- [ ] Function `getGiftTotalForRecipient(userId, recipient)` returns YTD total
- [ ] When new gift logged, AI says: "You're at $X of $25 cap for {recipient} this year"
- [ ] If gift exceeds $25, AI explains: "Only $25 is deductible, even though you spent more"
- [ ] Test: 2 gifts to same person in same year — second one shows cap reached

**Technical Notes:**
- Match recipients by exact name (don't try to dedupe "John" vs "John Smith")
- Year boundaries: January 1 resets the cap
- This is an IRS rule, not a Tally rule — communicate clearly

---

### TSNAP-031 — Substantiation Status Updates
**Type:** Task
**Owner:** Raj
**Effort:** 1 hour
**Depends on:** TSNAP-028, TSNAP-023
**Priority:** P0

**Description:**
When user responds to clarification questions or attaches photos, recompute substantiation_complete status.

**Acceptance Criteria:**
- [ ] Function `recomputeSubstantiation(receiptId)` in `lib/substantiation.ts`
- [ ] Fetches receipt + rule, runs decision tree on current state
- [ ] Updates: substantiation_complete, needs_receipt, substantiation_missing_fields
- [ ] Called after: receipt update from clarification, photo attachment
- [ ] Test: text expense → ask for receipt → user adds photo → status updates to complete

**Technical Notes:**
- Pure function approach: don't mutate, return new state
- Use database transactions to avoid race conditions
- Log status changes for analytics later

---

### TSNAP-032 — "Receipt Needed" Reminder System
**Type:** Story
**Owner:** Raj
**Effort:** 2 hours
**Depends on:** TSNAP-022, TSNAP-031
**Priority:** P1

**Description:**
Weekly cron job sends reminder SMS to users with outstanding `needs_receipt` flags.

**Acceptance Criteria:**
- [ ] Vercel Cron Job configured to run weekly (Monday 9am UTC)
- [ ] Endpoint at `/api/cron/receipt-reminders` (protected with secret header)
- [ ] Query: receipts with `needs_receipt=TRUE` AND `created_at > NOW() - 30 days`
- [ ] Group by user, send one SMS per user with their outstanding items
- [ ] SMS format: "You have 3 expenses needing receipts: [list]. Snap them now?"
- [ ] Test: manually trigger endpoint, verify reminder sent
- [ ] Configurable: user can opt out via "STOP REMINDERS"

**Technical Notes:**
```typescript
// vercel.json
{
  "crons": [{
    "path": "/api/cron/receipt-reminders",
    "schedule": "0 9 * * 1"
  }]
}
```

- Use Vercel Cron headers to verify request origin
- Don't send reminders for receipts older than 30 days (probably forgotten)
- Limit to 5 reminders per SMS to avoid huge messages

---

### TSNAP-033 — Substantiation Test Suite
**Type:** Task
**Owner:** Priya
**Effort:** 1.5 hours
**Depends on:** TSNAP-028, TSNAP-029, TSNAP-030
**Priority:** P0

**Description:**
Comprehensive test cases for the decision tree. This is the most important code in the product — it MUST be correct.

**Acceptance Criteria:**
- [ ] 30+ test cases covering every decision tree branch
- [ ] Tests in `__tests__/substantiation.test.ts`
- [ ] Run with `npm test`
- [ ] All test cases pass
- [ ] Test cases include:
  - General expenses (no questions, no receipt needed)
  - Strict + photo + over $75 (ask for context only)
  - Strict + no photo + over $75 (ask for receipt + context)
  - Strict + no photo + under $75 (ask for context only)
  - Lodging any amount (always receipt)
  - Gifts (always receipt + recipient + relationship)
  - Vehicle (miles + purpose)
  - Already complete (no additional asks)
  - Personal (not deductible)
- [ ] Priya signs off that all IRS scenarios are covered

**Technical Notes:**
```typescript
describe('substantiation decision tree', () => {
  test('general expense never needs receipt', () => {
    const result = runDecisionTree(
      { category: 'software', amountCents: 4900, photoUrl: null },
      generalRule
    );
    expect(result.needsReceipt).toBe(false);
    expect(result.substantiationComplete).toBe(true);
  });
  
  test('lodging always needs receipt', () => {
    const result = runDecisionTree(
      { category: 'travel_lodging', amountCents: 5000, photoUrl: null },
      lodgingRule
    );
    expect(result.needsReceipt).toBe(true);
  });
  
  // ... 28 more tests
});
```

- Use Jest or Vitest
- This is the regression test suite — never change behavior without updating these

---

## Day 4-5 Checklist (Overlaps with EPIC 2)

Substantiation work happens IN PARALLEL with SMS pipeline work since they're tightly coupled. The breakdown is roughly:

**Day 4 morning (in addition to EPIC 2 work):**
- [ ] TSNAP-027: Rules engine (1.5h)
- [ ] TSNAP-028: Decision tree (2h)

**Day 4 afternoon:**
- [ ] TSNAP-029: Vehicle mileage (1h)

**Day 5 morning (in addition to EPIC 2 work):**
- [ ] TSNAP-030: Gifts cap (1h)
- [ ] TSNAP-031: Status updates (1h)

**Day 5 afternoon:**
- [ ] TSNAP-033: Test suite (1.5h)
- [ ] TSNAP-032: Reminder system (2h) — can defer to week 3 if time-constrained

---

## Definition of Done for EPIC 3

This epic is DONE when:
1. ✅ Decision tree implemented as pure function
2. ✅ All 30+ test cases pass
3. ✅ Vehicle mileage calculations work
4. ✅ Gifts cap tracking works
5. ✅ Substantiation_complete status updates accurately
6. ✅ Priya signs off that IRS rules are correctly applied
7. ✅ Reminder system works (or formally deferred to week 3)

You are now ready for EPIC 4: Web Dashboard.
