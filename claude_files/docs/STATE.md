# Tally: Current State

A living snapshot of where the build is right now. Unlike JOURNAL.md (an append-only
log of every decision in chronological order), this file is a working memory. It gets
overwritten in place so it always reflects the present, not the history.

**Read this first at session start** to orient, then read JOURNAL.md or the specific
ticket file when you need detail.

_Last updated: 2026-06-10_

---

## Now working on

- **Messaging-cost levers** (see `claude_files/specs/messaging-cost-levers.md`, draft proposal).
  Two active levers: (A) conditional disclaimer/citation — BLOCKED on a Jordan/lawyer call;
  (A.1) encoding — SMS segment instrumentation now SHIPPED (`sms-segments.ts` + `sendMessage`
  logs an `sms_segments` line per SMS); (B) value digest — designed, not built. Silent capture +
  question-batching explicitly REJECTED. Pending: a JOURNAL DEC to record the finding/rejection/defers.
- Cleaning AI-isms out of the docs (em dashes removed from CLAUDE.md).
- Uncommitted changes in flight: HeroCopy.tsx, i18n/dictionaries.ts, proxy.ts, JOURNAL.md,
  plus new sms-segments.ts/.test.ts, twilio.ts, and the messaging-cost-levers spec.

## Recently shipped

- **Business profile → profession-aware categorization** (Spec 09, Piece 1, DEC-081, 2026-06-10).
  `users.business_profile` JSONB (migration 0029) holds a structured prior
  `{industry, sells_product, common_categories, synonyms, notes_for_categorizer}` derived ONCE
  from the free-text `business_type` answer (Sonnet, `BUSINESS_PROFILE_BUILDER_PROMPT`). Generated
  lazily at first expense (`ensureBusinessProfile` at the top of the expense flow — onboarding stays
  deterministic/fast), injected through the single `userContextLine` seam so all four categorization
  paths get it. Closed-taxonomy backstop (`sanitizeProfile`) drops any invalid category key.
  Best-effort: failure → null → today's bare-business_type behavior. New module `businessProfile.ts`
  + tests (227 pass). **Work type is now editable at /settings** — changing it clears the profile so
  it regenerates on the next expense. **Two evals added:** `eval:profession` (with-vs-without-profile
  categorization lift, regression-gated) and `eval:profile-build` (grades what the builder prompt
  generates; 9/9 sane). **Inventory/COGS (Piece 2) DEFERRED** — Tally captures expenses not sales,
  so it structurally can't compute COGS; out of scope (Spec 09).
- **Receipt reminders: waive + auto-cap** (DEC-078, 2026-06-08). A flagged receipt now has
  a terminal `waived` state so we stop nagging forever. Cap at 4 reminders, never silent.
- **Paywall reply made deterministic** (DEC-077, 2026-06-07). Subscribe token, no caching layer.
- **Conversational "capability" intent** (DEC-076). Tally can answer "how does this work / can it do X".
- **Business-meal full §274(d) context** (DEC-075): capture relationship + place.
- **Month-end review agent** (DEC-074, 2026-06-05). First agent shipped alongside the workflow.
- **Pricing reset to 3 tiers** (DEC-049): $5.99/wk · $12.49/mo · $9.99/mo annual, ~70% margin floor.

## Open threads

- Brand name still a rebrandable beta ("Tally" / tallywhy.com). Distinctive-name + trademark
  work deferred until paid/public scale.
- User validation with 5 real unsophisticated self-employed people (not yet done).
- Lawyer review of disclaimer/privacy/terms (pre-paid users).
- CPA spot-check of IRC summaries (post-launch).

## Active constraints to remember

- Hosting is Vercel Hobby: cron jobs are consolidated to fit the plan's limits.
- Eval pacing: ~50 Haiku requests/min cap; classifyIntent swallows 429s into "capture",
  which fakes misclassifications, so pace live evals.
- `vercel env pull` returns empty for encrypted values in this sandbox; use `env ls` for names.
- Founder uses only `.env.local`; do not create a `.env.example`.

---

## How to keep this file current

When you finish a meaningful chunk of work, update the three lists above and bump the
date. Move anything from "Now working on" to "Recently shipped" once it lands, and prune
"Recently shipped" entries once they are old enough that the JOURNAL entry is the better
reference. Keep it short: this is a snapshot, not a changelog.
