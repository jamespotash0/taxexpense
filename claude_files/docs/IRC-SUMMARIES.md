# Tally — Core IRC Code Summaries

These are the 9 IRC sections seeded into the `irc_summaries` table — the original 7 core sections (which cover ~90% of common self-employed business expenses) plus **§274(b) gifts** and **§280F vehicle/listed property**, added per JOURNAL.md DEC-009 so gift and vehicle expenses resolve to the right summary instead of mis-loading the meals / generic-§162 copy.

**IMPORTANT:** These summaries are AI-assisted drafts. Before launch:
1. Review against IRS source publications
2. Consider getting a CPA spot-check
3. Apply standard disclaimer language

> **Sourcing & currency (2026):** The statutory detail, subsection-level rules, "WHY"-to-capture notes, and primary/secondary sources behind these summaries live in [`IRC-RESEARCH.md`](./IRC-RESEARCH.md). That file reconciles these summaries to the **One Big Beautiful Bill Act (P.L. 119-21, July 2025)** — which changed §179, §168(k), and §199A — and lists the figures that are inflation-adjusted and need annual review. **If you edit a number below, update IRC-RESEARCH.md too.** Last reconciled: 2026-06-01.

---

## §162 — Ordinary and Necessary Business Expenses

**section_id:** `162`

**title:** General Business Expenses

**short_summary:** The foundational tax code section that allows deduction of "ordinary and necessary" expenses paid or incurred during the tax year in carrying on any trade or business.

**deduction_percentage:** 100

**common_practice:** Most business expenses fall under this section — supplies, software, marketing, professional services, business insurance, internet, business phone, advertising, professional development. The expense must be common in your line of work ("ordinary") and helpful to your business ("necessary"). It doesn't have to be required.

**worth_noting:** Personal expenses claimed as business expenses are a common reason deductions get disallowed. The expense must have a genuine business purpose, and keeping a record of what each one was for is what supports it.

**source_url:** https://www.law.cornell.edu/uscode/text/26/162

---

## §262 — Personal Expenses (Not Deductible)

**section_id:** `262`

**title:** Personal Expenses (Not Deductible)

**short_summary:** Personal, living, or family expenses generally cannot be deducted as business expenses, even if you also use them for work.

**deduction_percentage:** 0

**common_practice:** Common examples of expenses that are NOT deductible: regular clothing (even if worn at work), gym memberships (unless you're a fitness professional), commuting from home to your office, personal meals eaten alone, entertainment for personal enjoyment.

**worth_noting:** Mixed-use expenses (phone, internet, vehicle, home) can be partially deductible based on business-use percentage — but the personal portion is never deductible. The business-use percentage should reflect actual use and is commonly scrutinized, so a contemporaneous record of how it was calculated matters.

**source_url:** https://www.law.cornell.edu/uscode/text/26/262

---

## §274 — Meals and Entertainment

**section_id:** `274`

**title:** Business Meals

**short_summary:** Business meals are generally 50% deductible. The meal must have a business purpose, a business contact must be present (not just yourself), and you must keep documentation of who attended and what was discussed.

**deduction_percentage:** 50

**common_practice:** Most freelancers deduct: client lunches, networking meals, meals during business travel, working meals with potential clients or business partners. The IRS specifically requires documentation of: amount, time, place, business purpose, and business relationship to the person you ate with.

**worth_noting:** Entertainment expenses (sports tickets, concerts, golf outings) are NOT deductible since the 2017 Tax Cuts and Jobs Act, even with clients present. Solo meals eaten alone while working are personal, not business. The $75 receipt rule isn't meals-only: for strict categories (meals, travel, gifts) keep a receipt for any expense of $75 or more, and keep a receipt for lodging at any amount. Below $75, your written record — your text to us — can substantiate it.

**source_url:** https://www.law.cornell.edu/uscode/text/26/274

---

## §274(b) — Business Gifts

**section_id:** `274b`

**title:** Business Gifts

**short_summary:** You can deduct business gifts, but only up to $25 per recipient per year — that counts everything you give one person during the year, directly or indirectly. Spend more than $25 on the same person and the extra isn't deductible.

**deduction_percentage:** 100

**common_practice:** Client and referral gifts are deductible up to $25 per person for the whole year, so keep a running total per recipient. Two things don't count as a "gift" against the $25: (1) cheap promotional items that cost $4 or less, have your name clearly and permanently printed on them, and are handed out widely as identical items (think logo pens or magnets); and (2) signs, display racks, or other promotional material meant for use at the recipient's place of business. Incidental costs like engraving, packaging, insurance, and mailing also don't count toward the $25, as long as they don't add real value to the gift. Keep a record of who received the gift, the date, a short description, the amount, and the business reason.

**worth_noting:** The $25 cap is per recipient for the whole year, so track a running total per person. A married couple is treated as one recipient. Gifts follow the strict-substantiation rules (who, what, when, why). The $25 figure has been fixed since 1962 — it is not inflation-adjusted. For how this applies to your situation, check with a tax professional.

**source_url:** https://www.law.cornell.edu/uscode/text/26/274 (§274(b)(1); v2, checked 2026-06-02 — see JOURNAL DEC-031)

---

## §280A — Home Office Deduction

**section_id:** `280A`

**title:** Home Office Deduction

**short_summary:** If you use part of your home regularly and exclusively for business, you can deduct a portion of home-related expenses (rent, mortgage interest, utilities, insurance, repairs) proportional to the space used.

**deduction_percentage:** 100

**common_practice:** The IRS offers two methods: (1) Simplified method — $5 per square foot up to 300 sq ft ($1,500 max). (2) Regular method — calculate the exact percentage of your home used for business and apply to actual expenses. Most freelancers use the simplified method for ease.

**worth_noting:** The "exclusively for business" requirement is strict — the space must NOT be used for any personal purposes. A guest room that doubles as an office doesn't qualify. A dedicated corner of a room counts if used only for work. Keep documentation of the space and how it's used exclusively for business.

**source_url:** https://www.law.cornell.edu/uscode/text/26/280A

---

## §280F — Vehicle & Listed Property

**section_id:** `280F`

**title:** Vehicle & Listed Property

**short_summary:** Vehicle expenses are deductible for the business-use portion of your driving. Because a car counts as "listed property," the IRS requires a contemporaneous mileage log, and you must use the vehicle more than 50% for business to claim the larger write-offs.

**deduction_percentage:** 100

**common_practice:** Most freelancers track business miles and deduct either the IRS standard mileage rate or actual costs (gas, insurance, repairs, depreciation) times their business-use percentage. Log the date, miles, and business purpose for each trip. If you own the vehicle, annual depreciation is capped by the "luxury auto" limits, which change every year.

**worth_noting:** The mileage log IS the substantiation — without it, vehicle deductions are commonly disallowed. Commuting from home to a regular workplace is personal, not business. If business use drops to 50% or below, you lose accelerated depreciation and Section 179 for that vehicle. The annual depreciation caps are inflation-adjusted — re-verify each tax year (see IRC-RESEARCH.md).

**source_url:** https://www.law.cornell.edu/uscode/text/26/280F

---

## §179 — Immediate Equipment Deduction

**section_id:** `179`

**title:** Section 179 Equipment Deduction

**short_summary:** Allows businesses to deduct the full purchase price of qualifying equipment and software in the year it was bought, rather than depreciating it over several years.

**deduction_percentage:** 100

**common_practice:** Commonly used for: computers, cameras, professional equipment, business vehicles (with limits), software, office furniture, machinery. Under the One Big Beautiful Bill Act (2025), the annual limit is $2.5 million with a $4 million phase-out threshold (indexed for inflation from 2026) — most freelancers won't approach this cap. Separately, §168(k) "bonus depreciation" is back to 100% (permanent) for qualifying property acquired and placed in service after Jan 19, 2025.

**worth_noting:** The equipment must be used more than 50% for business. If you use it less than 100% for business, you can only deduct the business-use percentage. The item must be put into service during the tax year — buying it and storing it unused doesn't qualify. The $2.5M/$4M figures are inflation-adjusted annually starting 2026 — re-verify each tax year (see IRC-RESEARCH.md).

**source_url:** https://www.law.cornell.edu/uscode/text/26/179

---

## §1402 — Self-Employment Tax

**section_id:** `1402`

**title:** Self-Employment Tax

**short_summary:** Self-employed individuals pay both the employer and employee portions of Social Security and Medicare taxes — 15.3% total on net self-employment income (12.4% Social Security + 2.9% Medicare, with an additional 0.9% Medicare surtax on high earners).

**deduction_percentage:** 0

**common_practice:** Self-employment tax applies to net earnings from self-employment over $400 annually. It's calculated on Schedule SE and added to your regular income tax. The employer-equivalent half (7.65%) is deductible as an adjustment to income.

**worth_noting:** Self-employment tax is one of the largest tax costs for self-employed people. At higher income levels, some people ask a CPA whether a different business structure would reduce it — but that's a professional decision based on your specific situation, not a DIY move.

**source_url:** https://www.law.cornell.edu/uscode/text/26/1402

---

## §6654 — Estimated Tax Payments

**section_id:** `6654`

**title:** Estimated Quarterly Tax Payments

**short_summary:** Self-employed individuals are generally required to make estimated tax payments four times per year if they expect to owe $1,000 or more in taxes for the year.

**deduction_percentage:** 0

**common_practice:** Quarterly payment deadlines are typically: April 15 (Q1), June 15 (Q2), September 15 (Q3), and January 15 of the following year (Q4). Most freelancers calculate quarterly payments based on either: (1) 100% of prior year's tax liability, or (2) 90% of current year's expected liability.

**worth_noting:** Underpayment penalties apply if you don't pay enough throughout the year. The "safe harbor" rule says you generally won't be penalized if you pay either 100% of last year's tax (110% if your AGI was over $150K) or 90% of this year's tax, whichever is less.

**source_url:** https://www.law.cornell.edu/uscode/text/26/6654

---

## Standard Disclaimer for All Summaries

Add this to every IRC summary displayed to users:

> _This is general information about the Internal Revenue Code, not tax advice for your specific situation. Tax law is complex and changes frequently. For advice on your specific circumstances, consult a licensed tax professional._

---

## Seeding & Updates (single source of truth)

The runnable SQL lives in **`supabase/migrations/0003_seed_irc_summaries.sql`** (with `0002_seed_substantiation_rules.sql`). That migration is the single source of truth for the `irc_summaries` data — **edit the summaries there**, not in this doc. This file holds the human-readable copy + the standard disclaimer above; the migration holds the seed. (The old copy-paste SQL block was removed because it had already drifted from the migration — keeping two copies of tax data is a correctness hazard.)

- **Apply:** `supabase db push` (preferred), or paste `supabase/migrations/RUN_ALL.sql` into the Supabase SQL Editor.
- **Verify:** `SELECT section_id, title, version FROM irc_summaries ORDER BY section_id;` (7 rows).
- **Updating later:** do NOT hand-edit rows in prod (an in-place `UPDATE` desyncs the DB from the migration and is clobbered on the next `db push`). Land content changes as targeted, append-only migrations (`0004_update_irc_<year>.sql`, …) that set the changed fields, bump `version`, and set a real `last_reviewed` date.
- **Cadence, ownership, the annual inflation-adjusted-figure review, and sourcing:** see [`IRC-RESEARCH.md`](./IRC-RESEARCH.md) (Annual-Review Checklist) and the decision log in [`JOURNAL.md`](./JOURNAL.md) (DEC-007, DEC-008).
