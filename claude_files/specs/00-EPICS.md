# Tally V1 — Master Epics & Dependency Graph

**Priya Sharma led this breakdown. The team contributed to their domain areas.**

This document lists the 8 epics that make up V1, their dependencies, and the recommended execution order.

---

## Epic Overview

| Epic | Title | Owner | Effort | Priority | Days |
|------|-------|-------|--------|----------|------|
| TSNAP-EPIC-1 | Foundation & Infrastructure | Raj | 8h | P0 | 1-2 |
| TSNAP-EPIC-2 | SMS Pipeline | Raj + Sofia | 16h | P0 | 3-5 |
| TSNAP-EPIC-3 | Substantiation Logic | Priya + Raj | 10h | P0 | 4-5 |
| TSNAP-EPIC-4 | Web Dashboard | Emma + David | 14h | P0 | 6-8 |
| TSNAP-EPIC-5 | Landing + Legal | David + Jordan | 6h | P0 | 9 |
| TSNAP-EPIC-6 | Testing & Launch | Jordan + Priya | 8h | P0 | 10 |
| TSNAP-EPIC-7 | Security (cross-cutting) | Jordan | 6h | P0 | Throughout |
| TSNAP-EPIC-8 | Email Accountant Feature | Emma | 4h | P1 | 8 (or slip) |

**Total: 72 hours of work**

---

## Build Status — Claude Code (2026-06-01)

All epic code is implemented and compiles (`npm run build`), lints clean, and **21 unit
tests pass**. Decisions/conflicts logged in `claude_files/docs/JOURNAL.md` (DEC-001…016).

| Epic | Code status | Blocked on (founder / live) |
|------|-------------|------------------------------|
| 1 Foundation | ✅ code + SQL | run seeds (0002/0003) + migration 0004; Twilio; deploy |
| 2 SMS Pipeline | ✅ code | live Twilio number + seeds to run end-to-end |
| 3 Substantiation | ✅ tested tree + weekly reminder cron | — |
| 4 Dashboard | ✅ auth, list, detail/edit, upload, export, settings | live DB session test |
| 5 Landing + Legal | ✅ landing/privacy/terms | lawyer review before paid launch |
| 6 Testing + Launch | 🟡 unit tests; E2E pending | Twilio + deploy; Sentry deferred (DEC-016) |
| 7 Security | ✅ signature, rate-limit, lockout, cookies, RLS, STOP/START | per-day/min rate limits (follow-up) |
| 8 Email Accountant | ✅ CSV + HTML email | Resend key + verified domain; PDF deferred (DEC-015) |

**Founder run-list to go live:** run `supabase/migrations/RUN_ALL.sql` (seeds + 0004) →
finish Twilio (sole-prop A2P + number, point webhook to `/api/sms/inbound`) → set env vars
(incl. `CRON_SECRET`, `RESEND_*`) → `vercel` deploy → end-to-end test.

---

## Dependency Graph

```
                    ┌─────────────────────┐
                    │  EPIC 1: Foundation │
                    │  (Raj, Days 1-2)    │
                    └──────────┬──────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
       ┌────────▼────────┐         ┌─────────▼─────────┐
       │  EPIC 7:        │         │  EPIC 3:           │
       │  Security       │         │  Substantiation    │
       │  (Jordan,       │         │  Logic             │
       │  Throughout)    │         │  (Priya + Raj,     │
       │                 │         │  Days 4-5)         │
       └────────┬────────┘         └─────────┬──────────┘
                │                            │
                └──────────────┬─────────────┘
                               │
                  ┌────────────▼────────────┐
                  │  EPIC 2: SMS Pipeline   │
                  │  (Raj + Sofia,           │
                  │  Days 3-5)              │
                  └────────────┬────────────┘
                               │
                  ┌────────────▼────────────┐
                  │  EPIC 4: Web Dashboard  │
                  │  (Emma + David,         │
                  │  Days 6-8)              │
                  └────────────┬────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
       ┌────────▼────────┐          ┌─────────▼─────────┐
       │  EPIC 5:         │         │  EPIC 8:           │
       │  Landing/Legal  │          │  Email Accountant  │
       │  (David,         │         │  (Emma, Day 8)     │
       │  Jordan, Day 9) │          │  CAN SLIP          │
       └────────┬────────┘          └─────────┬──────────┘
                │                             │
                └──────────────┬──────────────┘
                               │
                  ┌────────────▼────────────┐
                  │  EPIC 6: Testing/Launch │
                  │  (Jordan + Priya,       │
                  │  Day 10)                │
                  └─────────────────────────┘
```

---

## Epic Details

### TSNAP-EPIC-1 — Foundation & Infrastructure
**Owner:** Raj Patel
**Effort:** 8 hours
**Days:** 1-2
**Priority:** P0 (Blocker)

Set up all the accounts, services, schemas, and infrastructure needed before any feature work can begin. Without this, nothing else works.

**Key deliverables:**
- All service accounts created (Twilio, Supabase, Anthropic, Vercel)
- Next.js project initialized and deployed
- Database schema created and migrated
- Environment variables configured
- Multi-tenant data architecture established
- IRC summaries seeded
- Substantiation rules seeded

**See:** `tickets/01-foundation.md`

---

### TSNAP-EPIC-2 — SMS Pipeline
**Owner:** Raj Patel + Sofia Reyes
**Effort:** 16 hours
**Days:** 3-5
**Priority:** P0 (Blocker)

The core capture mechanism. Users text the number, AI handles the conversation, expenses get logged. This is the heart of the product.

**Key deliverables:**
- Twilio webhook endpoint handling inbound SMS
- 3-question onboarding flow
- Claude Vision OCR for photo receipts
- Claude Sonnet for text expense parsing + categorization
- Smart categorization using substantiation rules
- Conversation state management
- Outbound SMS responses with proper formatting

**See:** `tickets/02-sms-pipeline.md`

---

### TSNAP-EPIC-3 — Substantiation Logic
**Owner:** Priya Sharma + Raj Patel
**Effort:** 10 hours
**Days:** 4-5
**Priority:** P0 (Blocker)

The intelligence that makes Tally different from every other receipt tracker. Implements the IRS decision tree that determines when to ask for receipts, what context to capture, and when documentation is complete.

**Key deliverables:**
- Substantiation rules engine
- Decision tree implementation
- Smart questioning logic (only asks when required)
- "Needs receipt" flag system
- "Documentation complete" status tracking
- $75 threshold + lodging/gifts exceptions
- Weekly reminder system for missing receipts

**See:** `tickets/03-substantiation.md`

---

### TSNAP-EPIC-4 — Web Dashboard
**Owner:** Emma Larsson + David Park
**Effort:** 14 hours
**Days:** 6-8
**Priority:** P0 (Blocker)

The review/management interface. Users come here to see their records, edit details, attach receipts to text-only expenses, and export data. SMS is primary; dashboard is for review.

**Key deliverables:**
- Phone OTP authentication
- Receipt list view (filterable, sortable)
- Receipt detail page with edit capability
- Substantiation badge display
- CSV export (standard + QuickBooks-compatible)
- Photo attachment for previously-logged expenses
- Empty states and loading states

**See:** `tickets/04-web-app.md`

---

### TSNAP-EPIC-5 — Landing Page & Legal
**Owner:** David Park + Jordan Kim
**Effort:** 6 hours
**Day:** 9
**Priority:** P0 (Blocker)

Public face of the product. Visitors discover what Tally does, get the phone number to text, and read legal disclaimers. Includes mandatory privacy policy, terms of service, and tax disclaimer.

**Key deliverables:**
- Landing page with hero, how-it-works, FAQ
- Privacy Policy page
- Terms of Service page
- Tax Disclaimer page
- Mobile-responsive design
- TCPA opt-in language on phone number form

**See:** `tickets/05-landing-legal.md`

---

### TSNAP-EPIC-6 — Testing & Launch
**Owner:** Jordan Kim + Priya Sharma
**Effort:** 8 hours
**Day:** 10
**Priority:** P0 (Blocker)

End-to-end validation before opening to beta users. Tests every flow, every edge case, every device. Sets up monitoring, finalizes deployment, and confirms launch readiness.

**Key deliverables:**
- End-to-end flow test on real iPhone + Android
- Carrier compatibility testing (Verizon, AT&T, T-Mobile)
- Edge case testing (blurry photos, multi-receipt, pauses)
- Sentry error monitoring configured
- Production environment variables verified
- Final security audit (Jordan's checklist)
- Pre-launch backup of database

**See:** `tickets/06-testing-launch.md`

---

### TSNAP-EPIC-7 — Security (Cross-cutting)
**Owner:** Jordan Kim
**Effort:** 6 hours
**Days:** Throughout
**Priority:** P0 (Blocker)

Security isn't a feature — it's a constraint that affects every other epic. These tickets describe security work that happens IN PARALLEL with other epics.

**Key deliverables:**
- Twilio webhook signature validation
- Rate limiting on auth endpoints
- TCPA opt-in/opt-out compliance
- Session token security
- Photo URL signing
- Input sanitization
- Compliance checklist completion

**See:** `tickets/07-security-crosscutting.md`

---

### TSNAP-EPIC-8 — Email Accountant Feature
**Owner:** Emma Larsson
**Effort:** 4 hours
**Day:** 8 (or slip to week 3)
**Priority:** P1 (Critical — can slip)

Lets users send a monthly summary (PDF + CSV) to their accountant via email. This serves the "I have an accountant" segment without building a full accountant portal.

**Key deliverables:**
- Email service integration (Resend or similar)
- PDF generation of monthly summary
- "Email my accountant" button in dashboard
- Accountant email field in user settings

**This epic can SLIP to week 3 if other work runs over.**

**See:** `tickets/05-landing-legal.md` (bundled at end)

---

## Critical Path Analysis

**The longest dependency chain:**

```
EPIC 1 (8h) → EPIC 2 (16h) → EPIC 3 (10h) → EPIC 4 (14h) → EPIC 5 (6h) → EPIC 6 (8h)
= 62 hours on critical path
```

**Parallelizable work:**
- EPIC 7 (Security) runs alongside other epics → 6 hours absorbed
- EPIC 8 (Email Accountant) can run during EPIC 4 → 4 hours, can slip

**Realistic timeline:**
- Days 1-2: Foundation (8h)
- Days 3-5: SMS Pipeline + Substantiation in parallel (16h + 10h)
- Days 6-8: Web Dashboard + Email Accountant if time (14h + 4h)
- Day 9: Landing + Legal (6h)
- Day 10: Testing + Launch (8h)

**Total time on critical path: 62 hours.**
**Available time at 5h/day x 10 days: 50 hours.**

**Gap: 12 hours.**

---

## Priya's Recommendations

### Option A: Cut Scope (Recommended)
- Move EPIC 8 (Email Accountant) to week 3 post-launch
- Cut P3 features identified in individual tickets
- Saves: ~6-8 hours
- New total: 64-66 hours

### Option B: Extend Timeline
- Accept that V1 launches Day 12-13 instead of Day 10
- Maintain full scope
- Risk: Burnout, missing content rhythm

### Option C: Both
- Cut to ~60 hours of work
- Plan for Day 11-12 buffer
- Most realistic for solo founder

**Priya votes for Option C.**

---

## Parallel Execution Notes

While the critical path is sequential, some work CAN happen in parallel:

**During EPIC 2 (SMS Pipeline):**
- Jordan starts EPIC 7 (security work) at the same time
- David can start visual design system that EPIC 4 will use

**During EPIC 3 (Substantiation):**
- This needs to land BEFORE EPIC 4 starts
- But EPIC 2 conversation logic and EPIC 3 substantiation rules can develop together

**During EPIC 4 (Web Dashboard):**
- David finalizes visual components as Emma builds
- Emma can start EPIC 8 in parallel if ahead of schedule
- Jordan continues security work

**During EPIC 5 (Landing):**
- David handles visual design
- Jordan handles legal page content (with lawyer review NOT included in V1 budget — see EPIC 7)

---

## What's NOT in V1

Per CONTEXT.md, the following are explicitly deferred:

- Voice channel (Phase 2)
- Mobile app (Phase 2)
- Tax deadline reminders (Phase 2)
- Stripe billing (free during beta)
- Multi-entity support (Phase 3)
- Plaid bank linking (Phase 3 — V2 feature)
- Full accountant portal (Phase 3 — V3 feature)
- Direct QuickBooks sync (Phase 3)
- State-specific features (Phase 3)
- Tax filing (never)
- Per diem calculations
- International travel rules
- Entertainment expense edge cases
- Complex listed property rules

Do not let scope creep pull these into V1.

---

## How to Use This Document

**At start of project:**
- Read this entire file to understand the big picture
- Print or pin the dependency graph
- Note which epic you're starting

**Daily:**
- Open the specific ticket file for today's epic
- Work tickets in order
- Mark completed tickets with [✓ DONE]
- Update this file's effort tracking if estimates are wrong

**Weekly:**
- Review which tickets slipped
- Adjust scope or timeline
- Re-prioritize remaining work

**Ready to start?** Read `tickets/01-foundation.md` for Day 1.
