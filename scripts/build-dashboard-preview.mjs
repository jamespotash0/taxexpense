// Polished mockup of the Tally mobile dashboard (ref: design_refs/IMG_3294.PNG).
// Same content + brand palette (globals.css indigo tokens), cleaner type/spacing/shadows.
// Run: node scripts/build-dashboard-preview.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'previews');
mkdirSync(OUT, { recursive: true });

// Brand tokens (from src/app/globals.css)
const C = {
  bg: '#f7f7fb', surface: '#ffffff', fg: '#16161f', muted: '#6e6e80',
  border: '#e8e8ee', primary: '#5b57e0', primaryHover: '#4843c4', primary50: '#efeefe',
  success: '#178a5d', warnText: '#b5800f', warnBg: '#fbf0d7',
};

const STATUS = `
  <div class="status">
    <div class="time">9:41</div>
    <div class="icons">
      <svg width="18" height="12" viewBox="0 0 18 12"><g fill="#fff">
        <rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/>
        <rect x="10" y="2" width="3" height="10" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></g></svg>
      <svg width="17" height="12" viewBox="0 0 17 12"><path fill="#fff" d="M8.5 2.5c2.6 0 5 1 6.8 2.7l1.4-1.5C14.5 1.5 11.6.3 8.5.3 5.4.3 2.5 1.5.3 3.7l1.4 1.5C3.5 3.5 5.9 2.5 8.5 2.5zm0 3.6c1.5 0 2.9.6 3.9 1.6l1.4-1.5c-1.4-1.4-3.3-2.2-5.3-2.2s-3.9.8-5.3 2.2l1.4 1.5c1-1 2.4-1.6 3.9-1.6zm0 3.5L10.4 11.6 8.5 11.7 6.6 11.6z"/></svg>
      <svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="22" height="12" rx="3.5" fill="none" stroke="#fff" opacity="0.5"/><rect x="2" y="2" width="17" height="9" rx="2" fill="#fff"/><rect x="24" y="4" width="2" height="5" rx="1" fill="#fff" opacity="0.5"/></svg>
    </div>
  </div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-font-smoothing:antialiased; }
  .phone { width:390px; min-height:844px; background:${C.bg}; position:relative;
    font-family:-apple-system, system-ui, "SF Pro Text", sans-serif; color:${C.fg};
    display:flex; flex-direction:column; }
  /* dark browser bar */
  .topbar { background:${C.fg}; color:#fff; padding-bottom:8px; }
  .status { height:50px; display:flex; align-items:flex-end; justify-content:space-between;
    padding:0 28px 4px; font-size:16px; font-weight:600; }
  .icons { display:flex; align-items:center; gap:6px; }
  .url { text-align:center; font-size:13px; color:#c9c9d2; padding-top:7px; letter-spacing:.2px; }
  /* content */
  .content { flex:1; padding:18px 16px 0; display:flex; flex-direction:column; gap:14px; }
  .card { background:${C.surface}; border:1px solid ${C.border}; border-radius:18px;
    box-shadow:0 1px 2px rgba(22,22,31,.04), 0 8px 24px rgba(22,22,31,.05); }
  /* trial */
  .trial { display:flex; align-items:center; justify-content:space-between; padding:15px 18px;
    border-radius:16px; }
  .trial .left { display:flex; align-items:center; gap:9px; font-size:14.5px; color:${C.fg}; }
  .trial .dot { width:8px; height:8px; border-radius:50%; background:${C.primary}; }
  .trial .sub { color:${C.primary}; font-weight:600; font-size:14.5px; }
  /* summary */
  .summary { padding:20px 22px 22px; }
  .label { font-size:13px; color:${C.muted}; letter-spacing:.2px; }
  .big { font-size:46px; font-weight:700; letter-spacing:-1.5px; margin:2px 0 18px;
    font-variant-numeric:tabular-nums; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:18px 16px; }
  .stat .k { font-size:13px; color:${C.muted}; margin-bottom:3px; }
  .stat .v { font-size:19px; font-weight:600; font-variant-numeric:tabular-nums; }
  .v.good { color:${C.success}; }
  .v.warn { color:${C.warnText}; display:inline-flex; align-items:center; gap:7px; }
  .v.warn .pill { background:${C.warnBg}; color:${C.warnText}; font-size:12px; font-weight:700;
    border-radius:20px; padding:2px 9px; }
  /* review */
  .review { padding:20px 22px 22px; }
  .review h3 { font-size:18px; font-weight:700; letter-spacing:-.3px; }
  .review p { font-size:14px; line-height:1.5; color:${C.muted}; margin:8px 0 18px; }
  .btn { display:block; width:100%; text-align:center; background:${C.primary}; color:#fff;
    font-size:16px; font-weight:600; padding:14px; border-radius:13px;
    box-shadow:0 6px 16px rgba(91,87,224,.32); }
  .divider { height:1px; background:${C.border}; margin:20px 0 16px; }
  .past { font-size:15px; font-weight:700; margin-bottom:12px; }
  .past-row { display:flex; align-items:baseline; justify-content:space-between; padding:9px 0; }
  .past-row + .past-row { border-top:1px solid ${C.border}; }
  .past-row .m { font-size:15px; font-weight:500; }
  .past-row .meta { font-size:12.5px; color:${C.muted}; }
  /* filters */
  .filters { display:flex; gap:9px; padding:2px 2px; }
  .fpill { font-size:14px; padding:8px 16px; border-radius:20px; color:${C.muted};
    background:transparent; }
  .fpill.active { background:${C.primary}; color:#fff; font-weight:600; }
  /* actions */
  .actions { display:flex; gap:10px; padding:4px 0 0; }
  .action { flex:1; text-align:center; background:${C.surface}; border:1px solid ${C.border};
    border-radius:13px; padding:13px 6px; font-size:13.5px; font-weight:600; color:${C.fg};
    box-shadow:0 1px 2px rgba(22,22,31,.04); }
  .homebar { width:140px; height:5px; background:${C.fg}; border-radius:3px;
    margin:22px auto 9px; opacity:.9; }
</style></head>
<body><div class="phone">
  <div class="topbar">${STATUS}<div class="url">🔒 tallywhy.com</div></div>
  <div class="content">

    <div class="card trial">
      <div class="left"><span class="dot"></span>11 days left in your free trial</div>
      <div class="sub">Subscribe</div>
    </div>

    <div class="card summary">
      <div class="label">This month</div>
      <div class="big">$140.00</div>
      <div class="grid">
        <div class="stat"><div class="k">Receipts</div><div class="v">3</div></div>
        <div class="stat"><div class="k">Deductible</div><div class="v good">$97.50</div></div>
        <div class="stat"><div class="k">Documented</div><div class="v">2 <span style="color:${C.muted};font-weight:500;font-size:15px">(67%)</span></div></div>
        <div class="stat"><div class="k">Needs attention</div><div class="v warn"><span class="pill">1</span></div></div>
      </div>
    </div>

    <div class="card review">
      <h3>Month-end review</h3>
      <p>Tally’s review agent reads this month’s expenses, checks the IRS rules, and drafts a note to your accountant. You approve before anything sends.</p>
      <div class="btn">Review my month</div>
      <div class="divider"></div>
      <div class="past">Past reviews</div>
      <div class="past-row"><span class="m">May 2026</span><span class="meta">1 flagged · completed · Jun 5</span></div>
      <div class="past-row"><span class="m">April 2026</span><span class="meta">completed · May 4</span></div>
    </div>

    <div class="filters">
      <div class="fpill active">All</div>
      <div class="fpill">Needs attention</div>
      <div class="fpill">This month</div>
    </div>

    <div class="actions">
      <div class="action">Year-end<br>cleanup</div>
      <div class="action">Export CSV</div>
      <div class="action">QuickBooks</div>
    </div>

  </div>
  <div class="homebar"></div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 3 });
await page.setViewportSize({ width: 390, height: 900 });
await page.setContent(html, { waitUntil: 'networkidle' });
const el = await page.$('.phone');
await el.screenshot({ path: join(OUT, '5-dashboard.png') });
await browser.close();
console.log('✓ 5-dashboard.png  —  polished mobile dashboard');
