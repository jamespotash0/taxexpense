'use client';

// Dashboard settings (DEC-014): name, email, org name, accountant email. These are
// collected here (not over SMS). PATCH /api/settings.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormSubmit } from '@/lib/use-form-submit';

interface Initial {
  full_name: string;
  email: string;
  organization_name: string;
  accountant_email: string;
  business_type: string;
}

interface SettingsCopy {
  yourName: string;
  email: string;
  businessName: string;
  accountantEmail: string;
  workType: string;
  workTypeHint: string;
  save: string;
  saved: string;
  saveFailed: string;
}

export function SettingsForm({ initial, t }: { initial: Initial; t: SettingsCopy }) {
  const router = useRouter();
  const { busy, error, submit } = useFormSubmit();
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof Initial>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const { ok } = await submit('/api/settings', {
      method: 'PATCH',
      errorMessage: t.saveFailed,
      body: {
        full_name: form.full_name || null,
        email: form.email || null,
        organization_name: form.organization_name || null,
        accountant_email: form.accountant_email || null,
        business_type: form.business_type || null,
      },
    });
    if (ok) {
      setSaved(true);
      router.refresh();
    }
  }

  const field = 'field';
  const labelCls = 'label';

  return (
    <form onSubmit={save} className="space-y-5">
      <label className="block"><span className={labelCls}>{t.yourName}</span><input className={field} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} /></label>
      <label className="block"><span className={labelCls}>{t.email}</span><input type="email" className={field} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" /></label>
      <label className="block"><span className={labelCls}>{t.businessName}</span><input className={field} value={form.organization_name} onChange={(e) => set('organization_name', e.target.value)} /></label>
      <label className="block">
        <span className={labelCls}>{t.workType}</span>
        <input className={field} value={form.business_type} onChange={(e) => set('business_type', e.target.value)} placeholder="e.g. real estate agent" />
        <span className="mt-1.5 block text-xs text-muted">{t.workTypeHint}</span>
      </label>
      <label className="block">
        <span className={labelCls}>{t.accountantEmail}</span>
        <input type="email" className={field} value={form.accountant_email} onChange={(e) => set('accountant_email', e.target.value)} placeholder="accountant@example.com" />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn btn-primary px-8">{t.save}</button>
        {error ? <span className="text-sm text-error-600">{error}</span> : saved && <span className="text-sm text-muted">{t.saved}</span>}
      </div>
    </form>
  );
}
