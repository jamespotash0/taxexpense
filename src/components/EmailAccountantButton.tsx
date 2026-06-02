'use client';

// Triggers POST /api/email-accountant (TSNAP-048).
import { useState } from 'react';

export function EmailAccountantButton({ hasAccountantEmail }: { hasAccountantEmail: boolean }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/email-accountant', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not send.');
      setStatus(`Sent to ${data.sent_to}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not send.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={send}
        disabled={busy || !hasAccountantEmail}
        className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        title={hasAccountantEmail ? '' : 'Add an accountant email above first'}
      >
        {busy ? 'Sending…' : 'Email this month to my accountant'}
      </button>
      {status && <p className="text-sm text-gray-500">{status}</p>}
    </div>
  );
}
