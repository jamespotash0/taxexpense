# TaxSnap — Decisions Journal

Append-only log of decisions made during the build, especially where team members
disagreed. CLAUDE.md references this file as the home for decisions and deferred ideas.

Format: date, decision, who pushed back, resolution, rationale.

---

## 2026-06-01 — Day 1 / EPIC-1 Foundation kickoff

### DEC-020 — Landing redesign: animated SMS hero, 3 sections, "Say hello" CTA, no pricing
- Rebuilt the landing to 3 sections (hero / features / footer-CTA). Hero visual is an
  **animated SMS thread** (`AnimatedPhone`): user texts an expense → typing indicator → Tally
  replies, looping. Custom CSS keyframes + a setTimeout state machine (no animation library).
  Honors `prefers-reduced-motion` (static thread, no loop) per Sofia/a11y. Primary CTA is
  "Say hello 👋" → `sms:` deep link to the Tally number; Install as secondary. No pricing.
  Icons still placeholders (designer task). Consulted Sofia (web UX) on motion + accessibility.

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
