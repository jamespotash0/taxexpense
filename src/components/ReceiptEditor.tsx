'use client';

// Receipt detail editor (TSNAP-040/041). Edit fields → PATCH; upload photo →
// attach-receipt; delete → DELETE. User has final say (AI overridable).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORY_LABELS } from '@/lib/categories';

interface Receipt {
  id: string;
  vendor: string | null;
  amount_cents: number;
  transaction_date: string | null;
  category: string | null;
  payment_account: string | null;
  business_purpose: string | null;
  attendees: string | null;
  business_relationship: string | null;
  location_city: string | null;
  business_miles: number | null;
  notes: string | null;
  photo_url: string | null;
  needs_receipt: boolean;
}

export function ReceiptEditor({ receipt, photoUrl }: { receipt: Receipt; photoUrl: string | null }) {
  const router = useRouter();
  const [form, setForm] = useState({
    vendor: receipt.vendor ?? '',
    amount: (receipt.amount_cents / 100).toFixed(2),
    transaction_date: receipt.transaction_date ?? '',
    category: receipt.category ?? 'personal',
    payment_account: receipt.payment_account ?? 'unknown',
    business_purpose: receipt.business_purpose ?? '',
    attendees: receipt.attendees ?? '',
    business_relationship: receipt.business_relationship ?? '',
    location_city: receipt.location_city ?? '',
    business_miles: receipt.business_miles?.toString() ?? '',
    notes: receipt.notes ?? '',
  });
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/receipts/${receipt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: form.vendor || null,
          amount_cents: Math.round(parseFloat(form.amount || '0') * 100),
          transaction_date: form.transaction_date,
          category: form.category,
          payment_account: form.payment_account,
          business_purpose: form.business_purpose || null,
          attendees: form.attendees || null,
          business_relationship: form.business_relationship || null,
          location_city: form.location_city || null,
          business_miles: form.business_miles ? parseInt(form.business_miles, 10) : null,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setStatus('Saved ✓');
      router.refresh();
    } catch {
      setStatus('Save failed — try again.');
    } finally {
      setBusy(false);
    }
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus('Uploading…');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/receipts/${receipt.id}/attach-receipt`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      setStatus('Receipt attached.');
      router.refresh();
    } catch {
      setStatus('Upload failed — check the file and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Delete this receipt? This cannot be undone.')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/receipts/${receipt.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      router.replace('/dashboard');
      router.refresh();
    } catch {
      setStatus('Delete failed — try again.');
      setBusy(false);
    }
  }

  const field = 'w-full rounded-md border border-gray-300 px-3 py-2 text-base outline-none focus:border-gray-900';
  const labelCls = 'text-xs font-medium text-gray-500';

  return (
    <div className="space-y-4">
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="Receipt" className="max-h-72 rounded-md border border-gray-200 object-contain" />
      )}
      {!photoUrl && receipt.needs_receipt && (
        <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-amber-400 bg-amber-50 px-4 py-6 text-sm text-amber-800">
          <input type="file" accept="image/*,.pdf" className="hidden" onChange={upload} disabled={busy} />
          Upload receipt photo (this expense needs one)
        </label>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className={labelCls}>Vendor</label><input className={field} value={form.vendor} onChange={(e) => set('vendor', e.target.value)} /></div>
        <div><label className={labelCls}>Amount ($)</label><input className={field} inputMode="decimal" value={form.amount} onChange={(e) => set('amount', e.target.value)} /></div>
        <div><label className={labelCls}>Date</label><input type="date" className={field} value={form.transaction_date} onChange={(e) => set('transaction_date', e.target.value)} /></div>
        <div>
          <label className={labelCls}>Category</label>
          <select className={field} value={form.category} onChange={(e) => set('category', e.target.value)}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Payment account</label>
          <select className={field} value={form.payment_account} onChange={(e) => set('payment_account', e.target.value)}>
            <option value="business">Business</option>
            <option value="personal">Personal</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        <div><label className={labelCls}>Business miles</label><input className={field} inputMode="numeric" value={form.business_miles} onChange={(e) => set('business_miles', e.target.value)} /></div>
        <div className="sm:col-span-2"><label className={labelCls}>Business purpose</label><input className={field} value={form.business_purpose} onChange={(e) => set('business_purpose', e.target.value)} /></div>
        <div><label className={labelCls}>Attendees</label><input className={field} value={form.attendees} onChange={(e) => set('attendees', e.target.value)} /></div>
        <div><label className={labelCls}>Business relationship</label><input className={field} value={form.business_relationship} onChange={(e) => set('business_relationship', e.target.value)} /></div>
        <div className="sm:col-span-2"><label className={labelCls}>Notes</label><textarea className={field} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={save} disabled={busy} className="rounded-md bg-gray-900 px-4 py-2 text-white disabled:opacity-50">Save</button>
        {status && <span className="text-sm text-gray-500">{status}</span>}
        <button onClick={remove} disabled={busy} className="text-sm text-red-600 hover:underline">Delete</button>
      </div>
    </div>
  );
}
