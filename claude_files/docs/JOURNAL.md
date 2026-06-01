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
