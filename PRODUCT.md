# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: solo freelancers, contractors, side-hustlers, and single-member LLC owners (roughly $40K-$200K income) in the US. They pay business costs from a mix of personal and business cards, have no dedicated accountant, no QuickBooks, no Mercury/Brex/Ramp, and today keep a shoebox, a notes-app folder of photos, or nothing.

Their job: capture why each business expense happened while they still remember, then hand a clean record to whoever does their taxes in April.

Secondary (agency view): an organization (bookkeeper or agency) reviewing expenses for several of its members.

## Product Purpose

Tally is a text-based assistant. Users text an expense (photo or words) to a number. The AI extracts it, categorizes it under the relevant IRC section, and asks for more context only when IRS substantiation rules require it. The web app exists to review, correct, and export what was captured. Success is consistent capture (beta target: 5 of the first 10 users send 3+ receipts a week for 2 weeks) and a documentation-complete record at tax time.

## Positioning

"Your bank knows WHAT you spent, but not WHY. Tally captures both." The mechanism: capture happens over text at the moment of purchase, and the substantiation decision tree (strict categories under §274(d): meals, travel, gifts, vehicles; $75 threshold; lodging always needs a receipt) decides when to ask. Under $75, the user's own text is the written record.

## Operating Context

- Capture happens in the phone's messaging app, not in Tally's UI. The assistant is named Penny by default and is renamable per user.
- The web app is a second, occasional surface: logging in by phone OTP, scanning what was captured, fixing categories, adding missing context, attaching receipts, exporting CSV (standard and QuickBooks-compatible), emailing an accountant.
- Usage peaks around month-end review and tax season; much of it is on a phone.

## Capabilities and Constraints

- Routes in scope for the redesign: /dashboard, /dashboard/cleanup, /receipts/[id], /settings, /login, /privacy, /terms, /irc/[section], /agency, /agency/[orgId].
- The landing page (/, /pricing, /start) is out of scope for this redesign and keeps its interactive video hero (clips in public/hero/). New app surfaces must sit comfortably next to it.
- Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase. i18n dictionaries exist (src/i18n).
- Every AI categorization is overridable by the user and cites an IRC section.
- Not in V1: mobile app, bank linking, QuickBooks sync, accountant portal, tax filing, multi-entity, international.

## Brand Commitments

- Name: Tally (beta, rebrandable; do not invest in the mark). Domain tallywhy.com.
- Voice: plain English, friend-like, no IRS jargon or accounting-speak. "Suggest, don't advise": "typically falls under," never "you should." Always defer specifics to a CPA.
- Say "documentation complete," never "audit-ready."
- No em dashes in user-facing copy.
- App look (founder-pinned, 2026-11-19): simple, clean, modern, intuitive but captivating consumer fintech, at the craft level of Lemonade, Jerry, and Robinhood. Light mode only.
- Celebrate completion ("✓ Documentation complete"). Match the user's own words.

## Evidence on Hand

- Hero clips: public/hero/. OG image, icons, brand folder: public/, public/brand/.
- Design reference screenshots: design_refs/.
- No customer testimonials, logos, or usage statistics exist. Do not fabricate any.

## Product Principles

1. Text-first, app-second. The web app reviews and exports; it never competes with the text thread.
2. Ask only when the law requires it. The UI surfaces what's missing for documentation, nothing more.
3. Show the work. Every category shows its IRC section with a plain-English summary.
4. The user has final say. Every AI decision is visibly editable.
5. A logger, not an advisor. Nothing implies tax advice or guaranteed outcomes.
