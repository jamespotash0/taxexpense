'use client';

// Triggers POST /api/email-accountant (TSNAP-048).
import { useState } from 'react';
import { fmt } from '@/i18n/config';

interface EmailCopy {
  button: string;
  sending: string;
  sentTo: string;
  couldNotSend: string;
  addEmailFirst: string;
}

export function EmailAccountantButton({ hasAccountantEmail, t }: { hasAccountantEmail: boolean; t: EmailCopy }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/email-accountant', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t.couldNotSend);
      setStatus(fmt(t.sentTo, { email: data.sent_to }));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : t.couldNotSend);
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
        title={hasAccountantEmail ? '' : t.addEmailFirst}
      >
        {busy ? t.sending : t.button}
      </button>
      {status && <p className="text-sm text-gray-500">{status}</p>}
    </div>
  );
}
