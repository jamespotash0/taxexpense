# Spec 10 — Agency Tier (B2B2C: one agency manages many creator books)

> **Status:** **Build-first (founder decision 2026-06-10)** — build a minimum demo-able slice, then
> reach out to agencies with a working product (a manual concierge pilot won't be credible to B2B
> agencies). Sequenced to defer the fiddly/risky tail (automated seat billing, agency write-access)
> until an agency commits. Needs a JOURNAL DEC when greenlit. Builds on the business-profile engine
> (DEC-081) and the creator-vertical exploration.
> **Owner personas:** raj (schema/architecture), **jordan (security — the authz boundary is the
> whole risk)**, priya (billing edge cases), marcus (GTM context).

## Why this exists

The agency channel is the distribution unlock for verticals where you can't buy the audience
(adult creators especially): one B2B sale = many users, with the agency's trust transferred and a
clean B2B billing profile (sidesteps the Stripe adult-association risk — the agency is a normal
business). An agency (OFM agency or creator-bookkeeper) manages N creators and lives the March
"what was this $400 charge?" pain across their whole book — which is exactly the WHY-capture Tally
provides. See the conversation log / STATE.md for the GTM rationale.

This is a **go-to-market change as much as an architecture change**: D2C creators = texting is the
hero; B2B agencies = the multi-client *management surface* is the hero. The capture engine is the
same in both.

## Build-first sequencing (read first)

Founder's call: build a working slice, then reach out — agencies won't take a manual pilot
seriously. The discipline becomes "don't build the *whole* tier blind; build the thinnest slice
that demos the value and defer the expensive/risky tail until an agency commits."

**Minimum demo-able slice (build before reaching out):**
1. Foundation migration (`agencies`, `agency_members`, `organizations.agency_id`) — safe, additive.
2. `provisionCreatorOrg` (Fix 1) — attach creators to an agency.
3. **Read-only** agency dashboard — cross-org *view* (Fix 2 reads only) + the "who's missing what"
   board (Fix 4). This is the demo and the core value.
4. Lightweight entitlement fork (Fix 3 logic only): managed creators are entitled because the
   agency's status is set `active` **by hand** after you invoice them.

**Defer until an agency actually commits:**
- Automated Stripe per-seat billing — invoice the first 1–3 agencies manually.
- Agency **write/edit** access — keep the dashboard read-only first (creators edit via their own
  login); shrinks the authz surface dramatically.

**Cannot shortcut even in the slice:** the read-path authz (`assertCanAccessOrg` + negative tests).
Read-only makes it smaller, not optional — a leak here is a breach. And in parallel, stand up 2–3
real creators on the existing capture to confirm this vertical will actually text — nearly free,
de-risks the foundation of the whole bet.

## What does NOT change (scope containment)

The entire valuable core is **per-creator-org and untouched**: SMS capture, the substantiation
decision tree, `business_profile`, categorization, vendor memory, CSV/QBO export. Because the schema
is already `organization_id`-scoped (multi-tenant from day 1), the agency tier is **additive — a
layer on top, not a teardown.** The creator still texts from their own phone; `sms-handler` resolves
them by phone to their own org, which now merely *also* has an `agency_id`. Capture code changes: none.

## ⚠️ Correctness invariant: agency ≠ co-owner

The existing co-owner feature (DEC-045) is *many people → ONE shared book* (spouses). An agency is
*one manager → MANY separate books*. **Each managed creator MUST be its own `organization`** (own
books, own Schedule C, own taxpayer). Never model an agency's creators as co-owners of one org —
that would merge N taxpayers' deductions into one return, a tax-correctness disaster.

## Foundation: a tier above `organizations`

```sql
-- new
agencies        (id, name, stripe_customer_id, subscription_status, seat_plan, created_at)
agency_members  (agency_id FK, user_id FK, role TEXT CHECK (role IN ('admin','staff')), PRIMARY KEY (agency_id, user_id))
-- altered
ALTER TABLE organizations ADD COLUMN agency_id UUID NULL REFERENCES agencies(id);
```

`organizations.agency_id` is the hinge. It splits every org into two worlds, and all four fixes are
just "branch on this":

- **`agency_id IS NULL`** → today's self-serve creator. Pays for itself. Fully unchanged.
- **`agency_id IS NOT NULL`** → *managed* org. Billing + access flow through the agency.

`agency_members` are agency staff users — they auth through the same mechanism as everyone but they
**don't text expenses**; they use the agency dashboard.

## The four fixes

### Fix 1 — Provisioning (agency creates creators) · effort: small

A sibling to `inviteToOrg`, but it creates a NEW org under the agency instead of attaching a
co-owner to an existing one:

```
provisionCreatorOrg(agencyId, phone, name):
  insert organization { agency_id: agencyId }            -- born managed
  insert user { org, phone, name, onboarding_completed:false, sms_consent_at:null }
  insert user_roles { user, org, role:'owner' }
  bump agency Stripe seat quantity (Fix 3)
```

Agency dashboard "Add creator" → name + phone → runs this. The creator's first inbound text is
picked up by the existing `getOrCreateUserByPhone` (it finds the pre-seeded row, stamps TCPA
consent), and onboarding runs as normal. **SMS side unchanged.** Same global-phone-uniqueness
constraint as `inviteToOrg`: a number that already has a standalone account is refused (re-homing =
account merge, out of scope).

### Fix 2 — Cross-org access (agency sees all creators) · effort: large · ⚠️ SECURITY-CRITICAL

Today auth is implicitly "you are in exactly one org." Widen it to "an agency staffer can reach any
org their agency owns":

```
getAccessibleOrgs(user)      → user's own org + (if agency_member) all orgs WHERE agency_id = their agency
assertCanAccessOrg(user, orgId) → member of orgId  OR  agency_member of org.agency_id
```

- Agency staffer logs in → **agency dashboard listing all managed creators** (not a single org).
- Picks a creator → **active-org context** → the existing per-creator dashboard/queries run scoped
  to that org.
- **Every org-scoped route / server action gets `assertCanAccessOrg` at the top**, replacing today's
  implicit single-org assumption.

**This is the one place a bug is a breach, not a glitch.** Miss one endpoint → Agency A sees Agency
B's creators, or a creator's books leak. Requirements (Jordan):
- Centralize the check in ONE guard; audit every org-scoped read/write through it.
- **Negative tests are mandatory:** staffer of agency X *cannot* reach an org of agency Y; a direct
  user cannot reach any managed org; a managed creator cannot reach a sibling creator.
- Multi-tenant isolation invariant: no query returns rows across an `agency_id` the requester isn't
  a member of.

### Fix 3 — Seat billing (agency pays, creator pays nothing) · effort: medium, fiddly

An **entitlement fork**, not new paywall logic:

```
getOrgEntitlement(orgId):
  if org.agency_id → agencyEntitlement(org.agency_id)   -- creator inherits the agency's plan
  else             → today's per-org logic
```

- The **agency** is the Stripe customer on a **per-seat subscription**: `quantity = count of managed
  creators`. Provision a creator → bump quantity (Stripe prorates); remove one → decrement.
- A managed creator's org is entitled whenever the agency's subscription is active. The creator
  **never hits the SMS paywall** (it calls `getOrgEntitlement`, which now resolves through the agency
  transparently — *no change to sms-handler*).
- The creator **never sees pricing / subscribe links / billing** — hide `ManageBillingButton` and
  subscribe UI whenever `agency_id` is set.
- Direct users' per-org Stripe path is unchanged.

### Fix 4 — Cross-creator reporting · effort: easy (downstream of Fix 2)

Aggregate over `getAccessibleOrgs`: per-creator deduction totals, **export-all** (zip of per-creator
CSVs, or one combined CSV with a creator column), and the killer view — a **"who's behind / what's
missing" board** (incomplete/flagged receipts per creator) that turns the agency's March chase into a
year-round glance. Additive UI on top of Fix 2.

## Requirement → mechanism map

| Requirement | Mechanism |
|---|---|
| Agency pays all seats, creator pays nothing | Stripe per-seat sub on the *agency* + `getOrgEntitlement` fork on `agency_id` + billing UI hidden for managed orgs |
| Agency sees all their creators | `agency_members` + `assertCanAccessOrg` cross-org guard + agency dashboard (client list → active-org switch) |

## Edge cases (Priya)

- **Agency subscription lapses** → managed creators lose entitlement. Decide grace behavior (likely:
  capture keeps working briefly / read-only, agency is nudged) — creators shouldn't be hard-cut for
  the agency's billing lapse without warning.
- **Creator leaves the agency** → "unmanage": archive the org, or offer the creator to take it over
  as a self-pay account (clear `agency_id`, hand them billing). Decrement the seat either way.
- **Seat accounting** = active managed orgs; define what "active" means (provisioned vs. has-texted).
- **Creator privacy/consent** — the agency can see the creator's books by design. Surface this in
  ToS/consent at provisioning; it's sensitive in the creator vertical. The creator should know.
- **TCPA** — provisioned creator rows carry `sms_consent_at = null`; first inbound is the opt-in
  (same as `inviteToOrg` today).

## Build order

See "Build-first sequencing" above for the slice-vs-defer split. In short: (1) foundation migration,
(2) `provisionCreatorOrg`, (3) read-only agency dashboard + "who's missing what" board with the
`assertCanAccessOrg` guard + negative tests, (4) lightweight manual entitlement fork. Then reach
out. Automated seat billing and agency write-access come only after an agency commits.

## Open decisions (founder + JOURNAL DEC)

1. **Pricing unit:** per active creator/seat vs. tiered bands vs. flat + overage.
2. **Lapse grace policy** for managed creators when the agency's sub fails.
3. **Provisioning model:** agency adds by phone only, or invites creators who self-complete; how the
   creator consents to agency visibility.
4. **Do agencies want capture-only** (you're the WHY layer they plug into their existing bank/books)
   **or full books?** Determines whether reporting stays light (export to their tools) or grows.
