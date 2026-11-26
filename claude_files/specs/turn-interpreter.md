# Turn Interpreter: one context-aware decision per inbound text

Status: design APPROVED by founder (2026-11-25). Approach A chosen by founder.

## Why

Real texting is messy and unpredictable. Today every inbound text runs a fixed chain of ~8 checks
in `handleExpenseFlow` (sms-handler.ts) and `routeTextMessage` (router.ts): regexes
(`replyStartsNewExpense`, `looksLikeCorrection`, `CONFIRM_RE`, `NO_RECEIPT_RE`, `EXPLAIN_RE`), time
windows (15-min correction window, 15-min pending amount, 24h pending question), pending-state
checks, then a Haiku classifier that sees the text ALONE, then a Haiku picker for "which expense".
Each piece sees a fragment, so each guesses. Three bugs on 2026-11-25 each slipped through a
different piece:

- "48 tools home depot" applied as a correction to an answered grocery "Quick check" (stale state).
- "Log as business expense" after Netflix applied to the older Optimum receipt (state + no context).
- "Log as business expense" / "business" classified as `help`; "its for business" picked the wrong
  expense (classifier and picker saw no conversation).

Patching each gap moves the failure to the next odd text. The fix is to decide "what is this text,
and what is it about?" ONCE, with the recent conversation in view.

## Goals

1. Each non-photo inbound text gets one structured decision from Haiku that sees: the last few
   messages, the open question (if any), and the user's recent expenses.
2. The decision names the action AND the target expense (by id from the list we offered).
3. Code then calls the EXISTING handlers. Tax facts, categorization, substantiation, and reply
   wording are unchanged (still decided in code / existing prompts).
4. Delete the routing regexes and time windows the decision replaces.
5. No slowdown for the common case: an obvious "$30 gas" with nothing open skips the model.
6. Regression-proof via a replay eval built from real conversations.

## Non-goals

- Changing categorization, substantiation, compose, correction, or clarification prompts.
- The photo path (OCR, attach-to-receipt, caption). Photos keep today's flow. (Later, maybe.)
- Splitting files. That's a separate, mechanical follow-up once this lands (see "After").
- Onboarding flow, edits (`handleInboundEdit`), cron nudges.

## Anti-goals (a failure even if it "works")

- The model writing data or tax facts. It only routes; it never sets category, amount, or IRC.
- More questions to the user. The decision tree still decides when we ask.
- A slower reply on plain expense texts.
- Conversation history becoming an injection channel. History and expense lines are quoted as
  data, never instructions; the receipt id must come from the offered list or it's discarded.
- Silent wrong-target edits. When the model isn't sure which expense, we ask "Which expense was that
  about?" (existing numbered list), same as today.

## Approaches considered

- **A. One decision with context, existing handlers unchanged (CHOSEN).** Medium change; keeps every
  working handler; deletes most rules. Founder picked it.
- B. Rewrite the whole conversation flow + split files together. Cleanest end state, highest risk,
  hard to tell which part broke something.
- C. Only call the model at ambiguous moments (open question + no "$"). Smallest, but keeps the
  fragment-based patchwork, so new gaps keep appearing.

## Design

### Where it sits

In `handleExpenseFlow`, after the photo branch and before everything else on the text path:

```
text in
  → deterministic fast paths (kept, no model):
      • bare digit 1-9 AND a numbered list is open → resolve that list (existing)
      • bare yes/no AND a yes/no question is open (verify, recurring opt-in, renewal) → existing handler
      • "flag for my CPA", agent-name messages → existing
      • obvious capture ($ or miles, not a question) AND no open question AND no expense logged
        in the last 15 min → capture (skips the model)
  → interpretTurn(user, text, context)  ← ONE Haiku call
  → dispatch on decision.action to existing handlers
```

### Decision shape (structured output, validated in code)

```
{
  action: "new_expense" | "edit_expense" | "answer_open_question" | "query" | "command"
        | "advice" | "help" | "capability" | "explain_why" | "receipt_resolution" | "other",
  receipt_id: string | null,       // only for edit_expense; must be one of the offered ids
  candidates: string[],            // when unsure which expense; offered ids only
  answer: "affirm" | "decline" | "detail" | null,  // for answer_open_question (see below)
  query/command/resolution fields  // same shapes as today's Intent (router.ts)
}
```

`answer` exists because non-bare confirmations ("looks good", "sure, track it", "no thanks") must not
be sent to the correction prompt as edits. (Builder-check Q1; call: Claude.)

### What counts as "open" (call: Claude)

"Open" for both the fast-path gate and the model context means ANY of:
- the receipt-linked question from `pickPendingContext` (text mode),
- a pending amount (`awaiting_amount`, keeps its existing 15-min window, not deleted),
- a numbered list (`awaiting_context_choice` / `awaiting_flag_choice`; digits resolve it on the fast
  path; any other text is interpreted normally and the list lapses, as today),
- a recurring renewal nudge (`getAwaitingConfirm`).
The capture fast path only fires when NONE is open, so "$167" answering "how much?" is never
captured alone.

### Dispatch (existing handlers)

| action | handler |
|---|---|
| new_expense | `captureTextExpense` (usage caps apply, as today); if an amount was pending, combine with `priorText` as today |
| edit_expense + valid receipt_id | `processCorrection(receipt_id)`, reply named via `withExpenseName` |
| edit_expense, no id / candidates | existing "Which expense was that about?" list (`awaiting_context_choice`) |
| answer_open_question | by open state and `answer`: `awaiting_confirm` → affirm: `confirmReceiptMessage`, detail/decline: `processCorrection`; `awaiting_context` → `processClarification`; `awaiting_receipt` → resolution none: waive THIS receipt, later/decline: ack, detail: `processCorrection`; `awaiting_amount` → combined re-parse; `awaiting_recurring_optin` / renewal → affirm: opt-in / log, decline: ack or skip |
| explain_why | `explainWhy` (keeps the open question open) |
| query / command / advice / help / capability / other | existing router handlers |
| receipt_resolution | existing bulk waive / later handling, ONLY when no `awaiting_receipt` question is open; if one is open, code forces the single-receipt path above (never bulk-waive receipts the user didn't mention). (Builder-check Q5; call: Claude.) |

### What the model sees (per call; system prompt cached)

- Last 6 messages within 24h, both directions, oldest first, each with an age ("3 min ago"),
  outbound truncated to ~200 chars.
- The open question, if any: its state, its text, and which receipt it's about. Rules for "open"
  stay in code (`pickPendingContext` text mode: newest receipt-linked reply decides).
- Up to 10 recent expenses (30 days): id, vendor, amount, category, age. Same lines as
  `formatCandidateLine`.
- flaggedCount (receipts missing a photo), as today.

### Deleted once live

`replyStartsNewExpense`, `looksLikeCorrection`, the 15-min post-log correction window branch,
`CONFIRM_RE`, `NO_RECEIPT_RE` / `looksLikeNoReceipt` text routing, `EXPLAIN_RE` routing,
`classifyIntent` + `CLASSIFY_PROMPT`, `pickReceiptForContext` + `CONTEXT_PICK_PROMPT` (their
rules move into the interpreter prompt), and the ordering logic in `handleExpenseFlow` that those
supported. `looksLikeExpenseCapture` stays (fast path). Their unit tests are replaced by the
interpreter's.

### Failure handling

- Model error / timeout / invalid JSON / 429 (call: Claude, builder-check Q3): if a receipt question
  or pending amount is open → answer it exactly as today (no regression during rate-limit bursts);
  else if the text has a $-amount or miles → new_expense; otherwise the existing friendly reply.
  Never edit a DIFFERENT expense on failure.
  Log `turn_interpret_failed` (no PII). (Today `classifyIntent` swallows 429 → capture, which faked
  misclassifications in evals; the eval must pace and surface failures separately.)
- Invalid receipt_id → treated as "unsure" → which-expense list.

### Model + cost

Haiku via `HAIKU_MODEL`, effort low (existing `effortFor`). `HAIKU_MODEL` is shared with OCR,
categorization and cleanup, so this work does NOT change its code default (that would touch the
photo path, a non-goal). Instead every eval for this work runs with `HAIKU_MODEL` set to the prod
value, `claude-haiku-5-5` (founder confirmed 2026-11-25): run them with `HAIKU_MODEL=claude-haiku-5-5`. ~2.8K input tokens (1.5K cached) + ~200 output ≈ $0.0002 per text, and it
replaces the classifier + picker calls, so net cost is about flat.

### Rollout

Env flag `TURN_INTERPRETER` (default on after evals pass). Off = today's path, for instant
rollback in Vercel without a deploy. Delete the old path and the flag after ~1 week of clean logs.

## Testing

- Unit (node:test): context building (message window, truncation, ages), decision validation
  (foreign receipt id discarded, missing fields), dispatch mapping with a fake decision, fast-path
  gates.
- Replay eval `npm run eval:turns` (live Haiku, paced under 50 req/min, rate-limit failures reported
  separately, never scored as misroutes): each case = a short conversation + open question + recent
  expenses + the new text, graded on action, receipt_id, and answer. Cases are HAND-WRITTEN
  (no prod pulls, no names or phone numbers; call: Claude): the 2026-11-25 sequences (grocery →
  Home Depot, Optimum → Netflix → "Log as business expense") rewritten as fixtures, all intent +
  context-match eval cases ported, and ~20 messy real-life texts (bare numbers, one-word replies,
  "nvm", typos, two expenses in one text, a question mid-flow, a reply to an old reminder,
  "looks good" to a verify). Cases tagged `ambiguous` are reported but unscored, as in the other
  evals. Bar: 100% on scored cases, 0 wrong-target edits, before the old path is deleted.
- `scripts/redteam/run.ts` imports `classifyIntent`; port it to `interpretTurn` before deleting.
- Existing evals (categorize, merged, conversation) unchanged and still passing.

## Left to the builder

Exact prompt wording; history length (start at 6) and truncation; how failures are logged; test
file layout; whether `interpretTurn` lives in router.ts or a new `turn.ts` (prefer new file).

## After

Split `sms-handler.ts` (952 lines) into the inbound entry + per-flow handler files, and trim
`router.ts` and `expense.ts`, as a mechanical move with no behavior change.
