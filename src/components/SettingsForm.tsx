'use client';

// Dashboard settings (DEC-014): name, email, org name, accountant email. These are
// collected here (not over SMS). PATCH /api/settings.
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Initial {
  full_name: string;
  email: string;
  organization_name: string;
  accountant_email: string;
}

export function SettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof Initial>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name || null,
          email: form.email || null,
          organization_name: form.organization_name || null,
          accountant_email: form.accountant_email || null,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setStatus('Saved ✓');
      router.refresh();
    } catch {
      setStatus('Save failed — check the fields and try again.');
    } finally {
      setBusy(false);
    }
  }

  const field = 'w-full rounded-md border border-gray-300 px-3 py-2 text-base outline-none focus:border-primary';
  const labelCls = 'text-xs font-medium text-gray-500';

  return (
    <form onSubmit={save} className="space-y-4">
      <div><label className={labelCls}>Your name</label><input className={field} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} /></div>
      <div><label className={labelCls}>Email</label><input type="email" className={field} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" /></div>
      <div><label className={labelCls}>Business name (optional)</label><input className={field} value={form.organization_name} onChange={(e) => set('organization_name', e.target.value)} /></div>
      <div>
        <label className={labelCls}>Accountant email (for &quot;email my accountant&quot;)</label>
        <input type="email" className={field} value={form.accountant_email} onChange={(e) => set('accountant_email', e.target.value)} placeholder="accountant@example.com" />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="rounded-md bg-primary hover:bg-primary-hover px-4 py-2 text-white disabled:opacity-50">Save</button>
        {status && <span className="text-sm text-gray-500">{status}</span>}
      </div>
    </form>
  );
}
