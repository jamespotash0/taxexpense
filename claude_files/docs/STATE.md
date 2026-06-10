# Tally: Current State

A living snapshot of where the build is right now. Unlike JOURNAL.md (an append-only
log of every decision in chronological order), this file is a working memory. It gets
overwritten in place so it always reflects the present, not the history.

**Read this first at session start** to orient, then read JOURNAL.md or the specific
ticket file when you need detail.

_Last updated: 2026-06-09_

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
