# Architecture

This document describes how Tally is put together: the request flows, the data model, the AI
pipeline, and the cross-cutting concerns (security, multi-tenancy, scheduling). For *what* the
product is and how to run it, see [README.md](./README.md). For end-user help, see the
[docs-site](./docs-site/).

---

## 1. Guiding principle: workflow, not agent

Tally is an **AI workflow**, not an autonomous agent. Application code owns the control flow and
calls Claude for narrow, well-defined tasks (OCR, extraction, categorization, intent
classification). The model never decides *what happens next* on the core capture path — the code
does. This keeps behavior deterministic, testable, and cheap.

The one place we use an agentic loop is the **month-end review** ([`src/lib/agent.ts`](./src/lib/agent.ts),
[`src/lib/agents/`](./src/lib/agents/)), which runs tool-calling over a user's data to produce a
review. It is bounded, scheduled, and read-mostly.

Rationale: [`claude_files/docs/AGENTS-VS-WORKFLOWS.md`](./claude_files/docs/AGENTS-VS-WORKFLOWS.md).

---

## 2. System context

```
   ┌──────────┐      MMS/SMS      ┌──────────┐   webhook    ┌──────────────────────┐
   │   User    │  ───────────────► │  Twilio   │ ───────────► │  Next.js (Vercel)     │
   │ (phone)   │  ◄─────────────── │           │ ◄─────────── │  /api/sms/inbound     │
   └──────────┘    SMS replies     └──────────┘   TwiML/REST  └──────────┬───────────┘
                                                                          │
   ┌──────────┐    HTTPS (OTP +    ┌──────────────────────┐              │ service-role
   │   User    │    session cookie) │  Next.js web app      │              ▼
   │ (browser) │ ◄────────────────► │  /dashboard, /login…  │      ┌──────────────┐
   └──────────┘                     └──────────┬───────────┘      │  Supabase     │
                                               │                  │  (Postgres +  │
                          ┌────────────────────┼────────────┐     │   Storage)    │
                          ▼                    ▼            ▼     └──────────────┘
                    ┌──────────┐        ┌──────────┐  ┌──────────┐
                    │ Anthropic │        │  Stripe   │  │  Resend   │
                    │  (Claude) │        │ (billing) │  │  (email)  │
                    └──────────┘        └──────────┘  └──────────┘
```

All third-party calls happen server-side. Secrets live only in environment variables and never
reach the client bundle (only `NEXT_PUBLIC_*` values do). Sentry wraps both server and client for
monitoring.

---

## 3. Codebase layout

| Path | Responsibility |
|------|----------------|
| [`src/app/api/`](./src/app/api/) | Route handlers (webhooks, auth, CRUD, billing, cron, agents) |
| [`src/app/`](./src/app/) (non-api) | Web pages: dashboard, login, settings, receipts, pricing, legal, IRC pages |
| [`src/lib/`](./src/lib/) | All business logic — pure-ish modules with colocated `*.test.ts` |
| [`supabase/migrations/`](./supabase/migrations/) | SQL schema & migrations (single source of DB truth) |
| [`scripts/`](./scripts/) | Evals, red-team harness, onboarding sim, screenshot tooling |
| [`claude_files/`](./claude_files/) | Product docs, specs, prompts, team personas, decision journal |
| [`docs-site/`](./docs-site/) | VitePress product help site (separate package) |

The **lib layer is the heart of the app.** Route handlers stay thin: they authenticate, parse
input, call into `lib/`, and serialize the response. Logic and its tests live in `lib/`.

---

## 4. The capture pipeline (inbound SMS)

This is the core loop. Entry point: [`src/app/api/sms/inbound/route.ts`](./src/app/api/sms/inbound/route.ts)
→ [`src/lib/sms-handler.ts`](./src/lib/sms-handler.ts).

```
1. Twilio POSTs inbound message  ──►  /api/sms/inbound
2. Validate Twilio signature             (reject if invalid; see §8)
3. Look up / create user by phone number (multi-tenant: user → organization)
4. Rate-limit + opt-out / consent checks (TCPA)
5. Onboarding?  ──► run onboarding step machine (lib/onboarding.ts) and return
6. Has a photo (MMS)?
      ├─ yes ─► OCR with Claude Haiku (lib/ocr.ts) to read the receipt
      └─ no  ─► route the text first (lib/router.ts):
                  • query / command / advice / help / capability / context / flag-CPA
                  • if it's an expense → fall through to capture
7. Extract + categorize (lib/categorize.ts, Claude Sonnet):
      vendor, amount, date, category, IRC section, deduction %
8. Apply substantiation rules (lib/substantiation.ts):
      decide whether to ask for a receipt and/or context — only if required
9. Persist: receipts row + conversations row (the written record)
10. Reply over SMS (acknowledge first, then at most ONE question)
```

### 4a. Text routing before capture

For text-only messages, [`src/lib/router.ts`](./src/lib/router.ts) runs first. A cheap regex
**fast-path** (`looksLikeExpenseCapture`) sends obvious expenses straight to capture without an LLM
call. Otherwise a Haiku classifier picks one intent:

- `capture` — record a new expense (default when uncertain)
- `query` — answer a read-only question about logged data (totals, breakdown, recent, year review)
- `command` — `export` or `email_accountant` (points to dashboard)
- `advice` — tax advice → deflected to a CPA
- `capability` — "how does Tally work / can it…" → answered from a grounded fact sheet
- `help` / `context_statement` / `other`

**Guardrails:** the router is read-only except two low-risk mutations — "flag for CPA" (regex-gated
boolean) and applying a `context_statement` as an edit to the most recent receipt. Every reported
**number comes from the database** (`lib/queries.ts`), never the model — the model only chooses the
intent; templates render the figures. Any classifier failure falls back to `capture`.

### 4b. The substantiation decision tree

The product's defining behavior — ask for documentation **only when IRS rules require it**. Driven
by the `substantiation_rules` table ([`src/lib/substantiation.ts`](./src/lib/substantiation.ts)):

```
Categorize → look up substantiation_rules
   ├─ general substantiation → log it, done
   └─ strict category (§274(d): meals, travel, lodging, gifts, vehicle):
        ├─ always_receipt (lodging)? → need photo, else ask for receipt
        └─ amount ≥ $75?
              ├─ yes + photo → ask only for missing context
              ├─ yes + no photo → log + ask for receipt + context
              └─ no (<$75) → the SMS itself is the written record; log when context complete
```

Full spec: [`claude_files/docs/SPEC.md`](./claude_files/docs/SPEC.md).

---

## 5. AI pipeline

| Task | Model | Module |
|------|-------|--------|
| Receipt OCR (image → text/fields) | Claude Haiku 4.5 | [`lib/ocr.ts`](./src/lib/ocr.ts) |
| Intent classification (text routing) | Claude Haiku 4.5 | [`lib/router.ts`](./src/lib/router.ts) |
| Capability Q&A (grounded) | Claude Haiku 4.5 | [`lib/router.ts`](./src/lib/router.ts) |
| Expense extraction + categorization | Claude Sonnet 4.6 | [`lib/categorize.ts`](./src/lib/categorize.ts) |
| Month-end review (tool-calling) | configurable (`COMPOSE_MODEL`) | [`lib/agent.ts`](./src/lib/agent.ts), [`lib/agents/`](./src/lib/agents/) |

Shared plumbing: [`lib/claude.ts`](./src/lib/claude.ts) (model IDs/config) and
[`lib/llm.ts`](./src/lib/llm.ts) (`claudeJSON` / `claudeText` helpers with prompt caching on system
prompts). Prompts live in [`lib/prompts.ts`](./src/lib/prompts.ts) and
[`claude_files/docs/SYSTEM-PROMPTS.md`](./claude_files/docs/SYSTEM-PROMPTS.md).

**Quality harness** (`scripts/`): evals for categorization, merged extraction, image OCR,
conversation flow, and intent (`npm run eval:*`), plus a red-team safety harness (`npm run
redteam`). See README for the full list.

---

## 6. Data model

Defined in [`supabase/migrations/`](./supabase/migrations/) (start at `0001_schema.sql`; apply all
via `RUN_ALL.sql`). Core tables:

| Table | Purpose |
|-------|---------|
| `organizations` | Tenant boundary. 1:1 with user in V1; modeled for multi-user later. |
| `users` | Phone number (unique), entity type, onboarding state, SMS consent/opt-out. |
| `user_roles` | owner/editor/viewer/accountant — V1 everyone is `owner`. |
| `receipts` | **The core table.** Transaction data, categorization (category, IRC section, deduction %), §274(d) substantiation fields, photo URL, doc-completeness flags, AI extraction metadata. |
| `substantiation_rules` | Per-category rules: strict vs general, receipt threshold, required context fields, deduction %/cap. Drives the decision tree. |
| `irc_summaries` | Plain-language IRC section summaries shown to users. |
| `conversations` | Full inbound/outbound SMS log — **the written record** that substantiates sub-$75 expenses. |
| `auth_codes` | Phone OTP codes (expiry, attempt lockout). |
| `sessions` | Web session tokens (expiry). |

Later migrations add: conversation pending-data/state, weekly plan, needs-review flag,
subscription/billing fields, agent runs, vendor→category memory, recurring detection, meals
business-place, etc.

Every business table carries `organization_id` and is queried org-scoped (see §7).

---

## 7. Multi-tenancy & data isolation

- **Tenant = organization.** Every row in a business table has `organization_id`.
- **App-layer scoping:** all queries go through org-scoped helpers ([`lib/db.ts`](./src/lib/db.ts)
  `orgScoped`, [`lib/queries.ts`](./src/lib/queries.ts), [`lib/receipts.ts`](./src/lib/receipts.ts))
  that filter by the authenticated org on every read and write.
- **RLS default-deny backstop (DEC-001):** Row Level Security is **enabled on every table with zero
  policies**, so the `anon`/`authenticated` roles can read/write nothing. The server uses the
  `service_role` key (server-only) which bypasses RLS. This makes accidental public exposure — the
  most likely real-world leak — structurally impossible while V1 relies on app-layer filtering.
  Custom-JWT per-org RLS under service role is a documented V2 item.

---

## 8. Security

- **Webhook signature validation (non-negotiable):** Twilio inbound and Stripe webhooks verify
  signatures before doing any work. (`ALLOW_INSECURE_SMS_WEBHOOK` exists only as a local-dev
  escape hatch — never set in production.)
- **Auth:** custom **phone OTP** ([`lib/auth.ts`](./src/lib/auth.ts), `/api/auth/*`). Codes have
  expiry + attempt lockout; sessions are opaque tokens with expiry. Auth endpoints are rate-limited
  ([`lib/rate-limit.ts`](./src/lib/rate-limit.ts)).
- **Secrets:** only in env vars, validated at the call site via `requireEnv`
  ([`lib/env.ts`](./src/lib/env.ts)). Only `NEXT_PUBLIC_*` reach the client.
- **PII discipline:** phone numbers are never logged in full; structured logging via
  [`lib/log.ts`](./src/lib/log.ts).
- **Storage:** receipt images live in a **private** Supabase bucket, served via short-lived signed
  URLs.
- **TCPA compliance:** explicit SMS consent (`sms_consent_at`) and opt-out (`sms_opted_out_at`) are
  tracked and enforced before sending.

Security checklist lives with the Jordan persona and EPIC-7 tickets in `claude_files/`.

---

## 9. Scheduled jobs (cron)

Vercel Cron hits the routes under [`src/app/api/cron/`](./src/app/api/cron/), each gated by a
`CRON_SECRET` bearer check:

| Route | Job |
|-------|-----|
| `cron/receipt-reminders` | Nudge users for receipts on expenses that still need one |
| `cron/recurring-reminders` | Detect/handle recurring expenses ([`lib/recurring.ts`](./src/lib/recurring.ts)) |
| `cron/tax-deadlines` | Tax-deadline alerts ([`lib/tax-deadlines.ts`](./src/lib/tax-deadlines.ts)) |
| `cron/trial-reminders` | Trial-expiry nudges ([`lib/trial-reminders.test.ts`](./src/lib/trial-reminders.test.ts)) |

The agentic **month-end review** is exposed at `api/agents/month-end-review`.

---

## 10. Billing

[`src/app/api/billing/`](./src/app/api/billing/) + [`lib/billing-notify.ts`](./src/lib/billing-notify.ts),
[`lib/stripe.ts`](./src/lib/stripe.ts), [`lib/subscription.ts`](./src/lib/subscription.ts),
[`lib/pricing.ts`](./src/lib/pricing.ts).

- **Plans** (single source of truth in `pricing.ts`): Weekly $5.99/wk, Monthly $12.49/mo, Annual
  $119.88/yr (≈$9.99/mo). Three **billing-interval** tiers of one product — not feature tiers. Stripe
  Price IDs come from env so the same code works in test/live. 21-day trial; co-owners capped.
- **Flows:** `checkout` (start subscription), `portal` (manage), `subscribe-link` (signed link), and
  `webhook` (Stripe events → subscription state). The webhook verifies the Stripe signature and is
  idempotent.

---

## 11. Web app

App Router pages under [`src/app/`](./src/app/): `dashboard` (review/edit/export receipts),
`login`/`start` (OTP onboarding), `settings` (accountant email, members), `receipts`, `pricing`,
`irc` (public IRC summaries), and legal (`privacy`, `terms`). Styling is Tailwind v4; some motion via
`framer-motion`. The landing hero is an interactive video player.

---

## 12. Cross-cutting conventions

- **Idempotency** on anything that can be retried (webhooks, cron, message processing).
- **Thin handlers, fat lib** — logic and tests live in `lib/`.
- **Tests colocated** as `lib/<name>.test.ts`; run with `npm test`.
- **Boring tech that works** over clever abstractions (this is V1).
- **Decisions are logged** in [`claude_files/docs/JOURNAL.md`](./claude_files/docs/JOURNAL.md) as
  `DEC-NNN` and referenced from code comments.

---

## 13. Where to go next

- Product/positioning → [`claude_files/docs/CONTEXT.md`](./claude_files/docs/CONTEXT.md)
- Full spec + schema + decision tree → [`claude_files/docs/SPEC.md`](./claude_files/docs/SPEC.md)
- Verbatim AI prompts → [`claude_files/docs/SYSTEM-PROMPTS.md`](./claude_files/docs/SYSTEM-PROMPTS.md)
- Decision history → [`claude_files/docs/JOURNAL.md`](./claude_files/docs/JOURNAL.md)
- End-user help → [`docs-site/`](./docs-site/)
</content>
</invoke>
</invoke>
