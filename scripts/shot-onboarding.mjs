// Ad-hoc visual check for the /start onboarding funnel (not a committed test).
// Walks each step and screenshots it at mobile width. Run: node scripts/shot-onboarding.mjs
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000/start';
const OUT = 'scripts/_onboarding';
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addCookies([{ name: 'locale', value: 'en', url: BASE }]);
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });

  // Step 0 — name
  await page.screenshot({ path: `${OUT}/0-name.png` });
  await page.fill('input[autocomplete="given-name"]', 'Jordan');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(500);

  // Step 1 — work type (select, then Continue)
  await page.screenshot({ path: `${OUT}/1-work-empty.png` });
  await page.click('button[aria-pressed="false"] >> nth=1'); // pick 2nd chip
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/1-work-selected.png` });
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(500);

  // Step 2 — pain free-text
  await page.screenshot({ path: `${OUT}/2-pain.png` });
  await page.fill('textarea', "I never remember why I bought stuff");
  await page.screenshot({ path: `${OUT}/2-pain-filled.png` });
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(500);

  // Step 3 — reveal
  await page.screenshot({ path: `${OUT}/3-reveal.png` });
  await page.click('button:has-text("Show me how to start")');
  await page.waitForTimeout(500);

  // Step 4 — start (shows formatted number)
  await page.screenshot({ path: `${OUT}/4-start.png` });
  console.log('Wrote screenshots to', OUT);
} finally {
  await browser.close();
}
