# Bank feeds via Stripe Financial Connections (design, 2026-11-25)

**Status:** Design, V2 (post-V1). Not approved for build. Validate with the 5 user interviews first:
"would you link your bank to a new app?" History: JOURNAL "IDEA — Bank feeds".

## Why

Texting every expense is the main effort Tally asks of users. A bank feed supplies the WHAT
automatically; Tally keeps its job of capturing the WHY, asking only when the substantiation tree
requires it. Positioning holds: "Your bank knows WHAT, Tally knows WHY."

**Principle (founder, 2026-11-25): a bank feed is only another way data comes into Tally.**
Categorize -> substantiation tree -> ask-only-when-required -> log is unchanged and shared with the
text/photo path. Unlinked users see no difference. New code is limited to the intake side: the
Stripe sync, matching a bank line to an already-texted expense, merchant rules, and the daily digest.

## Vendor: Stripe Financial Connections (not Plaid)

- Already a Stripe customer ([stripe.ts](../../src/lib/stripe.ts)): no new vendor, no Plaid
  production approval, one bill.
- Founder confirmed all target banks are supported with transactions: **Chase, Bank of America,
  Capital One, TD, Valley**.
- Request the `transactions` permission only. Never payment methods, balances, or ownership.
- Pricing is per connected account: confirm current rates in the Stripe dashboard before committing.

## User flow (everything in the text thread)

1. **Link.** User texts "link my bank" -> Tally replies with a one-time link
   (`tallywhy.com/link/<token>`). Mobile page, one button, opens the Stripe modal; bank login and
   app-to-app approval happen inside Stripe/the bank. Page ends: "Done. Head back to Messages."
2. **Setup questions.** See Setup conversation (account type, what to ask about, cadence, history).
3. **New charges.** Known merchant (rule exists) -> categorize silently. Unknown -> queued.
4. **Daily "what's this?"** One text per day, batched: "3 new charges: 1) Shell $48 2) Netflix $15
   3) Uber $32. Which were business?" Reply by number (reuses the numbered-pick pattern from
   DEC-094). Business ones then run the substantiation tree; ask for the WHY only where required.
5. **Unlink.** "unlink my bank" by text, or the dashboard. Separate "delete my bank history" option.

Dashboard also gets a "Link a bank" button for users who prefer web.

### Link token rules

- Single-use, ~15 min expiry, bound to the user's phone/org.
- Forwarding is low-risk: the link *adds* a bank to the account; opening it still needs the opener's
  own bank login. Worst case (someone links *their* bank) is caught by the confirmation text naming
  the bank + last 4, and "unlink" reverses it.

## Setup conversation (founder, 2026-11-25)

Tally asks up front, one question per text, each with a default so a one-word reply works.
Everything is changeable later by texting "settings" or on the dashboard.

**In onboarding** (new optional entry at the end of `ONBOARDING_QUESTIONS`, onboarding.ts):
> "Want to connect your bank so I can log charges for you? You'd only text me the why. (yes / later)"

- `yes` -> send the one-time link (see User flow). `later` -> re-offer once, after their first
  week of logged expenses ("You've logged 6 expenses. Want me to pull these from your bank?"),
  when trust exists. Never asked a third time.

**Right after a bank links** (one per text, in order):
1. **Account type:** "Is Chase ••4321 for business, personal, or both?" (business / personal / both)
   - Drives export: personal charges on a business account = owner's draw (kept); on a personal
     card, excluded by default.
2. **What to ask about** (personal / both only): "Should I ask about every charge, or only ones over
   $25?" (every / over $25, default over $25). Groceries and streaming under the line are logged
   as personal silently; merchant rules still learn from any answer.
3. **How often:** "How often should I check in about new charges? Daily is best, details fade fast."
   (daily / every few days / weekly, default daily). Time: early evening, local.
4. **History:** "Want me to pull in charges since Jan 1 for this tax year?" (yes / no, default yes).
   Backfill goes to the dashboard "To sort" list, never as a flood of texts.

Settings stored per bank account (`kind`, `ask_threshold_cents`) and per user (`digest_cadence`).

## Reconciliation: propose, human confirms (founder, 2026-11-25)

When a bank line looks like an expense already captured by text/photo:

- **Exact match** (same amount, date within ~3 days, merchant matches): link silently; the text
  keeps the WHY, the bank line confirms the amount. No question.
- **Near match** (amount differs, e.g. $80 texted vs $96 posted after tip; or vendor name differs):
  Tally proposes the merge and the human confirms. Batched into the daily digest, never its own text:
  "Your $80 dinner text matches Chase $96 at Nobu (tip?). Reply 1 to use $96." Until confirmed,
  both stay visible and the dashboard shows "Possible match: confirm".
- **No match:** the bank line is a new expense and goes through the normal flow.
- Never auto-merge two expenses on a guess: a wrong merge silently corrupts the record.

## Linked users rarely text: the digest is the main channel (founder, 2026-11-25)

With a feed, most users stop texting. Tally becomes outbound-first, so the digest has to carry what
texting used to: the "what's this?", the WHY for strict categories, and receipt requests.

- **Timing:** once a day, early evening, covering charges since the last digest (WHY fades fast,
  so daily, not weekly). Pending charges can be included; amounts are recorded from posted.
- **One message, numbered answers.** Respects "one question per message": the single question is
  "which were business?"; follow-ups only for items that need more.
  ```
  3 new charges yesterday:
  1) Nobu $180   2) Shell $48   3) Netflix $15
  Which were business? (e.g. "1 2")
  ```
- **Then only what the substantiation tree requires**, in one follow-up text:
  - Meal under $75: who it was with and the business purpose (their reply is the record).
  - Meal/travel $75+ or lodging: same, plus "snap or forward the receipt when you can".
  - Software, phone, supplies: nothing more. Logged.
- **Nothing new = no text.** Known merchants and personal-card noise never produce a digest by
  themselves.
- **Unanswered items** roll into the next digest once, then go to the dashboard "To sort" list and
  the month-end review. No nagging chain.
- **Cost:** inbound volume drops (users text less); outbound is about one digest plus one follow-up
  per active day. The 40-texts/day cap (DEC-095) is unaffected.

## Pending vs posted

Stripe transactions carry `status`: `pending` | `posted` | `void`.

- **Ask early, record late:** the "what's this?" can go out on pending (WHY is freshest), but the
  recorded amount comes from posted (tips change restaurant totals).
- **Skip holds:** gas/hotel/rental pre-auths ($1, $100, $175) are never asked about until posted.
- **Void:** delete silently; if Tally already asked, don't follow up.
- Refresh cadence is Stripe's, not ours (likely hours). Test with a real card in live mode before
  promising "texts you right after you pay".

## Data model

```
Stripe (holds the bank connection)
   │  webhook: new transactions
   ▼
bank_accounts       fca_ id, institution, last4, kind (business | personal), status
bank_transactions   every charge: merchant, amount, date, pending/posted/void,
                    state (needs_answer | business | personal), stripe txn id
   │  business (by answer or merchant rule)
   ▼
receipts            existing expenses table; linked to its bank line (dedupe)
merchant_rules      per org: merchant -> category or personal (learned from answers)
```

- **Dedupe:** match a bank line to an already-texted receipt (amount, date window, merchant) so the
  expense counts once.
- **Personal charges are kept and labeled**, not deleted (founder, 2026-11-25): stored as receipts
  with category `personal` (§262, 0%, DEC-004).
  - On a **business account**: shown as "Personal / owner's draw" and included in exports (books must
    reconcile to the bank).
  - On a **personal card**: excluded from exports by default; user can include.
- Export gets a `Source` column (`Text` / `Photo` / `Bank`); see [11-accountant-export.md](11-accountant-export.md).

## Review surfaces

- **Text:** the daily digest (main path).
- **Dashboard:** new "To sort" list (bulk business/personal); bank-sourced expenses appear in the
  existing list with a "from Chase ••4321" tag; personal charges viewable and reclassifiable.
- **Month-end review** (DEC-092) includes any unanswered bank charges.

## Flags (recordkeeping, not fraud protection)

Falls out of the "what's this?" flow: duplicate charge (same merchant + amount, same day), user
replies "not me" to an unrecognized merchant, subscription price jump. Never market as fraud
protection: feeds lag hours to days and banks own fraud detection + liability.

## Security

- **Never stored by Tally:** bank credentials, MFA codes, account/routing numbers.
- **Stored:** `fca_` account id (useless without our Stripe secret key; no per-user bank token),
  institution + last4, transactions.
- **The crown jewel is the Stripe key:** use a separate **restricted key** scoped to Financial
  Connections read for bank data; keep the billing key separate.
- Hardware-key / authenticator MFA on Stripe, Vercel, Supabase, GitHub, Twilio/Linq.
- Vercel env vars marked sensitive; nothing secret in client bundles.
- Webhooks verified (`constructEvent`, already in stripe.ts).
- New tables get RLS + org filter on every query; no merchant names/amounts in logs or Sentry.
- Unlink = Stripe disconnect API call + stop syncing; "delete my bank history" purges bank rows.
- **Legal:** add bank data to the lawyer review of privacy/terms; ask whether the **FTC Safeguards
  Rule** applies (written security program). SOC 2 later, when partners/paying users require it.

## Effort (rough)

~1-1.5 weeks: link page + token (1d), Stripe FC session + storage (0.5-1d), webhook + sync (1-2d),
dedupe + merchant rules (1-2d), daily digest + numbered replies (1-2d), dashboard "To sort" (1d),
security pass (1d).

## Open questions

- Answered by the setup conversation: digest cadence, personal-card threshold, history import.
- Default threshold: $25 is a guess; tune with real data (share of personal charges under it).
- Does the onboarding bank offer hurt completion? Instrument it like the other onboarding steps.
