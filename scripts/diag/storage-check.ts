// Read-only diagnostic: is receipt-photo storage working end to end?
//   - does the 'receipts' bucket exist?
//   - what objects are in it (per-user folders)?
//   - do recent receipts rows have photo_url set, and does that path resolve in Storage?
// Uses the Supabase REST/Storage API via fetch (avoids supabase-js realtime / WebSocket on Node 20).
// Run: node --import tsx --env-file=.env.local scripts/diag/storage-check.ts
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = 'receipts';
const H = { apikey: key, Authorization: `Bearer ${key}` };

async function listBuckets() {
  const r = await fetch(`${url}/storage/v1/bucket`, { headers: H });
  return r.ok ? ((await r.json()) as Array<{ name: string; public: boolean }>) : (console.log('listBuckets', r.status, await r.text()), []);
}
async function listObjects(prefix: string) {
  const r = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 100, offset: 0, sortBy: { column: 'created_at', order: 'desc' } }),
  });
  return r.ok ? ((await r.json()) as Array<{ name: string; id: string | null }>) : (console.log('list', r.status, await r.text()), []);
}
async function sign(path: string) {
  const r = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 60 }),
  });
  return r.ok;
}

async function main() {
  console.log(`\n# Storage diagnostic — ${url}\n`);

  const buckets = await listBuckets();
  console.log('Buckets:', buckets.map((b) => `${b.name}${b.public ? ' (public)' : ''}`).join(', ') || '(none)');
  console.log(`'${BUCKET}' bucket present: ${buckets.some((b) => b.name === BUCKET) ? 'YES' : 'NO — uploads would fail!'}`);

  const top = await listObjects('');
  console.log(`\nTop-level entries in '${BUCKET}': ${top.length}`);
  for (const e of top) {
    const inner = e.id === null ? await listObjects(e.name) : [];
    console.log(`  ${e.name}${e.id === null ? `/  → ${inner.length} file(s)${inner[0] ? ` e.g. ${inner[0].name}` : ''}` : '  (file)'}`);
  }

  const rr = await fetch(
    `${url}/rest/v1/receipts?select=id,vendor,amount_cents,category,photo_url,needs_receipt,created_at&order=created_at.desc&limit=10`,
    { headers: H },
  );
  if (!rr.ok) { console.log('\nreceipts query ERROR', rr.status, await rr.text()); return; }
  const rows = (await rr.json()) as Array<{ vendor: string | null; amount_cents: number | null; category: string | null; photo_url: string | null; needs_receipt: boolean; created_at: string }>;
  console.log(`\nMost recent ${rows.length} receipts:`);
  for (const r of rows) {
    console.log(`  ${r.created_at?.slice(0, 19)}  ${(r.vendor ?? '—').padEnd(18)} $${((r.amount_cents ?? 0) / 100).toFixed(2).padStart(8)}  ${(r.category ?? '—').padEnd(18)} photo_url=${r.photo_url ?? 'NULL'}  needs_receipt=${r.needs_receipt}`);
  }

  const withPhoto = rows.find((r) => r.photo_url);
  if (withPhoto && withPhoto.photo_url) {
    console.log(`\nNewest photo_url (${withPhoto.photo_url}) resolves in Storage: ${(await sign(withPhoto.photo_url)) ? 'YES ✓' : 'NO ✗ (row points at a missing object)'}`);
  } else {
    console.log('\nNo recent receipt has a photo_url set — nothing to resolve.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
