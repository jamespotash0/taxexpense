# CLAUDE.md — Project Memory

This file is automatically read by Claude Code on every session start. It contains the most important context to keep loaded at all times.

**For deeper detail, Claude Code should read specific files referenced below.**

> **Next.js framework rules:** This repo was scaffolded with **Next.js 16 + React 19 + Tailwind v4**. See [`AGENTS.md`](./AGENTS.md) for framework-version rules before writing framework code. Project planning docs live in [`claude_files/`](./claude_files/).

---

## What This Project Is

TaxSnap is a text-based AI assistant that captures business expense context (the WHY) in real-time for self-employed people. Users text expenses to a phone number — photo or text. The AI extracts data, categorizes it under the correct IRC section, and asks for additional context **only when the IRS substantiation rules actually require it**.

## Positioning Statement

**Internal (for technical decisions):**
"We solve tax-time scrambles for self-employed people whose bank tracks WHAT they spent but not WHY — and by April it's too late to remember."

**External (for user-facing copy):**
"Your bank knows WHAT you spent — but not WHY. TaxSnap captures both."

The product is NOT just "AI receipt tracking." It's "capture WHY in real-time." Every design decision should reinforce this positioning.

## Target User (V1)

Self-employed people (sole proprietors and single-member LLCs) who do NOT have:
- Mercury, Brex, or Ramp business banking
- QuickBooks Online
- A dedicated accountant

They pay business expenses from a mix of personal and business cards. They have nothing organized for tax time. They want effortless capture, not another app.

**NOT v1 target:** Funded startups with Mercury+QBO+accountant. Those users are served by V2 (Plaid integration).

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Database:** Supabase (managed Postgres)
- **Auth:** Custom phone OTP via Twilio
- **Storage:** Supabase Storage (private bucket, signed URLs)
- **SMS:** Twilio
- **AI:** Claude Haiku 4.5 (OCR) + Claude Sonnet 4.6 (reasoning)
- **Email:** Resend
- **Hosting:** Vercel
- **Monitoring:** Sentry

## Architecture Pattern

**This is an AI WORKFLOW, not an AI AGENT.** The code controls flow. Claude is called for specific tasks at specific points. See `claude_files/docs/AGENTS-VS-WORKFLOWS.md` for full rationale.

## Critical Behavioral Rules

When implementing AI logic, ALWAYS follow these:

1. **Suggest, don't advise.** Use "typically falls under," not "you should."
2. **Cite IRC sections.** Every categorization must reference the relevant tax code.
3. **Ask only when required.** The substantiation decision tree (in SPEC.md) determines when to ask for receipts/context.
4. **The SMS is the written record.** For sub-$75 strict-category expenses, the user's text IS the IRS-compliant documentation.
5. **Use "documentation complete" not "audit-ready"** in user-facing copy (legal liability).
6. **The user has final say.** Every AI decision is overridable.
7. **Defer to professionals.** For specific advice, always recommend consulting a CPA.

## The Substantiation Decision Tree

This is the heart of the product. Every expense follows this logic:

```
EXPENSE COMES IN
    ↓
Categorize (via Claude)
    ↓
Look up substantiation_rules
    ↓
Strict category?
├── NO → Log it. Done.
└── YES:
    ├── always_receipt? (lodging, gifts)
    │   ├── Has photo? → ask only for context
    │   └── No photo? → log + ask for receipt
    └── amount >= $75?
        ├── YES + has photo → ask only for context
        ├── YES + no photo → log + ask for receipt + context
        └── NO (<$75) → check context fields, log when complete
```

The strict categories are: meals, travel transportation/lodging, business gifts, vehicle expenses.

Everything else is "general substantiation" — log and move on.

## File Map

When you need to know something, read the relevant file (under `claude_files/`):

| Need | File |
|------|------|
| Product overview and positioning | `claude_files/docs/CONTEXT.md` |
| Day-by-day execution plan | `claude_files/docs/PLAN.md` |
| Technical specification + DB schema | `claude_files/docs/SPEC.md` |
| AI prompts (verbatim) | `claude_files/docs/SYSTEM-PROMPTS.md` |
| IRC summaries content + SQL | `claude_files/docs/IRC-SUMMARIES.md` |
| Why we're not building agents | `claude_files/docs/AGENTS-VS-WORKFLOWS.md` |
| Epics + dependency graph | `claude_files/specs/00-EPICS.md` |
| Granular tickets | `claude_files/specs/` folder |
| Team personas to invoke | `claude_files/team/` folder |
| Decisions + conflict log | `claude_files/docs/JOURNAL.md` |

## How to Approach Work

**At session start:**
1. Confirm what day of the build I'm on
2. Read `claude_files/docs/PLAN.md` for today's overview
3. Open the relevant ticket file (`claude_files/specs/01-foundation.md`, etc.)
4. Work tickets in order

**For technical decisions:**
- Default to "boring tech that works"
- Multi-tenant from day 1
- Idempotent operations
- Logs without PII
- Multi-tenant filters on every query

**For UX/copy decisions:**
- One question per message, max
- Acknowledge first, ask second
- Match user's words ("client meal" not "business meal" if they said the former)
- Celebrate completion ("✓ Documentation complete")

**For security decisions:**
- Webhook signature validation = non-negotiable
- Rate limiting on all auth endpoints
- HTTPS everywhere
- No secrets in client bundles

## Team Personas Available

Load these as needed for domain-specific perspective (under `claude_files/team/`):

- `marcus-chen.md` — Strategy, prioritization, positioning
- `priya-sharma.md` — Specs, edge cases, metrics
- `sofia-reyes.md` — Flows, conversation design, copy
- `raj-patel.md` — Architecture, database, scaling
- `emma-larsson.md` — Next.js, frontend, performance
- `jordan-kim.md` — Security, compliance, testing
- `alex-moreno.md` — Pressure-testing, devil's advocate
- `maya-okafor.md` — Content, distribution, growth

**Default approach:** When a decision touches multiple domains, load 2-3 relevant personas and get their perspectives. Don't load all of them every time.

## What V1 Includes

✅ SMS capture (photo + text)
✅ AI categorization with IRC reference
✅ Smart substantiation (asks only when required)
✅ Phone OTP login
✅ Web dashboard for review/edit/export
✅ CSV export (standard + QuickBooks-compatible)
✅ "Email my accountant" feature (P1 — can slip)
✅ Landing page + legal pages

## What V1 Does NOT Include

❌ Voice channel
❌ Mobile app
❌ Plaid bank linking (V2)
❌ Direct QuickBooks sync (V3)
❌ Accountant portal (V3)
❌ Tax filing (never)
❌ Multi-entity support
❌ International users

**Resist scope creep.** Every "wouldn't it be cool if..." comes out of the 10-day budget.

## Common Mistakes to Avoid

1. **Don't over-architect.** This is V1. Boring tech that works > clever tech that breaks.
2. **Don't ask too many questions.** The substantiation decision tree determines when to ask — never add more.
3. **Don't claim "tax advice."** We're a logger, not an advisor. Always defer to CPA for specifics.
4. **Don't add features mid-build.** New ideas go in `JOURNAL.md` for post-V1 consideration.
5. **Don't skip security tickets.** Jordan's checklist is non-negotiable.
6. **Don't optimize prematurely.** Ship first, optimize after real users hit bottlenecks.

## Brand Name

**Working name:** TaxSnap

**Status:** Not yet locked. This needs to be locked before landing page, demo videos, and content production.

## Critical Open Items

1. Brand name locked
2. User validation with 5 real unsophisticated self-employed people
3. Lawyer review of disclaimer/privacy/terms (~$1,500-2,500 — pre-paid users)
4. CPA spot-check of IRC summaries (post-launch, when revenue justifies)

## How to Use This File

Claude Code reads this on every session automatically. You shouldn't need to remind it about anything in this file — just ask for help with the actual work.

If something major changes (new positioning, new architecture decision), update this file and log it in `claude_files/docs/JOURNAL.md`. It's the source of truth for "what does Claude Code need to know on every session."

For granular detail, Claude Code should ALWAYS read the specific file referenced rather than guess.
