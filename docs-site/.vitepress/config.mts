import { defineConfig } from 'vitepress'

// Tally product help site. Built with VitePress (Vite-powered).
// Run from docs-site/: `npm install` then `npm run docs:dev`.
export default defineConfig({
  title: 'Tally Help',
  description: 'How to use Tally — capture the why behind every business expense, by text.',
  lang: 'en-US',
  cleanUrls: true,
  lastUpdated: true,

  // README.md is contributor docs, not a published help page.
  srcExclude: ['README.md'],

  themeConfig: {
    siteTitle: 'Tally · Help',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/guide/getting-started' },
      { text: 'FAQ', link: '/guide/faq' },
      { text: 'tallywhy.com', link: 'https://tallywhy.com' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Start here',
          items: [
            { text: 'What is Tally?', link: '/guide/what-is-tally' },
            { text: 'Getting started', link: '/guide/getting-started' },
          ],
        },
        {
          text: 'Logging expenses',
          items: [
            { text: 'Logging by text', link: '/guide/logging-expenses' },
            { text: 'Receipts & photos', link: '/guide/receipts-and-photos' },
            { text: 'Mileage', link: '/guide/mileage' },
            { text: 'When Tally asks for more', link: '/guide/substantiation' },
            { text: 'Fixing & correcting', link: '/guide/corrections' },
          ],
        },
        {
          text: 'Reviewing & exporting',
          items: [
            { text: 'Asking questions by text', link: '/guide/asking-questions' },
            { text: 'The dashboard', link: '/guide/dashboard' },
            { text: 'Exporting & your accountant', link: '/guide/exporting' },
          ],
        },
        {
          text: 'Account',
          items: [
            { text: 'Plans & billing', link: '/guide/billing' },
            { text: 'Privacy & security', link: '/guide/privacy-security' },
            { text: 'FAQ', link: '/guide/faq' },
          ],
        },
      ],
    },

    footer: {
      message:
        'Tally keeps your records — it is not tax advice. For specific questions, talk to a CPA.',
      copyright: 'Tally · tallywhy.com',
    },

    search: {
      provider: 'local',
    },
  },
})
