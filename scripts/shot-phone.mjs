import { chromium } from 'playwright';
const BASE='http://localhost:3000/';
const b = await chromium.launch();
const ctx = await b.newContext();
await ctx.addCookies([{name:'ab_hero',value:'A',url:BASE},{name:'locale',value:'en',url:BASE}]);
const p = await ctx.newPage();
await p.setViewportSize({width:1280,height:1000});
await p.goto(BASE,{waitUntil:'networkidle'});
const phone = p.getByTestId('hero-phone');
await phone.scrollIntoViewIfNeeded();
await p.waitForTimeout(3200); // let the thread play out
await phone.screenshot({path:'/tmp/phone.png'});
await b.close(); console.log('shot done');
