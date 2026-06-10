# Messaging cost levers — conditional disclaimer + value digest (DRAFT proposal)

**Status:** Draft. Nothing here is shipped or decided. Section A is blocked on a legal
call (Jordan + lawyer); Section B is buildable as soon as it's prioritized.

**Origin:** Review of an external "SMS economics" memo against what Tally already ships.
Most of that memo's levers were already pulled — pricing is margin-floored ([JOURNAL DEC-049]),
the long tail is capped ([DEC-050], ~$0.045 all-in COGS/expense), WhatsApp is channel-ready
([DEC-051]). Two genuinely stranded wins remain, captured here. Explicitly **rejected**:
silent capture + batching the WHY question into a digest — it trades the "capture WHY in
real-time" differentiator for a cost already contained (see the chat thread / to be logged
in JOURNAL).

---

## Section A — Conditional disclaimer + citation (FOR LEGAL REVIEW)

### The problem

Every categorized reply appends two things in code, regardless of context:

1. **Inline IRC citation + tap-through URL** — e.g. `§274 (https://tallywhy.com/irc/274)`,
   ~35 chars. Re-attached as a backstop in `composeResponse` ([categorize.ts:214](../../src/lib/categorize.ts#L214)).
2. **Legal disclaimer line** — `\n\nSuggestion, not advice. Confirm with your CPA.`, ~49 chars
   incl. the blank line. Appended by `withDisclaimer()` ([categorize.ts:96](../../src/lib/categorize.ts#L96)),
   asserted on EVERY reply by an invariant test ([categorize.test.ts:13](../../src/lib/categorize.test.ts#L13)).

Together that's ~85 chars of fixed tail on every confirmation. For the most common reply
(a sub-$75 general expense, complete) it's the difference between fitting in one segment and
spilling into two — i.e. it structurally doubles outbound cost on the highest-frequency message.
This is the [DEC-065b] win, held pending a legal sign-off.

### What is NOT on the table (legal floor stays)

- **The reply itself is never trimmed.** For sub-$75 strict-category expenses the SMS thread
  IS the IRS contemporaneous written record (CLAUDE.md rule 4). We never shorten the substantive
  confirmation — vendor, amount, category, IRC §, deductible amount all stay.
- **Suggest-not-advise phrasing stays in the body.** The compose prompt already bans "you should /
  I recommend / you'll save" and mandates "typically falls under" ([prompts.ts:355-370](../../src/lib/prompts.ts#L355)).
  The not-advice posture is baked into the wording independent of the trailing disclaimer line.
- **We always show *some* not-advice marker.** The question is full-vs-short, never none.

### The proposed tiering

Replace "full disclaimer + URL on every reply" with a three-tier rule:

| Tier | When | Disclaimer | IRC citation + URL |
|------|------|-----------|--------------------|
| **Full** | Strict categories (meals, travel, lodging, gifts, vehicle) **and** the first reply per category, per user | `Suggestion, not advice. Confirm with your CPA.` | Full inline `§X (https://…/irc/X)` |
| **Short** | All other replies (general categories, repeat categories) | `Not advice — see app.` *(or a chosen short form, see below)* | Bare `§X` (no URL) — the section is still cited; the tap-through lives in the dashboard |
| **(none)** | Non-categorized replies (acks, OTP, onboarding) — already the case | n/a | n/a |

Rationale: the **full** educational/legal moment fires exactly where audit risk and user
uncertainty are highest (strict §274(d) categories) and the first time a user meets a category
(the teaching moment). Everything else — a repeat $12 software charge under §162 — gets a short
marker that still cites the section but skips the ~35-char URL and uses a compact disclaimer.

### Candidate short-form wordings (pick one — this is a lawyer call)

1. `Not advice — confirm with your CPA.` (29 chars)
2. `Suggestion only. Confirm w/ CPA.` (32 chars)
3. `Not tax advice.` (15 chars) — leanest; drops the explicit deferral
4. `Not advice — details in app.` (29 chars) — points to where the full disclaimer/URL lives

> Note: the em dash isn't GSM-7-safe (see Section A.1); use a hyphen `-` in the shipped form.

### Questions for Jordan + the lawyer (the actual decision)

1. **May the full CPA-deferral line be occasional** (full on strict/first-per-category, short
   form otherwise) rather than verbatim on every single categorized reply — given that
   suggest-not-advise phrasing is enforced in the body of *every* reply regardless?
2. **Is a short not-advice marker** (one of the candidates above) **legally sufficient** on the
   non-strict, repeat-category replies, or must the full "confirm with your CPA" sentence appear
   every time?
3. **May the tap-through IRC URL be omitted** on short-tier replies as long as the section is
   still cited (`§162`) and the URL is reachable in the dashboard/app?
4. **For the sub-$75 strict-category "the SMS is the record" case** — does the written record need
   the disclaimer line *in that message*, or is the substantive content (vendor/amount/category/§/
   purpose) the record while the disclaimer is a separate consumer-protection layer that can vary?

### Implementation notes (once legal answers)

- `withDisclaimer()` becomes tier-aware: `withDisclaimer(message, tier)` where the caller
  (`composeResponse`) passes the tier computed from `rule.strict` + a per-(org, category)
  "seen before" check.
- The invariant test ([categorize.test.ts:13](../../src/lib/categorize.test.ts#L13)) is rewritten
  to assert the **tiered** floor: full tier ⇒ full line; short tier ⇒ a non-empty not-advice
  marker is still present. This test edit IS the codified legal-posture change — do not land it
  without the sign-off in hand, and reference the answering JOURNAL decision in the test comment.
- "First reply per category per user" needs a cheap persisted flag (e.g. a `seen_categories`
  set on the org, or derive from existing receipts: `count(category) == 1`). Prefer deriving from
  receipts to avoid new state.
- No change to the compose prompt's body rules — only the appended tail.

### A.1 — Encoding sub-lever (NOT a legal question — Sofia + eng)

Independent of the disclaimer decision, and arguably the cheapest win of all:

- SMS segments are **160 chars** in GSM-7, but **70** the instant any character falls outside
  GSM-7 (forces UCS-2). Concatenated multi-segment: **153** (GSM-7) vs **67** (UCS-2) per segment.
- `§` and `$` ARE in GSM-7 (safe). `✓`, `→`, `—` (em dash), and curly quotes are **not**.
- The `✓` confirmation pattern (Sofia's "Logged ✓", the `Updated ✓` in [CORRECTION_PROMPT](../../src/lib/prompts.ts#L473))
  and the `→` in [sms-handler.ts:387](../../src/lib/sms-handler.ts#L387) each force the **entire**
  message into UCS-2 — so a ~140-char reply becomes 3 segments instead of 1.
- **Action:** (1) instrument actual segment count + encoding per outbound message before changing
  anything — confirm the hypothesis with real numbers; (2) decide with Sofia whether to swap `✓`/`→`
  for GSM-7-safe equivalents (`Logged.`, `Done.`, `>`), or keep the glyph as a deliberate,
  measured UX cost. Sofia owns the call; she's right that the checkmark carries real trust weight.
- **Status: instrumentation SHIPPED.** `analyzeSegments()` ([sms-segments.ts](../../src/lib/sms-segments.ts))
  + an `sms_segments` log line in `sendMessage` ([twilio.ts](../../src/lib/twilio.ts)), SMS-only.
- **PII-safety (DEC-003 / Jordan — FOR REVIEW).** The log echoes characters from the outbound reply
  body, which contains vendor/attendee names. Accented Latin (é, ñ, ü, ç) is GSM-7 so it's invisible
  here, but a non-Latin-script name (CJK/Cyrillic/Arabic) is not — so raw logging would leak name
  fragments. Mitigated by `redactNonGsmForLog()`: we log non-GSM **symbols only** (`✓`, `→`, `—`,
  emoji — the cost culprits, no identity) and reduce non-GSM **letters to a bare count**
  (`nonGsmLetterCount`), never their content. Tested end-to-end (a `海底捞` vendor surfaces zero
  letters). **Jordan to confirm** this redaction is sufficient for the DEC-003 floor.

### Combined effect (illustrative, the typical sub-$75 complete reply)

- **Today:** body + URL + full disclaimer + a `✓` ⇒ UCS-2 ⇒ ~3 segments.
- **After A + A.1:** GSM-7 body + bare `§X` + short marker, no `✓` ⇒ ~1 segment.
- ≈ **60-66% fewer segments on the highest-frequency reply**, with zero change to the
  substantive record and the not-advice posture intact. Measure to confirm.

---

## Section B — Value digest (BUILDABLE — reframes the memo's "daily digest" correctly)

### The idea

The memo's "daily digest" instinct is right, but its home is **value-surfacing**, not
clarifying-question batching (batching loses the fresh-memory advantage the product exists for).
Send a periodic message that makes the dollar value impossible to miss — this is both retention
and pricing power (Marcus: "the user should think '$12/mo for the thing sitting on $4,000 of
deductions,' not '$12/mo for texts'").

### Shape

- **Cadence:** monthly (aligns with the existing month-end cadence). One outbound/month is
  negligible cost — and free in-window once WhatsApp is live ([DEC-051]).
- **Deterministic, no LLM.** It's a `SUM(deductible_amount_cents)` + `COUNT(*)` over the period,
  org-scoped — a workflow, not an agent (AGENTS-VS-WORKFLOWS.md). Near-zero marginal cost.
  Does NOT need the month-end review agent; reads the same receipts table directly.
- **GSM-7-safe, single segment** (apply Section A.1 here too — no `✓`/emoji in the digest).
- **Deep-links to the dashboard** (the review/export surface, where the full disclaimer + URLs live).

### The number: safe vs unsafe (legal — Alex's flag)

- ✅ **SAFE (default, ship this):** *deductions captured* = the deductible-amount total we already
  compute per receipt. It's a description of what was logged, not a tax-outcome claim.
  > "This month: $1,840 in potential deductions captured across 84 expenses. Tap to review → app."
- ⚠️ **UNSAFE without care:** "worth ~$480 off your tax bill." That's a tax-outcome projection
  (needs a marginal-rate assumption) and brushes the "never guarantee outcomes / no specific
  advice" line (CONTEXT.md legal framing). **Recommendation: do NOT ship the savings figure in
  V1.** If ever added, gate behind an explicit assumption + disclaimer ("at a 22% rate, roughly
  $X less taxable income — estimate, confirm with your CPA") and a lawyer review.

### Copy variants by state (Priya — edge cases)

- **Healthy month:** "This month: $1,840 in potential deductions captured, 84 expenses. Review or
  export anytime → app." (GSM-7, one segment)
- **Low/new (<5 expenses):** encouraging, no big number — "3 expenses logged so far. The more you
  text in, the more you capture at tax time." (or suppress entirely below a threshold)
- **Zero this period:** suppress — never send a "$0" message.
- **Near/over usage cap ([DEC-050]):** the digest is the natural place to surface "you're a heavy
  user" — but keep the existing cap nudges authoritative; don't duplicate. Coordinate copy.
- **Trial / paywalled user:** the digest is a strong upsell surface (shows the value they'd lose).
  Decide deliberately whether paywalled users still receive it (recommend: yes, value-forward,
  consistent with the trial-end "records are safe" framing in [DEC-072 area]).
- **Opt-out:** must respect the same STOP/opt-out posture as other outbound; one-tap off.

### Metrics (Priya)

- Leading: digest → dashboard open rate.
- Retention: 30/60-day retention of digest-openers vs not.
- Pricing-power proxy: trial→paid conversion among users who received ≥1 value digest with a
  non-trivial number vs those who didn't.

### Growth (Maya)

The deductions number is the screenshot-able artifact ("$4,287 captured"). Design the digest
(and a dashboard "year so far" card) to look good captured — that's a distribution surface, not
just a billing one. Specific numbers build trust.

### Open decisions for the founder

1. Monthly vs quarterly cadence (recommend monthly).
2. Ship the safe "deductions captured" number only, or invest in the gated savings estimate
   (recommend: safe-only for V1).
3. Does it go to paywalled users (recommend: yes, value-forward).
4. Threshold below which we suppress / send the encouraging variant.

---

## Sequencing

1. **Now:** get answers to Section A's four legal questions (unblocks the biggest cheap win).
2. **In parallel:** instrument segment/encoding counts (A.1) — no legal dependency.
3. **Then:** build Section B (value digest, safe number only) — no legal dependency beyond
   avoiding the savings claim.
4. **On answers:** ship the tiered disclaimer (A) + the test rewrite, referencing the new JOURNAL
   decision.

Defer (logged, not now): carrier migration (Telnyx/Plivo), email-in capture, usage-pricing tiers,
RCS. Keep warm: WhatsApp Meta business-verification docs.
