// Ad-hoc responsive check for the landing hero (not a committed test).
// Loads each A/B variant at several widths, measures horizontal overflow, and counts
// the rendered line boxes of the headline + subtitle. Run: node scripts/check-hero.mjs
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000/';
const WIDTHS = [360, 390, 768, 1126, 1280, 1440];
const VARIANTS = ['A', 'B', 'C'];

// One rect per visual line for the text inside `el`.
function lineCount(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const tops = new Set();
  for (const r of range.getClientRects()) tops.add(Math.round(r.top));
  return tops.size || 1;
}

const browser = await chromium.launch();
try {
  for (const variant of VARIANTS) {
    const context = await browser.newContext();
    await context.addCookies([
      { name: 'ab_hero', value: variant, url: BASE },
      { name: 'locale', value: 'en', url: BASE },
    ]);
    const page = await context.newPage();
    console.log(`\n=== Variant ${variant} ===`);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(BASE, { waitUntil: 'networkidle' });
      const data = await page.evaluate(() => {
        const h1 = document.querySelector('section h1');
        const sub = document.querySelector('section h1 + p');
        const docW = document.documentElement.scrollWidth;
        const clientW = document.documentElement.clientWidth;
        // Visual line count = element height ÷ its line-height. The squiggle SVG is
        // absolutely positioned so it doesn't inflate the height (unlike getClientRects).
        const lc = (el) => {
          if (!el) return 0;
          const cs = getComputedStyle(el);
          const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
          return Math.round(el.getBoundingClientRect().height / lh);
        };
        return {
          headlineLines: lc(h1),
          subtitleLines: lc(sub),
          overflowPx: docW - clientW,
          headlineFont: h1 ? getComputedStyle(h1).fontSize : '?',
          subFont: sub ? getComputedStyle(sub).fontSize : '?',
        };
      });
      const flag = data.overflowPx > 0 ? '  ⚠ H-OVERFLOW' : '';
      console.log(
        `  ${String(width).padStart(4)}px → headline ${data.headlineLines} lines (${data.headlineFont}), ` +
          `subtitle ${data.subtitleLines} lines (${data.subFont})${flag}`,
      );
      await page.screenshot({ path: `/tmp/hero_${variant}_${width}.png` });
    }
    await context.close();
  }
} finally {
  await browser.close();
}
