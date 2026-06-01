# TaxSnap — IRC Research & Sourcing Reference

**Purpose:** This is the *sourced* reference behind [`IRC-SUMMARIES.md`](./IRC-SUMMARIES.md). Where IRC-SUMMARIES.md holds the short, user-facing copy seeded into the `irc_summaries` table, **this file holds the statutory detail at subsection level, the "WHY" each provision requires a user to capture, and the primary/secondary sources** so the summaries can be audited and kept current.

**Scope:** The Internal Revenue Code sections and subsections that matter to TaxSnap's target user — a **sole proprietor, single-member LLC, or 1099 contractor filing Schedule C** — for the product's core job: **capturing the business purpose ("the WHY") of an expense and meeting IRS substantiation rules.**

**Currency:** Current as of **2026 tax year**, and explicitly reconciled to the **One Big Beautiful Bill Act (OBBBA), Public Law 119-21, enacted July 4, 2025.** Several dollar figures changed under OBBBA — a summary written before July 2025 will be *wrong* on §179, §168(k), and §199A. See the [What Changed for 2026](#what-changed-for-2026-obbba) box.

**How this was produced:** Statutory text was verified against **Cornell Legal Information Institute (LII)** primary text and **eCFR/Cornell** regulation text; current-year dollar figures were verified against **official IRS revenue procedures, notices, and newsroom releases** (Rev. Proc. 2025-32 for TY2026 inflation items; Rev. Proc. 2026-15 for auto caps; SSA for the wage base), with Big Four / CPA-firm secondary sources used only to corroborate. Each finding below is tagged with its sources and a confidence level. **Two multi-agent research passes** (a broad fan-out with 3-vote adversarial verification, then a focused gap-verification pass) backstop the figures.

---

> ### ⚠️ Standard Disclaimer (must accompany any user-facing use)
> _This is general information about the Internal Revenue Code, not tax advice for your specific situation. Tax law is complex and changes frequently. For advice on your specific circumstances, consult a licensed tax professional._

> ### ❗ This document is not a substitute for a CPA spot-check
> These summaries are research-grade and primary-sourced, but TaxSnap is a logger, not an advisor. Per [`CLAUDE.md`](../../CLAUDE.md) Critical Open Items, the IRC summaries still warrant a **CPA spot-check before/just-after launch**. Items needing professional confirmation are flagged inline and collected in [Open Items & CPA-Review Flags](#open-items--cpa-review-flags).

---

## What Changed for 2026 (OBBBA)

The **One Big Beautiful Bill Act (P.L. 119-21, July 4, 2025)** changed several of exactly the provisions TaxSnap cites. A summary based on pre-OBBBA (TCJA-sunset) assumptions would be out of date:

| Provision | Old (pre-OBBBA) | **Current (2026, post-OBBBA)** |
|---|---|---|
| **§168(k) bonus depreciation** | Phasing down — 40% (2025), 20% (2026), sunset | **100% permanent** for property *acquired and placed in service after Jan 19, 2025* |
| **§179 expensing cap** | ~$1,160,000 (2023), indexed | **$2,500,000** max, **$4,000,000** phase-out threshold |
| **§199A QBI deduction** | 20%, **set to expire after 2025** | **20%, made permanent**; new minimum deduction added |
| **§274(o) (new)** | n/a | New disallowance of *employer-convenience* meals from 2026 — **does not affect** sole-prop client/travel meals |

The IRS confirmed these are operative in 2026 law via **Rev. Proc. 2025-32** ("inflation adjustments for tax year 2026, including amendments from the One, Big, Beautiful Bill"). Primary: https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill

**Refuted during research (do NOT repeat):** the claim that OBBBA's *Qualified Production Property* shares the bonus-depreciation "after Jan 19, 2025" acquired-and-placed-in-service date — QPP timing differs. (Verdict 0–3; excluded.) QPP is out of scope for TaxSnap's Schedule-C users anyway.

---

## Quick Reference: Sections Flagged for TaxSnap

| § | Topic | Substantiation regime | Deduct % | Key figure (2026) | Annual review? |
|---|---|---|---|---|---|
| **§162** | Ordinary & necessary business expense (the deduction authority) | General | 100% | — | No |
| **§162(a)(2)** | Travel away from home | **Strict §274(d)** | 100% (lodging/transport) | — | No |
| **§162(a)(1)** | Reasonable compensation | n/a | — | **Owner draws NOT deductible** | No |
| **§162(l)** | Self-employed health insurance | Above-the-line | 100% (limited) | LTC age caps indexed | Yes (LTC caps) |
| **§262** | Personal/living expenses; mixed-use | General | 0% personal | — | No |
| **§274(a)(1)** | Entertainment | Disallowed | **0%** | — | No |
| **§274(b)(1)** | Business gifts | Strict §274(d) | 100% | **$25/recipient/yr cap** | No (fixed) |
| **§274(d)** | The strict substantiation regime | **Strict** | — | 4–5 required elements | No |
| **§274(k)** | Meals not lavish + taxpayer present | Strict | — | — | No |
| **§274(n)** | Business meal limit | Strict | **50%** | — | No |
| **§280A** | Home office | General (Sched C) | 100% (allocated) | **$5/sq ft, 300 sq ft, $1,500** | No (fixed) |
| **§280F** | Listed property / luxury auto | **Strict §274(d)** | per caps | 2026 caps ↓ (see below) | **Yes** |
| **§179** | Immediate expensing | General | 100% | **$2.5M / $4M phase-out** | **Yes** (from TY2026) |
| **§168(k)** | Bonus depreciation | General | **100%** | post-Jan 19 2025 property | No (now permanent) |
| **§195** | Start-up expenditures | General | $5k then amortize | **$5,000 / $50,000 / 180 mo** | No (fixed) |
| **§6001** | General recordkeeping mandate | — | — | "so long as material" | No |
| **§1402 / §1401** | Self-employment tax | — | — | 15.3%; wage base **$184,500** | **Yes** (wage base) |
| **§164(f)** | Deduct ½ of SE tax | Above-the-line | — | — | No |
| **§6654** | Estimated quarterly tax | — | — | $1,000 / 90/100/110% | No |
| **§199A** | QBI deduction | — | **20%** | thresholds **$201,750 / $403,500** | **Yes** |

"Annual review?" = the dollar figure is inflation-adjusted and must be re-verified each tax year against the then-current IRS revenue procedure. See [Annual-Review Checklist](#annual-review-checklist-inflation-adjusted-figures).

---

# Section Detail

Each entry separates **(a) the statutory rule**, **(b) the WHY to capture** (what TaxSnap should record/ask for), and **(c) sources + flags**.

---

## §162 — Ordinary & Necessary Business Expenses

**(a) Rule.** §162(a) allows a deduction for *all the ordinary and necessary expenses paid or incurred during the taxable year in carrying on any trade or business.* "Ordinary" = common/accepted in your line of work; "necessary" = helpful and appropriate (it need not be indispensable). This is the foundational deduction authority for nearly every general-substantiation expense. **§162(a)(2)** specifically allows *traveling expenses (including meals and lodging not lavish or extravagant) while away from home in pursuit of a trade or business* — "away from home" means away from your tax home long enough to require sleep/rest (generally overnight).

**(b) The WHY to capture.** The business reason the expense was incurred (its business purpose), and — for travel — that the trip was away from the tax home in pursuit of business. For general-substantiation items this is satisfied by payee + amount + date + description + proof of payment; §162(a)(2) travel is pushed into the **strict §274(d)** regime below.

**(c) Sources & flags.** Primary: https://www.law.cornell.edu/uscode/text/26/162 · Secondary: IRS Pub 535 / Pub 334. **Flag:** Foundational text, untouched by TCJA or OBBBA — stable. Confidence: **high** (3-0 verified verbatim).

### §162(a)(1) — Reasonable compensation (and the owner-draw trap)

**(a) Rule.** §162(a)(1) allows a deduction for *a reasonable allowance for salaries or other compensation for personal services actually rendered.* **Critically for TaxSnap's user:** a sole proprietor / single-member LLC owner **cannot deduct compensation paid to themselves.** Owner draws are not deductible. The Schedule C instructions state plainly: "Do not include … amounts paid to yourself." The owner's "pay" is the residual **net profit** (Schedule C line 31), which is then subject to SE tax — regardless of how much cash they actually withdrew.

**(b) The WHY to capture.** Capture deductible *business* expenses to reduce net profit; do **not** treat owner draws as expenses.

**(c) Sources & flags.** Primary: https://www.law.cornell.edu/uscode/text/26/162 + Schedule C instructions https://www.irs.gov/instructions/i1040sc · **Product implication:** TaxSnap must never suggest a sole prop "pay themselves a salary" or log an owner draw as a deductible expense. Stable; no OBBBA change. Confidence: **high**.

### §162(l) — Self-employed health insurance deduction

**(a) Rule.** A self-employed individual may deduct premiums for health (and qualified long-term care) insurance covering self, spouse, dependents, and children under 27 — as an **above-the-line adjustment to income (Form 7206 / Schedule 1), NOT on Schedule C and not as a §213 itemized medical deduction.** Two limits: (1) the deduction can't exceed net earnings from the business the plan is established under, and (2) it's **disallowed for any month** the taxpayer is eligible for an employer-subsidized plan (own or spouse's). LTC premiums count only up to age-based caps (2025: $480 / $900 / $1,800 / $4,810 / $6,020 by age band — **indexed annually**).

**(b) The WHY to capture.** Premium-payment proof, policy/coverage type and covered persons, and that the taxpayer was *not* eligible for employer-subsidized coverage in the claimed months.

**(c) Sources & flags.** Primary: https://www.law.cornell.edu/uscode/text/26/162 + Form 7206 instructions https://www.irs.gov/instructions/i7206 · IRS Topic 305/502. **Flag:** LTC age caps are **inflation-adjusted annually** (review). This is an above-the-line item, *not* a Schedule C expense — likely **out of TaxSnap's core capture loop**, but worth knowing so the AI doesn't mis-bucket health premiums as a Schedule C deduction. Confidence: **high**.

---

## §262 — Personal, Living & Family Expenses (Not Deductible)

**(a) Rule.** §262(a): *"no deduction shall be allowed for personal, living, or family expenses."* Treas. Reg. §1.262-1 supplies the **mixed-use** principle: when an expense serves both business and personal purposes, only the **portion properly attributable to business is deductible**; the personal portion never is. The IRS does not accept estimates for the allocation.

**(b) The WHY to capture.** For mixed-use items (vehicle, phone, internet, home), capture: the business purpose, the total amount, the **allocation method** (business miles ÷ total miles; office sq ft ÷ home sq ft; business-use %), and contemporaneous records backing that allocation. Without allocation evidence the *entire* expense risks disallowance.

**(c) Sources & flags.** Primary: https://www.law.cornell.edu/uscode/text/26/262 + https://www.law.cornell.edu/cfr/text/26/1.262-1 + Schedule C instructions. **Flag:** Stable; unchanged by TCJA/OBBBA. Confidence: **high**.

---

## §274 — The Strict Substantiation Regime (the heart of TaxSnap)

§274 is where the product's "capture the WHY only when the code requires it" logic lives. Treat each subsection separately.

### §274(d) — Strict substantiation: the 4–5 required elements

**(a) Rule.** For **travel, meals, gifts, and listed property**, **NO deduction is allowed** unless the taxpayer substantiates — *by adequate records or sufficient corroborating evidence of the taxpayer's own statement* — these elements: **(A) amount; (B) time and place** of travel (or, for a gift, **date and description**); **(C) business purpose**; and **(D) the business relationship** of the person receiving the meal/gift. Treas. Reg. §1.274-5 (operative detail in temp. §1.274-5T) carries the same elements.

**Documentary-evidence ($75) threshold — Reg. §1.274-5(c)(2):** a **receipt/paid bill is required** for (1) **any lodging** expense while traveling away from home, and (2) **any other expenditure of $75 or more.** **Below $75 (and not lodging), the taxpayer's own adequate written record suffices** — *this is the statutory basis for TaxSnap's rule that for a sub-$75 strict-category expense the user's SMS IS the IRS-compliant documentation.* The **$75 threshold is fixed (since Oct 1, 1995), not inflation-adjusted**, and unchanged by OBBBA.

**(b) The WHY to capture.** This subsection literally defines what TaxSnap asks for on strict-category expenses: **amount, when, where, why (business purpose), and for whom (business relationship).** Lodging and any ≥$75 strict expense additionally require an attached receipt.

**(c) Sources & flags.** Primary: https://www.law.cornell.edu/uscode/text/26/274 + https://www.law.cornell.edu/cfr/text/26/1.274-5 (+ eCFR §1.274-5T). **Flag:** $75 documentary threshold is **fixed, not indexed**. Confidence: **high** (3-0). *Nuance:* for **gifts**, element (B) is *date and description of the gift*, not "place."

### §274(a)(1) — Entertainment disallowed (0%)

**(a) Rule.** Since the TCJA (effective 1/1/2018), **no deduction** is allowed for entertainment, amusement, or recreation, or facilities used for them — **0% deductible.** Still in force in 2026; OBBBA did not change it. Narrow §274(e) exceptions exist (employee events, items treated as compensation, entertainment sold to the public), but these are essentially irrelevant to a solo Schedule C filer. Entertainment must be distinguished from a **meal** (still 50% — see §274(n)): if a meal is purchased at an entertainment venue, the separately-stated food/beverage cost can still qualify.

**(b) The WHY to capture.** When an expense is entertainment, **do not ask for receipt/context — log it as nondeductible** and tell the user the IRS disallows the category. If the user says "this was actually a client meal," recategorize to a meal (50%, with §274(d) substantiation) but warn that pure entertainment is never deductible.

**(c) Sources & flags.** Primary: https://www.law.cornell.edu/uscode/text/26/274 · IRS Pub 463; "TCJA — Businesses." **Flag:** Permanent, no sunset; no dollar threshold. Confidence: **high**.

### §274(b)(1) — Business-gift cap: $25 per recipient per year

**(a) Rule.** The deduction for business gifts to any one individual is capped at **$25 per person per taxable year**, cumulative across all gifts to that person. Pub 463 corroborates and adds: incidental promotional items ≤$4 with your name on them don't count, and spouses are treated as one donor.

**(b) The WHY to capture.** Recipient identity and a **running per-recipient annual total**; flag amounts over $25/recipient as nondeductible above the cap. (Gifts also always require strict §274(d) substantiation — TaxSnap models gifts as `always_receipt`.)

**(c) Sources & flags.** Primary: https://www.law.cornell.edu/uscode/text/26/274 · Secondary: https://www.irs.gov/publications/p463. **Flag:** **$25 is fixed (since 1962), not inflation-adjusted**, unchanged by OBBBA. Confidence: **high**. *(Note: TaxSnap's `substantiation_rules` seed encodes this as `deduction_cap_cents = 2500`.)*

### §274(k) — Meals: not lavish + taxpayer/employee present

**(a) Rule.** §274(k)(1): no deduction for food/beverages unless **(A) not lavish or extravagant** under the circumstances **AND (B) the taxpayer (or an employee) is present** at the furnishing. Conjunctive test. This is why a meal "for a client" the taxpayer didn't attend, or an extravagant meal, fails.

**(b) The WHY to capture.** Confirmation the meal was reasonable and that the user/employee attended (the "solo meal alone = personal" rule flows from here + §262).

**(c) Sources & flags.** Primary: https://www.law.cornell.edu/uscode/text/26/274. **Flag:** Current; not altered by OBBBA. Confidence: **high**.

### §274(n) — Business meals limited to 50%

**(a) Rule.** §274(n)(1): the deduction for food/beverages **cannot exceed 50%** of the amount. The temporary **100% restaurant-meal deduction (§274(n)(2)(D)) applied only to 2021–2022 and has fully expired** — 2026 meals are **50%**. **OBBBA added a *new* §274(o)** (effective 2026) disallowing *employer-convenience* meals and employer eating-facility costs — this targets employers with employees and **does not affect** a sole proprietor's client meals or meals while traveling.

**(b) The WHY to capture.** Standard §274(d) meal elements; apply 50% to the deductible amount. TaxSnap's `meals_business` / `meals_travel` rules already carry `deduction_percentage = 50`.

**(c) Sources & flags.** Primary: https://www.law.cornell.edu/uscode/text/26/274 · Secondary: Pub 463; CohnReznick / UHY / Forvis on §274(o). **Flag:** 50% is statutory, not indexed; the 100% (2021–22) provision is **expired** — any copy implying 100% restaurant meals is wrong. Confidence: **high**.

---

## §280A — Home Office

**(a) Rule.** §280A(c)(1) disallows home expenses **unless** a portion is used **regularly AND exclusively** as (1) the **principal place of business**, (2) a place to **meet clients/patients/customers** in the normal course, or (3) a **separate structure** used for business. "Principal place of business" includes a space used for **administrative/management activities** if there's no other fixed location where the taxpayer does substantial admin/management (the post-*Soliman* fix, Taxpayer Relief Act of 1997). Two methods:

- **Regular (actual-expense) method:** deduct the business-use % of actual home costs (utilities, mortgage interest, property tax, insurance, depreciation, repairs).
- **Simplified method (Rev. Proc. 2013-13):** **$5/sq ft, up to 300 sq ft = $1,500 maximum.** Rate and cap are **fixed since 2013, not inflation-adjusted.**

Both are capped by **§280A(c)(5)**: the deduction can't exceed gross income from the business use (excess carries forward).

**(b) The WHY to capture.** **Regular & exclusive use** of the space; square footage of the office (and of the home, for the regular method); business-use start date; and, for the regular method, the actual-expense records. **Note:** the home-office deduction is claimed on Schedule C separately from individual expense line items — a user's per-expense SMS does **not** substitute for home-office substantiation.

**(c) Sources & flags.** Primary: https://www.law.cornell.edu/uscode/text/26/280A · Secondary: Pub 587 https://www.irs.gov/publications/p587, Rev. Proc. 2013-13 (IRB 2013-06), IRS simplified-method FAQ. **Flag:** $5/$1,500 **fixed, not indexed**; no OBBBA change. The "exclusive use" test is strict (a guest-room-that-doubles-as-office fails). Confidence: **high**.

---

## §280F — Listed Property & Luxury-Auto Limits (why vehicles are strict)

**(a) Rule.** §280F(d)(4) defines **listed property** to include **any passenger automobile** and other transportation property — which is *why vehicles fall under the strict §274(d) regime.* §280F(b)(3): listed property is "predominantly used in a qualified business use" only if **business use exceeds 50%**. At ≤50% business use (§280F(b)(1)), the taxpayer is forced to **ADS straight-line depreciation** (no bonus/accelerated) and **§179 is unavailable** for that property. §280F(a) caps annual depreciation on passenger autos; the **base statutory caps** ($10,000 / $16,000 / $9,600 / $5,760) are **increased by an annual inflation adjustment** under §280F(d)(7), so the operative caps change yearly.

**Current-year (2026) caps — from Rev. Proc. 2026-15:**

| Year in service | With §168(k) bonus | Without bonus |
|---|---|---|
| 1st year | **$20,300** | $12,300 |
| 2nd year | $19,800 | $19,800 |
| 3rd year | $11,900 | $11,900 |
| Each later year | $7,160 | $7,160 |

(The $8,000 first-year gap is the §168(k)(2)(F)(i) bonus add-on. "Passenger automobiles" includes trucks and vans.)

**(b) The WHY to capture.** A **contemporaneous mileage/usage log** establishing the business-use %: business miles, total miles, dates, and purpose of trips. This is the §274(d) substantiation that supports both the deduction and the >50% test. TaxSnap's `vehicle_business` rule captures `business_miles` + `business_purpose`.

**(c) Sources & flags.** Primary: https://www.law.cornell.edu/uscode/text/26/280F + Rev. Proc. 2026-15 https://www.irs.gov/pub/irs-drop/rp-26-15.pdf · Secondary: Pub 946 https://www.irs.gov/publications/p946. **Flag:** Auto caps are **inflation-adjusted annually — re-verify every tax year** (2025 caps actually *dropped* vs. prior year). Confidence: **high**.

---

## §179 — Election to Expense Equipment (post-OBBBA)

**(a) Rule.** §179 lets a business **expense the full cost of qualifying equipment/software in the year placed in service** instead of depreciating. **As amended by OBBBA**, for property placed in service in tax years beginning after Dec 31, 2024: **maximum = $2,500,000**, with a **dollar-for-dollar phase-out beginning at $4,000,000** of §179 property placed in service. These amounts are **inflation-adjusted for tax years beginning after Dec 31, 2025.** Property must be **>50% business use** and **placed in service** during the year (buying and storing it doesn't qualify).

**(b) The WHY to capture.** **Placed-in-service date** and **business-use percentage** (and the >50% test from §280F for vehicles/listed property).

**(c) Sources & flags.** Primary/official: Rev. Proc. 2025-32 https://www.irs.gov/pub/irs-drop/rp-25-32.pdf (states the $2.5M/$4M figures verbatim) + https://www.law.cornell.edu/uscode/text/26/179 · Secondary: AICPA, KPMG, Bloomberg Tax. **Flag (OBBBA + annual):** prior law was ~$1.16M/$2.89M — **any summary citing ~$1.16M is now WRONG.** Indexed from TY2026 → review yearly. Confidence: **high**.

---

## §168(k) — Bonus Depreciation (100% permanent again)

**(a) Rule.** OBBBA amended §168(k)(1) to allow **100% additional first-year depreciation** for qualified property **acquired AND placed in service after January 19, 2025**, **permanently** removing the TCJA phase-down/sunset (which had dropped bonus to 40% in 2025, 20% in 2026, then zero). §168(k)(2)(F)(i) adds $8,000 to the first-year §280F auto cap (the source of the bonus-vs-no-bonus gap above). §168(k)(10) permits an *election* of 40%/60% for property acquired after Jan 19, 2025 and placed in service in the year including Jan 20, 2025.

**(b) The WHY to capture.** Acquisition date and placed-in-service date (the Jan 19, 2025 line matters), business-use %.

**(c) Sources & flags.** Official: IRS newsroom https://www.irs.gov/newsroom/one-big-beautiful-bill-provisions + IRS Notice 2026-11 https://www.irs.gov/pub/irs-drop/n-26-11.pdf + Rev. Proc. 2026-15 · Secondary: Grant Thornton, BDO, Moss Adams, RSM, Baker Tilly. **Flag (OBBBA):** **A summary citing the old 40%/60% phase-down is WRONG** — 100% is now the default and permanent. Confidence: **high**.

---

## §195 — Start-Up Expenditures

**(a) Rule.** §195(b): a taxpayer may deduct the **lesser of (i) actual start-up costs or (ii) $5,000** in the first year, with the **$5,000 reduced dollar-for-dollar by start-up costs exceeding $50,000** (so the first-year deduction is fully phased out at $55,000). The **remainder is amortized ratably over 180 months (15 years)** beginning the month the business begins. **$5,000 / $50,000 are fixed statutory amounts, not inflation-adjusted.**

**(b) The WHY to capture.** Per-cost documentation (invoice/amount/description), evidence the cost was incurred **before the business opened**, the **date operations began**, and the cap calculation.

**(c) Sources & flags.** Primary: https://www.law.cornell.edu/uscode/text/26/195. **Flag:** Fixed amounts (a 2010 law temporarily raised them to $10k/$60k for 2010 only — expired). OBBBA added an "or 174A" R&D cross-reference but **did not change the $5k/$50k limits.** Confidence: **high**.

---

## §6001 — The Recordkeeping Mandate (statutory backbone)

**(a) Rule.** §6001: every person liable for tax must **keep records sufficient to establish** their liability, as the Secretary prescribes. Treas. Reg. §1.6001-1: maintain **permanent books/records sufficient to establish gross income, deductions, and credits**, and **retain them so long as their contents may become material** to administering the tax law. This is the general-substantiation backbone for the §162 (non-strict) categories.

**(b) The WHY to capture.** For every expense: amount, date, payee, and the **business purpose** — because the IRS requires proof an expense was ordinary/necessary and actually incurred. The WHY is what fails first when only the WHAT (amount) is provable.

**(c) Sources & flags.** Primary: https://www.law.cornell.edu/uscode/text/26/6001 + https://www.law.cornell.edu/cfr/text/26/1.6001-1. **Flag:** No fixed retention period — "so long as material." Practical lookback: generally **3 years**, **6 years** if income understated by >25%, **indefinite** for fraud. Confidence: **high**.

---

## §1402 / §1401 — Self-Employment Tax (and §164(f))

**(a) Rule.** SE tax = **15.3%** on net SE earnings: **12.4% Social Security (OASDI)** up to the annual wage base + **2.9% Medicare** (no cap). Applies once net SE earnings reach **$400/yr**. The wage base is **adjusted annually**: **$168,600 (2024) → $176,100 (2025) → $184,500 (2026).** The **0.9% Additional Medicare Tax** (via §1401(b)(2)) applies to combined wages + SE income over **$250,000 MFJ / $125,000 MFS / $200,000 others** — these thresholds are **fixed, not inflation-adjusted.** **§164(f)** lets the taxpayer deduct **one-half of the §1401 SE tax** as an above-the-line adjustment.

**(b) The WHY to capture.** Net SE earnings (drives the tax); for the 0.9% surtax, household wages + SE income (it's a household-level threshold); SE tax paid (for the §164(f) deduction).

**(c) Sources & flags.** Official: SSA wage base/rates https://www.ssa.gov/oact/cola/cbb.html, https://www.ssa.gov/oact/progdata/taxRates.html; IRS Topic 751 https://www.irs.gov/taxtopics/tc751; Additional Medicare Tax Q&A https://www.irs.gov/businesses/small-businesses-self-employed/questions-and-answers-for-the-additional-medicare-tax · Primary: https://www.law.cornell.edu/uscode/text/26/164, https://www.law.cornell.edu/uscode/text/26/1401. **Flag:** **Wage base is adjusted annually — review every year.** Rates (12.4%/2.9%) and surtax thresholds are fixed. ⚠️ **CPA-review item:** whether **one-half of the 0.9% Additional Medicare surtax is deductible under §164(f)** — a research agent asserted it is; the commonly-cited rule is that §164(f) covers only the regular SE tax, **not** the Additional Medicare Tax. *Do not state this either way in user copy without CPA confirmation.* Confidence on rate/wage-base: **high**; on the §164(f)/surtax interaction: **low — flagged.**

---

## §6654 — Estimated Quarterly Tax

**(a) Rule.** An individual must pay estimated tax if expected tax (after withholding) is **$1,000 or more** (§6654(e)(1)). **Safe harbors** to avoid the underpayment penalty: pay **≥90% of the current-year** tax, **OR ≥100% of the prior-year** tax (**110% if prior-year AGI > $150,000**; $75,000 MFS). Quarterly due dates: **April 15, June 15, September 15, and January 15** of the following year.

**(b) The WHY to capture.** Documented quarterly payments (dates/amounts), income projections, and prior-year tax (if using the 100/110% harbor).

**(c) Sources & flags.** Primary: https://www.law.cornell.edu/uscode/text/26/6654 · Official: IRS Topic 306 https://www.irs.gov/taxtopics/tc306, Pub 505 https://www.irs.gov/publications/p505, Estimated Taxes hub. **Flag:** $1,000 threshold and 90/100/110% harbors stable; OBBBA added only a narrow *farmland-deferral* interaction (Notice 2026-3) irrelevant to TaxSnap's users. **Out of core scope** for V1 (no tax-deadline reminders in V1 per SPEC), but relevant context for the "why track expenses" story. Confidence: **high**.

---

## §199A — Qualified Business Income (QBI) Deduction

**(a) Rule.** §199A(a): a deduction equal to the **lesser of (1) the combined QBI amount or (2) 20% of (taxable income − net capital gain).** Below the income threshold, the per-business amount is simply **20% of QBI**; above it, the **W-2 wage / UBIA limitation** and the **SSTB** (specified service trade/business) restrictions phase in. **OBBBA made §199A permanent** (repealing the post-2025 sunset) and added a **new minimum deduction** (greater of the regular amount or **$400** for taxpayers with ≥$1,000 of active QBI; indexed from 2027).

**Threshold amounts (statutory base $157,500 / $315,000 MFJ, indexed). For tax years beginning in 2026 (Rev. Proc. 2025-32):**

| Filing status | Threshold | Phase-in top |
|---|---|---|
| MFJ | **$403,500** | $553,500 |
| Single / HoH (all other) | **$201,750** | $276,750 |
| MFS | $201,775 | $276,775 |

**(b) The WHY to capture.** Whether the business is an **SSTB**, and taxable income relative to these thresholds — together they decide whether the 20% is limited. (This is a *return-level* computation, not a per-expense capture — context for the product, not a field TaxSnap collects per receipt.)

**(c) Sources & flags.** Primary: https://www.law.cornell.edu/uscode/text/26/199A + Rev. Proc. 2025-32 https://www.irs.gov/pub/irs-drop/rp-25-32.pdf · Secondary: KPMG, RSM. **Flag (OBBBA + annual):** **Made permanent — a summary saying §199A expires after 2025 is WRONG.** Thresholds are **inflation-adjusted annually — review yearly.** Confidence: **high**.

---

# Annual-Review Checklist (Inflation-Adjusted Figures)

Re-verify these **every tax year** against the then-current IRS revenue procedure / SSA release, then bump `last_reviewed` and `version` in `irc_summaries`:

- [ ] **§280F luxury-auto caps** — current Rev. Proc. (2026: Rev. Proc. 2026-15; figures *dropped* in 2025, so don't assume monotonic).
- [ ] **§199A thresholds / phase-in ranges** — current Rev. Proc. (2026: $201,750 / $403,500; tops $276,750 / $553,500).
- [ ] **§179 cap & phase-out** — indexed beginning TY2026 (base $2.5M / $4M).
- [ ] **SE-tax Social Security wage base** — SSA (2026: $184,500).
- [ ] **§162(l) LTC age-band premium caps** — IRS annual release.

**Fixed (NOT indexed — safe to hardcode, but confirm no statutory change):** §274(d) **$75** documentary threshold · §274(b)(1) **$25** gift cap · §280A simplified-method **$5/sq ft, $1,500** · §195 **$5,000 / $50,000** · SE-tax rates **12.4% / 2.9%** · §1401(b)(2) surtax thresholds **$250k / $200k / $125k** · §6654 **$1,000** threshold & **90/100/110%** harbors.

---

# Open Items & CPA-Review Flags

Per [`CLAUDE.md`](../../CLAUDE.md) ("Defer to professionals" / Critical Open Items), surface these for a CPA spot-check before relying on them in user-facing advice:

1. **§164(f) × 0.9% Additional Medicare Tax** — confirm whether one-half of the *surtax* (vs. only the base SE tax) is deductible. Conservative position: §164(f) covers only the regular SE tax. *Flagged low-confidence; do not assert in copy.*
2. **Meals percentage messaging** — confirm 50% is correct for the user's facts and that the new **§274(o)** employer-convenience-meal disallowance genuinely doesn't reach any of TaxSnap's sole-prop users (it shouldn't, but a user with employees changes this).
3. **§280A "exclusive use" edge cases** — the regular-and-exclusive standard is strict and fact-specific; keep TaxSnap's role to logging, not advising on borderline home-office claims.
4. **§199A SSTB classification** — whether a given user's trade is an SSTB is a judgment call with real consequences above the threshold; defer to CPA.
5. **State conformity** — all of the above is *federal*. States vary on §179/§168(k) conformity and SE-tax-equivalents; out of V1 scope, but a known gap.

---

# Source Index

### Primary — statute & regulations (Cornell LII / eCFR)
- §162 — https://www.law.cornell.edu/uscode/text/26/162
- §164 (incl. §164(f)) — https://www.law.cornell.edu/uscode/text/26/164
- §179 — https://www.law.cornell.edu/uscode/text/26/179
- §195 — https://www.law.cornell.edu/uscode/text/26/195
- §199A — https://www.law.cornell.edu/uscode/text/26/199A
- §262 — https://www.law.cornell.edu/uscode/text/26/262 · Reg. §1.262-1 — https://www.law.cornell.edu/cfr/text/26/1.262-1
- §274 — https://www.law.cornell.edu/uscode/text/26/274 · Reg. §1.274-5 — https://www.law.cornell.edu/cfr/text/26/1.274-5
- §280A — https://www.law.cornell.edu/uscode/text/26/280A
- §280F — https://www.law.cornell.edu/uscode/text/26/280F
- §1401 — https://www.law.cornell.edu/uscode/text/26/1401
- §6001 — https://www.law.cornell.edu/uscode/text/26/6001 · Reg. §1.6001-1 — https://www.law.cornell.edu/cfr/text/26/1.6001-1
- §6654 — https://www.law.cornell.edu/uscode/text/26/6654

### Primary — official IRS / SSA (current-year figures & OBBBA)
- Rev. Proc. 2025-32 (TY2026 inflation items + OBBBA) — https://www.irs.gov/pub/irs-drop/rp-25-32.pdf
- Rev. Proc. 2026-15 (2026 auto depreciation caps) — https://www.irs.gov/pub/irs-drop/rp-26-15.pdf
- IRS Notice 2026-11 (bonus depreciation under OBBBA) — https://www.irs.gov/pub/irs-drop/n-26-11.pdf
- IRS — One Big Beautiful Bill provisions — https://www.irs.gov/newsroom/one-big-beautiful-bill-provisions
- IRS — TY2026 inflation adjustments incl. OBBBA — https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill
- IRS Topic 751 (SE tax rates) — https://www.irs.gov/taxtopics/tc751 · Additional Medicare Tax Q&A — https://www.irs.gov/businesses/small-businesses-self-employed/questions-and-answers-for-the-additional-medicare-tax
- IRS Topic 306 / Pub 505 (estimated tax) — https://www.irs.gov/taxtopics/tc306 · https://www.irs.gov/publications/p505
- SSA contribution & benefit base — https://www.ssa.gov/oact/cola/cbb.html

### Primary — IRS publications (secondary/explanatory)
- Pub 463 (travel, gift, car) — https://www.irs.gov/publications/p463
- Pub 587 (home office) — https://www.irs.gov/publications/p587
- Pub 535 / Pub 334 (business expenses) — https://www.irs.gov/publications/p334
- Pub 946 (depreciation) — https://www.irs.gov/publications/p946
- Schedule C instructions — https://www.irs.gov/instructions/i1040sc · Form 7206 instructions — https://www.irs.gov/instructions/i7206 · Form 4562 instructions — https://www.irs.gov/instructions/i4562

### Secondary — CPA / Big Four corroboration (not authority)
Grant Thornton, BDO, Moss Adams, RSM, Baker Tilly, KPMG, AICPA, Bloomberg Tax, CohnReznick, UHY, Journal of Accountancy, The Tax Adviser, Current Federal Tax Developments. Used only to corroborate primary figures; cite the primary source in user-facing contexts.

---

*Last researched: 2026-06-01. Method: two-pass multi-agent web research (broad fan-out with 3-vote adversarial verification + focused gap-verification), primary-source-first. Re-run the [Annual-Review Checklist](#annual-review-checklist-inflation-adjusted-figures) each tax year and after any major tax legislation.*
