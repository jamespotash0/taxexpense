# TSNAP-EPIC-4 — Web Dashboard

**Owner:** Emma Larsson + David Park
**Effort:** 14 hours
**Days:** 6-8
**Priority:** P0 (Blocker)

## Epic Description

The review/management interface. Users come here to see their records, edit details, attach receipts to text-only expenses, and export data. SMS is primary; dashboard is for review.

## Epic Acceptance Criteria

- [ ] User can log in with phone OTP
- [ ] Receipt list displays all user's receipts
- [ ] User can view receipt details
- [ ] User can edit any field
- [ ] User can attach a photo to a previously-logged expense
- [ ] User can delete receipts
- [ ] User can export to CSV (standard + QuickBooks-compatible)
- [ ] Substantiation status is visually clear
- [ ] Mobile-responsive (works on iPhone Safari, Android Chrome)

---

## Tickets in Order

### TSNAP-034 — Visual Design System Setup
**Type:** Story
**Owner:** David
**Effort:** 1.5 hours
**Depends on:** TSNAP-002
**Priority:** P0

**Description:**
Establish design tokens, base components, and visual language. Keep it minimal — David's principle is "restraint over expression."

**Acceptance Criteria:**
- [ ] Tailwind config customized with:
  - Primary color: single accent (suggest a refined blue or near-black)
  - Neutrals: 9-step gray scale
  - Semantic: success green, warning amber, error red
- [ ] Typography: system font stack (no custom fonts in V1)
- [ ] Spacing scale: 4px base unit (Tailwind default works)
- [ ] Border radius: consistent (suggest 6px for most elements)
- [ ] No gradient backgrounds, no glow effects, no AI-cliché aesthetics
- [ ] Test: a button component looks clean and intentional

**Technical Notes:**
```js
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: { /* deep blue or near-black */ },
        success: { 50: '...', 500: '#22c55e', 700: '...' },
        warning: { 50: '...', 500: '#f59e0b', 700: '...' },
        error: { 50: '...', 500: '#ef4444', 700: '...' },
      },
    },
  },
};
```

- Test components in grayscale first — if they don't work without color, color won't save them
- No emoji or icons yet (icons come per-component)

---

### TSNAP-035 — Phone OTP Auth: Request Code
**Type:** Story
**Owner:** Emma + Jordan
**Effort:** 1.5 hours
**Depends on:** TSNAP-005, TSNAP-014
**Priority:** P0

**Description:**
User enters phone number → receives 6-digit code via SMS → enters code to log in.

**Acceptance Criteria:**
- [ ] `/login` page with phone number input
- [ ] Phone number input validates US format (+1 XXX-XXX-XXXX)
- [ ] On submit: POST `/api/auth/request-code` with phone number
- [ ] API generates 6-digit code (e.g., `crypto.randomInt(100000, 999999)`)
- [ ] Code stored in `auth_codes` table with 10-min expiry
- [ ] SMS sent: "Your Tally code is: 123456 (expires in 10 min)"
- [ ] UI transitions to code entry screen
- [ ] Rate limited: max 3 requests per phone per 15 minutes
- [ ] If rate limit hit: clear error message to user

**Technical Notes:**
- Generate code server-side, never client-side
- Use `crypto.randomInt` for cryptographically secure codes
- Store code as hashed value if paranoid (not required for V1)
- Jordan must verify rate limiting before production

---

### TSNAP-036 — Phone OTP Auth: Verify Code & Create Session
**Type:** Story
**Owner:** Emma + Jordan
**Effort:** 1 hour
**Depends on:** TSNAP-035
**Priority:** P0

**Description:**
User submits the 6-digit code → system verifies → creates session token → user is logged in.

**Acceptance Criteria:**
- [ ] Code entry screen with 6 input fields (auto-advance)
- [ ] On submit: POST `/api/auth/verify-code` with phone + code
- [ ] API looks up most recent unexpired code for phone
- [ ] If match: mark code as used, generate session token, store in `sessions` table
- [ ] Session token returned in HTTP-only secure cookie
- [ ] Cookie: `sameSite=lax`, expires in 30 days
- [ ] Redirect to `/dashboard` on success
- [ ] Wrong code: clear error message, allow retry
- [ ] Max 5 failed attempts per code, then must request new code

**Technical Notes:**
```typescript
// Generate session token
const token = crypto.randomBytes(32).toString('base64url');

// Store in database
await supabaseAdmin.from('sessions').insert({
  user_id: userId,
  token,
  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
});

// Set cookie
cookies().set('session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60,
});
```

- Code expiry is enforced both client-side and server-side
- Use the existing user (from SMS interactions) — don't create duplicate

---

### TSNAP-037 — Auth Middleware
**Type:** Task
**Owner:** Emma + Jordan
**Effort:** 45 minutes
**Depends on:** TSNAP-036
**Priority:** P0

**Description:**
Protect all dashboard routes — redirect to login if no valid session.

**Acceptance Criteria:**
- [ ] `middleware.ts` checks session cookie on protected routes
- [ ] Protected routes: `/dashboard`, `/receipts/*`
- [ ] Public routes: `/`, `/login`, `/privacy`, `/terms`, `/api/sms/*`, `/api/auth/*`
- [ ] Invalid session → redirect to `/login` with `?returnTo=` param
- [ ] Valid session → request continues, user attached to context
- [ ] Helper `getCurrentUser()` for server components to access user

**Technical Notes:**
```typescript
// middleware.ts
export async function middleware(req: NextRequest) {
  const protectedPaths = ['/dashboard', '/receipts'];
  const isProtected = protectedPaths.some(p => req.nextUrl.pathname.startsWith(p));
  
  if (!isProtected) return NextResponse.next();
  
  const token = req.cookies.get('session')?.value;
  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('returnTo', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // Verify token in DB
  // ... (or do this in the page itself for simplicity)
  
  return NextResponse.next();
}
```

---

### TSNAP-038 — Dashboard Page: Summary Widget
**Type:** Story
**Owner:** Emma + David
**Effort:** 1.5 hours
**Depends on:** TSNAP-037
**Priority:** P0

**Description:**
Top of dashboard shows summary: this month's totals, documentation status, quick stats.

**Acceptance Criteria:**
- [ ] `/dashboard` page accessible after login
- [ ] Summary widget shows:
  - Total logged this month
  - Number of receipts this month
  - Total deductible amount this month
  - Documentation complete % (X of Y)
  - Items needing attention count with link
- [ ] Data fetched server-side (Server Component)
- [ ] Loading skeleton while data loads
- [ ] Mobile responsive (320px+)

**Technical Notes:**
- Use Server Component for initial render
- David: keep visual hierarchy clear — total amount is the headline
- "Needs attention" link goes to filtered receipt list

---

### TSNAP-039 — Dashboard Page: Receipt List
**Type:** Story
**Owner:** Emma + David
**Effort:** 2 hours
**Depends on:** TSNAP-038
**Priority:** P0

**Description:**
The main receipt list. Reverse chronological. Visible info: date, vendor, amount, category, substantiation badge.

**Acceptance Criteria:**
- [ ] Receipts listed in reverse chronological order
- [ ] Each row shows: date (Apr 15), vendor (Morton's), amount ($340), category (Meals), substantiation badge
- [ ] Substantiation badge:
  - Green "✓ Complete" if substantiation_complete=TRUE
  - Yellow "⚠ Needs receipt" if needs_receipt=TRUE
  - Yellow "⚠ Needs context" if substantiation_missing_fields not empty
- [ ] Tap row → navigate to receipt detail page
- [ ] Empty state: "No receipts yet. Text [phone] to get started."
- [ ] Pagination: load 20 at a time, "Load more" button
- [ ] Filter: dropdown for "All", "Needs attention", "This month"
- [ ] Mobile responsive

**Technical Notes:**
- Server Component for initial 20 receipts
- "Load more" can be a Client Component with useState
- David: dense but scannable — Linear-like, not Stripe Dashboard-like
- Show payment_account icon (business/personal) on each row

---

### TSNAP-040 — Receipt Detail Page
**Type:** Story
**Owner:** Emma + David
**Effort:** 2 hours
**Depends on:** TSNAP-039
**Priority:** P0

**Description:**
Detailed view of a single receipt with ability to edit any field, attach photo if missing, delete.

**Acceptance Criteria:**
- [ ] `/receipts/[id]` route
- [ ] Shows all receipt fields with inline editing
- [ ] If photo exists, display it prominently
- [ ] If photo missing and needs_receipt=TRUE, "Upload receipt" button
- [ ] All fields editable: vendor, amount, date, category, payment_account, business_purpose, attendees, business_relationship, notes
- [ ] Save updates field in DB, recomputes substantiation_complete
- [ ] Delete button with confirmation modal
- [ ] IRC summary displayed in sidebar (educational context)
- [ ] Mobile responsive

**Technical Notes:**
- Use form with controlled inputs
- Debounced auto-save (1s after typing stops) — feels modern
- Show "Saved ✓" indicator after save
- Sofia: layout should feel like a card, not a form

---

### TSNAP-041 — Photo Upload from Dashboard
**Type:** Story
**Owner:** Emma + Raj
**Effort:** 1.5 hours
**Depends on:** TSNAP-040, TSNAP-018, TSNAP-019
**Priority:** P0

**Description:**
User can attach a receipt photo to a previously-logged text expense via the dashboard (not just SMS).

**Acceptance Criteria:**
- [ ] "Upload receipt" button on receipt detail page (when no photo + needs_receipt)
- [ ] File picker accepts JPG, PNG, HEIC (iOS), PDF
- [ ] Max file size: 10MB (Twilio limit, consistency)
- [ ] On upload: file goes to Supabase Storage (private bucket)
- [ ] OCR runs to extract data
- [ ] Receipt updated with photo_url, needs_receipt=FALSE
- [ ] Substantiation status recomputed
- [ ] Loading state during upload + OCR
- [ ] Success: "Receipt attached. Documentation complete."
- [ ] Error handling: bad file type, too large, OCR failure

**Technical Notes:**
- Use `<input type="file" accept="image/*,.pdf">`
- For HEIC: convert to JPG server-side (Sharp library can do this)
- Endpoint: POST `/api/receipts/[id]/attach-receipt` with multipart form
- This is the dashboard equivalent of TSNAP-024

---

### TSNAP-042 — CSV Export (Standard)
**Type:** Story
**Owner:** Emma
**Effort:** 1 hour
**Depends on:** TSNAP-039
**Priority:** P0

**Description:**
User can download a CSV of all their receipts. Useful for accountants, personal records.

**Acceptance Criteria:**
- [ ] "Export CSV" button on dashboard
- [ ] Endpoint `/api/receipts/export?format=csv`
- [ ] CSV columns: Date, Vendor, Amount, Category, IRC Section, Deductible Amount, Payment Account, Business Purpose, Attendees, Notes, Receipt Photo URL
- [ ] Filename: `tally-export-YYYY-MM-DD.csv`
- [ ] All amounts formatted as currency
- [ ] Dates in YYYY-MM-DD format
- [ ] Triggers browser download
- [ ] Test: open in Excel/Numbers, formats correctly

**Technical Notes:**
- Use a CSV library or write your own (it's just commas and escaping)
- Set Content-Type: text/csv and Content-Disposition: attachment
- Filter by date range if `?from=X&to=Y` query params provided

---

### TSNAP-043 — CSV Export (QuickBooks Compatible)
**Type:** Story
**Owner:** Emma + Priya
**Effort:** 1 hour
**Depends on:** TSNAP-042
**Priority:** P1

**Description:**
QuickBooks-compatible CSV format. Lets users import directly into their accountant's QBO.

**Acceptance Criteria:**
- [ ] Endpoint `/api/receipts/export?format=quickbooks`
- [ ] CSV columns match QuickBooks IIF/CSV import format
- [ ] Required columns: Date, Description, Amount, Account (Chart of Accounts)
- [ ] Categories mapped to standard QBO accounts (Meals, Travel, etc.)
- [ ] Test: import into QuickBooks Online sandbox successfully
- [ ] Available from "Export" dropdown alongside standard CSV

**Technical Notes:**
- QBO CSV format: https://quickbooks.intuit.com/learn-support/en-us/help-article/import-export/import-data-quickbooks-online/L4f7QzZIw_US_en_US
- Category mapping example:
  - `meals_business` → "Meals and Entertainment"
  - `software` → "Software"
  - `travel_lodging` → "Travel - Lodging"
- Some categories may not have exact QBO equivalents — make best match

---

### TSNAP-044 — Empty States & Loading States
**Type:** Task
**Owner:** Emma + David
**Effort:** 1 hour
**Depends on:** TSNAP-039, TSNAP-040
**Priority:** P1

**Description:**
First-time experience and loading states for every list/detail view.

**Acceptance Criteria:**
- [ ] Empty receipt list: "No receipts yet. Text [phone number] to get started."
- [ ] Loading list: skeleton screen (gray bars), not spinner
- [ ] Loading detail: skeleton screen
- [ ] Error states: clear messages, never blank pages
- [ ] David approves: empty states feel inviting, not depressing

**Technical Notes:**
- Use shadcn/ui or custom Tailwind skeleton components
- Empty state should include action: "Text the number" with the actual number visible

---

### TSNAP-045 — Mobile Responsiveness Audit
**Type:** Task
**Owner:** Emma
**Effort:** 1 hour
**Depends on:** TSNAP-038, TSNAP-039, TSNAP-040
**Priority:** P0

**Description:**
Test entire dashboard on real mobile devices. Fix anything broken.

**Acceptance Criteria:**
- [ ] Tested on iPhone Safari (real device or iOS Simulator)
- [ ] Tested on Android Chrome (real device or emulator)
- [ ] Touch targets minimum 44px
- [ ] No horizontal scroll
- [ ] Forms work with mobile keyboards
- [ ] Photo upload works from mobile camera roll
- [ ] Tap targets don't overlap
- [ ] Text is readable without zoom (min 16px on mobile)

**Technical Notes:**
- Chrome DevTools mobile emulation is NOT enough — test real devices
- The majority of users will check dashboard from their phone
- Pay special attention to receipt detail page (lots of form fields)

---

## Day 6 Checklist

**Morning (4 hours):**
- [ ] TSNAP-034: Design system setup (1.5h)
- [ ] TSNAP-035: Phone OTP request (1.5h)
- [ ] TSNAP-036: Phone OTP verify (1h)

**Afternoon (3 hours):**
- [ ] TSNAP-037: Auth middleware (45min)
- [ ] TSNAP-038: Dashboard summary widget (1.5h)
- [ ] Start TSNAP-039: Receipt list (45min)

## Day 7 Checklist

**Morning (4 hours):**
- [ ] TSNAP-039: Finish receipt list (1.5h)
- [ ] TSNAP-040: Receipt detail page (2h)
- [ ] Start TSNAP-041: Photo upload (30min)

**Afternoon (3 hours):**
- [ ] TSNAP-041: Finish photo upload (1h)
- [ ] TSNAP-042: CSV export (1h)
- [ ] TSNAP-043: QBO CSV export (1h)

## Day 8 Checklist

**Morning (4 hours):**
- [ ] TSNAP-044: Empty/loading states (1h)
- [ ] TSNAP-045: Mobile responsiveness audit (1h)
- [ ] EPIC 8: Email Accountant feature (2h) — see below

**Afternoon (3 hours):**
- [ ] EPIC 8: Finish Email Accountant (2h)
- [ ] Buffer / polish
- [ ] Get ahead on EPIC 5 if time

---

## EPIC 8 — Email Accountant Feature (Bundled with Day 8)

### TSNAP-046 — Email Service Integration
**Type:** Task
**Owner:** Emma
**Effort:** 30 minutes
**Priority:** P1

**Description:**
Set up Resend.com (or similar) for transactional email.

**Acceptance Criteria:**
- [ ] Resend SDK installed
- [ ] Domain verified for sending
- [ ] Test email sends successfully
- [ ] Helper `sendEmail(to, subject, html, attachments?)` works

---

### TSNAP-047 — PDF Generation
**Type:** Task
**Owner:** Emma
**Effort:** 1.5 hours
**Priority:** P1

**Description:**
Generate a monthly summary PDF for a user.

**Acceptance Criteria:**
- [ ] Function `generateMonthlySummaryPDF(userId, year, month)` returns PDF buffer
- [ ] PDF includes: Tally header, user name, period, summary stats, table of all receipts
- [ ] PDF is well-formatted (use library like `@react-pdf/renderer`)
- [ ] Tested: opens correctly in Preview, Adobe Reader, web browser

---

### TSNAP-048 — Email Accountant UI + Backend
**Type:** Story
**Owner:** Emma
**Effort:** 2 hours
**Priority:** P1

**Description:**
User adds accountant email, clicks button, accountant receives PDF + CSV.

**Acceptance Criteria:**
- [ ] Settings field: `accountant_email` in user profile
- [ ] Dashboard button: "Email this month to my accountant"
- [ ] Endpoint `/api/email-accountant` generates PDF + CSV, sends to configured email
- [ ] Email subject: "Tally Monthly Summary — {User Name} — {Month YYYY}"
- [ ] Email body: brief explanation + attachment list
- [ ] Confirmation in UI: "Sent to accountant@example.com"
- [ ] If no email configured: prompt user to add one first

**This entire mini-epic (4 hours) can SLIP to week 3 if behind schedule.**

---

## Definition of Done for EPIC 4

This epic is DONE when:
1. ✅ User can log in with phone OTP
2. ✅ Dashboard shows accurate summary
3. ✅ Receipt list displays all data correctly
4. ✅ Substantiation badges visible and accurate
5. ✅ Receipt detail page allows editing all fields
6. ✅ Photo upload works from dashboard
7. ✅ CSV exports work (both formats)
8. ✅ Mobile responsive on iOS and Android
9. ✅ Empty + loading states are graceful
10. ✅ David approves visual design
11. ✅ Emma signs off on performance

If EPIC 8 (Email Accountant) is included, it's done when:
1. ✅ User can configure accountant email
2. ✅ Monthly summary PDF generates correctly
3. ✅ Email arrives with PDF + CSV attached
4. ✅ Process takes < 30 seconds end-to-end

You are now ready for EPIC 5: Landing Page & Legal.
