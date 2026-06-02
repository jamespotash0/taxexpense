-- TaxSnap — Seed: irc_summaries (TSNAP-006)
-- Source of truth: THIS FILE (the IRC-SUMMARIES.md doc holds the human-readable copy).
-- Sourcing / subsection detail / annual-review flags: claude_files/docs/IRC-RESEARCH.md.
--
-- 9 sections: the original 7 core + §274b (gifts) and §280F (vehicle/listed property),
-- added per DEC-009 so the `business_gifts` and `vehicle_business` rules resolve to
-- gift/vehicle content instead of mis-loading the meals / generic-§162 summaries.
--
-- These are the user-facing summaries the AI loads to cite the relevant code for a
-- categorized expense (SPEC.md: "Always pass relevant IRC summaries in the system prompt").
--
-- 2026 currency: figures reconciled to the One Big Beautiful Bill Act (P.L. 119-21,
-- July 2025). §179 was bumped to version 2 ($1.16M -> $2.5M/$4M + §168(k) 100% bonus).
-- Several figures are inflation-adjusted annually — see the IRC-RESEARCH.md
-- "Annual-Review Checklist" and bump version/last_reviewed when they change.
--
-- Idempotent: ON CONFLICT (section_id) upserts. Run after 0001_schema.sql.

INSERT INTO irc_summaries
  (section_id, title, short_summary, deduction_percentage, common_practice, worth_noting, source_url, last_reviewed, version)
VALUES

-- §162 General Business Expenses
(
  '162',
  'General Business Expenses',
  'The foundational tax code section that allows deduction of "ordinary and necessary" expenses paid or incurred during the tax year in carrying on any trade or business.',
  100,
  'Most business expenses fall under this section — supplies, software, marketing, professional services, business insurance, internet, business phone, advertising, professional development. The expense must be common in your line of work ("ordinary") and helpful to your business ("necessary"). It doesn''t have to be required.',
  'Personal expenses claimed as business expenses are a common reason deductions get disallowed. The expense must have a genuine business purpose, and keeping a record of what each one was for is what supports it.',
  'https://www.law.cornell.edu/uscode/text/26/162',
  DATE '2026-06-01',  -- literal review date; do NOT use CURRENT_DATE (re-running would falsely re-stamp every row)
  1
),

-- §262 Personal Expenses (Not Deductible)
(
  '262',
  'Personal Expenses (Not Deductible)',
  'Personal, living, or family expenses generally cannot be deducted as business expenses, even if you also use them for work.',
  0,
  'Common examples of expenses that are NOT deductible: regular clothing (even if worn at work), gym memberships (unless you''re a fitness professional), commuting from home to your office, personal meals eaten alone, entertainment for personal enjoyment.',
  'Mixed-use expenses (phone, internet, vehicle, home) can be partially deductible based on business-use percentage — but the personal portion is never deductible. The business-use percentage should reflect actual use and is commonly scrutinized, so a contemporaneous record of how it was calculated matters.',
  'https://www.law.cornell.edu/uscode/text/26/262',
  DATE '2026-06-01',  -- literal review date; do NOT use CURRENT_DATE (re-running would falsely re-stamp every row)
  1
),

-- §274 Business Meals
(
  '274',
  'Business Meals',
  'Business meals are generally 50% deductible. The meal must have a business purpose, a business contact must be present (not just yourself), and you must keep documentation of who attended and what was discussed.',
  50,
  'Most freelancers deduct: client lunches, networking meals, meals during business travel, working meals with potential clients or business partners. The IRS specifically requires documentation of: amount, time, place, business purpose, and business relationship to the person you ate with.',
  'Entertainment expenses (sports tickets, concerts, golf outings) are NOT deductible since the 2017 Tax Cuts and Jobs Act, even with clients present. Solo meals eaten alone while working are personal, not business. The $75 receipt rule isn''t meals-only: for strict categories (meals, travel, gifts) keep a receipt for any expense of $75 or more, and keep a receipt for lodging at any amount. Below $75, your written record — your text to us — can substantiate it.',
  'https://www.law.cornell.edu/uscode/text/26/274',
  DATE '2026-06-01',  -- literal review date; do NOT use CURRENT_DATE (re-running would falsely re-stamp every row)
  1
),

-- §274(b) Business Gifts
(
  '274b',
  'Business Gifts',
  'You can deduct business gifts, but only up to $25 per recipient per year. Anything you spend above $25 on the same person isn''t deductible.',
  100,
  'Client and referral gifts are deductible up to $25 per person, per year. Incidental branded items costing $4 or less (and shipping) don''t count toward the $25. Keep a record of who received the gift, the date, a short description, the amount, and the business reason.',
  'The $25 cap is per recipient for the whole year, so track a running total per person. Gifts follow the strict-substantiation rules (who, what, when, why). The $25 figure has been fixed since 1962 — it is not inflation-adjusted.',
  'https://www.law.cornell.edu/uscode/text/26/274',
  DATE '2026-06-01',
  1
),

-- §280A Home Office Deduction
(
  '280A',
  'Home Office Deduction',
  'If you use part of your home regularly and exclusively for business, you can deduct a portion of home-related expenses (rent, mortgage interest, utilities, insurance, repairs) proportional to the space used.',
  100,
  'The IRS offers two methods: (1) Simplified method — $5 per square foot up to 300 sq ft ($1,500 max). (2) Regular method — calculate the exact percentage of your home used for business and apply to actual expenses. Most freelancers use the simplified method for ease.',
  'The "exclusively for business" requirement is strict — the space must NOT be used for any personal purposes. A guest room that doubles as an office doesn''t qualify. A dedicated corner of a room counts if used only for work. Keep documentation of the space and how it''s used exclusively for business.',
  'https://www.law.cornell.edu/uscode/text/26/280A',
  DATE '2026-06-01',  -- literal review date; do NOT use CURRENT_DATE (re-running would falsely re-stamp every row)
  1
),

-- §280F Vehicle & Listed Property
(
  '280F',
  'Vehicle & Listed Property',
  'Vehicle expenses are deductible for the business-use portion of your driving. Because a car counts as ''listed property,'' the IRS requires a contemporaneous mileage log, and you must use the vehicle more than 50% for business to claim the larger write-offs.',
  100,
  'Most freelancers track business miles and deduct either the IRS standard mileage rate or actual costs (gas, insurance, repairs, depreciation) times their business-use percentage. Log the date, miles, and business purpose for each trip. If you own the vehicle, annual depreciation is capped by the "luxury auto" limits, which change every year.',
  'The mileage log IS the substantiation — without it, vehicle deductions are commonly disallowed. Commuting from home to a regular workplace is personal, not business. If business use drops to 50% or below, you lose accelerated depreciation and Section 179 for that vehicle. The annual depreciation caps are inflation-adjusted — re-verify each tax year (see IRC-RESEARCH.md).',
  'https://www.law.cornell.edu/uscode/text/26/280F',
  DATE '2026-06-01',
  1
),

-- §179 Section 179 Equipment Deduction (version 2 — OBBBA 2025 update)
(
  '179',
  'Section 179 Equipment Deduction',
  'Allows businesses to deduct the full purchase price of qualifying equipment and software in the year it was bought, rather than depreciating it over several years.',
  100,
  'Commonly used for: computers, cameras, professional equipment, business vehicles (with limits), software, office furniture, machinery. Under the One Big Beautiful Bill Act (2025), the annual limit is $2.5 million with a $4 million phase-out threshold (indexed for inflation from 2026) — most freelancers won''t approach this cap. Separately, §168(k) bonus depreciation is back to 100% (permanent) for qualifying property acquired and placed in service after Jan 19, 2025.',
  'The equipment must be used more than 50% for business. If you use it less than 100% for business, you can only deduct the business-use percentage. The item must be put into service during the tax year — buying it and storing it unused doesn''t qualify. The $2.5M/$4M figures are inflation-adjusted annually starting 2026.',
  'https://www.law.cornell.edu/uscode/text/26/179',
  DATE '2026-06-01',  -- literal review date; do NOT use CURRENT_DATE (re-running would falsely re-stamp every row)
  2
),

-- §1402 Self-Employment Tax
(
  '1402',
  'Self-Employment Tax',
  'Self-employed individuals pay both the employer and employee portions of Social Security and Medicare taxes — 15.3% total on net self-employment income (12.4% Social Security + 2.9% Medicare, with an additional 0.9% Medicare surtax on high earners).',
  0,
  'Self-employment tax applies to net earnings from self-employment over $400 annually. It''s calculated on Schedule SE and added to your regular income tax. The employer-equivalent half (7.65%) is deductible as an adjustment to income.',
  'Self-employment tax is one of the largest tax costs for self-employed people. At higher income levels, some people ask a CPA whether a different business structure would reduce it — but that''s a professional decision based on your specific situation, not a DIY move.',
  'https://www.law.cornell.edu/uscode/text/26/1402',
  DATE '2026-06-01',  -- literal review date; do NOT use CURRENT_DATE (re-running would falsely re-stamp every row)
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
  DATE '2026-06-01',  -- literal review date; do NOT use CURRENT_DATE (re-running would falsely re-stamp every row)
  1
)

ON CONFLICT (section_id) DO UPDATE SET
  title                = EXCLUDED.title,
  short_summary        = EXCLUDED.short_summary,
  deduction_percentage = EXCLUDED.deduction_percentage,
  common_practice      = EXCLUDED.common_practice,
  worth_noting         = EXCLUDED.worth_noting,
  source_url           = EXCLUDED.source_url,
  last_reviewed        = EXCLUDED.last_reviewed,
  version              = EXCLUDED.version;

-- Verify: 9 rows (162, 262, 274, 274b, 280A, 280F, 179, 1402, 6654).
--   SELECT section_id, title, version FROM irc_summaries ORDER BY section_id;
-- Coverage integrity — every section a rule cites must have a summary row (expect 0):
--   SELECT DISTINCT irc_section FROM substantiation_rules s
--   WHERE irc_section IS NOT NULL
--     AND NOT EXISTS (SELECT 1 FROM irc_summaries i WHERE i.section_id = s.irc_section);
