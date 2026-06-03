# Tally — Decisions Journal

Append-only log of decisions made during the build, especially where team members
disagreed. CLAUDE.md references this file as the home for decisions and deferred ideas.

Format: date, decision, who pushed back, resolution, rationale.

---

## 2026-06-02 — 1099-NEC deadline added to tax-deadline reminders

### DEC-032 — Added Jan 31 `1099-NEC filing` deadline; broadcast-to-all accepted for V1
- **Trigger.** Founder asked that tax-deadline reminders cover quarterly/1099 obligations.
  Confirmed the daily cron + 7/1-day lead logic already covers the quarterly estimated
  dates (Jan 15, Apr 15, Jun 15, Sep 15) and annual filing — those live in `DEADLINES`
  data, not the schedule. **Did NOT change the cron schedule** (`0 14 * * *`): a quarterly
  cron would miss the 7-day/1-day marks and never send. Gap found: no 1099-NEC date.
- **Change.** Added `{ id: '1099nec', label: '1099-NEC filing', month: 1, day: 31 }` to
  `src/lib/tax-deadlines.ts` (+ unit test). Fires Jan 24 (7-day) and Jan 30 (1-day).
- **Deferred consideration (post-V1):** the cron texts **every** onboarded, opted-in user,
  but 1099-NEC only applies to those who paid a contractor $600+. Copy is a soft "heads up"
  that defers to a CPA, so it's defensible for V1. If a "do you pay contractors?" user flag
  is added later, target the 1099-NEC reminder to those users only. Same pattern could
  later partition estimated-tax reminders by filing status.

## 2026-06-02 — §274(b) gift summary corrected against statute

### DEC-031 — `irc_summaries` §274b content fixed to match §274(b)(1) (v1 → v2)
- **Trigger.** Founder pasted the Cornell LII statutory text of §274(b)(1) and asked to make
  sure the gift rule is summarized correctly in the DB.
- **Two correctness bugs found in the existing `274b` row:**
  1. **$4 exception was incomplete/misleading.** Old copy: "Incidental branded items costing
     $4 or less (and shipping) don't count toward the $25." The statute's exclusion (A) is
     narrower: the item must cost ≤$4, have the taxpayer's name **clearly and permanently
     imprinted**, AND be **one of a number of identical items distributed generally** (e.g.
     logo pens handed out broadly) — not any cheap branded gift. The old phrasing also
     conflated this with the incidental-cost rule (engraving/packing/mailing, from Reg
     §1.274-3), which is a separate point.
  2. **Promotional-materials exclusion (B) was missing entirely** — signs, display racks, and
     other promo material for use on the recipient's business premises are not "gifts" at all.
- **Fix (v2).** Rewrote `short_summary` (added "directly or indirectly", cumulative), rewrote
  `common_practice` (correct $4 test + added the promo-materials carve-out + incidental-costs
  worded as "as long as they don't add real value"), and `worth_noting` (added "a married
  couple is treated as one recipient" + CPA deferral). Bumped `version` 1→2, `last_reviewed`
  2026-06-01→2026-06-02. Source pinned to §274(b)(1).
- **Kept scoped to (b)(1).** The partnership entity/partner rule was deliberately left out of
  the user-facing summary (out of V1 scope — sole props / SMLLCs); it stays in the CPA memo.
- **Synced all three sources** so they don't drift: `supabase/migrations/0003_seed_irc_summaries.sql`,
  the regenerated `RUN_ALL.sql`, and the content doc `claude_files/docs/IRC-SUMMARIES.md`. The
  seed upsert (`ON CONFLICT … DO UPDATE`) refreshes every field incl. `version`, so re-running
  0003 corrects any already-seeded DB. **Founder action:** re-run 0003 (or `RUN_ALL.sql`) to
  push v2 to the live DB.
- **Relation to DEC-028 gift-cap check.** The cleanup `gift_cap` flag's softened wording and
  this summary now tell the same story (suggest-don't-assert; $4-imprinted + promo carve-outs).

---

## 2026-06-02 — DB access hardening (RLS / anon path)

### DEC-030 — Harden the anon/public DB path; per-tenant RLS deliberately NOT added

- **Trigger.** Founder asked for "robust RLS so people can't access the tables."
- **Audit finding — posture was already sound, not open.** All 9 tables (0001) have RLS
  **ENABLED with zero policies = default-deny**, so the public anon key already reads/writes
  nothing. 0004/0005 only add columns (no RLS-less tables). 100% of data access is server-side
  via the **service role** (bypasses RLS); the anon client (`getSupabase()`) is defined but
  **never called**. So "people can access the tables" was not actually true.
- **Decision — add belt-and-suspenders hardening (0006), NOT per-tenant RLS.**
  - `0006_security_hardening.sql`: re-assert RLS on all tables; **REVOKE ALL** on public
    tables/sequences/functions from `anon`/`authenticated` + `ALTER DEFAULT PRIVILEGES` so
    future objects inherit the denial; and a **self-check `DO` block that RAISES if any
    `public` base table ships without RLS** (regression guard — a future table can't forget it).
  - Deliberately **did NOT** set `FORCE ROW LEVEL SECURITY` (with no policies it would also
    lock out the dashboard's owner-role data viewer, for zero gain since service_role bypasses
    and anon is fully revoked). Left as a commented per-table option.
  - Non-breaking: `service_role` keeps `BYPASSRLS` + its grants; the app is unaffected.
  - Regenerated `RUN_ALL.sql` (was stale — missing 0005) from 0001..0006.
- **Why NOT per-tenant RLS (Raj + Alex).** Because every request runs as `service_role`
  (bypasses RLS), classic per-tenant policies (`auth.uid()`-style) do **nothing** for the real
  cross-tenant risk (T3: an app bug querying the wrong org). That isolation is enforced in app
  code (`lib/db.orgTable`). True per-tenant RLS would require dropping the service role for
  requests + a non-bypass DB role + a per-request org claim — a large change for a custom-auth
  (phone-OTP, not Supabase Auth) solo-founder V1. **Alex:** over-engineering now; **Raj:** the
  app-layer scope + the RLS-on-all-tables guard is the right V1 line. Revisit only if we ever
  add client-side Supabase access or move off the service role.
- **Team (Jordan, security).** The anon/public REST path is the actual RLS attack surface, and
  it's now closed two ways (default-deny + revoked grants) and guarded against regression.
- **Residual items flagged (NOT in this change):**
  1. **Session tokens stored plaintext** in `sessions` (256-bit opaque). Recommend storing a
     `sha256(token)` and looking up by hash, so a DB read can't reuse live sessions. (Separate
     from RLS; high-value, low-effort follow-up.)
  2. **Verify the Storage receipt bucket is private** with no public-read policy (app uses
     signed URLs + service role; confirm in the Supabase Storage dashboard — not in SQL here).
  3. **service-role key hygiene** (rotation, never in client bundles) — out of scope of RLS.

**Follow-up (same day) — token hashing DONE + cross-tenant (IDOR) audit.**
- **Residual #1 shipped.** `sessions.token` → `token_hash`; the app now stores only
  `sha256(token)` (`lib/auth.ts`), the raw token lives only in the cookie. `0007_hash_session_tokens.sql`
  (guarded rename + purge of stale plaintext rows; idempotent). RUN_ALL regenerated to 0001..0007.
- **"Data that isn't yours" audit — clean.** Reviewed every API route + dashboard loader.
  Consistent, correct pattern: auth via `getCurrentUser()` (401 otherwise); authorization derived from
  the SESSION's org/user, **never** from request body/params; every receipt access goes through
  `getReceipt(user.organization_id, id)` → 404 on cross-org id (no IDOR); deletes/updates double-scoped
  by `organization_id`; zod validation; file type/size caps. Billing/checkout, settings, and
  email-accountant refuse body-supplied identities (email only ever sends to the saved
  `accountant_email`). Webhooks verify signatures (Stripe + Twilio); cron requires `CRON_SECRET`
  (fails closed); `test-claude` is 404 in production. No cross-tenant vector found.
- **Still open:** storage-bucket-private confirmation (dashboard, not SQL) + service-role key rotation.

## 2026-06-02 — First agentic surfaces: SMS query router + "review my year" (post-V1)

### DEC-029 — Add bounded agentic features; capture loop stays a workflow (extends DEC-011 + AGENTS-VS-WORKFLOWS)

- **Decision.** Keep the SMS *capture* pipeline a deterministic workflow (unchanged). Layer
  two **bounded, read-mostly, user-initiated** agentic surfaces on top:
  1. **Conversational SMS query router** — users can ask about their data (aggregates by
     category/period, recent charges, counts, receipt status) and run safe commands (export).
  2. **"Review my year"** — an SMS/command-triggered report reusing `lib/cleanup.ts`
     (gap scan) + period aggregates. ("What's missing" already ships as weekly reminders +
     the cleanup dashboard, so this is the annual summary, not a new scanner.)
- **Guardrails (founder-approved):**
  1. **Read-only in v1.** Queries + `export`; `email-accountant` gated behind explicit Y/N
     confirmation (outward send). Edits/deletes via chat **deferred** (dashboard owns those);
     "mark personal" is the one mutation to add in v1.1 behind a confirm, once the classifier
     is proven.
  2. **Numbers come from the DB, never the model.** The LLM only classifies intent + extracts
     params (validated against the canonical category/period whitelist); deterministic
     functions (`lib/queries.ts`, reusing `receipts.ts`) compute every figure; replies that
     contain a number use **templates**, not free-form model output. Kills hallucinated totals.
  3. **Refuse tax-owed / advice** ("how much will I owe?", "is this deductible?") → warm
     deflection + CPA, reusing the suggest-don't-advise posture (CLAUDE.md #1/#7).
- **Build order (Option C — de-risk inward-out):** shared read-only query layer + guardrails
  → "review my year" (simple consumer, proves the numbers-from-DB contract) → SMS router
  (the only piece on the capture hot path; defaults to `capture` on low classifier confidence).
- **Team.** Raj: ~80% of the tooling already exists (`getMonthlySummary`/`getReceiptsForYear`/
  `listReceipts` are clean org-scoped tools). Jordan: read-only + numbers-from-DB + advice
  deflection are the non-negotiables. Priya: the classifier (capture vs query vs command vs
  advice) is the real work — needs an eval set; mixed/correction messages are the failure mode.
  Alex: passes his bar (real pull, low blast radius, high reuse) **but** validate with users
  and keep the intent whitelist small — no "ask me anything." Marcus: engagement/retention
  play; market as "ask Tally about your expenses," never "agent" (accuracy + legal risk).
- **Cost/latency note.** Router adds one Haiku classify call to *non-photo* inbound texts only;
  capture path unchanged. Numbers-from-DB means no extra reasoning tokens for arithmetic.

## 2026-06-02 — Year-End Cleanup Mode (new post-V1 epic) — first slice built

### DEC-028 — Year-End Tax Cleanup Mode added as TSNAP-EPIC-9 (post-V1, P2)
- **Context.** A Perplexity competitive teardown (founder-supplied) largely restated our
  existing positioning, but surfaced ONE genuinely net-new idea not anywhere in our docs:
  a **year-end cleanup mode** that spots missing notes, vague memos, duplicate receipts, and
  mixed personal/business items before filing. This is the "missing-proof detection"
  differentiator — defensible because it depends on our taxonomy + substantiation logic, not
  OCR. Founder liked it and asked to plan + start building it.
- **Decision.** Add as **TSNAP-EPIC-9**, explicitly **post-V1 / P2** (does NOT count against
  the 10-day MVP budget — cleanup only has value once a user has a year of data; pulling it
  into V1 would be scope creep per Common Mistake #4). Built the first slice now.
- **Architecture (consistent with DEC-011 + AGENTS-VS-WORKFLOWS).** Workflow, not agent. Of
  five checks, **four are pure deterministic code** reading flags V1 already stores
  (`needs_receipt`, `substantiation_complete`, `substantiation_missing_fields`,
  `payment_account`, `category='personal'`) — never re-deriving tax logic. The fifth,
  **vague-memo detection, is the only LLM call** (Haiku, batched, fail-safe → `[]` on error).
  Deterministic scan is the unit-tested backbone; the memo pass is an additive layer.
- **Guardrails honored.** Suggest-not-advise (CLAUDE.md #1) — every issue links to the receipt
  and the user resolves it; Tally never auto-edits. Copy says **"documentation complete," NOT
  "audit-ready"** (CLAUDE.md #5) — we deliberately rejected Perplexity's "audit-ready evidence"
  framing for the same legal-liability reason. (The same teardown also pushed "force context at
  capture" and a user-facing confidence score — both declined as conflicting with "ask only when
  required" and our advisor-liability posture; logged here for the record, not adopted.)
- **Built (first slice).** `lib/cleanup.ts` (engine + memo layer), `lib/cleanup.test.ts` (7
  tests, all green), `getReceiptsForYear()` in `lib/receipts.ts`, `GET /api/cleanup`,
  `/dashboard/cleanup` panel + dashboard entry point, EN/ES copy under `t.app.cleanup`.
  `npm run build` + full `npm run test` (45 tests) green.
- **Deferred (TSNAP-095).** Year-switcher UI (today `?year=` only), inline resolve actions,
  seasonal SMS nudge (needs TCPA + DB-backed rate limit — cf. DEC-027), gift $25-cap overage
  check, vague-memo eval/precision tests, CPA spot-check of the duplicate window + framing.
- **Files/spec:** `claude_files/specs/08-year-end-cleanup.md`, EPIC row in `specs/00-EPICS.md`.

**Follow-up (2026-06-02, same day): most of TSNAP-095 landed.**
- **Year-switcher UI** — `getReceiptYears()` drives a pill row on `/dashboard/cleanup`.
- **Gift $25-cap-per-recipient/year overage check** — new `gift_cap` issue type. Sums
  `business_gifts` by recipient (exact-match) and flags totals > $25 — the per-recipient/year
  AGGREGATE the per-receipt cap in `substantiation.ts` structurally cannot catch (cross-ref
  DEC-011 note + TSNAP-030). Wired through the report, dashboard group, EN/ES copy, AND the
  DEC-029 "review my year" SMS (`year-review.ts` ISSUE_NOUN) so both surfaces stay in sync.
- **Vague-memo scaffolding tests** — no-candidate short-circuit (proves no LLM call without an
  API key) + `mergeIssues` ordering/counts. Real-data precision eval still deferred (LLM judgment).
- **CPA spot-check PREP** — `claude_files/docs/CPA-REVIEW-CLEANUP.md` front-loads the questions
  (gift-cap aggregate unit + incidental-cost exclusion, 3-day duplicate window, mixed-account
  framing). The review itself stays deferred per CLAUDE.md Open Item #4 (post-launch).
- Cleanup tests 7→13; full suite 86 green; `npm run build` type-checks clean.
- **Gift-cap §274(b)(1) refinement** (founder supplied the full rule text). The cumulative
  direct+indirect per-recipient/year unit matches our sum. But the rule has carve-outs we
  **cannot detect** from {amount, date, recipient}: the **$4 de-minimis** (imprinted items
  distributed generally), **promotional materials** (signs/racks aren't gifts), **spouses =
  one recipient**, and the **partnership entity/partner** rule (out of V1 scope — sole
  props/SMLLCs). So we **softened the message from an assertion to a suggestion** ("only $25
  is deductible, the rest won't count" → "generally capped at $25… some may not count;
  imprinted <$4 and promo materials can be exempt — worth a check"). Keeps suggest-don't-advise
  (CLAUDE.md #1). We still sum **gross** and flag-for-review rather than silently excluding ≤$4
  items (avoids under-flagging). Carve-outs documented in the code + CPA memo (Q1a–Q1e).
- **Still open:** inline resolve actions, seasonal SMS nudge, vague-memo precision eval, the
  CPA review itself (now incl. the gross-vs-net-of-$4 question, Q1b).

---

## 2026-06-02 — Landing hero CTA experiment + desktop measurement fix

### DEC-027 — Hero "text-me-first" CTA (arm C) built but held OFF live traffic; desktop sms: dead-end fixed
- **Context.** Design research on text-first SaaS heroes (Poke, Keeper, Community, Cleo,
  DoNotPay, SlickText, Boardy) found that most have moved *away* from a raw textable number to
  a button/app-store flow; the surviving phone pattern is Boardy's "Message Me → enter your
  number, we text you first" (consent + attribution + works on desktop). Founder liked the
  what/why copy (variant A) and the conversational "Hey, I'm Tally" copy → became **variant B**
  (replaced the old loss-aversion B). Prototyped a Boardy-style phone-input CTA as **arm C**.
- **Decision.** Arm C is built but **NOT auto-assigned to live traffic.** Live split reverts to
  50/50 A/B (copy test only). Arm C is reachable via a forced `ab_hero=C` cookie for the 5-user
  validation sessions and demos. Also fixed the desktop CTA dead-end (new `TextNumberCta`):
  `sms:` links are a no-op on desktop, so the old `<a>` logged hollow "clicks"; it now copies the
  number (real desktop path) + opens Messages on mobile, and all arms fire one comparable
  `hero_cta_engaged` event.
- **Team review (conflict surfaced).**
  - *Jordan (compliance) — blocking for live:* "text-me-first" makes us the SMS initiator (A2P) →
    needs explicit **consent logged with timestamp** and **DB-backed rate limiting**. The current
    in-memory limiter is per-instance (resets on cold start) → SMS-bombing vector (enter a
    victim's number) → carrier complaints could kill our Twilio sender for everyone.
  - *Priya (metrics):* arms measured different events; desktop `sms:` conversion was broken → fixed
    via unified `hero_cta_engaged`. Also: solo-founder traffic likely can't power a 3-way test.
  - *Marcus + Alex:* optimizing a landing CTA before any user validation is premature; validate
    with 5 real users first.
  - **Dissent kept in view — Maya (growth):** even a *winning* arm C could weaken the demo-driven
    growth channel, because a phone-input form isn't filmable the way a live number is ("Bank says
    X, Tally says Y" reels need a textable number, not a lead-capture box).
  - *Sofia (UX):* if C ships, the welcome SMS must be one short, human line (one question, max) —
    not the current 3-sentence block.
- **Re-enable criteria for arm C → live:** (1) consent logged w/ timestamp, (2) DB-backed rate
  limit by IP + phone (mirror `lib/auth` requestCode), (3) abuse protection (e.g. CAPTCHA),
  (4) shortened welcome copy, (5) ≥5 validated users. A2P 10DLC registration also applies.
- **Files:** `lib/ab.ts` (variant C, not auto-assigned), `proxy.ts` (50/50 A/B), `HeroCopy.tsx`
  (B = conversational), `HeroTextMeForm.tsx` + `api/hero-optin/route.ts` (prototype),
  `TextNumberCta.tsx` (desktop fix), `dictionaries.ts` (EN/ES copy).

---

## 2026-06-01 — Day 1 / EPIC-1 Foundation kickoff

### DEC-020 — Landing redesign: animated SMS hero, 3 sections, "Say hello" CTA, no pricing
- Rebuilt the landing to 3 sections (hero / features / footer-CTA). Hero visual is an
  **animated SMS thread** (`AnimatedPhone`): user texts an expense → typing indicator → Tally
  replies, looping. Custom CSS keyframes + a setTimeout state machine (no animation library).
  Honors `prefers-reduced-motion` (static thread, no loop) per Sofia/a11y. Primary CTA is
  "Say hello 👋" → `sms:` deep link to the Tally number; Install as secondary. No pricing.
  Icons still placeholders (designer task). Consulted Sofia (web UX) on motion + accessibility.

### DEC-023 — Cinematic landing pass (Framer Motion scroll-reveal)
- Added scroll-reveal + stagger to the landing (Reveal/Stagger/StaggerItem) — section headings
  fade up, bento tiles stagger in, CTA band reveals; plus the existing animated SMS hero + bento
  hover-lift. Global `MotionProvider` (MotionConfig reducedMotion="user") makes ALL motion
  respect the OS reduce-motion setting. Completes founder's paywall→onboarding→product order.

### DEC-022 — Web onboarding funnel: animated priming flow → trial (Framer Motion)
- Built `/start` (OnboardingFlow): tappable, animated steps (Framer Motion, reduced-motion safe)
  — work type → tax-time pain → value reveal → "text to start (21-day trial, no card)" + install.
  It primes/personalizes before dropping into the trial (no card; capture begins on first text).
  No DB writes (no account yet); SMS onboarding remains the profile source of truth.
- Landing CTAs now route to `/start` ("Start free trial"), with direct-text as the secondary path.
- Settings gains a Billing section (status + Stripe portal via ManageBillingButton).
- Installed `framer-motion` (also used for the queued cinematic landing pass).

### DEC-024 — Tax-deadline reminder cron (Phase-2 feature pulled forward)
- Founder asked for tax-season reminders. CLAUDE.md listed "Tax deadline reminders" as Phase-2
  (not V1) — pulling it forward at founder request.
- `lib/tax-deadlines.ts` (pure, 5 unit tests): §6654 estimated quarterly (Jan/Apr/Jun/Sep 15)
  + annual filing (Apr 15); `remindersDueOn(today)` fires at 7-day and 1-day leads, grouping
  same-date deadlines (Apr 15 = filing + Q1). `/api/cron/tax-deadlines` (daily 14:00 UTC,
  CRON_SECRET-protected) texts onboarded, non-opted-out users. Every message says "not tax
  advice — confirm with your CPA." Nominal dates (reminders, not filing dates).
- Vercel env: Production fully mirrored from .env.local (8 vars incl. CRON_SECRET). Preview
  skipped — Vercel CLI 54.7.1 bug (`git_branch_required` loop even with documented flags);
  set Preview in the dashboard if/when needed (only affects PR/branch deploys).

### DEC-025 — Localization: Spanish first, funnel + AI-language-mirror (no i18n dep)
- Founder wants the +62.5% localization lift. Chose **Spanish first**, scope **funnel + app UI**.
- **Approach:** lightweight, dependency-free i18n (lower risk than wiring next-intl into Next 16/
  Turbopack). Locale from `locale` cookie → Accept-Language → default `en`. `src/i18n/`
  (config, dictionaries en/es, server getI18n) + `LocaleSwitcher` (EN/ES, cookie + refresh).
- **Done this pass (the conversion driver):** landing, `/start` onboarding, `/pricing` fully
  localized EN/ES (server pages resolve the dict; client components — OnboardingFlow, PlanPicker,
  InstallButton — take dict slices as props). Also upgraded the paywall design (most-popular
  ribbon, feature checklist, cinematic /pricing).
- **AI/SMS:** reply prompts now instruct Claude to answer in the user's language (Prompts 2/4/5) —
  cheap localization of the conversational surface without translating per-string.
- **Staged next:** app UI strings (dashboard, settings, login, receipt editor) on the same infra.
  Also not localized: the animated phone's example bubbles, hard-coded SMS onboarding copy, legal
  pages. USD pricing everywhere (no per-locale Stripe prices in this pass).

### DEC-026 — App-UI localization: dashboard, login, settings, receipt editor (completes DEC-025 stage)
- Localized the logged-in app surface EN/ES on the same dependency-free infra. Added an `app`
  namespace to `i18n/dictionaries.ts` (nav, dashboard, login, settings, settingsForm, receipt,
  badge, emailAccountant, deleteAccount, billing, categories) mirrored EN↔ES (shape enforced by
  `es: Dict`). Server pages (`dashboard`, `settings`, `login`, `receipts/[id]`) resolve via
  `getI18n()` and pass dict slices as props to client components (LoginForm, SettingsForm,
  ReceiptEditor, EmailAccountantButton, DeleteAccountButton, ManageBillingButton). `LocaleSwitcher`
  now also lives in the dashboard/settings/login headers so logged-in users can switch.
- **Plurals:** trial "N day(s) left" handled with explicit `*One`/`*Other` strings + `fmt()`
  (Spanish needs "Queda 1 día" vs "Quedan N días"), not naive `+ 's'`.
- **Categories:** added a localized display map in the dict used by the dashboard list + editor
  dropdown. **Left `lib/categories.ts` (CATEGORY_LABELS/QBO) English on purpose** — it backs the
  CSV/QuickBooks export, which must stay English for accountants. So on-screen labels translate;
  exported files don't. The editor still iterates the canonical `CATEGORY_LABELS` keys (stable
  order + value set), showing the localized label.
- **DELETE confirm token stays literal "DELETE"** in both languages (the API checks that string);
  only the surrounding warning prose is translated (warningBefore/After around a mono span).
- **Still English (unchanged from DEC-025 staging):** animated phone example bubbles, hard-coded
  SMS onboarding copy, legal pages, and DB-sourced IRC summaries (tax content, not UI). USD pricing.
- Green: `tsc --noEmit`, eslint, `next build`, 34 unit tests.

## 2026-06-02 — Monetization (EPIC-9): free trial + hybrid paywall

### DEC-021 — Paid product: 21-day trial, HYBRID hard paywall, Stripe (supersedes "free during beta")
- **Context:** Founder set a monetization strategy from mobile-subscription benchmarks (hard
  paywall ~10.7% vs soft ~2.1%; 17–32d trial > 3d; high price → ~5.4× LTV; localization +62.5%).
  This supersedes CLAUDE.md "Stripe billing (free during beta)" and the "no localization" line.
- **Decisions:**
  - **Hybrid paywall:** no card to start — users text and use Tally free for a **21-day trial**;
    after the trial a **hard paywall** requires a subscription to keep logging. Preserves the
    "just text" wedge during trial, then gates continued use. (Optional expense-cap deferred.)
  - **Billing = Stripe** (PWA, not native → no Apple/Google 30% cut, no IAP rules — real LTV win).
  - **Price (competitive default, single config constant):** $17.99/mo or $143.88/yr ($11.99/mo,
    save 33%). Landscape: Keeper ~$20/mo, QuickBooks Solopreneur ~$20/mo, Hurdlr/Everlance ~$8–12.
    Founder said "stay competitive" → premium-but-under-Keeper. Tunable in `lib/pricing.ts`.
  - **Animation lib:** Framer Motion (cinematic landing pass queued next).
- **Funnel (paywall → onboarding → product, per founder):** Landing → start trial (no card) →
  onboarding provisions the number → text. SMS handler checks entitlement; lapsed trials get a
  paywall reply. PWA shows a paywall screen when the trial has ended.
- **Validation caveat (Alex/Marcus):** conversion benchmarks assume demand exists; with 0 validated
  users the card-required step is *itself* the validation signal — go in knowing that.
- **Localization (+62.5%):** fast-follow after the English funnel converts (needs i18n + per-locale
  Stripe prices); not in this pass.
- **Founder must provide:** Stripe account → secret key, publishable key, the two Price IDs,
  webhook signing secret (added to `.env.local`).

## 2026-06-01 — Interface: PWA + WhatsApp (refines DEC-017)

### DEC-019 — Installable PWA + WhatsApp channel; native app stays Phase-2
- **Context:** Founder wants the landing page to push an installable app and the product to
  live at the app/messenger level (not a "website"). DEC-017 had said "no app, Phase 2."
- **Decision:** Make the existing web app an **installable PWA** (manifest + service worker +
  icons + install affordance) so the landing leads with "Install Tally," AND add **WhatsApp**
  as a second capture channel alongside SMS. This satisfies both "download/install" and
  "messenger" without a native build, App Store gate, or losing the no-friction wedge. A
  **native app stays Phase-2**, gated on user demand.
- **iMessage/RCS:** confirmed NOT available to a solo founder (Apple Messages for Business /
  Google RBM are agency/approval-gated). Realistic channels = SMS + WhatsApp.
- **Implementation:** `public/manifest.webmanifest`, `public/sw.js`, `PWARegister`,
  `InstallButton`, layout metadata/viewport, placeholder ink icons (David to replace).
  Messaging is now channel-aware: `sendMessage(to, body, channel)`; inbound route detects the
  `whatsapp:` prefix; replies go back on the same channel. Env: `TWILIO_WHATSAPP_FROM`.
- **SMS cost clarification (founder asked):** users are NOT billed by us (their carrier plan
  applies — unlimited for ~everyone). The operator (you) DOES pay Twilio per message
  (~$0.008/SMS seg, ~$0.02 MMS) + number + 10DLC fees — ~$6–15/mo at beta scale. WhatsApp is
  cheaper (free service-conversation window). No messaging channel is truly $0 to the operator;
  only the PWA's own in-app/web-push path is zero-marginal-cost (but loses the "just message" magic).

## 2026-06-01 — Receipt image storage hardening

### DEC-018 — OCR-before-store (no orphaned images) + account-deletion Storage purge
- **Found (Jordan):** the SMS flow stored every inbound photo to Supabase Storage BEFORE
  OCR. Non-receipt / unreadable / unmatched photos got stored but never linked to a
  `receipts` row → orphaned images (privacy: we keep images we never use; plus storage cost).
  Separately, DB cascade deletes rows but not Storage objects → account deletion left images.
- **Fix 1 (no orphans):** OCR from the Twilio bytes in-memory first (base64 vision via
  `extractReceiptFromImageData`), and only `storePhotoBuffer` once we know the image links —
  i.e. a confirmed new receipt or a high-confidence attachment. not-a-receipt / unreadable /
  medium-low matches are never written to Storage. `fetchTwilioMedia` replaces the old
  store-then-OCR `downloadAndStorePhoto`. Dashboard upload still stores (it always links).
- **Fix 2 (deletion purge):** `deleteAllUserPhotos(userId)` + `DELETE /api/account` purges
  Storage objects, then deletes the user (cascades receipts/conversations/roles/sessions),
  the org, and leftover auth codes — closing the SEC-001 Storage-deletion gap (CCPA/GDPR).
- **Note:** images are in Supabase Storage (S3-backed), private bucket, served via 1h signed
  URLs; path (not URL) stored on the receipt; removed on receipt delete too.

## 2026-06-01 — Design system (TSNAP-034) + mobile-app scope

### DEC-017 — Formalized web design tokens; no native mobile app in V1
- **Context:** Founder asked whether to solidify a mobile app's design/framework/colors.
- **Mobile app:** OUT of V1 (Phase 2, per CLAUDE.md). The V1 wedge is "no app — just text."
  Designing a native app + its own framework/colors now is scope creep (Alex) and contradicts
  positioning (Marcus). The only V1 "mobile" concern is the responsive WEB dashboard
  (TSNAP-045 device audit still pending). Decision: do NOT design a mobile app; revisit in
  Phase 2 after the SMS bet is validated with real users.
- **Web design system (the real gap):** I'd built the dashboard/landing with ad-hoc Tailwind
  utilities (no tokens). Formalized TSNAP-034 in `src/app/globals.css` via Tailwind v4
  `@theme`: one accent (`--color-primary` ink + hover), Tailwind's neutral gray scale, and
  semantic `success`/`warning`/`error` (50/600/700). Dropped the scaffold's auto dark-mode
  (it conflicted with the light components; not worth the polish budget). Switched to a system
  font stack (removed the Geist Google-font fetch). Refactored badges/buttons/focus/links to
  the tokens. David's "restraint over expression." Builds + 21 tests still green.

## 2026-06-01 — EPIC-3/4/5/7/8 build pass

### DEC-015 — Email-accountant ships as CSV + HTML summary in V1; PDF deferred
- **Context:** TSNAP-047/048 want a generated PDF + CSV emailed to the accountant.
- **Decision:** V1 sends a formatted HTML summary email with the **CSV attached** (via
  Resend). The **PDF is deferred** — `@react-pdf/renderer` is a heavy dependency for a
  P1-can-slip feature.
- **Rationale:** Accountants import CSV anyway; HTML body carries the at-a-glance summary.
  Matches EPIC-8's "can slip" priority and Alex's resist-scope-creep. Add PDF post-beta if
  users ask. `src/lib/email.ts`, `src/app/api/email-accountant/route.ts`.

### DEC-016 — Sentry deferred for V1; structured JSON logging via lib/log instead
- **Context:** EPIC-6 lists Sentry. It's marked "optional for V1."
- **Decision:** Skip the `@sentry/nextjs` install + instrumentation for now. Use the existing
  structured `lib/log` (JSON lines, PII-masked) which surfaces in Vercel logs. Wire Sentry
  before public/paid scale.
- **Rationale:** Avoid config overhead + a dependency on the critical path; logging covers
  beta debugging. `NEXT_PUBLIC_SENTRY_DSN` env slot kept for later.

### BUILD STATUS (end of this pass) — all code compiles, lints, 21 unit tests pass
- EPIC-1 Foundation: ✅ code/SQL (needs: seeds + migration 0004 run, Twilio, deploy).
- EPIC-2 SMS pipeline: ✅ code (needs live Twilio + seeds to run end-to-end).
- EPIC-3 Substantiation + reminders: ✅ decision tree (tested) + weekly cron reminder.
- EPIC-4 Dashboard: ✅ phone-OTP auth, sessions, proxy gate, list/detail/edit/delete,
  photo upload, CSV + QBO export, settings (email/org), badges, empty states.
- EPIC-5 Landing + legal: ✅ landing (TCPA opt-in), privacy (CCPA), terms + tax disclaimer.
- EPIC-7 Security: ✅ webhook signature, OTP rate-limit + lockout, constant-time compare,
  HTTP-only/secure/sameSite cookies, private Storage bucket + signed URLs, STOP/START,
  org-scoped queries + RLS default-deny. (Follow-ups: per-day receipt + per-min API limits.)
- EPIC-8 Email accountant: ✅ CSV + HTML email (PDF deferred, DEC-015).
- EPIC-6 Testing/launch: 🟡 unit tests in place; live E2E + carrier/device tests pending
  Twilio + deploy; Sentry deferred (DEC-016).

## 2026-06-01 — Day 3 / EPIC-2 SMS Pipeline kickoff

### DEC-014 — Capture name over SMS; email + org name at the dashboard (progressive profiling)
- **Context:** Over SMS we only know a phone number. Founder wanted to also capture name,
  email, org name so we "know who they are."
- **Tension:** Adding all three to SMS doubles onboarding (3→6) right after DEC-013 chose
  minimal. Sofia/Alex: friction at the highest-drop-off moment + off-brand. But the need is
  real for records / "email my accountant" / personalization.
- **Per-field reasoning:** name = warm, easy to type, broadly useful → SMS. email = typo-prone
  over SMS and NOT needed for phone-OTP login → dashboard, optional. org name = often empty for
  sole props → dashboard, optional.
- **Decision (progressive profiling):** Add **name** as onboarding Q1 (now 4 questions:
  name → work → entity → payment). Collect **email** + **org name** at the dashboard / at
  point-of-need (e.g. email when setting up "email my accountant"). Migration `0004` adds
  `users.full_name` + `users.email`; `organizations.name` already exists.
- **Follow-up:** EPIC-4 dashboard settings must collect email + org name (optional). Founder
  must run migration `0004` (or re-run `RUN_ALL.sql`) in Supabase.

### DEC-013 — Onboarding stays deterministic + minimal, but CONFIG-DRIVEN (not LLM-adaptive)
- **Context:** Founder asked whether the 3-question onboarding should be hardcoded or
  adaptive ("re-analyze based on answers to ensure coverage").
- **Key reframe:** Onboarding data is NOT load-bearing for substantiation — the decision
  tree runs on category + amount + photo + per-expense context. `business_type` only nudges
  categorization; `entity_type` does ~nothing in V1 (sole prop ≈ single-member LLC on
  Schedule C); `default_payment_account` is just a default. The adaptive "ask only what's
  required" intelligence already lives at EXPENSE time (the clarification flow).
- **Team:** Sofia/Alex/Marcus against adaptive onboarding (activation is the highest-drop-off
  moment; LLM nondeterminism/latency/over-asking is wrong there and off-brand vs "only ask
  when required"). Raj: don't hardcode in a switch — make it config-driven. Priya: instrument
  per-step completion; question whether `entity_type` earns its slot.
- **Decision:** Keep onboarding deterministic + minimal, but move questions into a tunable
  `ONBOARDING_QUESTIONS` config array with light re-ask validation (empty answer → re-ask).
  Adaptivity stays at expense time. `src/lib/onboarding.ts`.
- **Follow-up (measure, don't act yet):** instrument per-step completion; revisit whether
  `entity_type` should be dropped/inferred.

### DEC-011 — Substantiation decision tree runs in DETERMINISTIC CODE; LLM composes language only
- **Context:** SYSTEM-PROMPTS Prompt 2 embeds the decision tree and asks Sonnet to apply
  it (decide needs_receipt / thresholds / deductible) AND write the SMS in one call.
- **Tension:** CLAUDE.md mandates "code controls flow … substantiation_rules is the single
  source of truth — don't hardcode category logic." Raj: tax thresholds ($75, 50% meals,
  $25 gift cap) must be deterministic + unit-testable, never left to an LLM that can drift.
- **Decision:** `lib/substantiation.ts` computes the authoritative result from the
  `substantiation_rules` row: `needs_receipt`, `receipt_reason`, `missing_context_fields`,
  `substantiation_complete`, `deductible_amount_cents`. The LLM is used ONLY to (a) extract
  & categorize (Prompts 1/6, Haiku) and (b) compose the SMS wording given the already-computed
  decision (Prompt 2, Sonnet). The `receipts` row is written from the CODE decision, never
  parsed from LLM prose. Prompt 2 still carries the tree for tone, but flags are authoritative
  from code.
- **Rationale:** Tax correctness is deterministic, testable, and cheap; the LLM does what it's
  good at (language). Matches the AI-workflow-not-agent architecture.
- **Owners:** Raj + Priya (logic), Sofia (response wording).

### DEC-012 — Business gifts are THRESHOLD-based ($75), not always-receipt (doc prose was wrong)
- **Found:** Building the decision-tree unit tests surfaced a conflict. CLAUDE.md's tree
  and SPEC's "exceptions" prose say *gifts always require a receipt (lodging, gifts)*. But
  the seed data has `business_gifts.always_receipt = FALSE` (threshold $75), and
  SYSTEM-PROMPTS Example 6 (team-authored) shows a $45 gift getting **no receipt ask** —
  only the $25-cap note + a context question.
- **Decision:** The `substantiation_rules` table is the source of truth (DEC-011). Gifts are
  **threshold-based**: a sub-$75 gift needs no receipt; a $75+ gift does. Only **lodging** is
  truly always_receipt. The $25/recipient deduction cap still always applies.
- **Rationale:** Matches Example 6 and the "ask only when required" rule (a $20 gift's
  deductible is tiny — demanding a receipt would over-ask). Also closer to IRS: the
  always-receipt rule is specific to lodging (Reg §1.274-5); gifts fall under the general
  $75 documentary-evidence threshold.
- **Follow-up (doc fix, NOT code):** correct CLAUDE.md decision tree + SPEC "exceptions"
  prose to say "always_receipt: lodging" (drop "gifts" from the always-list). Code + seed
  already correct.

### DEC-001 — Multi-tenant isolation: app-layer filtering + RLS default-deny backstop
- **Context:** SPEC routes all server-side DB access through the Supabase service-role
  client and relies on `organization_id` filters on every query (Raj). Jordan wants
  Row Level Security so a single app bug can't leak data across tenants.
- **Tension:** We use custom phone-OTP auth, NOT Supabase Auth. `auth.uid()` is not
  available to Postgres RLS policies without building a custom-JWT signing layer, which
  is out of scope for Day 1.
- **Decision:** Enable RLS on every table with a **default-deny** policy. The `anon`
  key can read/write nothing; only the `service_role` key (server-only) bypasses RLS.
  In application code, ALL queries go through a mandatory `orgScoped()` helper that
  injects `organization_id`. 
- **Rationale:** Jordan gets a hard backstop against accidental public exposure (the
  most likely real-world leak path) without us building custom-JWT RLS on Day 1. Raj
  keeps the simple, fast server data path. 
- **Owners:** Raj (data path) + Jordan (policy). 
- **Deferred to V2:** Custom-JWT RLS so policies can enforce per-org isolation even if
  the service role is misused. Tracked here, not lost.

### DEC-002 — Next.js app lives at repo root, not in a `taxsnap-mvp/` subdirectory
- **Context:** `tickets/01-foundation.md` TSNAP-002 literally says
  `npx create-next-app@latest taxsnap-mvp`.
- **Decision:** Scaffold the app at the **repo root**. Planning docs stay in
  `claude_files/`.
- **Rationale:** Avoids a monorepo "root directory" setting on Vercel; one deploy
  target, zero extra config. The literal subdir name in the ticket was illustrative.

### DEC-003 — Phone numbers stored encrypted-at-rest (Supabase), never app-hashed
- **Context:** Jordan wants phone numbers hashed/encrypted. Raj needs plaintext: the
  inbound SMS webhook looks users up by `From`, and outbound SMS needs the real number.
- **Decision:** Store plaintext, rely on Supabase managed at-rest disk encryption. Do
  NOT app-hash the column. Add a `maskPhone()` logging helper (shows only last 4) and
  forbid logging full numbers anywhere.
- **Rationale:** A one-way hash breaks lookup-by-number and outbound send — it would
  break the core product. At-rest encryption + log masking covers the realistic
  exposure (leaked logs / casual DB browsing).

### DEC-013 — Beta domain change: gettallyexpense.com → tallywhy.com (supersedes DEC-010)
- **Context:** Founder went to lock a cleaner Tally `.com`. `usetally.com` (and effectively the
  entire Tally `.com` space — ~33 of 35 combos checked) is taken or parked. The descriptive
  `*expense` survivors (`gettallyexpense.com`, `jotexpense.com`, etc.) are weak brands and the
  `get<name>expense` handle is long/clunky for a non-technical audience to type or click.
- **Decision:** Beta domain = **`tallywhy.com`** (registered). Brand name stays **"Tally"**.
  Defensive holds recommended: `gettallywhy.com`, `tallywhy.co` (both available at decision time;
  `tallywhy.app` was taken).
- **Why tallywhy.com:**
  - **Bare `.com`, no `get/try/use` prefix** — shortest, most clickable option that exists in the
    Tally space; far better than `gettallyexpense.com` for the target audience.
  - **The domain now carries the WHY** instead of the tagline alone: "your bank knows WHAT you
    spent — Tally knows WHY." Resolves the standing DEC-010 caveat that the name "Tally" points at
    the gesture, not the differentiator.
  - **Brand-word-first** ("tally…") matches how people recall and autocomplete the name; reads
    unambiguously as a product name (vs. `whytally.com`, also available, which reads like a
    rhetorical headline "Why Tally?").
- **Caveat (unchanged from DEC-010):** "Tally" remains a crowded fintech trademark thicket. Still a
  **rebrandable beta name** — do NOT spend on the mark. Set
  `NEXT_PUBLIC_APP_URL=https://tallywhy.com`. Code fallback URLs + `privacy@` email updated to
  `tallywhy.com`.

### DEC-010 — Beta name change: "TaxSnap" → "Tally"; domain gettallyexpense.com (supersedes DEC-008)
- **Context:** Founder ran a fresh naming pass from the problem statement ("your bank knows
  WHAT you spent, not WHY"). Explored gesture/action monikers and the WHY/substantiation
  angle; candidates pressure-tested for sound, category fit, domain, and trademark.
- **Path walked (so the reasoning isn't lost):**
  - *Jot* → killed: Chase already shipped an expense app called "Jot" (+ JotNot/Jotform).
  - *Clip* → liked the gesture, killed on collisions: "Clip" is a $2B Mexican payments
    unicorn (PayClip) + Clip Money (public co); `getclip.com` registered since 2000;
    `clip.com` is a lawn-care company. `clipexpense.com` was free but the mark is crowded.
  - *Whyceipt* (why+receipt) → on-strategy and bare `.com` free, but sounds bad spoken.
  - *Tally* → chosen on **sound + category fit** ("a tally" = a running financial record;
    warm, two-syllable, verb-able — "it tallies as you go").
- **Why a plain-sounding name is OK:** Keeper precedent — "Keeper" contains no "tax"/
  "deduction"; the tagline carries the value. Same here: "Tally" names the gesture, the
  **tagline must carry the WHY** (Marcus/Maya caveat — name points at the running-record
  action, not the differentiator, and "Tally" is hard to search/hear in audio).
- **Domain reality:** "Tally" namespace is saturated — `tally.com` + clean `tally-*` .coms
  taken or parked-for-sale ($1k–5k+); even `gettallyapp.com` is gone. Best **free** `.com`
  is **`gettallyexpense.com`** (.com matters for the non-technical audience's trust;
  "expense" does the category work; mirrors the `gettaxsnap.com` `get<name>` pattern).
- **Decision:** Beta brand = **"Tally"**, subtitle **"Tally · expense tracking"**, domain
  **gettallyexpense.com**. Set `NEXT_PUBLIC_APP_URL=https://gettallyexpense.com` when the
  rename ships.
- **Caveat (carried, not resolved):** "Tally" is a crowded fintech trademark thicket. Treat
  as a **rebrandable beta name** — do NOT spend on the "Tally" mark. Distinctive-name +
  trademark exercise stays deferred to paid/public scale (CLAUDE.md Critical Open Item #1).
- **Follow-up (NOT done in this change):** a full find-replace of "TaxSnap" → "Tally" across
  docs/code is a separate task; this entry only locks the name + domain decision.

### DEC-008 — Beta domain: gettaxsnap.com; "TaxSnap" kept as rebrandable working name (SUPERSEDED BY DEC-010)
- **Context:** Setting up Twilio A2P registration forced a business-website (and thus
  domain) decision. Availability check: `taxsnap.com` is parked-for-sale since 2009
  (premium/slow); `.app/.io/.co/.ai/.us` all taken. Only "get/try" prefixes free.
- **Also noted:** "TaxSnap" (tax + snap) is descriptive → weak/hard-to-own trademark.
  Ethan/Marcus would prefer a distinctive name long-term; Alex: don't bikeshed a beta.
- **Decision:** Register **gettaxsnap.com** (~$15) for the beta and move. Keep "TaxSnap"
  as the working name; treat the brand as **rebrandable** post-beta if it gains traction.
  `NEXT_PUBLIC_APP_URL=https://gettaxsnap.com`.
- **Rationale:** A 10-user beta doesn't justify a premium .com purchase or a multi-day
  naming exercise. Unblocks Twilio website + deploy today.
- **Deferred:** Proper distinctive-name + trademark exercise before any paid/public scale
  (still CLAUDE.md Critical Open Item #1).

### SEC-001 — Jordan's RLS flags (re: "do we need more RLS handling?")
Schema verified live 2026-06-01: all 9 tables exist; seeds not yet run (founder's choice).
Verdict: **table-level RLS is correct for V1 (default-deny everywhere). No additional
RLS policies needed** — server-only access via service_role per DEC-001/DEC-006. Adding
policies now would be security theater. Required follow-ups (NOT more table RLS):
1. **Prove default-deny with data.** Empty tables return `[]` regardless, so isolation is
   currently unproven. Acceptance test after seeding: anon key → `[]`; service_role → 18
   rules / 7 summaries. (Claude to run.)
2. **Guard the service_role bypass.** Isolation rests on (a) the key never reaching the
   browser and (b) every org-owned query using `lib/db.orgTable()`. Add a guardrail
   against raw `getSupabaseAdmin().from('receipts'|'conversations'|'users')` calls that
   skip the `organization_id` filter (code-review checklist or eslint rule).
3. **🔴 Storage is uncovered.** RLS here is on Postgres TABLES only. Receipt photos live in
   Supabase Storage with separate policies. EPIC-2/4 MUST: private bucket (never public) +
   short-expiry signed URLs. This is the real leak vector if missed.
Optional decision: keep global reference tables (`irc_summaries`, `substantiation_rules`)
under default-deny for V1; only add an anon read policy if rendering them client-side later.

### DEC-006 — Dashboard login uses CUSTOM phone OTP (auth_codes + sessions), not Supabase Auth
- **Context:** Founder asked whether `auth_codes` + `sessions` are redundant given
  Supabase ships a managed Auth service (phone OTP + sessions + `auth.uid()` for RLS).
- **Tension:** "Don't roll your own auth" + free `auth.uid()` RLS (would fix the
  DEC-001 compromise) argues FOR Supabase Auth. Against it: the product is **SMS-first**
  — `public.users` rows are created from inbound SMS before any dashboard login, and
  **phone is the universal key**. Supabase Auth would mint a separate `auth.users`
  identity per login that must be reconciled by phone — a parallel identity model that
  fights "the phone number IS the user."
- **Decision:** Keep custom `auth_codes` + `sessions`. One phone-keyed `users` table
  serves both the SMS pipeline and dashboard login. Note: auth is **dashboard-only**;
  the SMS core never authenticates (it resolves users by inbound phone number).
- **Rationale:** Coherence with the SMS-first / phone-as-key model outweighs managed-auth
  convenience for V1. OTP + session is a simple, well-trodden pattern (not password auth).
- **Mandatory mitigation (Jordan / EPIC-7):** crypto-strong session tokens, constant-time
  OTP code comparison, HTTP-only + secure + sameSite cookies, OTP rate-limit (3/phone/15min)
  + attempt lockout. Hand-rolled auth is only acceptable WITH this hardening.
- **Deferred to V2:** Reconsider Supabase Auth to gain `auth.uid()`-backed RLS (would
  retire the DEC-001 app-layer-filtering compromise).

### DEC-005 — Framework versions: Next.js 16 / React 19 / Tailwind v4 (not Next 14)
- **Context:** SPEC/CLAUDE.md assumed "Next.js 14+". `create-next-app@latest` (run
  per TSNAP-002) produced **Next.js 16.2.6 + React 19.2 + Tailwind v4**.
- **Decision:** Proceed on current stable rather than pinning back to 14.
- **Consequences the team must know (these differ from older Next/Tailwind):**
  - **Async request APIs:** route handler and page `params` are now Promises
    (`const { id } = await params`). All `[id]` routes/pages already follow this.
  - **`middleware.ts` is deprecated → renamed to `proxy.ts`** (exports `proxy()`).
    Auth gating (EPIC-4) lands in `src/proxy.ts`, not `middleware.ts`.
  - **Tailwind v4:** no `tailwind.config.js`; config is CSS-first via
    `@import "tailwindcss"` in `globals.css`. The `prose` class needs the
    typography plugin (not installed yet — legal pages in EPIC-5 can add it).
  - Build uses **Turbopack** by default.
- **Rationale:** Latest stable satisfies "14+", gets us React 19 + the current
  Vercel deploy path, and avoids a downgrade fight. CLAUDE.md tech-stack section
  and AGENTS.md updated to reflect this.
- **Owner:** Emma (frontend) should skim the Next 16 migration notes before EPIC-4.

### DEC-004 — `personal` category retained with deduction_percentage = 0
- **Context:** The `personal` (§262) row in `substantiation_rules` is "general" level but
  not deductible. Minor modeling oddity flagged during seed review.
- **Decision:** Keep as specced. It exists so the AI can explicitly classify a
  non-deductible expense rather than mis-bucketing it. 0% deduction makes intent clear.

### DEC-007 — IRC content source-verified to 2026/OBBBA; new IRC-RESEARCH.md is the sourcing backbone
- **Context:** IRC-SUMMARIES.md shipped as "AI-assisted drafts" needing source review
  (a CLAUDE.md Critical Open Item). Requested a proper pull of current tax code at
  subsection level for the Schedule-C target user, with sourcing.
- **Method:** Two multi-agent web-research passes (broad fan-out with 3-vote adversarial
  verification, then a focused gap-verification pass), primary-source-first (Cornell LII
  statute/reg text; official IRS Rev. Procs/Notices/newsroom + SSA for current figures;
  CPA-firm sources only to corroborate).
- **Decision:** Added [`IRC-RESEARCH.md`](./IRC-RESEARCH.md) — subsection-level rules, the
  "WHY"-to-capture per provision, primary/secondary sources, an annual-review checklist
  for inflation-adjusted figures, and CPA-review flags. IRC-SUMMARIES.md now points to it.
- **Corrections made (out-of-date → current):**
  - **§179 cap $1.16M → $2.5M max / $4M phase-out** (OBBBA, P.L. 119-21, July 2025).
    Fixed in both the §179 prose and the SQL seed (row bumped to `version` 2).
  - Added **§168(k) 100% bonus depreciation is permanent** (property placed in service
    after Jan 19, 2025) context to §179.
- **New subsection coverage documented** (beyond the seeded 7): §162(a)(1)/(a)(2)/(l),
  §274(a)/(b)(1)/(d)/(k)/(n) incl. the **$75 documentary-evidence threshold** that
  underpins our "SMS = the record under $75" rule, §280F (listed-property + 2026 auto
  caps), §195, §6001, §164(f) + the 0.9% Additional Medicare surtax, §199A (made
  permanent by OBBBA; 2026 thresholds).
- **Open CPA-review flags (do NOT assert in user copy):** §164(f) × 0.9% surtax
  deductibility (low-confidence — conservative view: not deductible); §274(o) employer-
  convenience-meal disallowance edge cases; §280A "exclusive use" borderline calls;
  §199A SSTB classification; federal-only (no state conformity). Tracked in IRC-RESEARCH.md.
- **Refuted & excluded:** the claim that OBBBA Qualified Production Property shares the
  bonus-depreciation "after Jan 19, 2025" date (verdict 0–3; QPP timing differs and is
  out of scope for Schedule-C users anyway).
- **Owner:** still needs the CPA spot-check from CLAUDE.md Critical Open Items before
  any of this drives user-facing *advice* (we remain a logger, not an advisor).

### DEC-009 — Team review of IRC summaries: correctness fixes applied + update process
- **Context:** Convened a 5-persona review (Jordan, Priya, Alex, Raj, Marcus) of the IRC
  summaries against the sourced IRC-RESEARCH.md and the seed migrations.
- **Verified-and-corrected (applied now — scope-independent, rule-aligned):**
  - **§1402 worth_noting** removed the S-Corp salary/distribution tip — it was tax-planning
    *advice* (violates CLAUDE.md Rule 1 "Suggest, don't advise") and aimed at an entity our
    V1 user isn't. Replaced with neutral "ask a CPA" framing. (prose + 0003 seed)
  - **§274 worth_noting** "Meals over $75 require receipt" was an oversimplification. Now:
    the $75 documentary-evidence rule covers all strict categories, lodging needs a receipt
    at any amount, and under $75 the user's text is the record (Reg §1.274-5(c)(2)). (both)
  - **§179** wording de-drifted between prose and seed ("acquired and placed in service").
  - **Determinism (Raj):** 0003 used `CURRENT_DATE` for `last_reviewed` — re-running
    `db push` silently re-stamped every row "reviewed today," fabricating provenance.
    Changed to literal `DATE '2026-06-01'`.
  - **Source-of-truth collapse (Raj):** the copy-paste SQL block in IRC-SUMMARIES.md had
    already drifted from 0003 (a correctness hazard) and the doc carried a contradictory
    in-place `UPDATE` snippet. Removed both; IRC-SUMMARIES.md now points to 0003 as the
    single source of truth. RUN_ALL.sql is a regenerated artifact.
- **FALSE POSITIVE caught (did NOT change):** Jordan & Alex flagged §6654 "whichever is
  less" as a factual error. Verified against §6654(d)(1)(B): the "required annual payment"
  IS the *lesser* of 90%-current vs 100%/110%-prior, so the line is correct and taxpayer-
  favorable. Lesson logged: verify persona/agent findings before applying.
- **Convergent UPDATE PROCESS (resolved):**
  - **Single source of truth:** the migration files (0002/0003). Edit there, not in docs.
  - **Changes ship as targeted append-only migrations** (`0004_update_irc_<year>.sql`):
    set changed fields, bump `version`, set a real `last_reviewed`. Never hand-edit prod.
  - **Cadence:** annual (~Jan 31, vs new IRS Rev. Procs) + event-driven on major
    legislation (OBBBA was the proof). Annual review = the IRC-RESEARCH.md checklist.
  - **Traceability = git** (migration diff = what; PR/commit + JOURNAL = why) + the
    `version`/`last_reviewed` columns. No history table for 7 rows.
  - **Confidence-partitioned CPA review:** primary-sourced fixed figures ship on eng review
    with the disclaimer; low-confidence/judgment items (§164(f) surtax, §199A SSTB, S-Corp
    strategy) stay OUT of user copy until CPA-cleared.
- **CONFLICTS escalated to founder — RESOLVED:**
  1. **User-facing scope → "fix defects, keep breadth" (Priya's option).** Added two
     `irc_summaries` rows — **§274b (gifts)** and **§280F (vehicle/listed property)** — and
     **repointed** `business_gifts` (irc_section `274`→`274b`) and `vehicle_business`
     (`162`→`280F`) so they stop mis-loading the meals / generic-§162 copy. §1402 & §6654
     kept (corrected). Seed is now **9 summaries**; coverage-integrity verified (every
     section a rule cites has a summary). §195/§6001/§164(f)/§199A stay research-only.
  2. **CPA posture → "partition by confidence."** Primary-sourced fixed figures ship with
     the disclaimer; low-confidence/judgment items stay out of seeded user copy — already
     satisfied (S-Corp strategy removed; §164(f)/§199A are research-only). No
     `reviewed_by_cpa` column added (Jordan's hard gate not adopted). Disclaimer must be
     wired at render time in EPIC-3/4 (tracked; IRC-SUMMARIES.md "Standard Disclaimer").
  3. **Hardcoded indexed figures** — left as prose for V1 (only §179's number is seeded);
     `tax_year_figures` table deferred to V2 (Raj).
- Full persona reviews are in this session's transcript.
