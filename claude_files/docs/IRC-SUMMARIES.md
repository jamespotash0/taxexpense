# TaxSnap — Core IRC Code Summaries

These are the 7 IRC sections that cover ~90% of common self-employed business expenses. Pre-load these into the `irc_summaries` table.

**IMPORTANT:** These summaries are AI-assisted drafts. Before launch:
1. Review against IRS source publications
2. Consider getting a CPA spot-check
3. Apply standard disclaimer language

---

## §162 — Ordinary and Necessary Business Expenses

**section_id:** `162`

**title:** General Business Expenses

**short_summary:** The foundational tax code section that allows deduction of "ordinary and necessary" expenses paid or incurred during the tax year in carrying on any trade or business.

**deduction_percentage:** 100

**common_practice:** Most business expenses fall under this section — supplies, software, marketing, professional services, business insurance, internet, business phone, advertising, professional development. The expense must be common in your line of work ("ordinary") and helpful to your business ("necessary"). It doesn't have to be required.

**worth_noting:** Personal expenses dressed up as business expenses are the #1 audit trigger. The expense must have a genuine business purpose. Keep documentation of what each expense was for.

**source_url:** https://www.law.cornell.edu/uscode/text/26/162

---

## §262 — Personal Expenses (Not Deductible)

**section_id:** `262`

**title:** Personal Expenses (Not Deductible)

**short_summary:** Personal, living, or family expenses generally cannot be deducted as business expenses, even if you also use them for work.

**deduction_percentage:** 0

**common_practice:** Common examples of expenses that are NOT deductible: regular clothing (even if worn at work), gym memberships (unless you're a fitness professional), commuting from home to your office, personal meals eaten alone, entertainment for personal enjoyment.

**worth_noting:** Mixed-use expenses (phone, internet, vehicle, home) can be partially deductible based on business-use percentage — but the personal portion is never deductible. Be honest about percentages; this is heavily scrutinized.

**source_url:** https://www.law.cornell.edu/uscode/text/26/262

---

## §274 — Meals and Entertainment

**section_id:** `274`

**title:** Business Meals

**short_summary:** Business meals are generally 50% deductible. The meal must have a business purpose, a business contact must be present (not just yourself), and you must keep documentation of who attended and what was discussed.

**deduction_percentage:** 50

**common_practice:** Most freelancers deduct: client lunches, networking meals, meals during business travel, working meals with potential clients or business partners. The IRS specifically requires documentation of: amount, time, place, business purpose, and business relationship to the person you ate with.

**worth_noting:** Entertainment expenses (sports tickets, concerts, golf outings) are NOT deductible since the 2017 Tax Cuts and Jobs Act, even with clients present. Solo meals eaten alone while working are personal, not business. Meals over $75 require receipt documentation.

**source_url:** https://www.law.cornell.edu/uscode/text/26/274

---

## §280A — Home Office Deduction

**section_id:** `280A`

**title:** Home Office Deduction

**short_summary:** If you use part of your home regularly and exclusively for business, you can deduct a portion of home-related expenses (rent, mortgage interest, utilities, insurance, repairs) proportional to the space used.

**deduction_percentage:** 100

**common_practice:** The IRS offers two methods: (1) Simplified method — $5 per square foot up to 300 sq ft ($1,500 max). (2) Regular method — calculate the exact percentage of your home used for business and apply to actual expenses. Most freelancers use the simplified method for ease.

**worth_noting:** The "exclusively for business" requirement is strict — the space must NOT be used for any personal purposes. A guest room that doubles as an office doesn't qualify. A dedicated corner of a room counts if used only for work. Home office deduction is an audit-attention magnet, so documentation matters.

**source_url:** https://www.law.cornell.edu/uscode/text/26/280A

---

## §179 — Immediate Equipment Deduction

**section_id:** `179`

**title:** Section 179 Equipment Deduction

**short_summary:** Allows businesses to deduct the full purchase price of qualifying equipment and software in the year it was bought, rather than depreciating it over several years.

**deduction_percentage:** 100

**common_practice:** Commonly used for: computers, cameras, professional equipment, business vehicles (with limits), software, office furniture, machinery. As of 2024 the limit was $1.16 million annually — most freelancers won't approach this cap.

**worth_noting:** The equipment must be used more than 50% for business. If you use it less than 100% for business, you can only deduct the business-use percentage. The item must be put into service during the tax year — buying it and storing it unused doesn't qualify.

**source_url:** https://www.law.cornell.edu/uscode/text/26/179

---

## §1402 — Self-Employment Tax

**section_id:** `1402`

**title:** Self-Employment Tax

**short_summary:** Self-employed individuals pay both the employer and employee portions of Social Security and Medicare taxes — 15.3% total on net self-employment income (12.4% Social Security + 2.9% Medicare, with an additional 0.9% Medicare surtax on high earners).

**deduction_percentage:** 0

**common_practice:** Self-employment tax applies to net earnings from self-employment over $400 annually. It's calculated on Schedule SE and added to your regular income tax. The employer-equivalent half (7.65%) is deductible as an adjustment to income.

**worth_noting:** This is why S-Corp elections become attractive at higher income levels — they can reduce the self-employment tax burden by allowing income to be split between salary (subject to SE tax) and distributions (not subject to SE tax). This is a CPA conversation, not a DIY decision.

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

## SQL Insert Script (Ready to Run)

This is the complete, ready-to-execute insert. Used by `tickets/01-foundation.md#TSNAP-006`.

```sql
INSERT INTO irc_summaries (
  section_id, 
  title, 
  short_summary, 
  deduction_percentage, 
  common_practice, 
  worth_noting, 
  source_url, 
  last_reviewed, 
  version
) VALUES

-- §162 General Business Expenses
(
  '162',
  'General Business Expenses',
  'The foundational tax code section that allows deduction of "ordinary and necessary" expenses paid or incurred during the tax year in carrying on any trade or business.',
  100,
  'Most business expenses fall under this section — supplies, software, marketing, professional services, business insurance, internet, business phone, advertising, professional development. The expense must be common in your line of work ("ordinary") and helpful to your business ("necessary"). It doesn''t have to be required.',
  'Personal expenses dressed up as business expenses are the #1 audit trigger. The expense must have a genuine business purpose. Keep documentation of what each expense was for.',
  'https://www.law.cornell.edu/uscode/text/26/162',
  CURRENT_DATE,
  1
),

-- §262 Personal Expenses
(
  '262',
  'Personal Expenses (Not Deductible)',
  'Personal, living, or family expenses generally cannot be deducted as business expenses, even if you also use them for work.',
  0,
  'Common examples of expenses that are NOT deductible: regular clothing (even if worn at work), gym memberships (unless you''re a fitness professional), commuting from home to your office, personal meals eaten alone, entertainment for personal enjoyment.',
  'Mixed-use expenses (phone, internet, vehicle, home) can be partially deductible based on business-use percentage — but the personal portion is never deductible. Be honest about percentages; this is heavily scrutinized.',
  'https://www.law.cornell.edu/uscode/text/26/262',
  CURRENT_DATE,
  1
),

-- §274 Business Meals
(
  '274',
  'Business Meals',
  'Business meals are generally 50% deductible. The meal must have a business purpose, a business contact must be present (not just yourself), and you must keep documentation of who attended and what was discussed.',
  50,
  'Most freelancers deduct: client lunches, networking meals, meals during business travel, working meals with potential clients or business partners. The IRS specifically requires documentation of: amount, time, place, business purpose, and business relationship to the person you ate with.',
  'Entertainment expenses (sports tickets, concerts, golf outings) are NOT deductible since the 2017 Tax Cuts and Jobs Act, even with clients present. Solo meals eaten alone while working are personal, not business. Meals over $75 require receipt documentation.',
  'https://www.law.cornell.edu/uscode/text/26/274',
  CURRENT_DATE,
  1
),

-- §280A Home Office Deduction
(
  '280A',
  'Home Office Deduction',
  'If you use part of your home regularly and exclusively for business, you can deduct a portion of home-related expenses (rent, mortgage interest, utilities, insurance, repairs) proportional to the space used.',
  100,
  'The IRS offers two methods: (1) Simplified method — $5 per square foot up to 300 sq ft ($1,500 max). (2) Regular method — calculate the exact percentage of your home used for business and apply to actual expenses. Most freelancers use the simplified method for ease.',
  'The "exclusively for business" requirement is strict — the space must NOT be used for any personal purposes. A guest room that doubles as an office doesn''t qualify. A dedicated corner of a room counts if used only for work. Home office deduction is an audit-attention magnet, so documentation matters.',
  'https://www.law.cornell.edu/uscode/text/26/280A',
  CURRENT_DATE,
  1
),

-- §179 Section 179 Equipment Deduction
(
  '179',
  'Section 179 Equipment Deduction',
  'Allows businesses to deduct the full purchase price of qualifying equipment and software in the year it was bought, rather than depreciating it over several years.',
  100,
  'Commonly used for: computers, cameras, professional equipment, business vehicles (with limits), software, office furniture, machinery. As of 2024 the limit was $1.16 million annually — most freelancers won''t approach this cap.',
  'The equipment must be used more than 50% for business. If you use it less than 100% for business, you can only deduct the business-use percentage. The item must be put into service during the tax year — buying it and storing it unused doesn''t qualify.',
  'https://www.law.cornell.edu/uscode/text/26/179',
  CURRENT_DATE,
  1
),

-- §1402 Self-Employment Tax
(
  '1402',
  'Self-Employment Tax',
  'Self-employed individuals pay both the employer and employee portions of Social Security and Medicare taxes — 15.3% total on net self-employment income (12.4% Social Security + 2.9% Medicare, with an additional 0.9% Medicare surtax on high earners).',
  0,
  'Self-employment tax applies to net earnings from self-employment over $400 annually. It''s calculated on Schedule SE and added to your regular income tax. The employer-equivalent half (7.65%) is deductible as an adjustment to income.',
  'This is why S-Corp elections become attractive at higher income levels — they can reduce the self-employment tax burden by allowing income to be split between salary (subject to SE tax) and distributions (not subject to SE tax). This is a CPA conversation, not a DIY decision.',
  'https://www.law.cornell.edu/uscode/text/26/1402',
  CURRENT_DATE,
  1
),

-- §6654 Estimated Quarterly Tax Payments
(
  '6654',
  'Estimated Quarterly Tax Payments',
  'Self-employed individuals are generally required to make estimated tax payments four times per year if they expect to owe $1,000 or more in taxes for the year.',
  0,
  'Quarterly payment deadlines are typically: April 15 (Q1), June 15 (Q2), September 15 (Q3), and January 15 of the following year (Q4). Most freelancers calculate quarterly payments based on either: (1) 100% of prior year''s tax liability, or (2) 90% of current year''s expected liability.',
  'Underpayment penalties apply if you don''t pay enough throughout the year. The "safe harbor" rule says you generally won''t be penalized if you pay either 100% of last year''s tax (110% if your AGI was over $150K) or 90% of this year''s tax, whichever is less.',
  'https://www.law.cornell.edu/uscode/text/26/6654',
  CURRENT_DATE,
  1
);
```

## How to Run This

In the Supabase SQL Editor:

1. Make sure the `irc_summaries` table exists (created in TSNAP-005)
2. Paste the entire INSERT statement above
3. Execute
4. Verify: `SELECT section_id, title FROM irc_summaries ORDER BY section_id;`

Should return 7 rows.

## Updating IRC Summaries Later

These summaries should be reviewed annually (or after major tax law changes):

```sql
UPDATE irc_summaries 
SET 
  short_summary = '...',
  common_practice = '...',
  worth_noting = '...',
  last_reviewed = CURRENT_DATE,
  version = version + 1
WHERE section_id = '274';
```

Incrementing the version field lets us track when summaries change.
