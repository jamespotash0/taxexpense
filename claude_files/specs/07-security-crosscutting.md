# TSNAP-EPIC-7 — Security (Cross-cutting)

**Owner:** Jordan Kim
**Effort:** 6 hours
**Days:** Throughout
**Priority:** P0 (Blocker)

## Epic Description

Security isn't a feature — it's a constraint. These tickets capture security work that happens IN PARALLEL with other epics. Many of them are referenced in other epic tickets (e.g., TSNAP-015 for webhook validation appears in EPIC 2 but is owned by Jordan).

This file serves as the SECURITY MASTER CHECKLIST. Jordan should review this entire list before sign-off in TSNAP-064.

## Epic Acceptance Criteria

- [ ] All security tickets complete
- [ ] Jordan signs off on launch readiness
- [ ] Compliance checklist (TCPA, privacy) complete
- [ ] No P0 security issues outstanding

---

## Tickets in Order

### TSNAP-068 — Threat Model
**Type:** Story
**Owner:** Jordan
**Effort:** 1 hour
**Day:** 1 or 2
**Priority:** P0

**Description:**
Map out who would attack Tally, why, and how. This guides every other security decision.

**Acceptance Criteria:**
- [ ] Document `/docs/THREAT-MODEL.md` created
- [ ] Identifies threat actors:
  - Curious users (try to access others' data)
  - Spammers (abuse SMS gateway)
  - Phishers (impersonate Tally to steal credentials)
  - Competitors (scrape data)
  - Insiders (e.g., compromised dev account)
- [ ] For each threat, identifies:
  - What they want
  - How they'd attack
  - Our defense

**Technical Notes:**
- This is a one-time document — write it well, refer back often
- Focus on V1 attack surface: SMS, web auth, dashboard
- Out of scope: nation-state attackers, physical security

---

### TSNAP-069 — Twilio Webhook Signature Validation
**Type:** Task
**Owner:** Jordan + Raj
**Effort:** 30 minutes
**Day:** 3 (during EPIC 2)
**Priority:** P0

**Status:** Duplicate of TSNAP-015. Listed here for security tracking.

**Description:**
Verify incoming Twilio webhooks are actually from Twilio. Without this, anyone can spoof SMS.

**See:** `tickets/02-sms-pipeline.md#TSNAP-015`

---

### TSNAP-070 — Rate Limiting on Auth Endpoints
**Type:** Task
**Owner:** Jordan + Emma
**Effort:** 45 minutes
**Day:** 6 (during EPIC 4)
**Priority:** P0

**Description:**
Prevent brute force attacks on OTP login and SMS abuse.

**Acceptance Criteria:**
- [ ] OTP requests: max 3 per phone per 15 minutes
- [ ] OTP verifications: max 5 wrong attempts per code, then locked
- [ ] SMS receipt logging: max 30 per user per day (prevents abuse)
- [ ] When rate limited: clear error message, not generic 500
- [ ] Rate limits tracked in database or Redis (not in-memory)

**Technical Notes:**
- Use database-backed rate limiting (simpler than Redis for V1)
- Track by phone number for OTP, by user_id for logging
- Use sliding window or fixed window — sliding is more accurate
- Example: count attempts in last 15 min

```typescript
const recentAttempts = await supabaseAdmin
  .from('auth_codes')
  .select('id')
  .eq('phone_number', phone)
  .gte('created_at', new Date(Date.now() - 15 * 60 * 1000));

if (recentAttempts.data!.length >= 3) {
  return res.json({ error: 'Too many attempts. Try again in 15 minutes.' });
}
```

---

### TSNAP-071 — Session Token Security
**Type:** Task
**Owner:** Jordan + Emma
**Effort:** 30 minutes
**Day:** 6 (during EPIC 4)
**Priority:** P0

**Description:**
Secure session token handling per industry best practices.

**Acceptance Criteria:**
- [ ] Tokens generated with `crypto.randomBytes(32).toString('base64url')` (cryptographically secure)
- [ ] Stored in HTTP-only secure cookies
- [ ] Cookie: `sameSite=lax`
- [ ] 30-day expiry
- [ ] Logout endpoint deletes session from DB
- [ ] Token rotation on sensitive actions (optional, defer to V2)
- [ ] No tokens in URLs, logs, or client-side JavaScript

**Technical Notes:**
- `httpOnly` prevents XSS from stealing the token
- `secure` ensures HTTPS only
- `sameSite=lax` prevents CSRF
- Token MUST be unguessable — never use sequential IDs or timestamps

---

### TSNAP-072 — Photo URL Signing
**Type:** Task
**Owner:** Jordan + Raj
**Effort:** 30 minutes
**Day:** 4 (during EPIC 2)
**Priority:** P0

**Description:**
Receipt photos contain financial data. URLs must be signed and time-limited.

**Acceptance Criteria:**
- [ ] Supabase Storage bucket `receipts` is PRIVATE (not public)
- [ ] All photo access uses signed URLs from `storage.createSignedUrl()`
- [ ] Default expiry: 1 hour
- [ ] No direct path-based access works (verify by trying)
- [ ] When generating signed URLs, log who requested (for audit)

**Technical Notes:**
```typescript
const { data } = await supabaseAdmin.storage
  .from('receipts')
  .createSignedUrl('user-id/receipt.jpg', 3600);
// data.signedUrl
```

- 1 hour is plenty for SMS responses
- Dashboard may need to regenerate URLs on each view (cheap operation)

---

### TSNAP-073 — Input Sanitization
**Type:** Task
**Owner:** Jordan + Raj
**Effort:** 1 hour
**Day:** Throughout
**Priority:** P0

**Description:**
All user inputs must be sanitized before DB queries and output.

**Acceptance Criteria:**
- [ ] All DB queries use Supabase client (parameterized) — never raw SQL with concatenation
- [ ] Phone numbers normalized to E.164 format before storage
- [ ] User-provided text (business_purpose, notes, etc.) escaped before display
- [ ] No `dangerouslySetInnerHTML` anywhere in React
- [ ] CSV export properly escapes commas, quotes, newlines
- [ ] Zod schemas validate all API inputs

**Technical Notes:**
- Supabase JS client uses prepared statements by default — safe
- React escapes by default — only unsafe if you bypass it
- Zod for validation:
```typescript
const SendCodeSchema = z.object({
  phone_number: z.string().regex(/^\+1\d{10}$/),
});
```

---

### TSNAP-074 — Secrets Management Audit
**Type:** Task
**Owner:** Jordan + Raj
**Effort:** 30 minutes
**Day:** 1
**Priority:** P0

**Description:**
Verify no secrets in code, git history, or client bundles.

**Acceptance Criteria:**
- [ ] `.gitignore` includes `.env.local`, `.env`, `.env.production`
- [ ] `git log --all -p | grep -i "api_key"` returns nothing concerning
- [ ] `git log --all -p | grep -i "secret"` returns nothing concerning
- [ ] No API keys in client-side bundle (use Chrome DevTools to inspect bundle)
- [ ] Only `NEXT_PUBLIC_*` env vars are accessible client-side — verify
- [ ] All other secrets are server-side only

**Technical Notes:**
- If a secret was ever committed, ROTATE it immediately — git history is forever
- Tools like `git-secrets` or `truffleHog` can scan for accidentally committed secrets
- TruffleHog: `pip install trufflehog && trufflehog --regex git@github.com:you/tally-mvp.git`

---

### TSNAP-075 — TCPA Compliance: Opt-In
**Type:** Task
**Owner:** Jordan
**Effort:** 30 minutes
**Day:** 9 (during EPIC 5)
**Priority:** P0 (legal)

**Description:**
SMS marketing in the US requires explicit consent per TCPA. Penalties are $500-1,500 per violation.

**Acceptance Criteria:**
- [ ] User initiating SMS to Tally (texting first) = implicit consent — but document it
- [ ] If user submits a web form requesting SMS, require explicit checkbox
- [ ] Required disclaimers: "Message and data rates may apply. Reply STOP to opt out."
- [ ] Privacy Policy mentions SMS communications
- [ ] Consent timestamp logged in user record

**Technical Notes:**
- "Implicit consent" via texting first is a common interpretation but not bulletproof
- For maximum safety, add explicit "Yes, I want SMS messages" prompt during onboarding
- A lawyer review is RECOMMENDED before scaling
- Free TCPA compliance guide: https://www.twilio.com/docs/sms/best-practices

---

### TSNAP-076 — TCPA Compliance: Opt-Out
**Type:** Task
**Owner:** Jordan
**Effort:** 30 minutes
**Day:** 9 (during EPIC 5)
**Priority:** P0 (legal)

**Description:**
STOP keyword must work. Twilio handles automatically, but verify.

**Acceptance Criteria:**
- [ ] Test: text STOP to Tally number → automatic confirmation from Twilio
- [ ] Test: try to send to opted-out number → Twilio rejects
- [ ] User can rejoin with START or YES keyword
- [ ] User's opt-out status visible in Twilio Console
- [ ] App handles HELP keyword (returns support info)

**Technical Notes:**
- Twilio automatically handles STOP, START, HELP keywords (when enabled)
- Verify it's enabled for your account: Console → Messaging → Settings → Compliance
- Some clients may need to handle these in code if Twilio's automatic handling isn't enough

---

### TSNAP-077 — Privacy Policy Completeness
**Type:** Task
**Owner:** Jordan + You (founder)
**Effort:** 30 minutes
**Day:** 9 (during EPIC 5)
**Priority:** P0 (legal)

**Status:** Verification of TSNAP-052.

**Acceptance Criteria:**
- [ ] Privacy Policy explicitly covers SMS communications
- [ ] Lists all third parties (Twilio, Supabase, Anthropic, Vercel, Resend)
- [ ] Explains data retention
- [ ] Provides contact for privacy requests
- [ ] Mentions GDPR/CCPA where applicable (even if no EU users for now)

**See:** `tickets/05-landing-legal.md#TSNAP-052`

---

### TSNAP-078 — Data Deletion Process
**Type:** Story
**Owner:** Jordan + Raj
**Effort:** 1 hour
**Day:** Post-launch (acceptable to defer)
**Priority:** P1

**Description:**
GDPR/CCPA require ability to delete user data on request. Build the process.

**Acceptance Criteria:**
- [ ] User can request deletion via email (privacy@tallywhy.com or similar)
- [ ] Deletion script removes:
  - User record
  - All receipts
  - All conversations
  - All photos from Storage
  - All session tokens
  - All auth codes
- [ ] Keeps anonymized aggregates if needed (optional)
- [ ] Process documented in Privacy Policy
- [ ] 30-day grace period (account can be restored within 30 days)

**Technical Notes:**
- For V1, this can be a manual process (script you run yourself)
- Build automated self-serve in V2
- Don't forget: photos in Supabase Storage are separate from DB records

---

### TSNAP-079 — PII in Logs Audit
**Type:** Task
**Owner:** Jordan + Raj
**Effort:** 30 minutes
**Day:** 10 (during EPIC 6)
**Priority:** P0

**Description:**
Verify phone numbers and sensitive data don't appear in error logs.

**Acceptance Criteria:**
- [ ] All `console.log` statements reviewed
- [ ] No phone numbers in logs
- [ ] No session tokens in logs
- [ ] No photo URLs in logs (they have user IDs)
- [ ] Sentry PII filtering enabled
- [ ] If errors must log phone numbers, hash them first

**Technical Notes:**
- Easy to accidentally log PII in stack traces
- Sentry has built-in PII scrubbers — configure them
- Hash phone numbers with consistent algorithm (e.g., SHA-256) for log correlation

---

### TSNAP-080 — HTTPS Enforcement Verification
**Type:** Task
**Owner:** Jordan
**Effort:** 15 minutes
**Day:** 10 (during EPIC 6)
**Priority:** P0

**Description:**
Verify every page and API uses HTTPS only.

**Acceptance Criteria:**
- [ ] `curl -I http://yourdomain.com` returns 301 redirect to HTTPS
- [ ] All links in app use HTTPS
- [ ] Mixed content warnings: none
- [ ] HSTS header configured (optional but recommended)

**Technical Notes:**
- Vercel enforces HTTPS by default — verify
- HSTS: add `Strict-Transport-Security: max-age=31536000; includeSubDomains` header

---

## When Each Ticket Happens

These tickets are scheduled within other epics. Here's when each happens:

```
Day 1:  TSNAP-068 (Threat Model)
        TSNAP-074 (Secrets Audit)

Day 3:  TSNAP-069 (Twilio webhook signing) [in EPIC 2]

Day 4:  TSNAP-072 (Photo URL signing) [in EPIC 2]
        TSNAP-073 (Input sanitization) [ongoing]

Day 5:  Multi-tenant isolation (TSNAP-025) [in EPIC 2]

Day 6:  TSNAP-070 (Rate limiting) [in EPIC 4]
        TSNAP-071 (Session tokens) [in EPIC 4]

Day 9:  TSNAP-075 (TCPA opt-in) [in EPIC 5]
        TSNAP-076 (TCPA opt-out) [in EPIC 5]
        TSNAP-077 (Privacy Policy) [in EPIC 5]

Day 10: TSNAP-079 (PII in logs) [in EPIC 6]
        TSNAP-080 (HTTPS enforcement) [in EPIC 6]
        TSNAP-064 (Security final audit) [in EPIC 6]

Post-launch: TSNAP-078 (Data deletion process)
```

---

## Jordan's Pre-Launch Sign-Off Checklist

Before launch, Jordan must verify EVERY item below:

**SMS Security:**
- [ ] Twilio webhook signature validation active
- [ ] Rate limiting on SMS receipt logging (30/day per user)
- [ ] STOP keyword opt-out works
- [ ] TCPA opt-in language present

**Auth Security:**
- [ ] OTP rate limiting active (3/15min)
- [ ] OTP code expires in 10 min
- [ ] Max 5 wrong attempts per code
- [ ] Session tokens are HTTP-only, secure, sameSite=lax
- [ ] Logout deletes session from DB

**Data Security:**
- [ ] Multi-tenant isolation verified (user A cannot see user B's data)
- [ ] Photo URLs are signed with expiry
- [ ] No PII in logs
- [ ] All env vars are production values (no test keys)
- [ ] Secrets are server-side only (no `NEXT_PUBLIC_` for secrets)

**Compliance:**
- [ ] Privacy Policy published
- [ ] Terms of Service published
- [ ] Tax Disclaimer published
- [ ] All linked from footer
- [ ] TCPA compliant

**Infrastructure:**
- [ ] HTTPS enforced (no http:// works)
- [ ] Database backup taken pre-launch
- [ ] Sentry monitoring active
- [ ] Rollback plan documented

**Code Quality:**
- [ ] No secrets in git history
- [ ] Input sanitization on all forms
- [ ] No `dangerouslySetInnerHTML`
- [ ] `npm audit` shows no critical vulnerabilities

If any item is unchecked, Jordan says HOLD on launch.

---

## Definition of Done for EPIC 7

This epic is DONE when:
1. ✅ All security tickets above are complete
2. ✅ Jordan's pre-launch checklist passes 100%
3. ✅ No P0 security issues outstanding
4. ✅ Threat model documented
5. ✅ Compliance verified

Jordan owns the GO/NO-GO security decision in TSNAP-067.
