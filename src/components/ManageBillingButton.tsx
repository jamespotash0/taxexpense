'use client';

// Opens the Stripe Billing Portal (DEC-021). If there's no subscription yet, sends the
// user to /pricing instead.
import { useState } from 'react';

export function ManageBillingButton({ t }: { t: { manage: string; opening: string } }) {
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    const res = await fetch('/api/billing/portal', { method: 'POST' });
    if (res.status === 400) {
      window.location.assign('/pricing'); // no subscription yet
      return;
    }
    const data = await res.json().catch(() => null);
    if (res.ok && data?.url) {
      window.location.assign(data.url);
    } else {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={open}
      disabled={busy}
      className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
    >
      {busy ? t.opening : t.manage}
    </button>
  );
}
