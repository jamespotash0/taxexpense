# Tally — Product Help (docs-site)

End-user help documentation for Tally, built with [VitePress](https://vitepress.dev) (powered by
Vite). This is a **separate package** from the main Next.js app — it has its own dependencies and
builds/deploys independently, so it won't conflict with the app's React/Next versions.

## Develop

```bash
cd docs-site
npm install
npm run docs:dev      # local dev server with hot reload
```

## Build & preview

```bash
npm run docs:build    # static site → .vitepress/dist
npm run docs:preview  # serve the built site locally
```

## Structure

```
docs-site/
├── .vitepress/
│   └── config.mts        # site config: nav, sidebar, search, theme
├── index.md              # home page (hero + feature cards)
├── guide/                # all help pages (markdown)
│   ├── what-is-tally.md
│   ├── getting-started.md
│   ├── logging-expenses.md
│   ├── receipts-and-photos.md
│   ├── mileage.md
│   ├── substantiation.md
│   ├── corrections.md
│   ├── asking-questions.md
│   ├── dashboard.md
│   ├── exporting.md
│   ├── billing.md
│   ├── privacy-security.md
│   └── faq.md
└── package.json
```

## Editing

Pages are plain Markdown. To add a page, create a `.md` file under `guide/` and add it to the
`sidebar` in [`.vitepress/config.mts`](./.vitepress/config.mts). Search is built-in (local
provider) — no extra setup.

## Deploy

The build output in `.vitepress/dist/` is a static site — host it anywhere (Vercel, Netlify, static
bucket). For Vercel, set the project root to `docs-site/`, build command `npm run docs:build`, and
output directory `.vitepress/dist`.

## Keep it accurate

This site describes real product behavior. The capability facts mirror the grounded fact sheet in
`src/lib/router.ts` and the substantiation rules in `src/lib/substantiation.ts` — if product
behavior changes, update both.
