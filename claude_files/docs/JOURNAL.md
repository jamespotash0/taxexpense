# TaxSnap — Decisions Journal

Append-only log of decisions made during the build, especially where team members
disagreed. CLAUDE.md references this file as the home for decisions and deferred ideas.

Format: date, decision, who pushed back, resolution, rationale.

---

## 2026-06-01 — Day 1 / EPIC-1 Foundation kickoff

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

### DEC-008 — Beta domain: gettaxsnap.com; "TaxSnap" kept as rebrandable working name
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
