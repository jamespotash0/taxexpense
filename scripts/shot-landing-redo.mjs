// Visual check for the landing redesign: hero (clean montage + consolidated CTA + audience),
// MissingPiece (de-tacky'd why card), TaxSeason (cinematic video tiles). Screenshots full page
// + targeted sections across widths. Run: node scripts/shot-landing-redo.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:3000/';
const WIDTHS = [390, 768, 1280];
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  await context.addCookies([
    { name: 'ab_hero', value: 'A', url: BASE },
    { name: 'locale', value: 'en', url: BASE },
  ]);
  const page = await context.newPage();
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const heroPresent = (await page.getByTestId('hero-video').count()) > 0;
    await page.waitForTimeout(2500);
    // Hero (top of page)
    await page.screenshot({ path: `/tmp/redo_hero_${width}.png` });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    // Scroll the TaxSeason + MissingPiece sections into view so their lazy videos start.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.45));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `/tmp/redo_mid_${width}.png` });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.7));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `/tmp/redo_taxseason_${width}.png` });
    console.log(`${String(width).padStart(4)}px → hero present: ${heroPresent}, h-overflow: ${overflow}px`);
  }
  await context.close();
} finally {
  await browser.close();
}
