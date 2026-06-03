// Mobile sweep of the lower landing sections (bento, pricing, footer) at phone widths.
// Scrolls each into view to trigger scroll-reveal, then measures horizontal overflow,
// flags any element spilling past the viewport, checks footer tap targets, screenshots.
// Run: node scripts/check-sections.mjs
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000/';
const WIDTHS = [360, 390, 430];
const LOCALES = ['en', 'es']; // es footer row is longer — worth checking

const browser = await chromium.launch();
try {
  for (const locale of LOCALES) {
    const context = await browser.newContext();
    await context.addCookies([
      { name: 'ab_hero', value: 'A', url: BASE },
      { name: 'locale', value: locale, url: BASE },
    ]);
    const page = await context.newPage();
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(BASE, { waitUntil: 'networkidle' });
      // Scroll through to trigger every reveal, then settle.
      await page.evaluate(async () => {
        for (let y = 0; y <= document.body.scrollHeight; y += 400) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise((r) => setTimeout(r, 500));
      });

      const report = await page.evaluate((vw) => {
        const docOverflow = document.documentElement.scrollWidth - vw;
        // Elements spilling past the right edge (likely overflow culprits).
        const spillers = [];
        for (const el of document.querySelectorAll('section, footer, div, a, button, ul, h1, h2, p, img, input')) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > vw + 1) {
            spillers.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} right=${Math.round(r.right)}`);
          }
        }
        // Footer nav tap targets (links in the footer).
        const footerLinks = [...document.querySelectorAll('footer a')].map((a) => ({
          text: a.textContent.trim().slice(0, 16),
          h: Math.round(a.getBoundingClientRect().height),
        }));
        return { docOverflow, spillers: [...new Set(spillers)].slice(0, 8), footerLinks };
      }, width);

      const flag = report.docOverflow > 0 ? `  ⚠ DOC OVERFLOW +${report.docOverflow}px` : ' ok';
      console.log(`\n[${locale} ${width}px]${flag}`);
      if (report.spillers.length) console.log('   spillers:', report.spillers.join(' | '));
      const tiny = report.footerLinks.filter((l) => l.h < 32);
      if (tiny.length) console.log('   small tap targets (<32px):', tiny.map((l) => `${l.text}=${l.h}px`).join(', '));

      for (const sel of ['#how-it-works', '#pricing', 'footer']) {
        await page.locator(sel).scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        const name = sel.replace(/[#]/g, '');
        await page.locator(sel).screenshot({ path: `/tmp/sec_${locale}_${name}_${width}.png` }).catch(() => {});
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}
