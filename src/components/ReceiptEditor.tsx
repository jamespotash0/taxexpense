'use client';

// Receipt detail editor (TSNAP-040/041). Edit fields → PATCH; upload photo →
// attach-receipt; delete → DELETE. User has final say (AI overridable).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORY_LABELS } from '@/lib/categories';
import { useFormSubmit } from '@/lib/use-form-submit';
import { Icon } from '@/components/AppIcons';

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
  flagged_for_cpa: boolean;
  substantiation_missing_fields?: string[] | null;
}

interface ReceiptCopy {
  uploadPrompt: string;
  vendor: string;
  amount: string;
  date: string;
  category: string;
  paymentAccount: string;
  business: string;
  personal: string;
  unknown: string;
  businessMiles: string;
  businessPurpose: string;
  attendees: string;
  businessRelationship: string;
  notes: string;
  flagForCpa: string;
  save: string;
  saved: string;
  saveFailed: string;
  delete: string;
  confirmDelete: string;
  uploading: string;
  receiptAttached: string;
  uploadFailed: string;
  deleteFailed: string;
  whyTitle: string;
  whatTitle: string;
  location: string;
  stillNeeds: string;
  needed: string;
  photo: string;
  replacePhoto: string;
}

export function ReceiptEditor({
  receipt,
  photoUrl,
  t,
  categories,
  explainer,
}: {
  receipt: Receipt;
  photoUrl: string | null;
  t: ReceiptCopy;
  categories: Record<string, string>;
  /** IRC explainer, shown inline on phones (desktop shows it in the sidebar). */
  explainer?: React.ReactNode;
}) {
  const router = useRouter();
  const { busy, error, submit } = useFormSubmit();
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
  const [flagged, setFlagged] = useState(receipt.flagged_for_cpa);
  // `notice` carries success/progress copy; failures come from the hook's `error`.
  const [notice, setNotice] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setNotice(null);
    const { ok } = await submit(`/api/receipts/${receipt.id}`, {
      method: 'PATCH',
      errorMessage: t.saveFailed,
      body: {
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
        flagged_for_cpa: flagged,
      },
    });
    if (ok) {
      setNotice(t.saved);
      router.refresh();
    }
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNotice(t.uploading);
    const fd = new FormData();
    fd.append('file', file);
    const { ok } = await submit(`/api/receipts/${receipt.id}/attach-receipt`, { body: fd, errorMessage: t.uploadFailed });
    if (ok) {
      setNotice(t.receiptAttached);
      router.refresh();
    } else {
      setNotice(null);
    }
  }

  async function remove() {
    if (!confirm(t.confirmDelete)) return;
    const { ok } = await submit(`/api/receipts/${receipt.id}`, { method: 'DELETE', errorMessage: t.deleteFailed });
    if (ok) {
      router.replace('/dashboard');
      router.refresh();
    }
  }

  const missing = new Set(receipt.substantiation_missing_fields ?? []);
  const LABEL: Record<string, string> = {
    business_purpose: t.businessPurpose,
    attendees: t.attendees,
    business_relationship: t.businessRelationship,
    location_city: t.location,
    business_miles: t.businessMiles,
  };
  const missingLabels = [...missing].map((k) => LABEL[k]).filter(Boolean);

  // One labelled input. Fields the IRS rules still need glow amber and say so.
  function Field({ k, label, wide, children }: { k: keyof typeof form; label: string; wide?: boolean; children?: React.ReactNode }) {
    const need = missing.has(k);
    const id = `f-${k}`;
    return (
      <div className={wide ? 'sm:col-span-2' : undefined}>
        <label htmlFor={id} className="label flex items-center justify-between gap-2">
          {label}
          {need && <span className="chip chip-need h-5 px-2 text-[0.6875rem]">{t.needed}</span>}
        </label>
        {children ?? (
          <input
            id={id}
            className={`field ${need ? 'field-needed' : ''}`}
            value={form[k]}
            onChange={(e) => set(k, e.target.value)}
            inputMode={k === 'amount' ? 'decimal' : k === 'business_miles' ? 'numeric' : undefined}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {(missingLabels.length > 0 || (receipt.needs_receipt && !photoUrl)) && (
        <div className="rounded-3xl bg-warning-50 px-5 py-4 text-warning-700">
          <p className="text-sm font-semibold">{t.stillNeeds}</p>
          <p className="mt-1 text-[0.9375rem]">
            {[...(receipt.needs_receipt && !photoUrl ? [t.photo] : []), ...missingLabels].join(' · ')}
          </p>
        </div>
      )}

      {photoUrl ? (
        <div className="sheet flex justify-center p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt={t.photo} className="max-h-80 rounded-2xl object-contain" />
        </div>
      ) : receipt.needs_receipt ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-warning-500 bg-warning-50 px-4 py-8 text-center text-[0.9375rem] font-semibold text-warning-700 transition-colors hover:bg-[#ffedc4]">
          <input type="file" accept="image/*,.pdf" className="sr-only" onChange={upload} disabled={busy} />
          <Icon name="camera" size={28} />
          {t.uploadPrompt}
        </label>
      ) : (
        <label className="btn btn-secondary btn-sm cursor-pointer">
          <input type="file" accept="image/*,.pdf" className="sr-only" onChange={upload} disabled={busy} />
          <Icon name="camera" size={16} />
          {t.replacePhoto}
        </label>
      )}

      <section>
        <h2 className="text-lg font-bold tracking-[-0.02em]">{t.whyTitle}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Field({ k: 'business_purpose', label: t.businessPurpose, wide: true })}
          {Field({ k: 'attendees', label: t.attendees })}
          {Field({ k: 'business_relationship', label: t.businessRelationship })}
          {Field({ k: 'location_city', label: t.location })}
          {Field({ k: 'business_miles', label: t.businessMiles })}
          {Field({
            k: 'notes',
            label: t.notes,
            wide: true,
            children: <textarea id="f-notes" className="field" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />,
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold tracking-[-0.02em]">{t.whatTitle}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Field({ k: 'vendor', label: t.vendor })}
          {Field({ k: 'amount', label: t.amount })}
          {Field({
            k: 'transaction_date',
            label: t.date,
            children: <input id="f-transaction_date" type="date" className="field" value={form.transaction_date} onChange={(e) => set('transaction_date', e.target.value)} />,
          })}
          {Field({
            k: 'category',
            label: t.category,
            children: (
              <select id="f-category" className="field" value={form.category} onChange={(e) => set('category', e.target.value)}>
                {Object.keys(CATEGORY_LABELS).map((k) => <option key={k} value={k}>{categories[k] ?? CATEGORY_LABELS[k]}</option>)}
              </select>
            ),
          })}
          {Field({
            k: 'payment_account',
            label: t.paymentAccount,
            children: (
              <select id="f-payment_account" className="field" value={form.payment_account} onChange={(e) => set('payment_account', e.target.value)}>
                <option value="business">{t.business}</option>
                <option value="personal">{t.personal}</option>
                <option value="unknown">{t.unknown}</option>
              </select>
            ),
          })}
        </div>
      </section>

      <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-fill px-4 py-3.5 text-[0.9375rem] font-medium">
        <Icon name="flag" size={18} className="text-muted" />
        <span className="flex-1">{t.flagForCpa}</span>
        <input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} className="size-5 accent-[var(--color-primary)]" />
      </label>

      {/* Save stays in reach on a phone: pinned above the tab bar while editing. */}
      <div className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-3 rounded-full bg-white/95 p-1.5 pl-1.5 shadow-[0_8px_32px_-8px_rgba(11,11,18,0.25)] ring-1 ring-border backdrop-blur sm:bottom-6">
        <button onClick={save} disabled={busy} className="btn btn-primary px-8">{t.save}</button>
        <span aria-live="polite" className={`min-w-0 flex-1 truncate text-sm ${error ? 'text-error-600' : 'text-muted'}`}>
          {error ?? notice ?? ''}
        </span>
      </div>

      {explainer}

      <div className="border-t border-border pt-6">
        <button onClick={remove} disabled={busy} className="btn btn-danger btn-sm">
          <Icon name="trash" size={16} />
          {t.delete}
        </button>
      </div>
    </div>
  );
}
