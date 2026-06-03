# TSNAP-EPIC-9 — Year-End Tax Cleanup Mode

**Owner:** Priya Sharma + Raj Patel (engine) · Emma Larsson (dashboard)
**Effort:** ~6 hours
**Priority:** P2 (post-V1 — does NOT count against the 10-day MVP budget)
**Status:** First slice built 2026-06-02 (see JOURNAL DEC-028)

## Epic Description

A pre-filing review pass. Tally scans a tax year's receipts and surfaces gaps to
resolve **before** the user files: missing receipts, missing §274(d) context,
likely duplicates, mixed personal/business spend, and vague memos. It turns the
running record into a defensible one — the "missing-proof detection" differentiator
that's hard to copy because it depends on our taxonomy + substantiation logic, not OCR.

This is the feature that moves us from "expense tracker" to "defensible bookkeeping."

### Why this is post-V1, not V1

The 2-week MVP validates the core hypothesis (*will people text receipts?*). Cleanup
only has value once a user has a year of data to clean. It's the natural **second**
surface, built on flags V1 already stores. Pulling it into V1 would be scope creep
(Common Mistake #4). It ships after launch, when real users have accumulated records.

## Critical design decisions (DEC-028)

1. **Workflow, not agent.** Four of five checks are pure deterministic code reading
   fields we already store. Only vague-memo detection calls Claude. The code controls
   flow; the LLM is one bounded task. (Consistent with AGENTS-VS-WORKFLOWS.md + DEC-011.)
2. **Reuse the substantiation flags — never re-derive tax logic.** `needs_receipt`,
   `substantiation_complete`, and `substantiation_missing_fields` are already computed
   by the authoritative decision tree (`lib/substantiation.ts`). Cleanup READS them.
3. **Suggest, never advise** (CLAUDE.md #1). Every issue is a friendly nudge that
   points at a gap; the user resolves it on the receipt. Tally never auto-edits.
4. **"Documentation complete," never "audit-ready"** (CLAUDE.md #5). The Perplexity
   framing called this "audit-ready evidence" — we deliberately do NOT use that phrase.
5. **Deterministic scan is the backbone.** It runs with zero LLM calls and is fully
   unit-tested. The vague-memo Haiku pass is an additive, fail-safe layer (errors → []).

## The five checks

| Check | Source | Kind |
|-------|--------|------|
| `needs_receipt` | existing `needs_receipt` flag (over-$75 strict / lodging / gifts, no photo) | deterministic |
| `missing_context` | `substantiation_complete=false` + `substantiation_missing_fields` | deterministic |
| `duplicate` | same vendor (case-insensitive) + identical `amount_cents` + dates within 3 days | deterministic heuristic |
| `mixed_account` | business expense on `payment_account='personal'`; or `category='personal'` item | deterministic |
| `vague_memo` | memo/purpose present but too vague to substantiate ("misc", bare "lunch") | **Haiku LLM pass** |

## Architecture

```
GET /api/cleanup?year=YYYY&memo=0|1   (auth + org-scoped)
        │
        ▼
getReceiptsForYear(orgId, year)        ← lib/receipts.ts (org-scoped, date-bounded)
        │
        ▼
scanReceipts(receipts, year)           ← lib/cleanup.ts — PURE, deterministic, no I/O
        │   checkNeedsReceipt · checkMissingContext · checkDuplicates · checkMixedAccount
        │
        ▼ (only when memo=1)
scanWithMemoReview() → reviewVagueMemos(receipts)   ← Haiku, fail-safe (errors → [])
        │
        ▼
CleanupReport { tax_year, scanned_count, issues[], counts{} }
        │
        ▼
/dashboard/cleanup                     ← Server Component, groups issues, links to receipts
```

## Tickets

### TSNAP-090 — Cleanup scan engine ✅ DONE
- [x] `lib/cleanup.ts` with pure `scanReceipts(receipts, taxYear): CleanupReport`
- [x] Four deterministic checks, each pure `ReceiptRow[] -> CleanupIssue[]`
- [x] Issues sorted by resolve-priority; per-type `counts`
- [x] `lib/cleanup.test.ts` — 7 cases covering each check + ordering + clean books

### TSNAP-091 — Year data query ✅ DONE
- [x] `getReceiptsForYear(orgId, year)` in `lib/receipts.ts`, org-scoped, date-bounded

### TSNAP-092 — Vague-memo review (LLM layer) ✅ DONE
- [x] `reviewVagueMemos(receipts)` batches candidates (memo present) into one Haiku call
- [x] Fail-safe: any LLM/parse error → `[]`; empty candidates → no call
- [x] `scanWithMemoReview()` merges deterministic + memo issues

### TSNAP-093 — API route ✅ DONE
- [x] `GET /api/cleanup?year=&memo=` — auth, org-scoped, defaults to current year

### TSNAP-094 — Dashboard panel ✅ DONE
- [x] `/dashboard/cleanup` Server Component: grouped issues, counts, per-issue "Open" link
- [x] "Year-end cleanup" entry point on the dashboard
- [x] "Run deep scan (checks memos)" toggles `?memo=1`
- [x] EN/ES i18n under `t.app.cleanup`

### TSNAP-095 — Follow-ups
- [x] Year switcher UI — `getReceiptYears()` drives a pill row on `/dashboard/cleanup`
      (years the org has receipts in, newest first, always incl. current; preserves `memo`)
- [ ] "Resolve" affordances inline (e.g. one-tap "not a duplicate / delete dupe")
- [ ] Seasonal SMS nudge (Jan/Feb) — deferred; needs TCPA + DB-backed rate limit (cf. DEC-027)
- [ ] Gift $25-cap-per-recipient overage as a cleanup check (cross-ref TSNAP-030)
- [ ] Unit tests / eval for vague-memo precision (LLM layer currently untested)
- [ ] CPA spot-check of the duplicate window + mixed-account framing

## Acceptance criteria (epic)

- [x] Deterministic scan runs with zero LLM calls and is unit-tested
- [x] Vague-memo pass is additive and fails safe
- [x] Every issue links to the receipt; Tally never auto-edits
- [x] Copy is suggestive and uses "documentation complete"
- [x] Org-scoped throughout (DEC-001); `npm run build` + `npm run test` green
- [ ] Validated against a real year of beta-user data (post-launch)

## Files

- `src/lib/cleanup.ts` — scan engine (deterministic checks + memo layer)
- `src/lib/cleanup.test.ts` — deterministic-check unit tests
- `src/lib/receipts.ts` — `getReceiptsForYear()`, `getReceiptYears()` (switcher)
- `src/app/api/cleanup/route.ts` — scan endpoint
- `src/app/dashboard/cleanup/page.tsx` — dashboard panel
- `src/app/dashboard/page.tsx` — entry-point link
- `src/i18n/dictionaries.ts` — `t.app.cleanup` (EN/ES) + `dashboard.cleanupLink`
