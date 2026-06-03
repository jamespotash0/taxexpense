import { chromium } from 'playwright';
const BASE='http://localhost:3000/';
const b = await chromium.launch();
for (const w of [390, 1280]) {
  const ctx = await b.newContext();
  await ctx.addCookies([{name:'ab_hero',value:'A',url:BASE},{name:'locale',value:'en',url:BASE}]);
  const p = await ctx.newPage();
  await p.setViewportSize({width:w,height:1000});
  await p.goto(BASE,{waitUntil:'networkidle'});
  const sec = p.locator('#how-it-works');
  await sec.scrollIntoViewIfNeeded();
  await p.waitForTimeout(700);
  await sec.screenshot({path:`/tmp/bento_${w}.png`});
  await ctx.close();
}
await b.close(); console.log('shots done');
