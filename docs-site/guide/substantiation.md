# When Tally asks for more

One of the best things about Tally is what it *doesn't* do: it doesn't nag. Most expenses get logged
with no follow-up at all. But for a few categories, the IRS requires extra documentation — and in
those cases Tally asks **one** short question.

This is the heart of how Tally works, so it's worth a minute to understand.

## Two kinds of expenses

**Most categories — "general" substantiation.**
Office supplies, software, advertising, professional fees, and the like. Tally logs these and moves
on. No receipt request, no follow-up.

**Strict categories.**
The IRS holds a handful of categories to a higher standard (this comes from tax code §274). For
these, Tally may ask for a receipt and/or a bit of context:

- 🍽️ **Meals**
- ✈️ **Travel** (transportation and lodging)
- 🎁 **Business gifts**
- 🚗 **Vehicle / mileage**

## When Tally asks for a receipt

For a strict-category expense:

- **$75 or more?** A receipt is expected. If you already sent a photo, great — Tally won't ask. If
  not, it'll ask you to send one when you can.
- **Lodging?** A receipt is expected no matter the amount.
- **Under $75?** **Your text message is the record.** No photo needed — the note you sent is valid
  documentation on its own.

## When Tally asks for context

For meals, travel, and gifts, the rules also want to know the *business purpose* and, for meals, who
was there. So Tally might ask something like:

> Got it — who was the lunch with, and what was it about?

A one-line answer is all it needs:

> client, Jordan from Acme, about the Q3 renewal

Tally attaches that to the expense and you're done. It asks **at most one** question per expense, and
only for what's actually missing.

## The logic, at a glance

```
Expense comes in
   └─ Strict category? (meals, travel, lodging, gifts, vehicle)
        ├─ No  → log it, done.
        └─ Yes →
             ├─ Lodging → receipt expected
             ├─ $75 or more → receipt expected (+ context if missing)
             └─ Under $75 → your text is the record (+ context if missing)
```

::: tip Why this matters
Capturing the *why* in the moment is what makes your records hold up. Months later, "client lunch,
Q3 renewal" is impossible to reconstruct from a bank statement — but trivial to text the day it
happens.
:::

## Related

- [Receipts & photos](/guide/receipts-and-photos)
- [Fixing & correcting](/guide/corrections)
- [FAQ](/guide/faq)
