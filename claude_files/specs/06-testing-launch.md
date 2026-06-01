# TSNAP-EPIC-6 — Testing & Launch

**Owner:** Jordan Kim + Priya Sharma
**Effort:** 8 hours
**Day:** 10
**Priority:** P0 (Blocker)

## Epic Description

End-to-end validation before opening to beta users. Tests every flow, every edge case, every device. Sets up monitoring, finalizes deployment, confirms launch readiness.

## Epic Acceptance Criteria

- [ ] Full user journey works end-to-end on real devices
- [ ] All P0 edge cases tested
- [ ] Cross-carrier SMS testing complete
- [ ] Error monitoring configured
- [ ] Security final review complete
- [ ] Launch readiness confirmed by Priya and Jordan
- [ ] Database backed up
- [ ] Rollback plan defined

---

## Tickets in Order

### TSNAP-058 — Full User Journey Test (Happy Path)
**Type:** Story
**Owner:** Priya
**Effort:** 1 hour
**Depends on:** All previous epics
**Priority:** P0

**Description:**
Walk through the entire happy path from a fresh phone number, document everything.

**Acceptance Criteria:**
- [ ] From a phone number NEVER used with TaxSnap:
  - [ ] Text "hi" to the number
  - [ ] Complete 3-question onboarding successfully
  - [ ] Send a photo receipt — gets categorized correctly with IRC reference
  - [ ] Receive clarification question (if applicable)
  - [ ] Respond — receipt marked complete
  - [ ] Send text-only expense ("$48 lunch with Sarah re partnership") — categorized correctly
  - [ ] Send expense over $75 without photo — asked for receipt
  - [ ] Send lodging expense — asked for receipt regardless of amount
  - [ ] Send software expense — logged without questions
  - [ ] Send mileage — calculated correctly
  - [ ] Send a business gift — recipient tracked
- [ ] Then log in to dashboard:
  - [ ] Phone OTP works
  - [ ] All receipts visible
  - [ ] Substantiation badges accurate
  - [ ] Edit a receipt, save, verify update
  - [ ] Upload photo to a needs-receipt expense
  - [ ] Delete a receipt
  - [ ] Export CSV (both formats)
  - [ ] (If implemented) Email to accountant
- [ ] All steps documented in a checklist
- [ ] Any bugs found are logged and fixed before launch

**Technical Notes:**
- Take screenshots/videos for documentation
- Save these for marketing content later
- Priya owns the master test plan

---

### TSNAP-059 — Edge Case Testing
**Type:** Story
**Owner:** Priya + Jordan
**Effort:** 1.5 hours
**Depends on:** TSNAP-058
**Priority:** P0

**Description:**
Test every edge case to find bugs before users do.

**Acceptance Criteria:**
- [ ] Send blurry/illegible receipt photo → graceful handling
- [ ] Send photo that's NOT a receipt (random photo) → "doesn't look like a receipt"
- [ ] Send multiple receipts in one message → handled appropriately
- [ ] Send extremely large photo (>5MB) → handled
- [ ] Send HEIC format (iOS default) → converted to JPG
- [ ] Send a receipt in foreign language → handled
- [ ] Send text with no amount ("dinner with John") → asks for amount
- [ ] Send text with no vendor ("$30 stuff") → asks for context
- [ ] Send during onboarding when expecting answer → handled
- [ ] Pause for 5 minutes between question and response → resumes correctly
- [ ] Pause for 24+ hours → next message treated as new expense (per spec)
- [ ] Send STOP keyword → opted out (Twilio handles)
- [ ] Send same expense twice in row → both logged (don't dedupe)
- [ ] Send very long message (>2000 chars) → handled
- [ ] OCR confidence below 0.7 → asks user to verify
- [ ] Twilio webhook with spoofed signature → rejected with 403
- [ ] Try to access /dashboard without auth → redirected to login
- [ ] Submit wrong OTP code 5 times → locked, requires new code
- [ ] OTP code expired (10+ min old) → asks for new code
- [ ] All edge cases logged in test plan, bugs fixed

**Technical Notes:**
- Jordan focuses on security edge cases
- Priya focuses on UX edge cases
- Both maintain master test results spreadsheet

---

### TSNAP-060 — Cross-Device Testing
**Type:** Task
**Owner:** Priya
**Effort:** 1 hour
**Depends on:** TSNAP-058
**Priority:** P0

**Description:**
Verify product works on the devices users will actually use.

**Acceptance Criteria:**
- [ ] Tested on iPhone (iOS 17+) Safari
- [ ] Tested on iPhone (iOS 17+) Chrome
- [ ] Tested on Android (latest) Chrome
- [ ] Tested on iPad Safari
- [ ] Tested on desktop Chrome, Safari, Firefox
- [ ] SMS sends correctly to all tested devices
- [ ] Dashboard loads and works on all
- [ ] Photo upload from camera roll works on iOS and Android
- [ ] Mobile keyboards don't break form layouts

**Technical Notes:**
- Use real devices when possible
- BrowserStack or similar for cross-browser if needed
- Note: don't worry about old browsers (IE, old Safari) for V1

---

### TSNAP-061 — Cross-Carrier SMS Testing
**Type:** Task
**Owner:** Jordan
**Effort:** 45 minutes
**Depends on:** TSNAP-058
**Priority:** P0

**Description:**
SMS delivery can vary by carrier. Test major US carriers.

**Acceptance Criteria:**
- [ ] Tested with Verizon → SMS arrives reliably
- [ ] Tested with AT&T → SMS arrives reliably
- [ ] Tested with T-Mobile → SMS arrives reliably
- [ ] Tested with smaller carrier (e.g., Mint, Visible) → SMS arrives
- [ ] MMS (photos) work on all carriers tested
- [ ] No delivery issues (>1 minute delays = investigate)

**Technical Notes:**
- Recruit friends on different carriers if needed
- Twilio has delivery reports — check them
- A2P 10DLC registration may help deliverability long-term (post-launch task)

---

### TSNAP-062 — Sentry Error Monitoring Setup
**Type:** Task
**Owner:** Raj
**Effort:** 45 minutes
**Depends on:** TSNAP-001
**Priority:** P0

**Description:**
Set up error monitoring so we catch issues users hit in production.

**Acceptance Criteria:**
- [ ] Sentry SDK installed (`@sentry/nextjs`)
- [ ] Sentry DSN configured in environment variables
- [ ] Configured for both client and server errors
- [ ] Tested: deliberate error appears in Sentry dashboard
- [ ] PII filtering enabled (no phone numbers in error reports)
- [ ] Slack notification configured for critical errors (optional)

**Technical Notes:**
```bash
npx @sentry/wizard@latest -i nextjs
```

- The wizard handles most setup
- Manually verify: PII like phone numbers is scrubbed from error reports
- Sentry free tier: 5K errors/month — plenty for V1

---

### TSNAP-063 — Production Environment Variables Verification
**Type:** Task
**Owner:** Raj + Jordan
**Effort:** 30 minutes
**Depends on:** TSNAP-008
**Priority:** P0

**Description:**
Verify all production env vars are correct and not pointing to dev/test resources.

**Acceptance Criteria:**
- [ ] All env vars in Vercel match production resources
- [ ] No test/dev URLs in production
- [ ] No test API keys in production
- [ ] Twilio number is the production number
- [ ] Supabase project is the production project (not a test project)
- [ ] Anthropic API key has $50+ credit
- [ ] SESSION_SECRET is unique production value (not committed anywhere)
- [ ] Jordan signs off

**Technical Notes:**
- Common gotcha: developers use test keys, forget to swap for production
- Print all env vars (redacted) and review one by one

---

### TSNAP-064 — Security Final Audit
**Type:** Story
**Owner:** Jordan
**Effort:** 1.5 hours
**Depends on:** All previous epics
**Priority:** P0

**Description:**
Final security review using Jordan's compliance checklist before launch.

**Acceptance Criteria:**
- [ ] TCPA compliance verified (opt-in language, STOP keyword)
- [ ] Twilio webhook signature validation working
- [ ] Rate limiting on all auth endpoints verified
- [ ] HTTPS enforced everywhere (no http:// links)
- [ ] Session cookies HTTP-only, secure, sameSite=lax
- [ ] No secrets in client-side code (check bundle)
- [ ] No PII in error logs
- [ ] Photo URLs are signed with expiry
- [ ] Multi-tenant isolation verified (user A cannot see user B's data)
- [ ] Privacy Policy, Terms, Disclaimer all published
- [ ] CSP headers configured (if possible)
- [ ] All checklist items in `team/jordan-kim.md` pass

**Technical Notes:**
- Use `npm audit` to check for vulnerable dependencies
- Use a security scanner like ZAP (free) if comfortable
- This is Jordan's go/no-go for launch — take it seriously

---

### TSNAP-065 — Database Backup
**Type:** Task
**Owner:** Raj
**Effort:** 30 minutes
**Depends on:** TSNAP-005
**Priority:** P0

**Description:**
Set up automated backups + take a pre-launch snapshot.

**Acceptance Criteria:**
- [ ] Supabase Point-in-Time Recovery enabled (paid plan feature — defer if cost-prohibitive)
- [ ] OR: Manual `pg_dump` script created and tested
- [ ] Pre-launch snapshot taken and stored safely
- [ ] Backup process documented in README
- [ ] Restore process tested at least once

**Technical Notes:**
- Supabase free tier has daily automatic backups (7-day retention)
- For V1 with few users, this is sufficient
- Upgrade to PITR if/when user base grows

---

### TSNAP-066 — Rollback Plan
**Type:** Task
**Owner:** Raj + Priya
**Effort:** 30 minutes
**Depends on:** TSNAP-058
**Priority:** P1

**Description:**
Document what to do if launch goes wrong.

**Acceptance Criteria:**
- [ ] Document covers:
  - How to disable the Twilio webhook (puts SMS on hold)
  - How to revert Vercel to previous deploy
  - How to restore database from backup
  - How to communicate with affected beta users
  - Emergency contacts (yourself, support email)
- [ ] Stored in repo at `/docs/INCIDENT-RESPONSE.md`
- [ ] Priya reviews

**Technical Notes:**
- Hope you never need this. Prepare anyway.
- For V1, "rollback" mostly means: disable Twilio webhook + revert Vercel deploy

---

### TSNAP-067 — Soft Launch Decision
**Type:** Task
**Owner:** Priya + Jordan + You (founder)
**Effort:** 30 minutes
**Depends on:** TSNAP-058 through TSNAP-066
**Priority:** P0

**Description:**
Go/no-go meeting. Have we earned the right to launch?

**Acceptance Criteria:**
- [ ] All P0 tickets in all epics: ✓ DONE
- [ ] All edge case tests passed
- [ ] Cross-device testing passed
- [ ] Cross-carrier testing passed
- [ ] Sentry monitoring active
- [ ] Security audit passed
- [ ] Legal pages published
- [ ] Database backed up
- [ ] Rollback plan documented
- [ ] Decision: GREEN LIGHT or HOLD

**Technical Notes:**
- If you're unsure, HOLD. Better to delay 1 day than launch broken.
- Common reasons to HOLD: P0 bug discovered, SMS delivery flaky, legal page issue
- If GREEN: proceed to soft launch with first 10 personal contacts

---

## Day 10 Checklist

**Morning (4 hours):**
- [ ] TSNAP-058: Full happy path test (1h)
- [ ] TSNAP-059: Edge case testing (1.5h)
- [ ] TSNAP-060: Cross-device testing (1h)
- [ ] TSNAP-061: Cross-carrier SMS (30min)

**Afternoon (4 hours):**
- [ ] TSNAP-062: Sentry setup (45min)
- [ ] TSNAP-063: Env var verification (30min)
- [ ] TSNAP-064: Security final audit (1.5h)
- [ ] TSNAP-065: Database backup (30min)
- [ ] TSNAP-066: Rollback plan (30min)
- [ ] TSNAP-067: Soft launch decision (30min)
- [ ] (If GREEN) Begin outreach to first 10 personal contacts

---

## Post-Launch Day 1 Activities

(NOT in V1 build scope, but worth noting)

- [ ] Monitor Sentry for errors hourly
- [ ] Watch Twilio dashboard for delivery issues
- [ ] Respond to beta user messages within 1 hour
- [ ] Note every question, confusion, or friction point
- [ ] DO NOT make code changes for 48 hours unless critical bug
- [ ] Just observe

---

## Definition of Done for EPIC 6

This epic is DONE when:
1. ✅ Full happy path works on real devices
2. ✅ All edge cases handled gracefully
3. ✅ Cross-device tested
4. ✅ Cross-carrier tested
5. ✅ Error monitoring active
6. ✅ Production env vars verified
7. ✅ Security audit passed
8. ✅ Database backed up
9. ✅ Rollback plan documented
10. ✅ Priya + Jordan + you say GREEN LIGHT

You are now ready to launch.

---

## Beyond V1: First 30 Days

Once you launch, focus shifts from BUILDING to LEARNING. The post-launch plan lives in PLAN.md and OUTREACH.md. But the relevant tickets here are:

**Week 2 (Post-launch):**
- Acquire first 10 beta users
- Track every conversation
- Identify most-requested feature

**Week 3 (Validation):**
- 30-minute calls with 5 most active users
- Apply Sean Ellis test ("would you be disappointed?")
- Decide: iterate or add features

**Month 2+:**
- Build the most-requested feature only
- Continue content marketing (per CONTENT-STRATEGY.md)
- Maintain product quality

If you hit the success criteria in PLAN.md, you have something real.
