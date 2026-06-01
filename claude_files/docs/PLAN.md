# TaxSnap — V1 Execution Plan

This is the **high-level roadmap** for V1. For granular execution detail, see `tickets/` folder.

```
PLAN.md (you are here)         →  The roadmap and timeline
tickets/00-EPICS.md            →  Epic-level breakdown
tickets/01-06 + 07             →  Day-by-day ticket execution
```

---

## The Goal

Ship a working V1 in **10 working days** that validates the core hypothesis: *people will text expenses to a number when it captures the WHY in real-time and only asks for receipts when the IRS requires.*

**Success metric for V1 launch:** 10 active beta users sending 3+ expenses per week by end of week 3.

---

## Pre-Work (Day 0 — Before Opening Claude Code)

Complete this BEFORE starting Day 1. See `tickets/01-foundation.md` TSNAP-001 for full detail.

- [ ] Create accounts: Twilio, Supabase, Anthropic, Vercel, Resend, GitHub, domain registrar, Sentry
- [ ] Add $20 credit to Anthropic
- [ ] Buy domain (~$15/year)
- [ ] Buy Twilio phone number (~$1/month)
- [ ] Save all API keys to password manager
- [ ] Make list of 20-30 personal network contacts who fit target profile
- [ ] **Lock the brand name** (Alex's repeated warning — this blocks landing page, content, demos)
- [ ] Optional: send first 5 "want to be a beta tester?" messages so people are warmed up

---

## Scope Reality Check (From Priya)

```
Total work estimated:  ~72 hours
Available time:        ~50 hours (10 days × 5h/day)
Gap:                   ~22 hours

Priya's recommendation: Cut EPIC 8 (Email Accountant)
to week 3 post-launch. Cut all P3 items. Accept a
2-day buffer (Days 11-12) if needed.

Realistic target: ~60 hours of work in ~55 hours of time.
```

This means: **don't add scope mid-build**. Every "wouldn't it be cool if..." adds to a budget that's already tight.

---

## Week 1: Foundation + SMS Pipeline (Days 1-5)

### Day 1 — Foundation (Part 1)
**Epic:** TSNAP-EPIC-1 — Foundation & Infrastructure
**Owner:** Raj
**Tickets:** TSNAP-001 through TSNAP-011 (most of them)
**Reference:** `tickets/01-foundation.md`

**Morning:** Service accounts → Next.js init → Vercel deploy → Supabase init
**Afternoon:** Database schema → folder structure → Anthropic test
**End of day:** Custom domain shows the deployed site over HTTPS. Database has tables.

---

### Day 2 — Foundation (Part 2) + Security Threat Model
**Epic:** TSNAP-EPIC-1 finishes + TSNAP-EPIC-7 starts
**Owner:** Raj + Jordan
**Tickets:** TSNAP-006, TSNAP-007, TSNAP-012, TSNAP-068, TSNAP-074
**Reference:** `tickets/01-foundation.md` + `tickets/07-security-crosscutting.md`

**Morning:** Seed IRC summaries → seed substantiation rules → end-to-end verification
**Afternoon:** Jordan writes threat model, audits secrets management, buffer for issues
**End of day:** Foundation complete. Ready for feature work.

---

### Day 3 — SMS Pipeline (Part 1)
**Epic:** TSNAP-EPIC-2 — SMS Pipeline starts
**Owner:** Raj + Sofia
**Tickets:** TSNAP-013 through TSNAP-018
**Reference:** `tickets/02-sms-pipeline.md`

**Morning:** Twilio webhook → outbound SMS → signature validation → user lookup → conversation storage
**Afternoon:** Onboarding flow → photo upload to Supabase Storage
**End of day:** New user can text the number and complete onboarding in <60 seconds.

---

### Day 4 — SMS Pipeline (Part 2) + Substantiation Logic Begins
**Epic:** TSNAP-EPIC-2 continues + TSNAP-EPIC-3 starts
**Owner:** Raj + Priya
**Tickets:** TSNAP-019, TSNAP-020, TSNAP-021 (start), TSNAP-027, TSNAP-028
**Reference:** `tickets/02-sms-pipeline.md` + `tickets/03-substantiation.md`

**Morning:** Claude Vision OCR → text expense parsing
**Afternoon:** Substantiation rules engine → decision tree implementation → smart categorization (start)
**End of day:** Photos extract correctly. Text parses correctly. Decision tree returns correct results.

---

### Day 5 — SMS Pipeline (Part 3) + Substantiation Logic Completes
**Epic:** TSNAP-EPIC-2 finishes + TSNAP-EPIC-3 finishes
**Owner:** Raj + Priya + Sofia
**Tickets:** TSNAP-021 (finish), TSNAP-022, TSNAP-023, TSNAP-024, TSNAP-025, TSNAP-026, TSNAP-029 through TSNAP-033
**Reference:** `tickets/02-sms-pipeline.md` + `tickets/03-substantiation.md`

**Morning:** Smart categorization finishes → receipt save → clarification question flow
**Afternoon:** Receipt attachment flow → vehicle mileage → gifts cap → substantiation tests
**End of day:** Full SMS pipeline works. AI asks correct questions only when IRS requires. Substantiation tests pass.

---

### Weekend — Buffer / Rest

Use as buffer if Days 1-5 slipped. Otherwise: rest. **Don't burn out in week 1.**

A common temptation is to "get ahead" on the weekend. Resist. The build is mentally taxing — burnout in week 1 means failure in week 2.

If you must work: write tomorrow's outreach messages, plan content, do user research calls.

---

## Week 2: Dashboard + Launch (Days 6-10)

### Day 6 — Dashboard (Part 1)
**Epic:** TSNAP-EPIC-4 — Web Dashboard starts
**Owner:** Emma + David + Jordan
**Tickets:** TSNAP-034, TSNAP-035, TSNAP-036, TSNAP-037, TSNAP-038, TSNAP-070, TSNAP-071
**Reference:** `tickets/04-web-app.md` + `tickets/07-security-crosscutting.md`

**Morning:** Design system → phone OTP auth (request + verify)
**Afternoon:** Auth middleware → dashboard summary widget → start receipt list
**End of day:** User can log in via phone OTP. Dashboard shows summary stats.

---

### Day 7 — Dashboard (Part 2)
**Epic:** TSNAP-EPIC-4 continues
**Owner:** Emma + David
**Tickets:** TSNAP-039, TSNAP-040, TSNAP-041, TSNAP-042, TSNAP-043
**Reference:** `tickets/04-web-app.md`

**Morning:** Finish receipt list → receipt detail page → start photo upload
**Afternoon:** Photo upload finishes → CSV export → QBO-compatible CSV
**End of day:** Full dashboard CRUD works. User can edit, attach receipts, export.

---

### Day 8 — Dashboard (Part 3) + Email Accountant
**Epic:** TSNAP-EPIC-4 finishes + TSNAP-EPIC-8 (if time)
**Owner:** Emma + David
**Tickets:** TSNAP-044, TSNAP-045, TSNAP-046, TSNAP-047, TSNAP-048
**Reference:** `tickets/04-web-app.md`

**Morning:** Empty/loading states → mobile responsiveness audit
**Afternoon:** Email service setup → PDF generation → Email accountant UI/backend
**End of day:** Dashboard polished. Email-to-accountant works (or formally deferred to week 3).

**⚠️ Priya's note:** If Days 6-7 slipped, drop TSNAP-046 through TSNAP-048. They go to week 3.

---

### Day 9 — Landing Page + Legal
**Epic:** TSNAP-EPIC-5 — Landing + Legal
**Owner:** David + Jordan + Marcus + Sofia
**Tickets:** TSNAP-049 through TSNAP-057, TSNAP-075, TSNAP-076, TSNAP-077
**Reference:** `tickets/05-landing-legal.md` + `tickets/07-security-crosscutting.md`

**Morning:** Hero section → how it works → FAQ → footer
**Afternoon:** Privacy Policy → Terms of Service → Tax Disclaimer → TCPA compliance → mobile/performance audit
**End of day:** Public-facing pages live. Legal compliance verified.

---

### Day 10 — Testing + Launch
**Epic:** TSNAP-EPIC-6 — Testing & Launch
**Owner:** Jordan + Priya + everyone
**Tickets:** TSNAP-058 through TSNAP-067, TSNAP-079, TSNAP-080
**Reference:** `tickets/06-testing-launch.md`

**Morning:** Full happy path test → edge case testing → cross-device testing → cross-carrier SMS
**Afternoon:** Sentry setup → env var verification → security final audit → database backup → rollback plan → soft launch decision
**End of day:** GO or NO-GO call. If GO: launch to first 10 personal contacts.

---

## Soft Launch Weekend

If Day 10 ended with GREEN LIGHT:

- [ ] Send to first 10 beta users (personal network)
- [ ] Post on Reddit (r/freelance, r/smallbusiness, r/llc)
- [ ] Post on Indie Hackers
- [ ] Watch usage in real-time via dashboard + Sentry
- [ ] Note every question, confusion, error
- [ ] **DO NOT make code changes for 48 hours** unless critical bug
- [ ] Just observe

---

## Week 3 — Learn (Post-Launch)

Focus shifts from BUILDING to LEARNING. The hard work is over; the important work begins.

- [ ] Track active users per day
- [ ] Track receipts logged per user
- [ ] Schedule 30-min calls with 5 most active users
- [ ] Ask the Sean Ellis question: "If this disappeared tomorrow, would you be disappointed?"
- [ ] Identify the single most-requested feature
- [ ] Decide: iterate on core loop, or build the requested feature

**If EPIC 8 (Email Accountant) was deferred:** build it now in week 3.

---

## Parallel Activities Throughout

### Daily Outreach (30 min/day during build)

- 5 new personal contacts reached out to
- Engage on Reddit/Twitter where target users hang out
- Respond to anyone who replies

### Daily Content (30-60 min/day during build) — Optional Experiment

- 1 Trial Reel per day testing one of 5 hook formats
- 30-day test: if it works, lean in. If not, pause.
- See `CONTENT-STRATEGY.md` for full playbook

**⚠️ Alex's warning:** If you spend more than 1 hour/day on content during the build, the product slips. Content is a 30-60 min commitment max.

---

## Time Budget per Day

```
HOURS PER DAY 
DURING BUILD:

Product work:       4-5 hours
Outreach:           30 min
Content (optional): 30-60 min
Buffer:             15 min
                    ─────────
Total:              5.5-7 hours

Sustainable: yes, for 2 weeks
NOT sustainable: 6+ months
```

If you can't sustain this pace, cut content first. The product matters more than the marketing in week 1-2.

---

## Success Criteria

### End of Day 10
- [ ] V1 launched to first 10 beta users
- [ ] No P0 bugs in production
- [ ] All legal pages live
- [ ] Sentry shows minimal errors

### End of Week 3
- [ ] 10 active beta users acquired
- [ ] 5+ users sending 3+ receipts per week
- [ ] 2-3 users sending receipts daily
- [ ] 1-2 unsolicited referrals
- [ ] At least 1 "I'd be sad if this disappeared" answer

**If you hit Week 3 criteria, you have something real.** Plan post-MVP features based on real user data.

**If you don't hit it,** the product needs fundamental changes — but you've learned what to fix cheaply.

---

## Total Budget

```
ONE-TIME COSTS:
- Domain                  $15
- Twilio credit           $10
- Anthropic credit        $20
- Resend credit           $0 (free tier)
- Sentry                  $0 (free tier)
- Vercel                  $0 (free tier)
- Supabase                $0 (free tier)
                          ────
                          $45
```

```
MONTHLY OPERATING COST 
AT 1-10 USERS:

- Twilio phone number     $1
- Per-receipt API costs   ~$5
- Other services          $0
                          ────
                          ~$6/month
```

```
MONTHLY OPERATING COST 
AT 100 USERS:

- Twilio                  $1
- Twilio SMS              ~$15
- Anthropic API           ~$100
- Other services          $0-25
                          ──────
                          ~$120/month
```

---

## Optional: Lawyer Review Before Public Launch

**Strongly recommended** for V1 → V2 transition (when you're paying users):

- Disclaimer template review: $500-1,000
- Privacy policy review: $500-1,000
- Terms of service review: $500-1,000
- Total: $1,500-2,500 one-time

For V1 with 10 beta users, you can launch without lawyer review. Once you have paying users or 100+ beta users, get this done.

---

## When Things Go Wrong

### "Day 5 ended and SMS pipeline isn't done"
- Use weekend buffer
- Cut EPIC 8 (Email Accountant) from V1
- Reduce edge case coverage in EPIC 6 testing
- Don't compromise on security tickets

### "Day 8 ended and dashboard isn't done"
- Defer EPIC 8 entirely
- Simplify dashboard scope (skip QBO CSV format, basic export only)
- Push landing page to weekend

### "Day 10 ended but security audit failed"
- HOLD launch
- Fix security issues
- Re-test
- Launch when Jordan signs off

### "Days 11-12 needed for completion"
- Acceptable. Better to launch on Day 12 working than Day 10 broken.

---

## How to Use This Plan with Claude Code

**At start of each day:**

```
"Read PLAN.md for today's overview, 
then read tickets/0X-[filename].md 
for the actual tickets I'm working 
on. Help me complete the first 
ticket."
```

**Mid-day check:**

```
"Where am I in today's plan? 
Read PLAN.md and tell me what 
remains for today."
```

**End of day:**

```
"Today I completed TSNAP-XXX 
through TSNAP-YYY. Mark them 
done. What's tomorrow's first 
ticket?"
```

---

## Final Reminders from the Team

**Alex:** "Ship the embarrassing first version. The MVP isn't about pride — it's about learning."

**Marcus:** "Your first 10 users will teach you more than the next 10 weeks of planning."

**Raj:** "When you get stuck, the answer is usually in the spec. Re-read before improvising."

**Priya:** "Build the core loop perfectly. Everything else comes later."

**Jordan:** "Get the disclaimer template lawyer-reviewed once you have paying users. ~$1,500-2,500, one-time, saves you forever."

**Maya:** "Make 1 Trial Reel per day during the build. Worst case you have content for launch. Best case you have an audience."

**Sofia:** "If a user has to think for more than 3 seconds, we've failed."

**David:** "Less, but better."

**Ethan:** "Build it as if Intuit might want to acquire it in 3 years. They might."

**Emma:** "Will this work on a 2-year-old Android phone over 3G? If not, fix it."

Good luck. Go build.
