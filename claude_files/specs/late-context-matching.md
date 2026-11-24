# Late context: attach it to the right expense, or ask (design, 2026-11-24)

**Status:** Design, awaiting founder approval. Small change.

## Why

A user adds a detail after the fact ("that hotel was for the conference"). Today
`handleContextStatement` ([router.ts](../../src/lib/router.ts)) does one of two wrong things:

- **Within 2h:** applies it to the *most recent* receipt, whatever it is (the coffee logged after the hotel gets it).
- **After 2h:** replies "Got it!" and drops the detail. Looks like a save, isn't. This is a bug regardless of the rest.

Goal: the detail always lands on the expense the user meant, or Tally asks which one. Capturing the WHY late
is still capturing the WHY.

## Goals / non-goals / anti-goals

- **Goal:** resolve loose references ("that hotel", "the Austin one", "dinner with Sarah") to one past expense.
- **Goal:** never silently drop a context statement again.
- **Non-goal:** remembering loose facts for *future* expenses ("I'm in Austin this week" pre-filling later
  receipts). Logged to JOURNAL as a post-V1 idea.
- **Anti-goal:** confidently attaching a detail to the wrong expense. A wrong attach corrupts the IRS record
  quietly; asking is always the safer failure.
- **Anti-goal:** extra questions when the answer is obvious (one recent expense, or a clear match).

## Approaches considered

- **A. Keyword/amount match in code.** Free and predictable, but misses how people actually refer back ("the conference dinner"). Rejected.
- **B. Haiku picks from recent expenses. CHOSEN (founder).** Handles loose references; one small call (~$0.0005, ~0.5s on Haiku 5.5).
- **C. Always ask with a list.** Simplest, but asks when not required (breaks CLAUDE.md "ask only when required"). Rejected.

## Design

1. **Candidates:** the user's last 10 receipts from the last 30 days (org-scoped), as short lines:
   `id · vendor · $amount · category · logged N min/hours/days ago`.
2. **Shortcut:** exactly one candidate → apply it, no model call.
3. **Haiku pick** (`HAIKU_MODEL`, effort low, JSON): given the message + candidate lines, return
   `{ "match": <id> }` or `{ "match": null, "shortlist": [ids] }`. Prompt rules:
   - Pick only when exactly one expense plausibly fits. If two could fit, return null.
   - A bare "that one" / "it" with no other reference means the most recent expense **only if** it was logged in the last 2 hours; otherwise null.
   - The returned id must be one of the candidates (validated in code; anything else = null).
4. **Match:** apply via the existing `processCorrection` (same trusted edit path as today). The reply names the
   expense it saved to (e.g. "Added to Marriott Austin $230"), so a wrong pick is visible and correctable.
5. **No match:** ask once, reusing the flag-choice pattern: "Which expense was that about?" + numbered list
   (Haiku's shortlist, else the 5 most recent), "Reply with a number." New pending state
   `awaiting_context_choice` with `pendingData { candidateIds, text }` on the outbound row
   (`context_state` is VARCHAR, so no migration). A numeric reply applies the stored text to the chosen receipt.
6. **No expenses in 30 days:** keep today's steer-back reply, but word it honestly (not "Got it!"), and keep the
   `conversational_no_log` log.
7. **Failure:** Haiku error or timeout → treat as no match → ask (step 5). Never guess.

## Tests / checks

- Unit: candidate formatting, id validation, the one-candidate shortcut, numeric-reply resolution.
- Eval: a small live set (8-10 cases) for the picker: clear match, two hotels (must ask), bare "that one"
  fresh vs stale, no plausible match.

## Left to the builder

Exact copy (no em dashes in user-facing text), prompt wording, where the picker lives (likely `router.ts` next to
`handleContextStatement`).
