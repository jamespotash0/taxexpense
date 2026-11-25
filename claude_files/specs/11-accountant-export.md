# Accountant-ready export: Schedule C summary + tabs (design, 2026-11-25)

**Status:** Design, awaiting founder approval. V1-sized (~1 day + CPA review).

## Why

Accountants for sole props want the number they type into the return first, then the detail behind
it. Today's export ([csv.ts](../../src/lib/csv.ts)) has strong rows (business purpose, attendees,
IRC section, documentation complete) but no Schedule C line and no totals, so the accountant still
has to build the summary by hand. That's the gap between "a CSV" and "my client's books are done".

## What accountants expect (in priority order)

1. **Summary by Schedule C line**, with meals shown at 50%.
2. **Transaction list**, one row per expense, scannable for anomalies.
3. **Receipts on request**: a link per row (exists), predictable file names.
4. **Personal / owner's draws separate**, so books reconcile to the bank.
5. Mileage as its own log (vehicle users). Out of scope here; see open questions.

Format preference: **Excel with tabs** > CSV > PDF summary > QuickBooks import (minority).

## Scope

- **Schedule C line mapping** per category (table below), in `categories.ts` next to the labels.
- **New column** `Schedule C Line` (e.g. `24b Meals`) in the standard CSV.
- **New column** `Source`: `Text`, `Photo`, later `Bank` (see [12-bank-feeds.md](12-bank-feeds.md)).
- **.xlsx export** with three tabs:
  - **Summary**: one row per Schedule C line: total, deductible total (meals 50%), count.
    Footer: "Prepared from Tally records. Not tax advice; your CPA makes the final call."
  - **Transactions**: today's CSV columns + the two new ones. Business only.
  - **Personal**: `personal` category rows (owner's draws / non-deductible), excluded from Summary.
- **Receipt file names** in any download: `YYYY-MM-DD_Vendor_Amount.jpg`.
- Existing CSV and QuickBooks CSV stay as they are (plus the two columns in the standard one).
- "Email my accountant" (EPIC-8) attaches the .xlsx instead of / alongside the CSV.

Non-goals: a PDF report, mileage logs, accountant portal (V3), direct QuickBooks sync (V3).

## Schedule C mapping (DRAFT: needs CPA spot-check before shipping)

| Category | Schedule C line | Note for CPA review |
|---|---|---|
| meals_business, meals_travel | 24b Deductible meals | 50% limit applied in Summary |
| travel_transportation, travel_lodging | 24a Travel | |
| vehicle_business | 9 Car and truck | Standard mileage vs actual: CPA's call |
| advertising | 8 Advertising | |
| insurance | 15 Insurance (other than health) | |
| professional_services | 17 Legal and professional | |
| office_supplies | 18 Office expense | Some CPAs use 22 Supplies |
| rent, venue_rental | 20b Rent: other business property | |
| repairs | 21 Repairs and maintenance | |
| internet_phone | 25 Utilities | Some CPAs use 27a |
| equipment | 13 Depreciation / §179 | Small items often expensed (22) under de minimis: confirm |
| home_office | 30 Business use of home | Form 8829 or simplified method |
| software, education, business_gifts, team_event, other_business | 27a Other expenses | Gifts: $25/person limit (§274(b)) |
| personal | Not on Schedule C | Personal tab only |

## Decisions to make

- **.xlsx library.** Needs a new dependency (`exceljs`); CSV can't do tabs. Alternative: a ZIP of
  three CSVs (no dependency, worse for accountants). Recommend `exceljs`.
- **Where the mapping lives.** Code constant in `categories.ts` (recommended; categories are already a
  closed code-side set, DEC-065) vs a column on `substantiation_rules`.

## Validation (before building)

1. Mock the .xlsx with 20 realistic rows; show it to 2-3 CPAs/EAs (15 min each): "what would you
   change before you'd use this for a Schedule C?"
2. CPA spot-check of the mapping table (ties into the open "CPA spot-check" item in CLAUDE.md).

## Tests

- Mapping covers every key in `ALLOWED_CATEGORIES` (fails if a category is added without a line).
- Summary totals equal the sum of Transactions rows; meals deductible = 50%.
- Personal rows never reach Summary or Transactions.

## Open questions

- Mileage log export for `vehicle_business` users (needed if they take standard mileage).
- Tax-year boundary: export by calendar year (default) with a date-range override.
