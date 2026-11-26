-- Tally: five more categories so common Schedule C lines stop landing in the catch-all (DEC-108).
--
--   platform_fees    §162   Schedule C line 10 (commissions & fees): Stripe, PayPal, Etsy, Upwork
--   taxes_licenses   §164   line 23: business licenses, permits, LLC annual fees
--   interest         §163   line 16: business loan / business share of card interest
--   dues_memberships §162   professional + trade orgs (club dues excluded, §274(a)(3))
--   health_insurance §162(l) NOT Schedule C: Schedule 1 above-the-line deduction. Split out of
--                           `insurance` so the export puts it on the right line.
--
-- New summaries: §164, §163, §162l. CPA-flagged like the rest of irc_summaries.
-- Run in the Supabase SQL editor. Idempotent (ON CONFLICT upserts).

INSERT INTO substantiation_rules
  (category, irc_section, substantiation_level, receipt_threshold_cents, always_receipt, required_context_fields, deduction_percentage, deduction_cap_cents)
VALUES
  ('platform_fees',    '162',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('taxes_licenses',   '164',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('interest',         '163',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('dues_memberships', '162',  'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL),
  ('health_insurance', '162l', 'general', NULL, FALSE, ARRAY[]::TEXT[], 100, NULL)
ON CONFLICT (category) DO UPDATE SET
  irc_section             = EXCLUDED.irc_section,
  substantiation_level    = EXCLUDED.substantiation_level,
  receipt_threshold_cents = EXCLUDED.receipt_threshold_cents,
  always_receipt          = EXCLUDED.always_receipt,
  required_context_fields = EXCLUDED.required_context_fields,
  deduction_percentage    = EXCLUDED.deduction_percentage,
  deduction_cap_cents     = EXCLUDED.deduction_cap_cents;

INSERT INTO irc_summaries
  (section_id, title, short_summary, deduction_percentage, common_practice, worth_noting, source_url, last_reviewed, version)
VALUES
(
  '164',
  'Business Taxes & Licenses',
  'Taxes and license fees you pay because you run a business are generally deductible as a business expense.',
  100,
  'Common examples: a city or county business license, professional or trade licenses, permits, your state''s annual LLC or franchise fee, and property tax on property used in the business. Sales tax on something you buy for the business is usually treated as part of that item''s cost.',
  'Federal income tax is never deductible, and state income tax isn''t a business expense either. Self-employment tax works differently: half of it is deducted on your personal return, not as a business expense. Fines and penalties, including late fees from a government agency, are generally not deductible.',
  'https://www.law.cornell.edu/uscode/text/26/164',
  DATE '2026-11-26',
  1
),
(
  '163',
  'Business Interest',
  'Interest on money you borrowed for the business is generally deductible. Interest on personal debt is not.',
  100,
  'Common examples: interest on a business loan or line of credit, interest on a card you use only for the business, and the business-use share of interest on a car loan. What counts is what the borrowed money paid for, not which card or account it came from.',
  'If one credit card carries both business and personal charges, only the interest on the business charges is deductible, so keeping business spending on a separate card makes this much easier. Interest on a home mortgage is handled through the home office rules, not here.',
  'https://www.law.cornell.edu/uscode/text/26/163',
  DATE '2026-11-26',
  1
),
(
  '162l',
  'Self-Employed Health Insurance',
  'If you''re self-employed, premiums for health, dental, and qualified long-term care insurance for you, your spouse, and your dependents are generally deductible.',
  100,
  'This deduction goes on your personal return (Schedule 1), not on your business''s Schedule C. It lowers your income tax but not your self-employment tax. Medicare premiums can count. Children under 27 at year end can be covered even if they aren''t dependents.',
  'Two limits matter: the deduction can''t be more than your business''s net profit, and it doesn''t apply for any month you were eligible for an employer-subsidized health plan through your own job or your spouse''s. Marketplace plans with a premium tax credit need extra care. Check with a tax professional for your situation.',
  'https://www.law.cornell.edu/uscode/text/26/162',
  DATE '2026-11-26',
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

-- Coverage check (expect 0): every rule's irc_section must have a summary.
--   SELECT DISTINCT irc_section FROM substantiation_rules s WHERE irc_section IS NOT NULL
--     AND NOT EXISTS (SELECT 1 FROM irc_summaries i WHERE i.section_id = s.irc_section);
