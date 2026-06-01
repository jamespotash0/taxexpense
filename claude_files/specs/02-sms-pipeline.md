# TSNAP-EPIC-2 — SMS Pipeline

**Owner:** Raj Patel + Sofia Reyes
**Effort:** 16 hours
**Days:** 3-5
**Priority:** P0 (Blocker)

## Epic Description

The core capture mechanism. Users text the number, AI handles the conversation, expenses get logged. This is the heart of the product.

## Epic Acceptance Criteria

- [ ] User can text the Twilio number and receive a response
- [ ] New user goes through 3-question onboarding in under 60 seconds
- [ ] User can send a photo and have it extracted into structured data
- [ ] User can send text-only and have it parsed correctly
- [ ] Conversation state is maintained across messages
- [ ] AI responses are conversational, not robotic
- [ ] All conversations are logged to database

---

## Tickets in Order

### TSNAP-013 — Twilio Webhook Endpoint Skeleton
**Type:** Story
**Owner:** Raj
**Effort:** 1 hour
**Depends on:** TSNAP-012
**Priority:** P0

**Description:**
Create the inbound SMS webhook endpoint that Twilio will call when someone texts our number. Start with echo response — just confirm round-trip works.

**Acceptance Criteria:**
- [ ] Route handler at `app/api/sms/inbound/route.ts` created
- [ ] POST method handles Twilio's `application/x-www-form-urlencoded` body
- [ ] Parses: `From`, `Body`, `NumMedia`, `MediaUrl0`, etc.
- [ ] Returns valid TwiML or empty 200
- [ ] Echo test: text the number, get same message back
- [ ] Configured in Twilio Console: webhook URL points to `https://yourdomain.com/api/sms/inbound`

**Technical Notes:**
```typescript
// app/api/sms/inbound/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const from = formData.get('From') as string;
  const body = formData.get('Body') as string;
  const numMedia = parseInt(formData.get('NumMedia') as string || '0');
  
  // TODO: Process message
  
  return new NextResponse('', { status: 200 });
}
```

- Test with: text your Twilio number from your phone
- Use Twilio Console "Inbound webhook" logs to debug

---

### TSNAP-014 — Twilio Outbound SMS Helper
**Type:** Task
**Owner:** Raj
**Effort:** 45 minutes
**Depends on:** TSNAP-013
**Priority:** P0

**Description:**
Create a reusable function to send SMS via Twilio API. We'll use this throughout for all outbound messages.

**Acceptance Criteria:**
- [ ] `lib/twilio.ts` exports `sendSMS(to: string, body: string)` function
- [ ] Function uses Twilio SDK with credentials from env vars
- [ ] Handles SMS segmentation (over 160 chars splits automatically)
- [ ] Returns success/failure status
- [ ] Errors are caught and logged
- [ ] Test: function successfully sends SMS to your phone

**Technical Notes:**
```typescript
// lib/twilio.ts
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function sendSMS(to: string, body: string) {
  try {
    const message = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to,
    });
    return { success: true, sid: message.sid };
  } catch (error) {
    console.error('SMS send failed:', error);
    return { success: false, error };
  }
}
```

---

### TSNAP-015 — Twilio Webhook Signature Validation
**Type:** Task
**Owner:** Jordan + Raj
**Effort:** 30 minutes
**Depends on:** TSNAP-013
**Priority:** P0 (security)

**Description:**
Verify incoming Twilio webhooks are actually from Twilio (not spoofed). Without this, anyone can send fake SMS to our endpoint.

**Acceptance Criteria:**
- [ ] Webhook validates `X-Twilio-Signature` header
- [ ] Invalid signatures return 403 Forbidden
- [ ] Valid signatures proceed normally
- [ ] Test: manual POST without valid signature is rejected
- [ ] Real Twilio webhooks still work after validation added

**Technical Notes:**
```typescript
import { validateRequest } from 'twilio';

const isValid = validateRequest(
  process.env.TWILIO_AUTH_TOKEN!,
  req.headers.get('X-Twilio-Signature')!,
  fullUrl,
  params
);

if (!isValid) {
  return new NextResponse('Forbidden', { status: 403 });
}
```

- Jordan's checklist requires this — non-negotiable
- Twilio docs: https://www.twilio.com/docs/usage/webhooks/webhooks-security

---

### TSNAP-016 — User Lookup & Conversation Storage
**Type:** Task
**Owner:** Raj
**Effort:** 1 hour
**Depends on:** TSNAP-013, TSNAP-005
**Priority:** P0

**Description:**
On each inbound SMS, look up the user by phone number. Create them if new. Log all conversations (inbound and outbound) to the database.

**Acceptance Criteria:**
- [ ] `getUserByPhone(phoneNumber: string)` function in `lib/auth.ts`
- [ ] If user doesn't exist, create them AND their organization (1:1 for V1)
- [ ] Each inbound SMS logged to `conversations` table with direction='inbound'
- [ ] Each outbound SMS logged with direction='outbound'
- [ ] Both messages get `user_id`, `organization_id`, `message_text`, `media_url` populated
- [ ] User's `last_active_at` updated on each inbound message

**Technical Notes:**
- Phone numbers should be normalized to E.164 format (+1XXXXXXXXXX)
- New users are created with `onboarding_completed = FALSE`, `onboarding_step = 0`
- Use a single transaction for user+org creation

---

### TSNAP-017 — Onboarding Conversation State Machine
**Type:** Story
**Owner:** Raj + Sofia
**Effort:** 2 hours
**Depends on:** TSNAP-016
**Priority:** P0

**Description:**
Implement the 3-question onboarding flow. Hard-coded responses (not LLM-generated) for reliability per SYSTEM-PROMPTS.md.

**Acceptance Criteria:**
- [ ] New user texting anything triggers Question 1: "What kind of work do you do?"
- [ ] User's response stored in `users.business_type`, `onboarding_step` → 1
- [ ] System sends Question 2: "Are you operating as a sole proprietor or single-member LLC?"
- [ ] Response stored in `users.entity_type`, `onboarding_step` → 2
- [ ] System sends Question 3: "Business account or personal account by default?"
- [ ] Response stored in `users.default_payment_account`, `onboarding_step` → 3
- [ ] System sends completion message with sample expense examples
- [ ] `users.onboarding_completed` → TRUE
- [ ] Tested end-to-end with a fresh phone number

**Technical Notes:**
- Use exact wording from SYSTEM-PROMPTS.md Prompt 3
- Parse free-text responses to extract entity_type and payment account preference (use a small LLM call if needed, or simple keyword matching)
- For entity_type: "sole prop", "sole proprietor" → 'sole_prop'; "LLC", "llc", "single-member" → 'smllc'; otherwise → 'unknown'
- For payment account: "business" → 'business'; "personal" → 'personal'; "mixed", "both" → 'unknown'
- Sofia review the conversation feel — should feel friendly, not robotic

---

### TSNAP-018 — Photo Upload to Supabase Storage
**Type:** Task
**Owner:** Raj
**Effort:** 1 hour
**Depends on:** TSNAP-013
**Priority:** P0

**Description:**
When user sends an MMS with a photo, download from Twilio and store in Supabase Storage. Return a signed URL for AI processing.

**Acceptance Criteria:**
- [ ] Storage bucket `receipts` created in Supabase (private, not public)
- [ ] Function `downloadAndStorePhoto(twilioMediaUrl: string, userId: string)` in `lib/ocr.ts`
- [ ] Downloads photo from Twilio (requires Twilio auth in URL)
- [ ] Uploads to Supabase Storage at path `receipts/{user_id}/{uuid}.jpg`
- [ ] Returns signed URL with 1-hour expiry
- [ ] Handles errors gracefully (network issues, unsupported format)
- [ ] Test: photo from SMS appears in Supabase Storage

**Technical Notes:**
```typescript
import { supabaseAdmin } from '@/lib/supabase';

async function downloadAndStorePhoto(twilioMediaUrl: string, userId: string) {
  // Twilio URLs require auth
  const authUrl = twilioMediaUrl.replace(
    'https://',
    `https://${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}@`
  );
  
  const response = await fetch(authUrl);
  const blob = await response.blob();
  
  const filename = `${userId}/${crypto.randomUUID()}.jpg`;
  
  const { data, error } = await supabaseAdmin.storage
    .from('receipts')
    .upload(filename, blob, { contentType: 'image/jpeg' });
  
  if (error) throw error;
  
  const { data: signedUrl } = await supabaseAdmin.storage
    .from('receipts')
    .createSignedUrl(filename, 3600);
  
  return signedUrl.signedUrl;
}
```

---

### TSNAP-019 — Claude Vision OCR Integration
**Type:** Story
**Owner:** Raj
**Effort:** 2 hours
**Depends on:** TSNAP-018, TSNAP-010
**Priority:** P0

**Description:**
Integrate Claude Haiku 4.5 to extract structured data from receipt photos. Use Prompt 1 from SYSTEM-PROMPTS.md.

**Acceptance Criteria:**
- [ ] Function `extractReceiptFromPhoto(photoUrl: string)` in `lib/ocr.ts`
- [ ] Uses Claude Haiku 4.5 with vision capability
- [ ] System prompt from SYSTEM-PROMPTS.md Prompt 1
- [ ] Returns structured JSON: `{vendor, total_amount, transaction_date, items, payment_method, confidence}`
- [ ] Handles "not a receipt" responses gracefully
- [ ] Handles "unreadable" responses gracefully
- [ ] Confidence threshold of 0.7 — below that, asks user to verify
- [ ] Test: 10 real receipt photos extract correctly

**Technical Notes:**
```typescript
async function extractReceiptFromPhoto(photoUrl: string) {
  const response = await claude.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 1024,
    system: RECEIPT_EXTRACTION_PROMPT,  // from prompts.ts
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'url', url: photoUrl } },
        { type: 'text', text: 'Extract receipt data.' }
      ]
    }]
  });
  
  const text = response.content[0].text;
  return JSON.parse(text);
}
```

- Test with: blurry photos, multiple receipts, non-receipts, foreign language
- Log extraction failures for later analysis

---

### TSNAP-020 — Text-Only Expense Parsing
**Type:** Task
**Owner:** Raj
**Effort:** 1.5 hours
**Depends on:** TSNAP-010
**Priority:** P0

**Description:**
Parse text-only expense inputs like "$340 dinner at Morton's with John from Acme re Q3". Extract amount, vendor, date, context.

**Acceptance Criteria:**
- [ ] Function `parseTextExpense(text: string, userContext: User)` in `lib/ocr.ts`
- [ ] Uses Claude Haiku 4.5 (simple structured extraction)
- [ ] Returns: `{amount, vendor, transaction_date, attendees, business_purpose, raw_text, confidence}`
- [ ] Defaults to today's date if not mentioned
- [ ] Handles missing vendor gracefully
- [ ] Test: 20 different expense text inputs parse correctly

**Technical Notes:**
- Use a focused prompt: "Extract structured data from this expense description"
- Return null fields rather than guessing when unclear
- Don't make AI categorize yet — that's TSNAP-022

---

### TSNAP-021 — Smart Categorization with Substantiation
**Type:** Story
**Owner:** Raj + Priya
**Effort:** 3 hours
**Depends on:** TSNAP-019, TSNAP-020, TSNAP-007
**Priority:** P0

**Description:**
The core intelligence: categorize expenses, look up substantiation rules, and decide what to do next. Uses Prompt 2 + Prompt 6 from SYSTEM-PROMPTS.md.

**Acceptance Criteria:**
- [ ] Function `categorizeAndRespond(expenseData, user)` in `lib/prompts.ts`
- [ ] First calls Prompt 6 (categorization helper) with Claude Haiku 4.5
- [ ] Looks up `substantiation_rules` for the determined category
- [ ] Loads relevant IRC summary
- [ ] Calls Prompt 2 (categorization + response) with Claude Sonnet 4.6
- [ ] Passes: user context, substantiation rule, IRC summary, expense data
- [ ] Returns SMS response text + structured update for receipts table
- [ ] Test: 10 different expense scenarios route correctly through decision tree

**Technical Notes:**
- This is the most important function in the product
- See SPEC.md "The Substantiation Decision Tree" for the logic
- Cache the system prompt with Anthropic's prompt caching (75% cost reduction)
- Test all the SYSTEM-PROMPTS.md examples (Examples 1-9)

---

### TSNAP-022 — Receipt Database Save
**Type:** Task
**Owner:** Raj
**Effort:** 1 hour
**Depends on:** TSNAP-021
**Priority:** P0

**Description:**
Save categorized expenses to the `receipts` table with proper substantiation status.

**Acceptance Criteria:**
- [ ] Function `saveReceipt(data, user)` in `lib/db.ts`
- [ ] All fields populated: vendor, amount_cents, date, category, irc_section, deduction_percentage, deductible_amount_cents
- [ ] Substantiation fields populated based on what AI captured
- [ ] `needs_receipt` set based on decision tree
- [ ] `substantiation_complete` calculated based on required_context_fields
- [ ] `raw_extracted_data` stored as JSONB
- [ ] `payment_account` defaults to user's default if not specified
- [ ] Returns the inserted receipt ID

**Technical Notes:**
- Use Supabase admin client (bypasses RLS)
- All amounts stored in cents to avoid floating point issues
- Don't update users.last_active_at here (handled in TSNAP-016)

---

### TSNAP-023 — Clarification Question Flow
**Type:** Story
**Owner:** Raj + Sofia
**Effort:** 2 hours
**Depends on:** TSNAP-021, TSNAP-022
**Priority:** P0

**Description:**
When AI asks a clarifying question, the next message from user should be processed as a response to that question (not a new expense).

**Acceptance Criteria:**
- [ ] `conversations` table tracks `context_state` and `receipt_id` for pending questions
- [ ] When user responds to a question, system identifies the pending receipt
- [ ] Uses Prompt 4 from SYSTEM-PROMPTS.md to process clarification
- [ ] Updates the relevant receipt fields based on response
- [ ] Recomputes `substantiation_complete` after update
- [ ] Sends confirmation SMS
- [ ] If response doesn't address the question, asks again (max 2 retries)
- [ ] Test: full flow with photo → question → response → completion

**Technical Notes:**
- State machine: each receipt can be in state `pending_question` or `complete`
- Look up most recent receipt for user with `needs_receipt=TRUE` OR `substantiation_complete=FALSE`
- Time out pending questions after 24 hours (treat next message as new expense)
- Sofia review: the questions should feel like a smart friend asking, not a form

---

### TSNAP-024 — Receipt Attachment Flow (Photo After Text)
**Type:** Story
**Owner:** Raj
**Effort:** 1.5 hours
**Depends on:** TSNAP-022, TSNAP-023
**Priority:** P0

**Description:**
When user sends a photo to attach to a previously-logged text expense (because we asked for receipt), match it correctly. Uses Prompt 5.

**Acceptance Criteria:**
- [ ] System detects photo arrives when user has receipts with `needs_receipt=TRUE`
- [ ] Looks up most recent expense that matches (vendor name approximate match, amount approximate match)
- [ ] Uses Prompt 5 from SYSTEM-PROMPTS.md to cross-check
- [ ] If high confidence match: attaches photo, sets `needs_receipt=FALSE`, recalculates substantiation
- [ ] If low confidence: asks user "Is this for the Morton's expense from yesterday?"
- [ ] Test: text expense → 1 day later → photo → correctly attached

**Technical Notes:**
- This is tricky: people send photos days apart from the original text
- Default behavior if no recent match: treat as new expense (call TSNAP-021)
- Use OCR to extract vendor/amount, then SQL fuzzy match against pending receipts

---

### TSNAP-025 — Multi-Tenant Data Isolation
**Type:** Task
**Owner:** Raj + Jordan
**Effort:** 30 minutes
**Depends on:** TSNAP-016
**Priority:** P0 (security)

**Description:**
Ensure all receipt queries filter by organization_id. No user should ever see another user's data.

**Acceptance Criteria:**
- [ ] All `receipts` queries include `organization_id = userOrgId` filter
- [ ] All `conversations` queries include `user_id = userId` filter
- [ ] Helper function `requireUserOrg(userId)` returns the user's org_id
- [ ] Code review: no query bypasses these filters
- [ ] Test: create 2 users, verify each sees only their own data

**Technical Notes:**
- This is structural — handled by always querying through the helper
- Future: enable Supabase Row Level Security policies for defense in depth
- Jordan must sign off on this before EPIC 2 is complete

---

### TSNAP-026 — Error Handling & Graceful Failures
**Type:** Task
**Owner:** Raj + Sofia
**Effort:** 1 hour
**Depends on:** TSNAP-019, TSNAP-020, TSNAP-021
**Priority:** P0

**Description:**
Handle every AI failure mode without breaking the user experience.

**Acceptance Criteria:**
- [ ] If OCR returns `not_a_receipt`: SMS says "That doesn't look like a receipt. Want to describe the expense in text instead?"
- [ ] If OCR returns `unreadable`: SMS says "That photo's a bit blurry. Can you snap another, or just text me the details?"
- [ ] If text parsing returns null fields: ask user "Got it — quick: how much was this?"
- [ ] If Claude API times out (10s+): SMS says "Hmm, taking a moment. Can you try again?"
- [ ] If Claude returns malformed JSON: retry once, then fall back to "Sorry, can you describe what this was?"
- [ ] All errors logged to Sentry or console (visible for debugging)
- [ ] Test: deliberately trigger each error mode

**Technical Notes:**
- Wrap all Claude calls in try/catch
- Set 15-second timeout on Claude calls (use AbortController)
- Always send SOME response to user — never leave them hanging
- Sofia review: error messages should feel human, not technical

---

## Day 3 Checklist

**Morning (4 hours):**
- [ ] TSNAP-013: Webhook skeleton (1h)
- [ ] TSNAP-014: Outbound SMS helper (45min)
- [ ] TSNAP-015: Signature validation (30min)
- [ ] TSNAP-016: User lookup + conversation storage (1h)
- [ ] TSNAP-017: Start onboarding flow (45min)

**Afternoon (3 hours):**
- [ ] TSNAP-017: Finish onboarding (1.25h)
- [ ] TSNAP-018: Photo upload to storage (1h)
- [ ] Test end-to-end: new user → onboards → can send anything (45min)

## Day 4 Checklist

**Morning (4 hours):**
- [ ] TSNAP-019: Claude Vision OCR (2h)
- [ ] TSNAP-020: Text-only parsing (1.5h)
- [ ] Start TSNAP-021: Smart categorization (30min)

**Afternoon (3 hours):**
- [ ] TSNAP-021: Finish smart categorization (2.5h)
- [ ] TSNAP-022: Receipt save (30min)

## Day 5 Checklist

**Morning (4 hours):**
- [ ] TSNAP-023: Clarification flow (2h)
- [ ] TSNAP-024: Receipt attachment (1.5h)
- [ ] Start TSNAP-025: Multi-tenant isolation (30min)

**Afternoon (3 hours):**
- [ ] TSNAP-025: Finish multi-tenant (since most was done in 16)
- [ ] TSNAP-026: Error handling (1h)
- [ ] End-to-end testing of full SMS pipeline (2h)

---

## Definition of Done for EPIC 2

This epic is DONE when:
1. ✅ A new user can text the number and complete onboarding
2. ✅ User can send a photo of any receipt and it gets categorized correctly
3. ✅ User can send text expenses and they get categorized correctly
4. ✅ AI asks clarifying questions only when required
5. ✅ AI requests receipts only when IRS rules require them
6. ✅ Conversation state is maintained correctly
7. ✅ All conversations logged to database
8. ✅ Errors are handled gracefully
9. ✅ Sofia signs off on conversation feel
10. ✅ Jordan signs off on multi-tenant isolation

You are now ready for EPIC 3: Substantiation Logic (or it may already be partially complete via TSNAP-021).
