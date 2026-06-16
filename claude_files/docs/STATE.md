# Tally: Current State

A living snapshot of where the build is right now. Unlike JOURNAL.md (an append-only
log of every decision in chronological order), this file is a working memory. It gets
overwritten in place so it always reflects the present, not the history.

**Read this first at session start** to orient, then read JOURNAL.md or the specific
ticket file when you need detail.

_Last updated: 2026-06-16_

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

- **Landing traffic-source capture** (DEC-084, 2026-06-16). We now count where a visit came from
  (utm_source/ref param or external referrer, e.g. Product Hunt). New `traffic_sources` table
  (migration 0031, no PII — source/medium/campaign + referrer host only), a once-per-session client
  beacon `<TrafficSource/>` on the landing page → `POST /api/traffic` (IP-throttled) → pure
  `normalizeTrafficSource`. Aggregate channel counts only, NOT per-user web→SMS attribution
  (DEC-048/049 unchanged); JS-only. **Action needed: run `0031_traffic_sources.sql` in Supabase**
  before it ships (insert no-ops until then). 260 tests; eslint + tsc clean.

- **Multi-charge text capture** (DEC-083, 2026-06-16, follow-up to DEC-082). A single text naming
  several distinct charges ("$20 Twilio and another $20", "$40 gas and $12 parking") now logs them
  ALL instead of silently dropping all but the first. The merged parse prompt returns
  `additional_expenses[]`; `captureTextExpense` logs the primary on the full conversational flow and
  each extra via `processNewExpense`, then appends one summary note. Bounded: one live question per
  message (extras finish on the dashboard), recurring offers skipped for batches, injection/override
  defense intact, $0 phantoms filtered. Pure helpers (`summarizeExtra`/`formatBatchNote`) unit-tested;
  251 pass. Live evals green: `eval:merged` 95% (19/20) + `redteam` 15/15 held (no regression).

- **Read-verify fix: scoped the trigger + the confirm now carries the IRC §** (DEC-082, 2026-06-16).
  A "$20 Twilio and another $20" in one text tripped the multi-amount anti-injection rule (confidence
  forced ≤0.3), firing the paranoid read-check; on YES it returned a bare "locked it in" with no tax
  context, because the verify→confirm detour skips `composeResponse`. Fix: (1) the confidence penalty
  now only fires on a real *override* (a conflicting later amount that replaces an earlier one), not a
  repeated/equal amount; (2) `readCheckMessage` states the category + §section it'll file under; (3)
  new `confirmReceiptMessage`/`formatConfirmation` reply with category + §link + plain-English summary
  + CPA deferral, deterministically (no LLM, keeps DEC-066's cost win). Batch text capture (two distinct
  charges in one text → still logs one) stays the deferred limitation. 247 tests.

- **Bug fix: replies to the weekly receipt reminder now work** (2026-06-15). The reminder cron
  sends via `sendSms` and sets NO live `awaiting_receipt` pending context (and any original context
  ages out of the pending window), so a "no receipt" reply — exactly what the nudge instructs —
  fell through to new-expense capture and got the generic "text me an expense" help line. Even the
  literal "no receipt" failed. Fix: a new branch in `handleExpenseFlow` — when there's no pending
  question and the message isn't a fresh expense, a permanent no-receipt reply
  (`looksLikeNoReceiptEver`) bulk-waives all outstanding flagged receipts (`waiveAllFlaggedReceipts`),
  and a "later"-style reply (`looksLikeNoReceipt` + `countFlaggedReceipts` > 0) is acknowledged and
  kept flagged. New `bulkWaiveMessage` copy + regression tests (the exact failing phrase). 242 tests.

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

- **Verticalization + agency channel (exploration, 2026-06-10).** Evaluating verticals (adult
  creators / locums / photo-video) to differentiate from Keeper/FlyFin. Thesis: the moat is the
  substantiation/WHY-capture engine (now profession-aware via the business profile, DEC-081), not
  texting. Strongest distribution path = sell B2B to creator-management **agencies** (one sale =
  many users, clean processor profile). Stripe risk is manageable (Tally sells SaaS, not adult
  content; agency billing is clean B2B); the creator niche is already populated (Cookie Finance,
  MyPrivateLedger, OFCPA) so defensibility is product/model, not a vacuum. **Decision: build-first**
  (founder, 2026-06-10) — a manual concierge pilot isn't credible to B2B agencies, so build a
  minimum demo-able slice then reach out. Bank-linking call: NO for V1 (it's the commodity; the
  agency already owns the WHAT, you supply the WHY). Spec: `claude_files/specs/10-agency-tier.md`.
  **Chunk 1 LANDED** (migration 0030 + `src/lib/agency.ts`): `agencies` + `agency_members` tables,
  `organizations.agency_id` hinge (NULL = self-serve, unchanged), and `provisionCreatorOrg` (new
  managed org per creator — NOT co-owners). Additive, zero behavior change. **Chunk 2 in progress:**
  ✅ cross-org guard `canAccessOrg`/`assertCanAccessOrg`/`getAccessibleOrgs` + negative tests
  (agency.test.ts); ✅ entitlement fork — `getOrgEntitlement` branches on `agency_id` → managed
  creators inherit the agency's status (`computeAgencyEntitlement`, manual for now), never paywalled;
  provisioned orgs carry no own trial (so the trial-ended cron never texts an agency-covered
  creator). ✅ **read-only agency dashboard** — `/agency` (client list / "who's missing what" board,
  sorted by needs-attention; `listAgencyCreators`) + `/agency/[orgId]` (per-creator read-only
  receipts, gated by `assertCanAccessOrg`); dashboard shows an "Agency" link for staff and hides
  billing UI for managed creators. Agency UI is English-only (internal B2B tool, not i18n'd). 240
  tests pass; production build green. **Remaining follow-ups (deferred until an agency commits):**
  automated Stripe per-seat billing (manual invoicing for now), agency-side CSV export + receipt
  detail view, settings-page billing-hide for managed creators, and an agency provisioning UI
  (`provisionCreatorOrg` exists; no screen yet).
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
