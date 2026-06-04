// Verify the indigo-led palette migration (JOURNAL DEC-042) on a publicly reachable
// app screen. Login exercises the migrated tokens: neutral-50 page background,
// white-surface inputs, indigo primary button, muted secondary text.
// Asserts the computed body background == neutral-50 (#f7f7fb) and screenshots
// across phone/tablet/desktop. Run: node scripts/shot-tokens.mjs
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000/login';
const WIDTHS = [360, 768, 1280];
const EXPECT_BG = 'rgb(247, 247, 251)'; // #f7f7fb (neutral-50)

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 720 });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);

    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const ok = bg === EXPECT_BG ? 'ok' : `⚠ expected ${EXPECT_BG}`;
    console.log(`[${width}px] body bg = ${bg}  ${ok}`);

    await page.screenshot({ path: `/tmp/tokens-login-${width}.png`, fullPage: true });
  }
  console.log('\nscreenshots: /tmp/tokens-login-{360,768,1280}.png');
} finally {
  await browser.close();
}
