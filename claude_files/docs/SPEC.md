# Tally — Technical Specification

## Stack

- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Database:** Supabase (Postgres 15+)
- **Auth:** Custom phone OTP via Twilio
- **Storage:** Supabase Storage
- **SMS:** Twilio (programmable messaging API)
- **AI:**
  - Claude Sonnet 4.6 for reasoning and response composition
  - Claude Haiku 4.5 for receipt extraction (cheaper, faster)
- **Hosting:** Vercel
- **Monitoring:** Sentry (free tier)

---

## Core Product Behavior

Tally captures **business context** (WHY) for each transaction in addition to the standard data (WHAT). It implements IRS substantiation rules intelligently — asking for receipts and additional context **only when the tax code actually requires it**.

### The Three Input Types

1. **Photo + optional text** — User sends a receipt image, optionally with context
2. **Text only** — User describes the expense ("$48 lunch with Sarah re partnership")
3. **Photo of existing receipt added later** — User adds a receipt to a previously-logged text expense

### The Two Substantiation Regimes

**Strict Substantiation (IRC §274(d))** — Applies to:
- Business meals
- Travel (transportation, lodging, meals during travel)
- Business gifts
- Vehicle / listed property
- Entertainment (no longer deductible, but rules apply)

Requires contemporaneous records with: amount, date, place, business purpose, business relationship.

**General Substantiation (IRC §162)** — Applies to:
- Software, office supplies, professional services, advertising, internet, equipment, insurance, rent, education, etc.

Requires: payee, amount, proof of payment, date, description. Credit card statements generally sufficient.

### The $75 Receipt Rule

For strict-category expenses **at or over $75**, the IRS requires a third-party receipt.

For strict-category expenses **under $75**, a written record (the user's SMS to Tally) is sufficient.

**Exceptions** (always require receipts regardless of amount):
- Lodging
- Business gifts (also subject to $25/person/year deduction cap)

---

## Database Schema

### `users` table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  business_type VARCHAR(100),
  entity_type VARCHAR(20) CHECK (entity_type IN ('sole_prop', 'smllc', 'unknown')),
  default_payment_account VARCHAR(20) CHECK (default_payment_account IN ('business', 'personal', 'unknown')),
  accountant_email VARCHAR(255),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_step INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_org ON users(organization_id);
```

### `organizations` table (multi-tenant from day 1)

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  owner_user_id UUID,
  subscription_tier VARCHAR(50) DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

For v1, every user has their own organization (1:1). The structure supports future multi-user accounts without migration.

### `user_roles` table (for future)

```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role VARCHAR(20) CHECK (role IN ('owner', 'editor', 'viewer', 'accountant')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

For v1, every user has the `owner` role.

### `receipts` table (the core table)

```sql
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Core transaction data
  vendor VARCHAR(255),
  amount_cents INTEGER NOT NULL,
  transaction_date DATE,
  payment_account VARCHAR(20) CHECK (payment_account IN ('business', 'personal', 'unknown')),
  
  -- Categorization
  category VARCHAR(100),
  irc_section VARCHAR(20),
  deduction_percentage INTEGER DEFAULT 100,
  deductible_amount_cents INTEGER,
  
  -- Strict substantiation fields (for §274(d) categories)
  business_purpose TEXT,
  attendees TEXT,
  business_relationship TEXT,
  location_city VARCHAR(100),
  business_miles INTEGER,
  
  -- Receipt + documentation status
  photo_url VARCHAR(500),
  needs_receipt BOOLEAN DEFAULT FALSE,
  receipt_reason TEXT,
  substantiation_complete BOOLEAN DEFAULT FALSE,
  substantiation_missing_fields TEXT[],
  
  -- AI extraction metadata
  raw_extracted_data JSONB,
  extraction_confidence DECIMAL(3,2),
  
  -- Edit tracking
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_receipts_org ON receipts(organization_id, created_at DESC);
CREATE INDEX idx_receipts_user ON receipts(user_id, created_at DESC);
CREATE INDEX idx_receipts_date ON receipts(user_id, transaction_date DESC);
CREATE INDEX idx_receipts_needs_receipt ON receipts(user_id, needs_receipt) WHERE needs_receipt = TRUE;
```

### `substantiation_rules` table (the smart logic)

```sql
CREATE TABLE substantiation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(100) UNIQUE NOT NULL,
  irc_section VARCHAR(20),
  substantiation_level VARCHAR(20) CHECK (substantiation_level IN ('strict', 'general')),
  receipt_threshold_cents INTEGER,
  always_receipt BOOLEAN DEFAULT FALSE,
  required_context_fields TEXT[],
  deduction_percentage INTEGER DEFAULT 100,
  deduction_cap_cents INTEGER,
  notes TEXT
);
```

**Seeded data for v1:**

```sql
INSERT INTO substantiation_rules (category, irc_section, substantiation_level, receipt_threshold_cents, always_receipt, required_context_fields, deduction_percentage, deduction_cap_cents) VALUES
-- Strict substantiation categories
('meals_business', '274', 'strict', 7500, FALSE, ARRAY['attendees', 'business_purpose'], 50, NULL),
('meals_travel', '274', 'strict', 7500, FALSE, ARRAY['business_purpose'], 50, NULL),
('travel_transportation', '162', 'strict', 7500, FALSE, ARRAY['business_purpose'], 100, NULL),
('travel_lodging', '162', 'strict', 0, TRUE, ARRAY['business_purpose'], 100, NULL),
('business_gifts', '274', 'strict', 7500, FALSE, ARRAY['attendees', 'business_relationship'], 100, 2500),
('vehicle_business', '162', 'strict', NULL, FALSE, ARRAY['business_miles', 'business_purpose'], 100, NULL),

-- General substantiation categories
('software', '162', 'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
('office_supplies', '162', 'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
('professional_services', '162', 'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
('advertising', '162', 'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
('internet_phone', '162', 'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
('equipment', '179', 'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
('insurance', '162', 'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
('rent', '162', 'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
('repairs', '162', 'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
('education', '162', 'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
('home_office', '280A', 'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),

-- Special case: personal (not deductible)
('personal', '262', 'general', NULL, FALSE, ARRAY[]::TEXT[], 0, NULL);
```

### `irc_summaries` table

```sql
CREATE TABLE irc_summaries (
  section_id VARCHAR(20) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  short_summary TEXT NOT NULL,
  deduction_percentage INTEGER,
  common_practice TEXT,
  worth_noting TEXT,
  source_url VARCHAR(500),
  last_reviewed DATE,
  version INTEGER DEFAULT 1
);
```

(Content seeded from IRC-SUMMARIES.md — 7 core sections.)

### `conversations` table

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
  message_text TEXT,
  media_url VARCHAR(500),
  receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL,
  context_state VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_user ON conversations(user_id, created_at DESC);
```

### `auth_codes` table

```sql
CREATE TABLE auth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auth_codes_phone ON auth_codes(phone_number, created_at DESC);
```

### `sessions` table

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_token ON sessions(token);
```

---

## The Substantiation Decision Tree

This is the core logic the AI must follow. It determines whether to ask for a receipt, what context to capture, and when documentation is complete.

```
INCOMING EXPENSE
    ↓
Extract: vendor, amount, date, description
(via OCR if photo, via parsing if text)
    ↓
DETERMINE CATEGORY
(via AI categorization using business context)
    ↓
Look up substantiation_rules for category
    ↓
Is this a STRICT substantiation category?
    │
    ├── NO (general substantiation)
    │       ↓
    │       Log it. Cite IRC §162 (or relevant section).
    │       Confirm to user. Done.
    │
    └── YES (strict substantiation)
            ↓
            Is always_receipt = TRUE?
            │
            ├── YES (lodging, gifts)
            │       ↓
            │       Photo attached?
            │       │
            │       ├── YES → OCR + ask for context fields
            │       └── NO  → Log it + ask for receipt + set needs_receipt=TRUE
            │
            └── NO
                    ↓
                    amount_cents >= receipt_threshold_cents (typically 7500)?
                    │
                    ├── YES (≥$75)
                    │       ↓
                    │       Photo attached?
                    │       │
                    │       ├── YES → OCR + ask for missing context only
                    │       └── NO  → Log it + ask for receipt + ask for missing context + set needs_receipt=TRUE
                    │
                    └── NO (<$75)
                            ↓
                            Have all required_context_fields?
                            │
                            ├── YES → Log it as substantiation_complete=TRUE. SMS is the written record.
                            └── NO  → Ask for missing context. Once captured, mark complete.
```

---

## API Routes

### POST `/api/sms/inbound`

Twilio webhook endpoint. Receives incoming SMS.

**Receives:**
- `From` (phone number)
- `Body` (message text)
- `NumMedia` (count of attachments)
- `MediaUrl0`, `MediaUrl1`, ... (photo URLs)

**Process:**
1. Look up user by phone number
2. If new user: start onboarding flow
3. If onboarding incomplete: continue onboarding
4. If user is responding to a pending question: process clarification
5. Otherwise: process as new expense input
6. Run substantiation decision tree
7. Send SMS response via Twilio

**Returns:** TwiML response (or empty 200 since we send via API)

### POST `/api/auth/request-code`

**Body:** `{ phone_number: string }`

**Process:**
1. Generate 6-digit code
2. Store in `auth_codes` table with 10-min expiry
3. Send via Twilio SMS

**Returns:** `{ success: true }`

### POST `/api/auth/verify-code`

**Body:** `{ phone_number: string, code: string }`

**Process:**
1. Look up most recent unexpired code for phone
2. Compare codes
3. Mark code as used
4. Create session, return token

**Returns:** `{ token: string, user_id: string }` or `{ error: 'invalid' }`

### GET `/api/receipts`

**Auth:** Required (session token)

**Query params:** `limit`, `offset`, `from_date`, `to_date`, `needs_receipt` (boolean filter)

**Returns:** Array of user's receipts with substantiation status

### PATCH `/api/receipts/:id`

**Auth:** Required

**Body:** Partial receipt fields to update

**Returns:** Updated receipt

### DELETE `/api/receipts/:id`

**Auth:** Required

**Returns:** `{ success: true }`

### GET `/api/receipts/export`

**Auth:** Required

**Query params:** `format` (csv | quickbooks)

**Returns:** CSV file download (QuickBooks-compatible format available)

### POST `/api/receipts/:id/attach-receipt`

**Auth:** Required

**Body:** Multipart form with photo

**Process:**
1. Upload photo to Supabase Storage
2. Run OCR via Claude Haiku 4.5
3. Cross-check with existing data
4. Update `photo_url`, `needs_receipt=FALSE`, recompute `substantiation_complete`

### POST `/api/email-accountant`

**Auth:** Required

**Process:**
1. Generate monthly PDF + CSV
2. Email to user's configured accountant_email
3. Include all receipts from selected period

**Returns:** `{ success: true, sent_to: string }`

---

## Core Conversation Logic

The SMS handler follows this state machine:

```
INCOMING SMS
    ↓
Look up user by phone number
    ↓
New user?
├── YES → Send onboarding question 1
│         (What kind of work?)
│
└── NO → Check onboarding state
    │
    ├── Step 0 → Process work type answer → Send question 2 (entity type)
    │
    ├── Step 1 → Process entity type answer → Send question 3 (payment account)
    │
    ├── Step 2 → Process payment account answer → Confirm setup complete
    │
    └── Step 3+ → Check if user has pending receipt awaiting clarification
        │
        ├── YES → Process clarification response, update receipt
        │
        └── NO  → New expense input
            │
            ├── Photo attached?
            │   ├── YES → OCR via Haiku 4.5 → Categorize → Run decision tree
            │   └── NO  → Parse text expense → Categorize → Run decision tree
            │
            └── OR: Treat as general question if no expense detected
```

---

## OCR Implementation (Claude Haiku 4.5)

When user sends photo:

**Input:** Photo URL (from Twilio media)

**Process:**
1. Download photo from Twilio
2. Upload to Supabase Storage
3. Send to Claude Haiku 4.5 with extraction prompt
4. Parse structured JSON response
5. Store extracted data in `raw_extracted_data` JSONB field

**Output structure:**
```json
{
  "vendor": "Morton's Steakhouse",
  "total_amount": 340.50,
  "transaction_date": "2026-04-15",
  "items": ["Ribeye 16oz", "Caesar Salad", "Wine"],
  "payment_method": "credit",
  "confidence": 0.95
}
```

**Error handling:**
- `{"error": "not_a_receipt"}` → Reply: "That doesn't look like a receipt. Want to describe the expense in text instead?"
- `{"error": "unreadable"}` → Reply: "That photo's a bit blurry. Can you snap another, or just text me the amount and vendor?"
- Low confidence (< 0.7) → Reply: "I'm reading $X from [vendor] on [date]. Does that look right?"

---

## Smart Categorization Prompt Strategy

After OCR or text parsing, the AI determines category by considering:

1. **Vendor patterns:** "Morton's" + meal-like items → `meals_business`
2. **User context:** Their business type, entity type
3. **Explicit context:** Any business purpose mentioned in user text
4. **Amount + line items:** Equipment thresholds suggest §179

The AI then looks up the substantiation rule and runs the decision tree.

---

## Security Considerations

### Critical from Day 1
- Environment variables for all API keys (never committed to git)
- HTTPS everywhere (Vercel handles this)
- Phone number is the user identifier — rate-limit OTP requests
- Session tokens in HTTP-only cookies
- Sanitize all inputs (use Supabase client library)
- Validate Twilio webhook signatures (prevents spoofing)
- Photos stored with signed URLs in Supabase Storage

### Rate Limiting
- OTP requests: 3 per phone number per 15 minutes
- Inbound SMS: 25 per user per 10 min (burst) + 200 per user per 24h (abuse backstop) — see `src/lib/sms-handler.ts`
- API endpoints: 60 requests per session per minute

### Usage Caps (DEC-050 — cost control on flat-price plans)
Counted on **receipts created**, org-scoped (the org owns the plan; co-owners ride it). Only NEW
expense logging is gated — read-only queries, "why?" explanations, exports and recurring
confirmations are never capped. Implemented in `src/lib/usage.ts` (pure `decideUsage` + loader),
enforced in `handleExpenseFlow`.
- **Daily:** 30 receipts / rolling 24h — burst/abuse ceiling far above any real day.
- **Annual:** 1,200 receipts / rolling 365d (~$54 all-in COGS, profitable at $79.99/yr). Nudge at
  90% (1,080), allow a 50-receipt grace overage, then hard-block at 1,250 with a high-volume
  upsell to support@tallywhy.com (no separate Stripe tier in V1).

### Data Privacy
- Photo URLs in Supabase Storage with signed URLs (expire after 1 hour)
- No PII in logs
- Don't send card numbers to AI (extract only what's needed for categorization)
- Clear delete process if user requests data removal

---

## Cost Estimates

### Per-Receipt Costs
- Claude Haiku 4.5 (extraction): ~$0.003
- Claude Sonnet 4.6 (categorization + response): ~$0.012
- Twilio SMS (in + out, average 2 round-trips per receipt): ~$0.032
- **Total per receipt: ~$0.047**

### Monthly Costs at Different Scales
- 10 users × 30 receipts/month: ~$14/month
- 100 users × 30 receipts/month: ~$141/month
- 1,000 users × 30 receipts/month: ~$1,410/month

Plus fixed costs:
- Twilio phone number: $1/month
- Supabase: free → $25/month at scale
- Vercel: free → $20/month at scale
- Domain: ~$1/month
- Sentry: free → $26/month at scale

---

## File Structure

```
tally-mvp/
├── app/
│   ├── api/
│   │   ├── sms/
│   │   │   └── inbound/
│   │   │       └── route.ts
│   │   ├── auth/
│   │   │   ├── request-code/
│   │   │   │   └── route.ts
│   │   │   └── verify-code/
│   │   │       └── route.ts
│   │   ├── receipts/
│   │   │   ├── route.ts
│   │   │   ├── [id]/
│   │   │   │   ├── route.ts
│   │   │   │   └── attach-receipt/
│   │   │   │       └── route.ts
│   │   │   └── export/
│   │   │       └── route.ts
│   │   └── email-accountant/
│   │       └── route.ts
│   ├── login/
│   │   └── page.tsx
│   ├── dashboard/
│   │   └── page.tsx
│   ├── receipts/
│   │   └── [id]/
│   │       └── page.tsx
│   ├── privacy/
│   │   └── page.tsx
│   ├── terms/
│   │   └── page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── supabase.ts
│   ├── twilio.ts
│   ├── claude.ts
│   ├── prompts.ts
│   ├── substantiation.ts    ← NEW: decision tree logic
│   ├── ocr.ts                ← NEW: receipt extraction wrapper
│   └── auth.ts
├── components/
│   ├── ReceiptList.tsx
│   ├── ReceiptDetail.tsx
│   ├── SubstantiationBadge.tsx   ← NEW: shows "documentation complete" status
│   └── ...
├── middleware.ts
├── .env.local (NOT committed)
├── .gitignore
├── package.json
└── [all .md docs from handoff]
```

---

## Environment Variables

```
# Anthropic
ANTHROPIC_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Email (for accountant feature)
RESEND_API_KEY=  # or similar provider

# App
NEXT_PUBLIC_APP_URL=
SESSION_SECRET=

# Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN=
```

---

## Dashboard Display Logic

The web dashboard shows substantiation status visually:

### Per-receipt indicator
- ✅ **Documentation Complete** (green) — all required fields captured, receipt attached if needed
- ⚠️ **Receipt Needed** (yellow) — over $75 strict-category expense without photo, or lodging without photo
- ⚠️ **Context Needed** (yellow) — strict category missing required context fields
- ⏳ **Pending** (gray) — recently logged, awaiting clarification

### Dashboard summary widget
```
This Month
─────────────────────────────
Total logged:          $4,287
Receipts:              23
Documentation complete: 18 (78%)
Needs attention:        5 (22%)

[Complete documentation →]
```

The "needs attention" link filters the list to incomplete items.

---

## What's IN the V1 MVP

- SMS-based receipt capture (Twilio webhook)
- Photo OCR via Claude Vision (Haiku 4.5)
- Text-only expense capture
- 3-question onboarding (business type, entity type, default payment account)
- 7 pre-loaded IRC code summaries
- AI categorization with IRC citation
- **Smart substantiation logic (decision tree)**
- **Strict category context capture (meals, travel, gifts, vehicle, lodging)**
- **"Receipt needed" flags and reminders**
- Per-receipt payment account tracking (business vs personal)
- Multi-tenant data architecture (orgs from day 1)
- Web dashboard with phone-OTP login
- Receipt list, edit, delete
- CSV export + QuickBooks-compatible CSV
- "Email my accountant" feature
- Static landing page
- Privacy policy, terms, disclaimer pages

---

## What's NOT in V1

- Voice channel (Phase 2+)
- Mobile app (Phase 2)
- Tax deadline reminders (Phase 2)
- Stripe billing (free during beta)
- Multi-entity support (Phase 3)
- Bank linking via Plaid (Phase 3)
- Direct QuickBooks sync (Phase 3 — CSV export only for now)
- Accountant portal (Phase 3 — email feature only for now)
- State-specific features (Phase 3)
- Schedule C-formatted export (Phase 2)
- Tax filing (never — we're a logger, not a preparer)
- Entertainment expense edge cases (not deductible anyway)
- Per diem calculations (Phase 2)
- International travel rules (Phase 2+)

---

## Important Notes for Implementation

1. **The substantiation_rules table is the single source of truth** for how the AI behaves. Don't hardcode category logic anywhere else.

2. **Always pass relevant IRC summaries in the system prompt.** Load the matching summary for the determined category.

3. **Use prompt caching.** Anthropic's prompt caching reduces costs ~75% on repeated calls. Cache the system prompt and substantiation rules.

4. **Smart model routing.** Use Haiku 4.5 for OCR (cheap, fast), Sonnet 4.6 for categorization and conversation (better quality).

5. **Log every AI response.** Save conversations to the database for debugging, quality improvement, and legal protection.

6. **Never expose system prompts to users.** Don't echo back any part of these prompts in responses.

7. **Use "documentation complete" not "audit-ready"** in user-facing language. Less liability exposure.

8. **The SMS itself IS the written record** for sub-$75 strict-category expenses. Make sure this is preserved and timestamped in conversations table for retrieval.
