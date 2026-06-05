# Stripe Setup — Tally

The click-path to wire Stripe to Tally. The code only ever reads **four `STRIPE_*` env vars** (plus
`SUBSCRIBE_LINK_SECRET` for one-tap links), so once these are set, billing + the magic link work.

> Stripe's dashboard wording shifts occasionally; the **nouns** (Product, Price, Webhook, API key)
> are stable even if a button moves.

---

## 0. Pick the account model (one-time decision)

Tally is a distinct brand, so the recommended path is a **separate Stripe account under your existing
login** (clean payouts, books, branding, and risk isolation from your other app):

- Dashboard → **account switcher** (top-left) → **＋ Create account** (a *standalone* account, NOT a
  Connect connected account).
- Name it "Tally". Complete the brief business profile when it asks (can be a sole prop; EIN optional).

If instead you want everything under your existing account, skip this step — just create Tally's
Products there. Everything below is identical either way. (You can migrate customers between accounts
later, with Stripe's help, so this isn't a permanent lock-in.)

**Do all of the following in the Tally account.** Use **Test mode** first (toggle, top-right), then
repeat in **Live mode** — test and live have *separate* keys, products, and webhook secrets.

---

## 1. Products + Prices → `STRIPE_PRICE_WEEKLY`, `STRIPE_PRICE_ANNUAL`

Create **two Products**, each with one **recurring Price** (per `src/lib/pricing.ts`):

| Product (name)  | Price            | Billing period | Env var to receive the Price ID |
| --------------- | ---------------- | -------------- | ------------------------------- |
| Tally Weekly    | **$4.99**        | every **week** | `STRIPE_PRICE_WEEKLY`           |
| Tally Annual    | **$99.99**       | every **year** | `STRIPE_PRICE_ANNUAL`           |

Steps: **Product catalog → ＋ Add product** → name it → under Pricing pick **Recurring** + the period
→ Save. Open the Price and copy its **ID** (starts with `price_…`, *not* `prod_…`). That `price_…`
ID is what goes in the env var.

---

## 2. API key → `STRIPE_SECRET_KEY`

**Developers → API keys → Secret key** → reveal/copy. It's `sk_test_…` in Test mode and `sk_live_…`
in Live mode → set `STRIPE_SECRET_KEY` to the matching one for the environment you're configuring.

(We don't need the publishable key — Tally redirects to Stripe-hosted Checkout, no client-side Stripe.js.)

---

## 3. Webhook endpoint → `STRIPE_WEBHOOK_SECRET`

**Developers → Webhooks → ＋ Add endpoint**:

- **Endpoint URL:** `https://<your-domain>/api/billing/webhook`
- **Events to send** (exactly these — see `src/app/api/billing/webhook/route.ts`):
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Save → open the endpoint → **Signing secret** (`whsec_…`) → set `STRIPE_WEBHOOK_SECRET`.

The signing secret is **per endpoint and per mode** — your test endpoint and live endpoint have
different `whsec_…` values.

---

## 4. The magic link → `SUBSCRIBE_LINK_SECRET`

Not a Stripe value — it signs the one-tap subscribe links (DEC-062). Set it to any long random string:

```bash
SUBSCRIBE_LINK_SECRET=$(openssl rand -base64 48)
```

If it's **unset**, one-tap links gracefully fall back to `/pricing` (login-then-pay). Set it to turn
on tap-straight-to-Checkout from SMS.

---

## 5. The env vars, all together

Set these in `.env.local` (local) and in Vercel → Project → Settings → Environment Variables (prod):

```
STRIPE_SECRET_KEY=sk_live_xxx          # or sk_test_xxx in test
STRIPE_PRICE_WEEKLY=price_xxx          # Tally Weekly recurring price
STRIPE_PRICE_ANNUAL=price_xxx          # Tally Annual recurring price
STRIPE_WEBHOOK_SECRET=whsec_xxx        # from the webhook endpoint, per mode
SUBSCRIBE_LINK_SECRET=<random string>  # enables one-tap subscribe links
NEXT_PUBLIC_APP_URL=https://<your-domain>   # used for success/cancel + link building
```

---

## 6. Test it locally (Stripe CLI)

Stripe can't reach `localhost`, so forward webhooks with the CLI:

```bash
stripe login                                   # into the Tally account
stripe listen --forward-to localhost:3000/api/billing/webhook
# → prints a whsec_… for THIS session; use it as STRIPE_WEBHOOK_SECRET while testing locally
```

Then, with test keys set, run the app, go to `/pricing`, subscribe with Stripe's test card
`4242 4242 4242 4242` (any future expiry / any CVC). Confirm:

- the org flips to `active` (the `checkout.session.completed` handler),
- you land on `/dashboard?sub=success` (banner shows),
- you receive the welcome SMS (DEC-059) — once, even if Stripe retries (DEC-060),
- the trial-reminder cron + paywall links open Checkout directly (DEC-062), once `SUBSCRIBE_LINK_SECRET` is set.

---

## Going live checklist

- [ ] Repeated steps 1–3 in **Live mode** (live products, live `sk_live_…`, live webhook + `whsec_…`)
- [ ] Live env vars set in Vercel (Production)
- [ ] `NEXT_PUBLIC_APP_URL` = the real domain (so links + success/cancel URLs are correct)
- [ ] One real subscribe end-to-end (you can refund yourself)
- [ ] Business profile / payout bank account completed in the Tally account so payouts actually settle
