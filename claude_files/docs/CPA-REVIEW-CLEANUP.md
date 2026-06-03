# CPA Spot-Check Memo — Year-End Cleanup Heuristics (TSNAP-095)

**For:** a licensed CPA / EA reviewer
**Re:** the deterministic heuristics behind Tally's Year-End Cleanup Mode (TSNAP-EPIC-9)
**Status:** review deferred to post-launch per CLAUDE.md "Critical Open Items" #4 (CPA
spot-check when revenue justifies). This memo front-loads the specific questions so the
review is fast when it happens.

**Framing reminder for the reviewer:** Tally is an expense *logger* that SUGGESTS, never
advises (we say "documentation complete," never "audit-ready"). The cleanup scan flags
gaps for the user to resolve; it never files, never auto-edits, and always defers to a
professional. We're asking: *are these flags reasonable and non-misleading?* — not for
tax advice to end users.

---

## The five checks (what each one flags)

| Check | Rule it leans on | How we detect it |
|-------|------------------|------------------|
| `needs_receipt` | §274(d) + $75 documentary-evidence rule; lodging/gifts always | reuses the authoritative `needs_receipt` flag (already CPA-relevant logic) |
| `missing_context` | §274(d) contemporaneous records (purpose, attendees, relationship, miles) | reuses `substantiation_missing_fields` from the decision tree |
| `gift_cap` | **§274(b)(1)** — $25 deduction cap per recipient **per year** | sums all `business_gifts` to one recipient/year; flags if total > $25 |
| `duplicate` | n/a (data hygiene, not a tax rule) | same vendor + identical amount + dates within **3 days** |
| `mixed_account` | §162 ordinary-and-necessary; personal §262 not deductible | business expense on a personal card; or `category='personal'` items |

---

## Specific questions for the reviewer

### 1. Gift cap — aggregate framing (highest priority)
We apply the §274(b)(1) **$25/recipient/year** cap two ways: per-receipt (in the
substantiation engine) **and** as a year-end aggregate here (summing all gifts to one
named recipient). The cleanup message now reads (softened to suggest, not assert):
> "$40 in gifts to Dana Lee this year — the business-gift deduction is generally capped at
> $25 per recipient, so some of this may not count. (Imprinted items under $4 and
> promotional materials can be exempt — worth a quick check.)"

**Rule details we're working from** (please confirm each):
- **Cumulative, direct + indirect** to the same recipient within the tax year. ✔ matches
  our aggregate-by-recipient sum.
- **$4 de-minimis exception** — items ≤$4 with the taxpayer's name permanently imprinted,
  distributed generally, are exempt from the cap.
- **Promotional materials** (signs, display racks) for the recipient's premises aren't gifts.
- **Spouses** = one recipient.
- **Partnerships** apply the cap at the entity **and** each partner level.

**Questions:**
- **Q1a.** Is the $25/recipient/**year** cumulative aggregate the correct unit?
- **Q1b.** We **cannot detect** the $4-imprinted exception, promotional materials, or
  spouse-merging from our data ({amount, date, recipient name}). We therefore **sum gross
  and SUGGEST a review** rather than assert non-deductibility. Is that the right posture,
  or should we exclude individual line items ≤$4 from the sum by default (risking
  under-flagging real gifts)? Our lean: keep summing gross, keep the wording suggestive.
- **Q1c.** Incidental costs (engraving, packaging, shipping) are excludable under
  Reg. §1.274-3 — same gross-vs-net question as Q1b.
- **Q1d.** Partnership entity/partner rule — we treat as **out of V1 scope** (target is sole
  props / SMLLCs; multi-entity is Phase 3). Confirm that's a safe omission for V1.
- **Q1e.** The $25 figure is not inflation-indexed (unchanged since 1962) — confirm it's
  still $25 for the current tax year.

### 2. Duplicate window
We treat two same-vendor, same-exact-amount charges within **3 calendar days** as a
possible duplicate (one issue, user confirms or deletes).
- **Q2.** Is a 3-day window reasonable, or should it be same-day only (fewer false
  positives) or wider (catches delayed re-posts)? This is data hygiene, not a tax rule —
  we just don't want to nag on legitimate repeat purchases (e.g. daily parking, coffee).

### 3. Mixed personal/business framing
Two sub-cases, both worded as gentle confirmations, never assertions:
- Business expense paid from a **personal** account → "confirm the business purpose so
  it's clearly substantiated." (Deductibility is unaffected by which card paid — correct?)
- Item logged under `personal` (§262) → "won't be deducted; re-categorize if it was business."
- **Q3.** Any framing here that could mislead a sole-prop / SMLLC user, or imply something
  about commingling/“piercing the veil” we don't intend? (V1 users are sole props + SMLLCs.)

### 4. Anything missing?
- **Q4.** For this audience (Schedule C sole props / single-member LLCs, no accountant,
  mixed personal+business cards), is there a **common pre-filing gap we're NOT checking**
  that's cheap to detect from {vendor, amount, date, category, payment_account, miles,
  purpose, attendees}? (e.g. vehicle mileage without a contemporaneous log; meals at 50%;
  obviously-personal vendors miscategorized as business.)

---

## Out of scope for this memo
Tax-return positions, audit outcomes, state rules, entity-specific advice. We only want
confirmation the **flagging heuristics are reasonable and the user-facing wording is
non-misleading**. Findings get logged to JOURNAL and folded into `lib/cleanup.ts`.
