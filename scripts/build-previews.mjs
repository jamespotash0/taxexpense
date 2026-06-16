// Generates Tally launch preview images: iMessage-style SMS mockups, one per capability.
// Matches design_refs/Tally_SMS.jpeg (SMS-green bubbles, TallyAI header, iOS chrome).
// Run: node scripts/build-previews.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'previews');
mkdirSync(OUT, { recursive: true });

// --- bubble builders -------------------------------------------------------
const linkify = (s) =>
  s.replace(/(tallywhy\.com\/irc\/\d+)/g, '<a href="#">https://$1</a>');

const br = (s) => s.replace(/\n/g, '<br>');
const them = (html, { tail = true } = {}) =>
  `<div class="row them"><div class="bubble gray ${tail ? 'tail' : ''}">${br(html)}</div></div>`;
const me = (html, { tail = true } = {}) =>
  `<div class="row me"><div class="bubble green ${tail ? 'tail' : ''}">${br(html)}</div></div>`;
const photo = (inner) =>
  `<div class="row me"><div class="photo">${inner}</div></div>`;
const stamp = (t) => `<div class="stamp"><b>Text Message</b> · Today ${t}</div>`;

// A tiny CSS receipt graphic for "photo" bubbles (no external asset needed).
const receipt = `
  <div class="receipt">
    <div class="r-top">RECEIPT</div>
    <div class="r-line w70"></div><div class="r-line w50"></div>
    <div class="r-line w80"></div><div class="r-line w40"></div>
    <div class="r-tot"><span>TOTAL</span><span>$92.40</span></div>
    <div class="r-zig"></div>
  </div>`;

// --- scenarios -------------------------------------------------------------
const SCENARIOS = [
  {
    file: '1-categorize.png',
    title: 'Categorize + cite the tax code',
    body: [
      stamp('2:14 PM'),
      me('35 dollar figma subscription'),
      them(
        linkify(
          'Logged ✓ Figma — $35.00, 100% deductible as a software subscription, ' +
            'typically falls under ordinary &amp; necessary business expenses per §162 ' +
            '(tallywhy.com/irc/162). Documentation complete.',
        ),
      ),
      them(
        'Figma $35.00 looks like a recurring subscription — want me to track it ' +
          "monthly so you don't have to re-text it? Reply YES.",
      ),
      me('Yes'),
      them(
        "✓ Tracking Figma $35.00 monthly. I'll check in before each one — nothing " +
          'is logged until you confirm.',
      ),
    ],
  },
  {
    file: '2-receipt-context.png',
    title: 'Asks for the WHY only when the IRS requires it',
    body: [
      stamp('12:48 PM'),
      photo(receipt),
      them(
        linkify(
          'Got it ✓ Sushiya — $92.40, looks like a business meal under §274 ' +
            '(tallywhy.com/irc/274). Meals need a little context to hold up.',
        ),
      ),
      them('Who was this with, and what was the business purpose?', { tail: false }),
      me('Lunch with Dana from Acme, scoping the Q3 redesign'),
      them(
        '✓ Documentation complete. Sushiya $92.40, client meal with Dana (Acme), ' +
          'Q3 redesign scoping. 50% deductible per §274.',
      ),
    ],
  },
  {
    file: '3-mileage.png',
    title: 'Plain English in, deduction out',
    body: [
      stamp('9:02 AM'),
      me('drove 38 miles to the client site in Oakland and back'),
      them(
        linkify(
          'Logged ✓ Vehicle — 38 miles, business travel to client site (Oakland). ' +
            'At the 2026 standard mileage rate that’s about $26.22 deductible per §162 ' +
            '(tallywhy.com/irc/162). Documentation complete.',
        ),
      ),
      them(
        'Suggestion, not advice — confirm with your CPA. Want me to log the return ' +
          'trip separately, or is 38 round-trip?',
        { tail: false },
      ),
      me('that was round trip'),
      them('✓ Got it, 38 round-trip. All set.'),
    ],
  },
  {
    file: '4-export.png',
    title: 'Ask what you’ve logged, export when you’re ready',
    body: [
      stamp('4:30 PM'),
      me('how much have I spent on meals this year?'),
      them(
        'You’ve logged $1,240.50 across 18 business meals this year. That’s about ' +
          '$620.25 deductible at 50% per §274.\n\nSee them on your dashboard: ' +
          'tallywhy.com/dashboard',
      ),
      me('email my accountant'),
      them(
        'You can email this year’s records to sam@cpafirm.com from your dashboard: ' +
          'tallywhy.com/dashboard',
      ),
    ],
  },
];

// --- page template ---------------------------------------------------------
const css = `
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { background:#fff; }
  .phone {
    width:390px; height:844px; background:#fff; position:relative;
    font-family:-apple-system, system-ui, "SF Pro Text", sans-serif;
    color:#000; overflow:hidden; display:flex; flex-direction:column;
  }
  /* status bar */
  .status { height:54px; display:flex; align-items:flex-end; justify-content:space-between;
    padding:0 30px 10px; font-size:16px; font-weight:600; }
  .status .icons { display:flex; align-items:center; gap:6px; }
  .status .icons svg { display:block; }
  /* nav header */
  .nav { display:flex; flex-direction:column; align-items:center; padding:4px 0 10px;
    border-bottom:0.5px solid #d4d4d6; position:relative; background:#fbfbfd; }
  .nav .back { position:absolute; left:14px; top:8px; display:flex; align-items:center;
    color:#0a84ff; font-size:17px; gap:3px; }
  .nav .back .badge { background:#0a84ff; color:#fff; border-radius:10px; font-size:13px;
    font-weight:600; padding:1px 6px; }
  .nav .avatar { width:50px; height:50px; border-radius:50%;
    background:linear-gradient(#b9b9bf,#8e8e93); color:#fff; display:flex;
    align-items:center; justify-content:center; font-size:24px; font-weight:500; }
  .nav .name { font-size:12px; margin-top:3px; color:#000; display:flex; align-items:center; gap:2px; }
  .nav .name span { color:#8a8a8e; }
  /* thread */
  .thread { flex:1; overflow:hidden; padding:10px 12px 6px;
    display:flex; flex-direction:column; gap:3px; background:#fff; }
  .stamp { text-align:center; color:#8a8a8e; font-size:11px; margin:6px 0 10px; }
  .stamp b { color:#3c3c43; font-weight:600; }
  .row { display:flex; margin-top:1px; }
  .row.them { justify-content:flex-start; }
  .row.me { justify-content:flex-end; }
  .bubble { max-width:74%; padding:8px 13px; font-size:16.5px; line-height:1.27;
    border-radius:19px; position:relative; word-wrap:break-word; -webkit-font-smoothing:antialiased; }
  .gray { background:#e9e9eb; color:#000; }
  .green { background:#3bcd5a; color:#fff; }
  .green a { color:#fff; }
  .gray a { color:#0a84ff; text-decoration:underline; }
  .bubble.tail::after { content:""; position:absolute; bottom:0; width:18px; height:18px; }
  .them .bubble.tail::after { left:-6px; background:radial-gradient(circle at top left, transparent 14px, #e9e9eb 0); }
  .me .bubble.tail::after { right:-6px; background:radial-gradient(circle at top right, transparent 14px, #3bcd5a 0); }
  .row.me + .row.them, .row.them + .row.me { margin-top:9px; }
  /* photo bubble */
  .photo { background:#e9e9eb; border-radius:19px; padding:10px; max-width:60%; }
  .receipt { width:150px; background:#fff; border-radius:6px; padding:12px 12px 16px;
    box-shadow:0 1px 3px rgba(0,0,0,.18); font-family:"SF Mono",monospace; }
  .r-top { font-size:11px; letter-spacing:2px; color:#666; text-align:center; margin-bottom:10px; }
  .r-line { height:5px; background:#dcdce0; border-radius:3px; margin:7px 0; }
  .w40{width:40%}.w50{width:50%}.w70{width:70%}.w80{width:80%}
  .r-tot { display:flex; justify-content:space-between; font-size:11px; font-weight:700;
    border-top:1.5px dashed #ccc; margin-top:12px; padding-top:8px; }
  .r-zig { height:6px; margin-top:10px;
    background:linear-gradient(135deg,#fff 33%,transparent 0) 0 0/10px 10px repeat-x,
               linear-gradient(-135deg,#fff 33%,#dcdce0 0) 0 0/10px 10px repeat-x; }
  /* input bar */
  .inputbar { display:flex; align-items:center; gap:9px; padding:8px 12px 6px; border-top:0.5px solid #e0e0e2; }
  .inputbar .plus { width:34px; height:34px; border-radius:50%; background:#e9e9eb; color:#7a7a7e;
    display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:300; }
  .inputbar .field { flex:1; height:34px; border:1px solid #d6d6d8; border-radius:18px;
    display:flex; align-items:center; padding:0 14px; color:#a5a5aa; font-size:16px; }
  .inputbar .mic { margin-left:auto; color:#8a8a8e; }
  .homebar { position:absolute; bottom:8px; left:50%; transform:translateX(-50%);
    width:140px; height:5px; background:#000; border-radius:3px; }
`;

const STATUS = `
  <div class="status">
    <div class="time">9:41</div>
    <div class="icons">
      <svg width="18" height="12" viewBox="0 0 18 12"><g fill="#000">
        <rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/>
        <rect x="10" y="2" width="3" height="10" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></g></svg>
      <svg width="17" height="12" viewBox="0 0 17 12"><path fill="#000" d="M8.5 2.5c2.6 0 5 1 6.8 2.7l1.4-1.5C14.5 1.5 11.6.3 8.5.3S2.5 1.5.3 3.7l1.4 1.5C3.5 3.5 5.9 2.5 8.5 2.5zm0 3.6c1.5 0 2.9.6 3.9 1.6l1.4-1.5c-1.4-1.4-3.3-2.2-5.3-2.2s-3.9.8-5.3 2.2l1.4 1.5c1-1 2.4-1.6 3.9-1.6zm0 3.5L10.4 11.6 8.5 11.7 6.6 11.6z"/></svg>
      <svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="22" height="12" rx="3.5" fill="none" stroke="#000" opacity="0.35"/><rect x="2" y="2" width="17" height="9" rx="2" fill="#000"/><rect x="24" y="4" width="2" height="5" rx="1" fill="#000" opacity="0.4"/></svg>
    </div>
  </div>`;

const NAV = `
  <div class="nav">
    <div class="back"><svg width="11" height="18" viewBox="0 0 11 18"><path d="M9 1L2 9l7 8" stroke="#0a84ff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="badge">2</span></div>
    <div class="avatar">T</div>
    <div class="name">TallyAI <span>›</span></div>
  </div>`;

const INPUT = `
  <div class="inputbar">
    <div class="plus">+</div>
    <div class="field">Text Message · SMS</div>
    <svg class="mic" width="15" height="22" viewBox="0 0 15 22"><rect x="4.5" y="0" width="6" height="12" rx="3" fill="#8a8a8e"/><path d="M1 9a6.5 6.5 0 0 0 13 0M7.5 15.5V20M4 20h7" stroke="#8a8a8e" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
  </div>
  <div class="homebar"></div>`;

const html = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body><div class="phone">${STATUS}${NAV}<div class="thread">${body.join('')}</div>${INPUT}</div></body></html>`;

// --- render ----------------------------------------------------------------
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 3 });
await page.setViewportSize({ width: 390, height: 844 });
for (const s of SCENARIOS) {
  await page.setContent(html(s.body), { waitUntil: 'networkidle' });
  const el = await page.$('.phone');
  await el.screenshot({ path: join(OUT, s.file) });
  console.log(`✓ ${s.file}  —  ${s.title}`);
}
await browser.close();
console.log(`\nWrote ${SCENARIOS.length} previews to public/previews/`);
