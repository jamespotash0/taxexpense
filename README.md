# Tally

**Your bank knows _what_ you spent — but not _why_. Tally captures both.**

Tally is a text-based AI assistant that captures business-expense context — the **WHY** — in real time for self-employed people. You text an expense to a phone number (a photo of a receipt, or just a few words), and Tally:

1. Extracts the data (vendor, amount, date) from the photo or text.
2. Categorizes it under the correct IRC (tax code) section.
3. Asks for additional context **only when IRS substantiation rules actually require it** — never more.

The result is a clean, exportable, documentation-complete record of business expenses, built up effortlessly over the year instead of scrambled together every April.

> **Who it's for:** Sole proprietors and single-member LLCs who pay business expenses from a mix of personal and business cards and have *nothing* organized for tax time — people who don't use Mercury/Brex/Ramp, QuickBooks, or a dedicated accountant.

---

## How it works

Tally is an **AI workflow, not an autonomous agent** — the code controls the flow and calls Claude for specific, bounded tasks. The core loop:

```
Inbound SMS/MMS (Twilio webhook)
        │
        ▼
  Classify intent ──────────────► (login, question, command, expense capture…)
        │
        ▼  (expense)
  OCR the photo (Claude Haiku)  +  Extract & categorize (Claude Sonnet)
        │
        ▼
  Look up substantiation rules for the category
        │
        ├─ Not a strict category ──► log it, done.
        └─ Strict category ────────► ask for receipt/context only if required
                                      (meals, travel, lodging, gifts, vehicle)
        │
        ▼
  Reply over SMS · store in Supabase · viewable/exportable in the web dashboard
```

The **substantiation decision tree** is the heart of the product — it's what lets Tally ask *one* question only when the IRS genuinely requires it, and stay silent otherwise. See [`claude_files/docs/SPEC.md`](./claude_files/docs/SPEC.md).

Beyond capture, Tally also runs scheduled jobs (receipt reminders, recurring-expense nudges, tax-deadline alerts, trial reminders) and an agentic **month-end review**.

---

## Features

- 📲 **SMS/MMS capture** — text or photo, no app to install
- 🧠 **AI categorization** with cited IRC sections
- ✅ **Smart substantiation** — asks for context only when tax rules require it
- 🔐 **Phone OTP login** (custom, via Twilio)
- 🖥️ **Web dashboard** to review, edit, and export expenses
- 📤 **CSV export** (standard + QuickBooks-compatible)
- 📧 **"Email my accountant"** export
- 💳 **Stripe subscriptions** — Weekly ($5.99/wk), Monthly ($12.49/mo), and Annual ($119.88/yr ≈ $9.99/mo) plans, after a 21-day trial
- 📆 **Cron jobs** — reminders, recurring detection, tax-deadline + trial nudges
- 🤖 **Month-end review agent**

---

## Tech stack

| Layer | Choice |
|------|--------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase (managed Postgres) |
| Storage | Supabase Storage (private bucket, signed URLs) |
| SMS/MMS | Twilio |
| AI | Claude Haiku 4.5 (OCR) + Claude Sonnet 4.6 (reasoning) |
| Auth | Custom phone OTP via Twilio |
| Payments | Stripe |
| Email | Resend |
| Monitoring | Sentry |
| Hosting | Vercel |

> **Framework rules:** This repo targets Next.js 16 / React 19 / Tailwind v4. See [`AGENTS.md`](./AGENTS.md) before writing framework code.

---

## Project structure

```
src/
├── app/
│   ├── api/                 # Route handlers
│   │   ├── sms/inbound/     # Twilio webhook — the main capture entrypoint
│   │   ├── auth/            # Phone OTP request/verify/logout
│   │   ├── receipts/        # CRUD + CSV export
│   │   ├── billing/         # Stripe checkout, portal, webhook
│   │   ├── cron/            # Scheduled reminders & deadline jobs
│   │   ├── agents/          # Month-end review agent
│   │   ├── email-accountant/, settings/, account/, hero-optin/
│   ├── dashboard/, login/, start/, settings/, receipts/, pricing/
│   ├── irc/                 # Public IRC summary pages
│   └── privacy/, terms/     # Legal pages
├── lib/                     # Core logic (categorize, substantiation, ocr,
│                            #   sms-handler, router, agents, billing, csv…)
│                            #   — most have colocated *.test.ts files
supabase/migrations/         # SQL schema & migrations (run RUN_ALL.sql to set up)
scripts/                     # Evals, red-team harness, screenshot tooling
claude_files/                # Product docs, specs, prompts, team personas
```

Key modules in [`src/lib/`](./src/lib/):
- [`sms-handler.ts`](./src/lib/sms-handler.ts) / [`router.ts`](./src/lib/router.ts) — inbound message handling & intent routing
- [`categorize.ts`](./src/lib/categorize.ts) / [`ocr.ts`](./src/lib/ocr.ts) — Claude extraction & categorization
- [`substantiation.ts`](./src/lib/substantiation.ts) — the IRS substantiation decision tree
- [`agent.ts`](./src/lib/agent.ts), [`agents/`](./src/lib/agents/) — month-end review agent
- [`csv.ts`](./src/lib/csv.ts) — exports

---

## Getting started

### Prerequisites

- Node.js 20+
- A Supabase project, a Twilio account (phone number), an Anthropic API key, a Stripe account, and a Resend account

### 1. Install

```bash
npm install
```

### 2. Configure environment

Create a `.env.local` in the project root. Required variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Anthropic
ANTHROPIC_API_KEY=

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
# TWILIO_WHATSAPP_FROM=        # optional

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Email (Resend)
RESEND_API_KEY=
RESEND_FROM=

# Cron / internal secrets
CRON_SECRET=
SUBSCRIBE_LINK_SECRET=
ADMIN_NOTIFY_EMAIL=

# Monitoring (optional)
NEXT_PUBLIC_SENTRY_DSN=
```

### 3. Set up the database

Run the SQL migrations against your Supabase project. The consolidated script is at
[`supabase/migrations/RUN_ALL.sql`](./supabase/migrations/RUN_ALL.sql) (or apply the numbered
migrations in order).

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To exercise the SMS pipeline locally, point your Twilio number's webhook (or a tunnel like
ngrok) at `/api/sms/inbound`.

---

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm test` | Run unit tests (`*.test.ts` under `src/`) |
| `npm run eval:categorize` | Eval categorization accuracy |
| `npm run eval:merged` | Eval merged extraction+categorization |
| `npm run eval:image` | Eval OCR on receipt images |
| `npm run eval:conversation` | Eval multi-turn conversation flow |
| `npm run eval:intent` | Eval intent classification |
| `npm run redteam` | Red-team prompt-safety harness |
| `npm run sim:onboarding` | Simulate the onboarding conversation |
| `npm run agent:smoke` | Smoke-test the month-end review agent |

---

## Behavioral rules (when working on AI logic)

These are non-negotiable for any change touching the AI:

1. **Suggest, don't advise** — "typically falls under," not "you should."
2. **Cite IRC sections** on every categorization.
3. **Ask only when required** — the substantiation tree decides; never add questions.
4. **The SMS is the written record** — for sub-$75 strict-category expenses, the user's text *is* the IRS-compliant documentation.
5. Say **"documentation complete," not "audit-ready"** (legal liability).
6. **The user has final say** — every AI decision is overridable.
7. **Defer to professionals** — recommend a CPA for specific advice.

---

## Documentation

Deeper docs live in [`claude_files/`](./claude_files/):

| Topic | File |
|------|------|
| Product overview & positioning | [`claude_files/docs/CONTEXT.md`](./claude_files/docs/CONTEXT.md) |
| Technical spec + DB schema + decision tree | [`claude_files/docs/SPEC.md`](./claude_files/docs/SPEC.md) |
| AI prompts (verbatim) | [`claude_files/docs/SYSTEM-PROMPTS.md`](./claude_files/docs/SYSTEM-PROMPTS.md) |
| IRC summaries | [`claude_files/docs/IRC-SUMMARIES.md`](./claude_files/docs/IRC-SUMMARIES.md) |
| Why workflow, not agent | [`claude_files/docs/AGENTS-VS-WORKFLOWS.md`](./claude_files/docs/AGENTS-VS-WORKFLOWS.md) |
| Decisions & conflict log | [`claude_files/docs/JOURNAL.md`](./claude_files/docs/JOURNAL.md) |
| Project memory for Claude Code | [`CLAUDE.md`](./CLAUDE.md) |

---

## Status

V1 / beta. Working name **Tally**, beta domain **tallywhy.com**. The name is treated as
rebrandable — see `JOURNAL.md` for the branding rationale and open items (name lock, user
validation, legal review, CPA spot-check of IRC summaries).
</content>
</invoke>
