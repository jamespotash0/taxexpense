---
version: 1
slug: "src-app-dashboard-page-tsx"
primary_target: "src/app/dashboard/page.tsx"
related_targets: ["src/app/receipts/[id]/page.tsx","src/app/settings/page.tsx","src/app/login/page.tsx","src/app/agency/page.tsx"]
---

# App surfaces (dashboard, receipts, cleanup, settings, login, agency, IRC, legal)

Mode: Operate (IRC + legal pages: Read). Light only.

Audience/job: solo self-employed user, mostly on a phone, opening the app occasionally to clear what Penny still needs and to export at tax time. Primary task on /dashboard: clear what's missing. Pain to fix: generic look, hard to scan, clunky editing, weak mobile.

Constraints: landing (/, /pricing, /start) untouched; new system is scoped to app routes via an app shell so landing tokens do not change. All copy via i18n (en + es).

## Direction contract

THESIS: Consumer-fintech clarity in the Lemonade / Jerry / Robinhood class (user-pinned, canon path, executed straight). The app opens on "what's missing", not on a stack of bordered cards; refuses the indigo SaaS card list.

OWN-WORLD: White ground, soft gray fills instead of borders, near-black ink, one electric violet brand that owns the to-do region, green for documentation complete, amber for needs. Geist, big tight tabular amounts, pill buttons, 20-28px sheet radii, filled inputs, hairline-divided rows with monogram avatars.

STORY: User sees how many expenses still need them, taps once into the fix, sees exactly which field is missing (highlighted in the editor), saves, and watches the record go green.

FIRST VIEWPORT: Slim top bar (wordmark left, nav right; bottom tab bar on phones). Full-width violet to-do panel: large count sentence, documented-% bar, white pill "Start fixing". Below: month total at display scale with deductible and receipt count inline. Then segmented filter and the activity list.

FORM: canon (user-pinned reference products), seed 5f0999dc. Signature interaction: the documented bar fills on load with exponential ease-out; rows press-scale; missing fields glow amber in the editor.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
