# TaxSnap — Project Context

## What This Is

A text-based AI assistant that captures business expense **context** (the WHY) in real-time for self-employed people. Users text expenses to a phone number — photo or text. The AI extracts data, categorizes it under the correct IRC section, and asks for additional context **only when the IRS substantiation rules actually require it**. Users access their records via a simple web dashboard.

## Positioning Statement (Internal)

**"We solve tax-time scrambles for self-employed people whose bank tracks WHAT they spent but not WHY — and by April it's too late to remember."**

This is the long-form positioning statement. Use it for: spec documents, team alignment, investor conversations, partner pitches, internal clarity.

## Positioning Statement (External)

**"Your bank knows WHAT you spent — but not WHY. TaxSnap captures both."**

This is the public-facing hook. Use it for: landing page hero, demo video voiceovers, social media bios, ad headlines, anywhere a stranger sees the brand cold.

## The Core Insight

Banks (TD, Chase, Mercury, Brex) capture transactions — vendor, amount, date. But IRS substantiation rules under §274(d) for meals, travel, gifts, and vehicles require additional context: business purpose, attendees, business relationship, location, miles. This context lives in the user's head at the moment of purchase — and is gone by April.

**TaxSnap captures the WHY at the moment it's still fresh, via text — the muscle memory people already use.**

## Target Customer

**Primary v1 audience — the underserved end of the market:**

- Solo freelancers, contractors, and side-hustlers
- Single-member LLC owners
- $40K-$200K annual income range
- Currently using "shoebox of receipts" or "notes app photos" or nothing
- Do NOT have Mercury, Brex, Ramp, or sophisticated business banking
- Do NOT have a dedicated accountant (or only a part-time/relative)
- Do NOT use QuickBooks (or use it minimally)
- Wants something effortless that fits how they already work

**NOT v1 audience (saved for V2+):**

- Funded startups with Mercury/Brex + QBO + accountant — they already have categorization solved by their existing stack. They become viable customers in V2 when we add Plaid integration that enriches (not duplicates) their bank transactions.

## Product Principles

1. **Text-first, app-second** — SMS is the primary interface; the web app is for review and export only
2. **Capture WHY, not just WHAT** — every interaction captures business context in addition to transaction data
3. **Ask only when required** — IRS substantiation rules drive when we ask for receipts or context; never add friction the law doesn't require
4. **Suggest, don't advise** — AI categorizes but never gives "tax advice"
5. **Show the work** — every categorization cites IRC code with plain English summary
6. **User has final say** — every AI decision is overridable
7. **Plain English always** — no IRS jargon, no accounting-speak
8. **The SMS IS the written record** — for sub-$75 strict-category expenses, the user's text to TaxSnap meets IRS substantiation requirements per Reg §1.274-5(c)(2)(iii)

## Competitors (For Reference)

- **Keeper Tax** ($20-199/year) — bank-scan based, app-required
- **FlyFin** ($192-348/year) — bank-scan + CPA filing
- **SparkReceipt** ($6.58/mo) — basic mobile app
- **Receipt AI** ($10/mo) — SMS but B2B, requires QuickBooks
- **QuickBooks Self-Employed** ($15/mo) — accounting-first

None of them combine: SMS-first + AI categorization + IRC summaries + payment account tracking + no app required.

## Critical Legal Framing

This product is an **expense logger with smart suggestions**, NOT a tax advisor.

The AI:
- Categorizes expenses based on IRC code and common practice
- Cites the relevant tax code
- Provides plain English summaries
- Always allows user override
- Always defers to "consult a tax professional" for specific advice

The AI never:
- Gives specific tax advice
- Tells users what they "should" do
- Guarantees tax outcomes
- Files anything on their behalf

Every response should be anchored in: cited source + common practice + user agency + professional deferral.

## The 2-Week MVP Scope

**Goal:** Validate that people will text receipts to a number when given the option.

**Hypothesis:** If we make capturing receipts as easy as texting, self-employed people will actually do it consistently.

**Success metric:** 5+ of the first 10 beta users send 3+ receipts per week for 2 weeks.

## Tech Stack (Locked)

- **Frontend:** Next.js (App Router)
- **Database:** Supabase (managed Postgres)
- **Auth:** Custom phone OTP via Twilio
- **Storage:** Supabase Storage
- **SMS:** Twilio
- **AI:** Anthropic Claude (Sonnet 4.6 for reasoning, Haiku 4.5 for extraction)
- **Hosting:** Vercel
- **Monitoring:** Sentry (free tier)

## What's IN the MVP

- SMS-based receipt capture (Twilio webhook)
- Claude Vision for receipt extraction
- 3-question onboarding (work type, entity type, default payment account)
- 7 pre-loaded IRC code summaries
- AI categorization with IRC citation
- Per-receipt payment account tracking (business vs personal)
- Web dashboard with phone-OTP login
- Receipt list, edit, delete
- CSV export
- Static landing page
- Privacy policy, terms, disclaimer pages

## What's NOT in MVP

- Voice channel (Phase 2+)
- Mobile app (Phase 2)
- Tax deadline reminders (Phase 2)
- Stripe billing (free during beta)
- Multi-entity support (Phase 3)
- Bank linking (Phase 3)
- State-specific features (Phase 3)
- Schedule C-formatted export (Phase 2)
- Tax filing (never — we're a logger, not a preparer)

## The User Flow

### First-Time User

1. User sees landing page with phone number to text
2. Texts START or anything
3. AI asks: "What kind of work do you do?"
4. AI asks: "Sole proprietor or single-member LLC?"
5. AI asks: "Do you usually pay business expenses from a business account or personal account?"
6. AI confirms setup, invites first receipt

### Logging a Receipt

1. User sends photo or text description
2. AI extracts: vendor, amount, date, items
3. AI categorizes based on IRC code
4. AI confirms via SMS with categorization + IRC reference
5. AI asks one clarifying question if needed (e.g., who was the meal with, was this business or personal)
6. Receipt stored with full context

### Viewing Records

1. User visits domain.com/login
2. Enters phone number
3. Receives OTP via SMS
4. Logs in to dashboard
5. Sees all receipts in reverse chronological order
6. Can edit, delete, or download as CSV

## Files to Reference

- `PLAN.md` — Day-by-day execution plan
- `SPEC.md` — Technical specification and database schema
- `IRC-SUMMARIES.md` — The 7 pre-loaded tax code summaries
- `SYSTEM-PROMPTS.md` — AI system prompts for each interaction
- `OUTREACH.md` — First 10 customer acquisition templates
