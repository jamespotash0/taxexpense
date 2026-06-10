# Spec 09 — Business Profile → Profession-Aware Categorization (POST-V1)

> **Status:** Piece 1 **SHIPPED** 2026-06-10 (see STATE.md). Piece 2 (inventory/COGS) DEFERRED.
> Implementation: migration `0029_business_profile.sql`, `src/lib/businessProfile.ts`,
> `BUSINESS_PROFILE_BUILDER_PROMPT` in `prompts.ts`, `userContextLine` in `categorize.ts`,
> `ensureBusinessProfile` wired in `sms-handler.ts`. Still needs a JOURNAL DEC number (founder).
> **Owner personas to load:** marcus (positioning), priya (edge cases), raj (schema),
> jordan (compliance/liability), alex (devil's advocate).

## Problem

Today the engine is profession-blind. `users.business_type` is collected at onboarding
and injected into the Haiku prompt as a string (`src/lib/prompts.ts` —
`CATEGORIZATION_HELPER_PROMPT` / `TEXT_PARSE_CATEGORIZE_PROMPT`), but **no logic branches
on it**. Every user — realtor, consultant, watch reseller, barber — gets the identical 21
categories (`src/lib/categories.ts`) and the identical substantiation tree
(`src/lib/substantiation.ts`). The contextual capture ("the WHY") is generic.

This leaves money and accuracy on the table for higher-value verticals (real estate agents,
contractors, resellers, makers) whose deductions are profession-specific and whom a generic
engine — including competitors like Keeper — systematically under-serves.

## Core insight: the same receipt categorizes differently by business

| "$400 watch" texted by… | Correct treatment | Today's engine |
|---|---|---|
| Consultant | `business_gifts` (capped at $25 deductible) or personal | guesses gift/personal |
| Watch reseller | **inventory / COGS** (deduct when sold) | no such category |
| Watch repair shop | tool/`equipment` or a part | guesses equipment |
| Photographer | personal | may force-fit |

Business type is not a cosmetic label — it's a **prior** that should shift categorization,
and in some cases **unlock categories that don't currently exist**.

## Two distinct pieces of work (do not conflate)

### Piece 1 — Business profile as a categorization prior (the easy 80%)

Onboarding asks 1–2 plain-English questions ("What's your business? What do you sell or
do?"). An LLM call converts the answers into a **structured business profile** stored on the
user, e.g.:

```
business_profile = {
  industry: "real_estate_agent",        // canonical slug
  sells_product: false,                  // service vs product business
  holds_inventory: false,
  common_categories: ["vehicle_business","advertising","education","business_gifts","home_office"],
  synonyms: { "MLS": "professional_services", "desk fee": "professional_services",
              "E&O": "insurance", "staging": "advertising", "lockbox": "office_supplies" },
  notes_for_categorizer: "Real estate agent (1099). Mileage between showings is common and
    deductible; brokerage/MLS/desk fees are ordinary business expenses; staging and listing
    marketing are advertising."
}
```

The profile is injected into the categorization prompt as a prior + synonym map. No schema
upheaval, no new tax primitives. Realtor becomes one profile among many. This is additive
and consistent with the "AI workflow, not agent" architecture — code still controls flow;
the profile is just better context handed to a per-task Claude call.

**Worked example — real estate agent.** Activates the realtor synonym map above so MLS/desk
fees stop landing in the `other_business` drift bucket, staging/sign installs map to
`advertising`, and mileage between showings is recognized as the dominant pattern. (Replaces
the earlier "realtor vertical" sketch — realtor is now just the first profile.)

### Piece 2 — The inventory / COGS primitive — DEFERRED (out of scope, founder 2026-06-10)

> **Decision:** leave inventory/COGS out for now. The §471 seed migration that was drafted
> (`0029_seed_irc_inventory_cogs.sql`) has been **removed**; no `inventory_cogs` category,
> substantiation rule, schema field, or prompt taxonomy entry ships. Piece 1 proceeds without
> it. Re-open only if an inventory-business segment becomes a deliberate target.

The watch-reseller case is **not solvable by Piece 1 alone**. All current categories are
either immediate deductions (§162 / §179 / §280A) or `personal`; there is no concept of
inventory / Cost of Goods Sold (§471 / §263A), which is recovered *when the item sells*, not
when purchased. Representing it correctly would need a timing/cost-recovery field
(`deduction_percentage` encodes *how much*, not *when*).

**Why deferred — the structural mismatch (the deciding reason):** COGS depends on
year-end ending inventory (Schedule C Part III: beginning + purchases − ending = COGS), which
in turn depends on **what sold**. Tally captures *expenses* (money out); a sale is *revenue*
(money in) — the side of the ledger the product deliberately never touches. So Tally
structurally cannot know what sold, and the only honest options are a single year-end
inventory question or punting the ending-inventory count to the user's CPA. Per-sale tracking
would turn an effortless WHY-capture logger into inventory-management/bookkeeping software —
out of lane. Not worth the complexity until/unless inventory businesses are a chosen segment.

**Verified facts (kept for whenever this re-opens; WebSearch, Rev. Proc. 2025-32; Cornell LII §471/§448):**
- §448(c) gross-receipts threshold is inflation-indexed: **$32M for 2026** (§4.30), $31M 2025,
  base $25M (TCJA). Re-verify annually.
- Effectively every Tally user would qualify as a §471(c) small-business taxpayer → simplified
  NIMS method (cost recovered via COGS in the *later of* paid vs sold/used), not the general
  §471(a) inventory regime.
- This is judgment-heavy (method choice, §263A UNICAP, cash-vs-accrual) → CPA-gated content,
  never auto-applied — another reason it doesn't fit the "log it and move on" model today.

## Guardrails (keep inside stated product values)

1. **Suggest, don't advise** (rule 1). The profile shifts the *suggestion*; it still cites
   IRC and the user can override (rule 6).
2. **Confirm-don't-assume on high-stakes flips.** When the profile would move a receipt into
   a materially different treatment (e.g. a capped `business_gifts`, or flipping something to
   `personal`), ask one confirming question rather than silently re-classifying.
3. **Wrong-profile risk (Alex).** A bad/over-applied profile miscategorizes *systematically*
   — worse than a generic engine that's randomly wrong. Mitigations: confidence on the
   profile itself; an easy "that's not my business" correction that **updates the profile**;
   log profile-driven overrides for eval.
4. **One business per user** (consistent with current no-multi-entity V1 assumption). Side
   hustles / mixed activity are out of scope until multi-entity lands.
5. **Compliance gate (Jordan).** Anything touching inventory accounting method, depreciation
   beyond §179, or §199A stays confirm/defer-to-CPA, not auto-applied.

## Open decisions (for founder + JOURNAL DEC)

1. **Inference aggressiveness:** how strongly does the profile override the base categorizer?
   (soft prior vs hard synonym remap vs confirm-each-flip)
2. ~~Is `inventory_cogs` in scope~~ — **DEFERRED** (see Piece 2). Inventory/COGS is out of
   scope; this spec is now Piece 1 only.
3. **Profile build:** LLM-from-freetext at onboarding vs a curated industry picker vs hybrid.
4. **Eval impact:** profession-aware categorization needs profession-tagged eval cases or the
   existing categorization eval will under-measure it.

## Why this matters strategically (Marcus)

This generalizes the "real estate vertical" idea into a reusable mechanism: one engine, many
profession profiles. It raises per-user value (profession-specific accuracy competitors miss)
without forking the codebase per vertical, and it leans directly on the moat we already
built — real-time WHY capture — by making the WHY profession-aware.
