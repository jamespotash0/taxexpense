# Late Context Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A late detail ("that hotel was for the conference") lands on the expense the user meant, or Tally asks which one. Never dropped silently.

**Architecture:** `handleContextStatement` (router.ts) loads the last 10 receipts from 30 days. One candidate: apply it. Otherwise a Haiku picker returns one id or "not sure". "Not sure" sends a numbered list using the existing flag-choice pending pattern. Matches go through the existing `processCorrection`.

**Tech Stack:** Next.js 16 / TypeScript, Supabase, `@anthropic-ai/sdk` via `claudeJSON` (src/lib/llm.ts), node:test.

**Spec:** [late-context-matching.md](./late-context-matching.md)

## Global Constraints

- Model: `HAIKU_MODEL` from `src/lib/claude.ts` (effort low is applied automatically by llm.ts for haiku-5).
- Candidates: max 10 receipts, created in the last 30 days, org-scoped via `orgTable`.
- Bare "that one"/"it" means the latest receipt only if created in the last 2 hours.
- Ask list: Haiku's shortlist, else 5 most recent; max 5 lines; "Reply with a number."
- Any picker failure (error, timeout, bad JSON, id not in candidates) = no match = ask. Never guess.
- User-facing copy: no em dashes (enforced in `sendMessage`, but don't write them). One question per message.
- No DB migration (`context_state` is VARCHAR(50)).

## Review Focus

1. A bare number arrives while BOTH a flag list and a context list are pending: the newest outbound wins. (Task 3 test)
2. Haiku returns an id not in the candidates, or a shortlist with foreign ids: dropped, treated as no match. (Task 1 test)
3. Number out of range (e.g. "7" for a 3-item list): re-ask with the valid range, nothing applied. (Task 3 test)
4. Chosen receipt deleted between the ask and the reply: "that one's not there anymore" reply, nothing applied. (Task 3, covered by reusing the flag-choice guard shape)
5. Receipt with `vendor = null`: candidate line and list show "Unknown", not "null". (Task 1 test)

---

### Task 1: Pure helpers + recent-receipts query

**Files:**
- Create: `src/lib/context-match.ts`
- Create: `src/lib/context-match.test.ts`
- Modify: `src/lib/receipts.ts` (add after `getLatestReceiptSince`, ~line 152)

**Interfaces:**
- Produces:
  - `listRecentReceiptsSince(orgId: string, sinceIso: string, limit: number): Promise<ReceiptRow[]>` (receipts.ts; same query shape as `getLatestReceiptSince`, newest first)
  - `formatCandidateLine(r: ReceiptRow, now: Date): string` → `"<id> · <vendor|Unknown> · <formatMoney> · <category|uncategorized> · logged <N> min|hours|days ago"`
  - `validatePick(raw: unknown, candidateIds: string[]): { match: string | null; shortlist: string[] }`
  - `contextChoiceMessage(rows: ReceiptRow[]): string` → `"Which expense was that about?\n1) Marriott $230.00 Nov 22\n...\nReply with a number."` (uses `formatMoney`, `shortDate` from `./format`, same line shape as router.ts flag list)
  - `withExpenseName(reply: string, r: ReceiptRow): string` → prefixes `"<vendor> <money>: "` unless `reply` already contains the vendor (case-insensitive); returns reply unchanged when vendor is null.

- [ ] **Step 1: Write failing tests** in `context-match.test.ts`:
  - `validatePick: keeps a valid match` → `validatePick({match:'a'}, ['a','b'])` deep-equals `{match:'a', shortlist:[]}`
  - `validatePick: foreign id becomes no match` → `validatePick({match:'zzz', shortlist:['a','zzz']}, ['a','b'])` deep-equals `{match:null, shortlist:['a']}`
  - `validatePick: garbage input` → `validatePick('nope', ['a'])` and `validatePick(null, ['a'])` both `{match:null, shortlist:[]}`
  - `formatCandidateLine: null vendor shows Unknown` → line contains `· Unknown ·` and not `null`
  - `formatCandidateLine: age buckets` → created 30 min ago contains `30 min ago`; 5h ago `5 hours ago`; 3 days ago `3 days ago`
  - `contextChoiceMessage: numbered, max 5` → 7 rows in, output has `5)` and no `6)`, ends with `Reply with a number.`
  - `withExpenseName: prefixes when vendor missing from reply` / `no double name when present` / `unchanged when vendor null`
- [ ] **Step 2: Run** `npm test` → new tests FAIL (module not found).
- [ ] **Step 3: Implement** the four helpers in `context-match.ts` and `listRecentReceiptsSince` in receipts.ts.
- [ ] **Step 4: Run** `npm test` → all pass; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** `feat: helpers for matching late context to a past expense`

### Task 2: Haiku picker

**Files:**
- Modify: `src/lib/context-match.ts`

**Interfaces:**
- Consumes: `formatCandidateLine`, `validatePick` (Task 1); `claudeJSON` (llm.ts); `HAIKU_MODEL` (claude.ts); `log` (log.ts)
- Produces: `pickReceiptForContext(text: string, rows: ReceiptRow[], now?: Date): Promise<{ match: string | null; shortlist: string[] }>`

- [ ] **Step 1: Implement.** `CONTEXT_PICK_PROMPT` constant in the same file. It must state: return ONLY JSON `{"match": "<id>"}` or `{"match": null, "shortlist": ["<id>", ...]}`; pick only when exactly one expense plausibly fits; if two could fit, return null with both in the shortlist; a bare "that one"/"it" with no other reference means the most recent expense only if it was logged under 2 hours ago, else null; never invent ids. User text: the candidate lines, then `Message: <text>`. Call `claudeJSON` with `cacheSystem: true`, `maxTokens: 1024`. Pass the result through `validatePick`. Wrap in try/catch: on error log `context_pick_failed` (message only, no user text) and return `{match:null, shortlist:[]}`.
- [ ] **Step 2: Run** `npx tsc --noEmit` clean, `npm test` green (no new unit test: the logic is `validatePick`, already tested; behavior is covered by the Task 4 live eval).
- [ ] **Step 3: Commit** `feat: Haiku picker for which expense a late detail refers to`

### Task 3: Wire it into the router + numbered-reply resolution

**Files:**
- Modify: `src/lib/conversations.ts` (ContextState ~line 10, PendingData ~line 28, `getPendingFlagChoice` ~line 159)
- Modify: `src/lib/router.ts` (`handleContextStatement` ~line 425, add `resolveContextChoice` next to `resolveFlagChoice`)
- Modify: `src/lib/sms-handler.ts` (~line 573)
- Test: `src/lib/router.test.ts`, `src/lib/context-match.test.ts`

**Interfaces:**
- Consumes: Task 1 + Task 2 exports; `processCorrection(user, receiptId, text)` (expense.ts); `getReceipt` (receipts.ts)
- Produces:
  - ContextState gains `'awaiting_context_choice'`; PendingData gains `contextText?: string`
  - `getPendingFlagChoice` renamed to `getPendingChoice(userId: string): Promise<{ kind: 'flag' | 'context'; candidateIds: string[]; contextText?: string } | null>`: one query with `.in('context_state', ['awaiting_flag_choice','awaiting_context_choice'])`, newest outbound in the 24h window wins.
  - `pickPendingChoice(rows: Array<{context_state: string; pending_data: PendingData | null; created_at: string}>)` pure helper (in conversations.ts, exported) that `getPendingChoice` uses, so the "newest wins" rule is unit-testable.
  - `resolveContextChoice(user: AppUser, candidateIds: string[], contextText: string, choice: number): Promise<ProcessResult>` in router.ts

- [ ] **Step 1: Write failing tests:**
  - `pickPendingChoice: newest wins` → a context row newer than a flag row returns `kind:'context'` with its ids and `contextText`; swapped timestamps return `kind:'flag'`.
  - `pickPendingChoice: empty candidate list is null`.
  - `resolveContextChoice: out of range re-asks` (router.test.ts) → `resolveContextChoice(fakeUser, ['a','b'], 'x', 7)` resolves to `smsText` containing `1-2` and `receiptId: null` (the range check runs before any DB call).
- [ ] **Step 2: Run** `npm test` → FAIL.
- [ ] **Step 3: Implement:**
  - `handleContextStatement`: `rows = listRecentReceiptsSince(org, now-30d, 10)`. 0 rows → honest reply: `"I don't see a recent expense to add that to. Text me the expense with the detail (like \"$230 hotel, Austin conference\") and I'll log both."` + keep the `conversational_no_log` log. 1 row → apply. Else `pickReceiptForContext`; match → apply; no match → return `{ smsText: contextChoiceMessage(list), receiptId: null, contextState: 'awaiting_context_choice', pendingData: { candidateIds, contextText: text } }` where list = shortlist rows (in candidate order) if non-empty, else first 5 rows.
  - "Apply" = `processCorrection(user, id, text)`; if its `receiptId` is null fall through to the no-expense reply; else return it with `smsText: withExpenseName(smsText, row)`.
  - `resolveContextChoice`: same guards and copy as `resolveFlagChoice` (out of range → `"Reply with a number 1-N."`; missing receipt → `"Hmm, that one's not there anymore."`), then apply as above.
  - sms-handler: the bare-number branch calls `getPendingChoice`; `kind:'flag'` → `resolveFlagChoice`, `kind:'context'` → `resolveContextChoice(user, ids, contextText ?? '', n)`. Update the import.
  - Delete `CONTEXT_STATEMENT_WINDOW_MIN` and the `getLatestReceiptSince` import if now unused.
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit`, `npx eslint src/lib` → all clean.
- [ ] **Step 5: Commit** `feat: late context finds the right expense or asks which one`

### Task 4: Live eval + docs

**Files:**
- Create: `scripts/eval/context-match.ts`
- Modify: `package.json` (add `"eval:context": "node --import tsx --env-file=.env.local scripts/eval/context-match.ts"`)
- Modify: `claude_files/docs/JOURNAL.md`, `claude_files/docs/STATE.md`

**Interfaces:**
- Consumes: `pickReceiptForContext` (Task 2). Builds fake `ReceiptRow` objects in the script (no DB).

- [ ] **Step 1: Write the eval** (follow `scripts/eval/intent.ts` style: case table, paced ~1400ms, markdown report, headline %). Cases, `expect` = receipt key or `ASK`:
  1. "that hotel was for the conference" with [Marriott hotel 2d ago, Starbucks 1h ago, Uber 3h ago] → Marriott
  2. same message with [Marriott 2d ago, Hilton 5d ago, Starbucks 1h] → ASK, shortlist ⊇ both hotels
  3. "that one was personal" with [Starbucks 20 min ago, Marriott 2d ago] → Starbucks
  4. "that one was personal" with [Starbucks 5h ago, Marriott 2d ago] → ASK
  5. "dinner with Sarah was about the Q3 deal" with [Nopa dinner $84 1d ago, Shell gas 2h ago] → Nopa
  6. "the $18 one was to the airport" with [Uber $18 3d ago, Lyft $22 1d ago] → Uber
  7. "the Austin trip one was for a client" with [Marriott Austin 2d ago, Delta 2d ago, Staples 1h ago] → ASK (two Austin-trip expenses)
  8. "the gym membership is for a client" with [Starbucks 1h, Shell 1d] → ASK, empty or no shortlist match
- [ ] **Step 2: Run** `npm run eval:context` (needs a valid `ANTHROPIC_API_KEY` in .env.local) with `HAIKU_MODEL=claude-haiku-5-5`. Target: 8/8; every ASK case must ASK (a wrong confident pick is the failure that matters). If an ASK case picks, tighten the prompt and rerun.
- [ ] **Step 3: Docs.** JOURNAL: new DEC "Late context finds the right expense or asks" (problem: silent drop after 2h + wrong attach within 2h; approach B chosen by founder; eval result) plus a post-V1 idea line "Trip memory: 'I'm in Austin this week' pre-fills purpose on later receipts". STATE: one line under Recently shipped.
- [ ] **Step 4: Commit** `eval + docs: late context matching`
