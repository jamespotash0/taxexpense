// Local demo seed for the agency tier (Spec 10). Creates a demo agency, makes YOUR login phone an
// agency admin, and provisions a few demo creators with this-month receipts (a mix of complete and
// needs-attention) so /agency has real signal. Then log in with your phone → /dashboard → "Agency".
//
//   npm run seed:agency -- +15551234567        (your login phone, E.164)
//
// Requires the Supabase SERVICE-ROLE env (loaded via --env-file=.env.local). Inserts clearly-fake
// data (phones in the 555 range that never receive SMS) — run against a dev/staging DB, not prod.
// Idempotent: re-running reuses the existing "Demo Creator Agency" and won't duplicate creators.

import { getSupabaseAdmin } from '../src/lib/supabase';
import { getOrCreateUserByPhone } from '../src/lib/users';
import { createAgency, addAgencyMember, provisionCreatorOrg } from '../src/lib/agency';
import { normalizeToE164 } from '../src/lib/phone';

const AGENCY_NAME = 'Demo Creator Agency';

interface DemoReceipt {
  vendor: string;
  amount: number; // cents
  category: string;
  irc: string;
  pct: number;
  complete: boolean;
  purpose?: string;
  needsReceipt?: boolean;
  missing?: string[];
}

interface DemoCreator {
  name: string;
  receipts: DemoReceipt[];
}

// Sorted on the board by needs-attention desc → Mia (2), Jordan (1), Ava (0).
const DEMO: DemoCreator[] = [
  {
    name: 'Mia Lane',
    receipts: [
      { vendor: 'B&H Photo', amount: 84000, category: 'equipment', irc: '179', pct: 100, complete: false, needsReceipt: true, missing: ['business_purpose'] },
      { vendor: 'Adobe', amount: 5499, category: 'software', irc: '162', pct: 100, complete: true, purpose: 'Creative Cloud subscription' },
      { vendor: 'Uber', amount: 2300, category: 'vehicle_business', irc: '280F', pct: 100, complete: false, missing: ['business_purpose'] },
      { vendor: 'Backdrop Co', amount: 12000, category: 'advertising', irc: '162', pct: 100, complete: true, purpose: 'studio backdrop for shoots' },
    ],
  },
  {
    name: 'Jordan Vale',
    receipts: [
      { vendor: 'Wardrobe Boutique', amount: 18000, category: 'advertising', irc: '162', pct: 100, complete: false, missing: ['business_purpose'] },
      { vendor: 'Ring Light Co', amount: 9900, category: 'equipment', irc: '179', pct: 100, complete: true, purpose: 'lighting for content' },
    ],
  },
  {
    name: 'Ava Stone',
    receipts: [
      { vendor: 'Squarespace', amount: 2300, category: 'software', irc: '162', pct: 100, complete: true, purpose: 'portfolio site' },
      { vendor: 'Canva', amount: 1299, category: 'software', irc: '162', pct: 100, complete: true, purpose: 'thumbnails' },
      { vendor: 'Meta', amount: 7500, category: 'advertising', irc: '162', pct: 100, complete: true, purpose: 'promo for new content' },
    ],
  },
];

async function main() {
  const arg = process.argv[2];
  const phone = arg ? normalizeToE164(arg) : null;
  if (!phone) {
    console.error('Usage: npm run seed:agency -- <your-login-phone, E.164>   e.g. +15551234567');
    process.exit(1);
  }

  const admin = getSupabaseAdmin();

  // 1. Ensure your user exists (your login), and make it an agency admin.
  const { user } = await getOrCreateUserByPhone(phone);

  const { data: existing } = await admin.from('agencies').select('id').eq('name', AGENCY_NAME).maybeSingle();
  const fresh = !existing;
  const agencyId = existing ? (existing.id as string) : await createAgency(AGENCY_NAME);

  // Mark the agency 'active' so its creators are entitled (covered) — the manual billing step.
  await admin.from('agencies').update({ subscription_status: 'active' }).eq('id', agencyId);
  await addAgencyMember(agencyId, user.id, 'admin');
  console.log(`Agency "${AGENCY_NAME}" (${agencyId}) — ${phone} is an admin.`);

  if (!fresh) {
    console.log('Demo agency already existed; reused it (creators left unchanged). You are admin.');
    console.log('Log in with your phone → /dashboard → "Agency".');
    return;
  }

  // 2. Provision demo creators (fake 555 phones, never texted) + this-month receipts.
  const stamp6 = Date.now().toString().slice(-6);
  for (let i = 0; i < DEMO.length; i++) {
    const c = DEMO[i];
    const creatorPhone = `+1555${stamp6}${i}`; // +1 + 10 national digits, unique per run
    const res = await provisionCreatorOrg(agencyId, creatorPhone, c.name);
    if (!res.ok) {
      console.warn(`  skip ${c.name}: ${res.reason}`);
      continue;
    }
    const today = new Date().toISOString().slice(0, 10);
    const rows = c.receipts.map((r) => ({
      organization_id: res.organizationId,
      user_id: res.userId,
      vendor: r.vendor,
      amount_cents: r.amount,
      transaction_date: today,
      payment_account: 'business',
      category: r.category,
      irc_section: r.irc,
      deduction_percentage: r.pct,
      deductible_amount_cents: Math.round(r.amount * (r.pct / 100)),
      business_purpose: r.purpose ?? null,
      substantiation_complete: r.complete,
      needs_receipt: r.needsReceipt ?? false,
      substantiation_missing_fields: r.missing ?? null,
    }));
    const { error } = await admin.from('receipts').insert(rows);
    if (error) throw error;
    const attn = c.receipts.filter((r) => !r.complete).length;
    console.log(`  + ${c.name}: ${c.receipts.length} receipts (${attn} need attention)`);
  }

  console.log('\nDone. Log in with your phone → /dashboard → click "Agency".');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
