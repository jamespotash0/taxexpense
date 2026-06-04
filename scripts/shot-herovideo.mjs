// Ad-hoc visual check for the interactive video hero (HeroVideo). Loads the landing page,
// lets the rAF timeline run into scene 1's thread, and screenshots the hero across widths.
// Run: node scripts/shot-herovideo.mjs
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
    const player = page.getByTestId('hero-video');
    const found = (await player.count()) > 0;
    // Let scene 1's thread type in (beats reveal across ~9s; 4.5s lands mid-conversation).
    await page.waitForTimeout(4500);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    console.log(`${String(width).padStart(4)}px → hero-video present: ${found}, h-overflow: ${overflow}px`);
    await page.screenshot({ path: `/tmp/herovideo_${width}.png` });
  }
  await context.close();
} finally {
  await browser.close();
}
