// Synthetic receipt-image generator for the image categorization eval (scripts/eval/image.ts).
//
// There is no API/network here — it renders plain HTML receipts to PNG with Playwright (already a
// devDependency, same engine scripts/check-hero.mjs uses) and writes them next to this file. The
// PNGs are committed so the eval itself needs no browser. Re-run only when you change the fixture
// set (the receipts are deterministic, so re-running produces identical bytes):
//
//   node --import tsx scripts/eval/fixtures/gen-receipts.ts
//
// Each receipt is deliberately a BARE receipt (vendor + items + total, no business note) — the
// whole point of DEC-068 is that photographing one is itself the business-intent signal, so the
// model must categorize a context-less meal/travel/gift receipt as the strict BUSINESS category.

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

interface Line {
  name: string;
  price: string;
}
interface Receipt {
  file: string;
  vendor: string;
  address: string;
  date: string;
  lines: Line[];
  total: string;
}

// Fixtures span the DEC-068 decision: meal/travel/gift → strict business (must ask the WHY), and
// grocery/office → personal/general (must NOT be over-claimed — Alex/Jordan's guardrail).
const RECEIPTS: Receipt[] = [
  {
    file: 'meal-restaurant.png',
    vendor: "Morton's The Steakhouse",
    address: '400 Main St, Chicago IL',
    date: '04/15/2026',
    lines: [
      { name: 'Ribeye 16oz', price: '52.00' },
      { name: 'Caesar Salad', price: '14.00' },
      { name: 'Cabernet (glass)', price: '18.00' },
    ],
    total: '84.00',
  },
  {
    file: 'hotel.png',
    vendor: 'Marriott Downtown Denver',
    address: '1701 California St, Denver CO',
    date: '04/16/2026',
    lines: [
      { name: 'Room — 1 night', price: '169.00' },
      { name: 'City tax', price: '20.00' },
    ],
    total: '189.00',
  },
  {
    file: 'flight.png',
    vendor: 'United Airlines',
    address: 'SFO → DEN  Economy',
    date: '04/14/2026',
    lines: [
      { name: 'Base fare', price: '288.00' },
      { name: 'Taxes & fees', price: '32.00' },
    ],
    total: '320.00',
  },
  {
    file: 'grocery.png',
    vendor: 'Safeway',
    address: '55 Market St, San Jose CA',
    date: '04/15/2026',
    lines: [
      { name: 'Milk 1gal', price: '4.49' },
      { name: 'Eggs dozen', price: '5.29' },
      { name: 'Bread', price: '3.99' },
      { name: 'Bananas', price: '1.84' },
      { name: 'Chicken breast', price: '12.40' },
      { name: 'Cereal', price: '6.29' },
      { name: 'Misc groceries', price: '8.00' },
    ],
    total: '42.30',
  },
  {
    file: 'office-supplies.png',
    vendor: 'Staples',
    address: '900 Retail Rd, Austin TX',
    date: '04/15/2026',
    lines: [
      { name: 'Printer paper (5 reams)', price: '24.99' },
      { name: 'Gel pens (12pk)', price: '6.49' },
      { name: 'Stapler', price: '5.02' },
    ],
    total: '36.50',
  },
];

function receiptHtml(r: Receipt): string {
  const rows = r.lines
    .map((l) => `<tr><td class="n">${l.name}</td><td class="p">$${l.price}</td></tr>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #6b7280; padding: 32px; font-family: 'Courier New', monospace; }
    .r { width: 320px; background: #fff; color: #111; padding: 22px 20px; margin: 0 auto;
         box-shadow: 0 8px 24px rgba(0,0,0,.35); }
    h1 { font-size: 18px; text-align: center; letter-spacing: .5px; }
    .addr { font-size: 11px; text-align: center; color: #444; margin: 4px 0 14px; }
    .date { font-size: 12px; margin-bottom: 10px; }
    hr { border: none; border-top: 1px dashed #999; margin: 10px 0; }
    table { width: 100%; font-size: 13px; border-collapse: collapse; }
    td { padding: 4px 0; }
    td.p { text-align: right; }
    .tot { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; margin-top: 6px; }
    .foot { font-size: 11px; text-align: center; color: #555; margin-top: 16px; }
  </style></head><body>
    <div class="r" id="r">
      <h1>${r.vendor}</h1>
      <div class="addr">${r.address}</div>
      <div class="date">Date: ${r.date}&nbsp;&nbsp;&nbsp;Card ****4821</div>
      <hr>
      <table>${rows}</table>
      <hr>
      <div class="tot"><span>TOTAL</span><span>$${r.total}</span></div>
      <div class="foot">Thank you for your visit!</div>
    </div>
  </body></html>`;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  for (const r of RECEIPTS) {
    await page.setContent(receiptHtml(r), { waitUntil: 'load' });
    const el = await page.$('#r');
    if (!el) throw new Error(`render failed for ${r.file}`);
    const out = join(here, r.file);
    await el.screenshot({ path: out });
    console.log(`  wrote ${r.file}`);
  }
  await browser.close();
  console.log(`\nDone — ${RECEIPTS.length} receipt fixtures in ${here}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
