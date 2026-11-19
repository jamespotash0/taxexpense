---
name: Tally (app world)
description: Consumer-fintech clarity for capturing the WHY behind every business expense.
colors:
  violet: "#4f3bff"
  violet-deep: "#3d2ae0"
  violet-mist: "#efedff"
  ink: "#0b0b12"
  slate-muted: "#696978"
  placeholder: "#8b8b99"
  paper: "#ffffff"
  fill: "#f4f4f7"
  fill-strong: "#e9e9ef"
  hairline: "#ececf1"
  complete-tint: "#e3f8ee"
  complete: "#00b86b"
  complete-strong: "#00965a"
  complete-ink: "#007a45"
  needs-tint: "#fff4dc"
  needs: "#ffb224"
  needs-ink: "#8a5300"
  error-tint: "#fdecec"
  error: "#d93036"
  error-ink: "#b4232a"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 7vw, 3.5rem)"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "-0.04em"
    fontFeature: "\"tnum\", \"ss01\", \"cv11\""
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  body-strong:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
  caption:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
rounded:
  ledger-row: "12px"
  field: "14px"
  row: "16px"
  card: "24px"
  sheet: "28px"
  pill: "999px"
spacing:
  page-phone: "16px"
  page-desktop: "24px"
  panel: "24px"
  rail: "352px"
  rail-gap: "48px"
components:
  button-primary:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    typography: "{typography.body-strong}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.violet-deep}"
  button-secondary:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.fill-strong}"
  button-white:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.violet}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.error-tint}"
    textColor: "{colors.error-ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  field:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "11px 15px"
    height: "48px"
  field-needed:
    backgroundColor: "{colors.needs-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
  chip-done:
    backgroundColor: "{colors.complete-tint}"
    textColor: "{colors.complete-ink}"
    rounded: "{rounded.pill}"
    typography: "{typography.caption}"
    height: "26px"
  chip-need:
    backgroundColor: "{colors.needs-tint}"
    textColor: "{colors.needs-ink}"
    rounded: "{rounded.pill}"
    typography: "{typography.caption}"
    height: "26px"
  chip-muted:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.slate-muted}"
    rounded: "{rounded.pill}"
    typography: "{typography.caption}"
    height: "26px"
  segmented:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.slate-muted}"
    rounded: "{rounded.pill}"
    padding: "4px"
  sheet:
    backgroundColor: "{colors.fill}"
    rounded: "{rounded.sheet}"
    padding: "{spacing.panel}"
  todo-panel:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sheet}"
    padding: "28px 24px"
---

# Design System: Tally (app world)

## Overview

**Creative North Star: "The Clear Ledger"**

The app world is consumer-fintech clarity in the Lemonade / Jerry / Robinhood class: a white ground, soft gray fills where other products draw borders, near-black ink, and one electric violet that owns the to-do region. Every screen opens on what still needs the user, not on a stack of bordered cards. Success is quiet (a green check), anything that needs the user is loud (an amber chip that names what is missing).

Density is calm on phones and ledger-tight on desktop. Money is the hero type: large, tight, tabular amounts in Geist. Depth comes from tonal fills, not shadows. Motion is limited to one authored moment (the documented bar filling on load) plus press feedback on rows and buttons.

**Scope.** This world applies only to the app surfaces rendered inside the app shell: `/dashboard`, `/dashboard/cleanup`, `/receipts/[id]`, `/settings`, `/login`, `/agency`, `/agency/[orgId]`, `/irc/[section]`, `/privacy`, `/terms`. The landing surfaces (`/`, `/pricing`, `/start`) deliberately keep their own older indigo tokens (`#5b57e0`, system font stack, 6px radius) defined in the root `@theme`. The divergence is intentional. Do not "fix" the landing to match this world, and do not pull landing tokens into the app. App tokens are scoped by the `.app` class so the two never bleed.

**Key Characteristics:**
- Light mode only. No dark theme.
- White ground, gray fills instead of borders, hairlines only between list rows.
- One violet brand color; green means documentation complete, amber means needs you.
- Geist with tabular, tightly tracked numerals; big amounts at display scale.
- Pills for actions, filters and status; 24 to 28px radii for panels.
- Desktop and phone are two deliberately different layouts, not one responsive stack.
- Activity is always grouped by month.

## Colors

A near-monochrome white-and-ink canvas with a single electric violet and two working status hues.

### Primary
- **Electric Violet** (violet): primary buttons, the full-bleed to-do panel, active bottom-tab label, focus ring, text caret, links. It marks "the thing to do next".
- **Deep Violet** (violet-deep): hover and pressed state of violet actions; selection text.
- **Violet Mist** (violet-mist): selection background, the 4px focus halo on fields, hover of the white button.

### Secondary
- **Documentation Green** (complete, complete-strong, complete-ink, complete-tint): only for "Documentation complete". The check icon in phone rows uses the strong shade; chips use ink on tint; the all-done panel uses the tint ground with ink text.

### Tertiary
- **Needs-You Amber** (needs, needs-ink, needs-tint): anything that needs the user. Chips, needed fields, monogram avatars of rows that need attention, the review eye icon, trial-ended notice. Small text always uses the ink shade (needs-ink), never the base amber.

### Neutral
- **Ink** (ink): primary text and amounts.
- **Slate** (slate-muted): secondary text, column headers, inactive tabs, metadata lines.
- **Placeholder Gray** (placeholder): input placeholders only.
- **Paper** (paper): page ground and surfaces.
- **Fill / Fill Strong** (fill, fill-strong): the replacement for borders. Sheets, fields, secondary buttons, segmented tracks, muted chips, row hover; strong for hover on fills and the scrollbar thumb.
- **Hairline** (hairline): dividers between list rows, ledger header rule, header and tab-bar bottom/top edge (at 70% opacity).
- **Error** (error-ink on error-tint, error): destructive buttons and error text only.

### Named Rules
**The One Violet Rule.** Violet is the only brand hue and it belongs to action and to the to-do region. Never use it for status, decoration, or charts.

**The Status Pair Rule.** Green means documentation complete and nothing else; amber means the user must act and nothing else. Status is always carried by an icon or word as well as the hue.

**The Fill-Not-Border Rule.** Group content with a gray fill, not an outline. Borders exist only as hairlines between rows and under sticky chrome.

## Typography

**Display Font:** Geist (via next/font, `--font-app`), falling back to the system sans stack
**Body Font:** Geist
**Label/Mono Font:** Geist with tabular numerals (no separate mono)

**Character:** One modern grotesk at every level, with stylistic sets ss01 and cv11 on. Hierarchy comes from weight and tight negative tracking on large sizes, not from a second family.

### Hierarchy
- **Display**: the month's spent total on phones. Desktop rail uses the same treatment fixed at 2.25rem.
- **Headline**: the to-do panel sentence (1.5rem in compact mode) and the desktop "Activity" heading; balanced wrapping.
- **Title**: section headings on phones ("Activity").
- **Body / Body Strong**: row vendor names (strong), panel body copy, editor copy.
- **Label**: form labels, stats terms, metadata lines under vendors (regular weight, slate).
- **Caption**: chips, ledger column headers, phone tab labels (0.6875rem).

### Named Rules
**The Tabular Money Rule.** Every amount, date in a ledger column, percentage and count uses tabular numerals with -0.02em tracking (the `num` treatment) so columns align.

**The No Kicker Rule.** Headings stand alone. No eyebrow, kicker, or small uppercase label above a heading; context such as "Spent this month · November 2026" sits as a muted label directly above the number it describes.

## Layout

The app shell is a sticky white top bar (56px phone, 64px desktop, translucent with backdrop blur) whose content caps at 1280px (max-w-7xl): wordmark left, pill nav right. Page content sits in a centered column (768px default, wider where a page asks for it) with 16px phone and 24px desktop gutters.

**Two layouts, not one stack (founder requirement).**
- **Desktop (lg, 1024px and up):** a 352px sticky left rail (to-do panel, spent sheet, trial notice, export buttons) plus a 48px gap and a month-grouped ledger table. The ledger uses a fixed column grid (Date 4.5rem, Vendor flexible, Deductible 7.5rem, Status 12rem, Amount 6.5rem right-aligned) with a slate caption header row and sticky month headers that show count and month total.
- **Phone (below lg):** an app-style feed. To-do panel first, then the display-scale total and stats, then the "Activity" title, segmented filter, export pills, and the feed with sticky month headers (month name left, total right). Below 640px a fixed bottom tab bar (icon over label, respects the safe-area inset) replaces the header nav; content gets 112px bottom padding to clear it.

Activity is always grouped by month, newest first, on both layouts. Stats are an inline definition list (term in slate, value semibold tabular) rather than stat cards.

### Named Rules
**The Two Dashboards Rule.** Do not collapse the desktop ledger into stacked cards or stretch the phone feed into a table. Each breakpoint gets its own layout.

**The Month Group Rule.** Lists of expenses are always grouped under sticky month headers carrying the month total.

## Elevation & Depth

Flat by default. Depth is tonal: paper ground, gray fill sheets, and the saturated violet panel as the single high-contrast plane. Sticky chrome uses translucency and blur rather than shadow. Shadows appear only on things that float above content.

### Shadow Vocabulary
- **Segment lift** (`0 1px 2px rgba(11,11,18,0.08), 0 2px 8px -2px rgba(11,11,18,0.08)`): the selected option inside a segmented control.
- **Floating bar** (`0 8px 32px -8px rgba(11,11,18,0.25)` plus a 1px hairline ring): the sticky save bar in the receipt editor.
- **Modal** (`0 24px 64px -16px rgba(11,11,18,0.35)`): dialogs and bottom sheets such as the month-end review.

### Named Rules
**The Floats-Only Shadow Rule.** A shadow means the element floats over scrolling content. Resting panels, cards and rows never carry one.

## Shapes

Soft and rounded throughout. Actions, filters, chips and status are full pills. Panels use generous radii: the to-do panel and fill sheets at 28px, notices and empty states at 24px. Phone feed rows press into a 16px rounded highlight; desktop ledger rows into 12px. Fields are 14px. Monogram avatars and status icons are circles. Focus outlines are 2px violet with a 2px offset and a 10px radius. The one dashed border in the system is the amber receipt-upload drop zone in the editor, where it signals "put something here".

## Components

### Buttons
Pill-shaped, confident, tactile.
- **Shape:** full pill (999px), 44px tall, 20px side padding, 15px semibold; small size 36px tall, 14px text.
- **Primary:** violet with white text; hover deep violet.
- **Secondary:** gray fill with ink text; hover fill-strong. Used for exports and lesser actions.
- **White:** white with violet text, only on the violet panel or on a fill track ("Start fixing", "Subscribe").
- **Danger:** error tint with error ink.
- **States:** press scales to 0.97 with the expo ease; disabled at 45% opacity. Icons sit inline at 16 to 18px with an 8px gap.

### Chips
- **Style:** 26px pill, 12px semibold, icon (14px) plus label. Done = green ink on green tint; Need = amber ink on amber tint; Muted (pending) = slate on fill. The large badge variant on the receipt page is 32px with 13px text and 16px icons.
- **Phone:** in feed rows the chip shrinks to its icon and the words move into the text column in amber ink.

### Cards / Containers
- **Sheet:** fill ground, 28px radius, 24px padding, no border, no shadow.
- **To-do panel:** violet ground, white text, 28px radius. Count sentence at headline scale, documented-% bar (8px track at white 20%, white fill), up to three translucent white rows (12% white, hover 20%) linking to the fix, then the white pill.
- **All-done panel:** green tint with a solid green circle check and green ink text.
- **Notices:** 24px-radius tint blocks (amber for trial ended, green for success).

### Inputs / Fields
- **Style:** filled, not outlined: fill ground, 14px radius, 48px tall, 16px text, 1.5px transparent border; hover fill-strong.
- **Focus:** white ground, violet border and a 4px violet-mist halo.
- **Needed:** amber tint with amber border, plus a small "needed" amber chip beside the label. This is the editor's signature: the missing field glows amber.
- **Select:** same field with a custom slate chevron.
- **Label:** 13px semibold ink, 6px above the field.

### Navigation
- **Desktop header:** pill links, 14px semibold; active = fill pill with ink text, inactive slate turning ink on hover. Logout is a slate icon-plus-label pill.
- **Phone tab bar:** fixed bottom, white 95% with blur and hairline top edge; 22px stroke icon over an 11px semibold label; active violet, inactive slate.
- **Segmented control:** fill track with 4px padding; options are 36px pills in slate; the current option becomes white with ink text and the segment lift shadow. Also used for the app's text language switcher (EN / ES); the flag variant belongs to the landing only.

### Icons
One stroke set: 24px grid, 2px stroke, round caps and joins, `currentColor`. Decorative by default, labelled when they carry meaning. No emoji, no Unicode glyphs, no second icon family.

### Expense Row (signature)
- **Phone feed row:** 44px circular monogram (vendor initial; amber tint and amber ink when the expense needs the user, fill otherwise), vendor in body strong, a slate meta line (date · category), the need label in amber ink when relevant, a slate tax line (deductible share · IRC section), and on the right the tabular amount above the status (green check or icon chip). Rows are divided by hairlines and press into a 16px fill highlight with a 0.985 scale.
- **Desktop ledger row:** one line per expense on the ledger column grid; vendor with category beneath, deductible and section in tabular slate, a full-label chip, right-aligned semibold amount. Same fill hover and press.
- **Review flag:** a 16px amber eye icon after the vendor when the record needs review.

### Motion
- **Bar grow:** the documented bar fills from 2% over 1.2s with `cubic-bezier(0.16, 1, 0.3, 1)` after 0.15s. The one authored moment.
- **Rise in:** 8px rise and fade over 0.5s on the same ease for arriving notices and dialogs.
- **Press:** buttons scale 0.97, rows 0.985; color transitions 150 to 180ms.
- All of the above switch off under reduced motion.

## Do's and Don'ts

### Do:
- **Do** scope every app surface inside the app shell so the `.app` tokens and Geist apply.
- **Do** lead each surface with what still needs the user; violet owns that region.
- **Do** group content with gray fills (sheet, field, segmented track) instead of outlines.
- **Do** set every amount, count and percentage in tabular numerals with tight tracking; hero totals at display scale.
- **Do** pair every status color with an icon or word: green check for "Documentation complete", amber chip naming what is missing.
- **Do** keep the desktop ledger and the phone feed as separate layouts, both grouped by month with sticky month headers.
- **Do** use the single stroke icon set (24px grid, 2px stroke) for every icon.
- **Do** honor reduced motion for bar grow, rise in and press scaling.

### Don't:
- **Don't** apply these tokens to `/`, `/pricing` or `/start`, and don't port landing indigo, flags or the 6px radius into the app.
- **Don't** add a dark mode; the app is light only.
- **Don't** put an em dash in user-facing copy.
- **Don't** write "audit-ready"; the status is "Documentation complete".
- **Don't** place kickers or eyebrows (small uppercase labels) above headings.
- **Don't** use emoji or Unicode glyphs as icons.
- **Don't** use violet for status or green and amber for anything but their status meaning.
- **Don't** put shadows on resting cards, panels or rows; shadows are for floating bars, selected segments and dialogs.
- **Don't** wrap expenses in bordered cards or show an ungrouped activity list.
