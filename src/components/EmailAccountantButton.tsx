'use client';

// Triggers POST /api/email-accountant (TSNAP-048).
import { useState } from 'react';
import { fmt } from '@/i18n/config';
import { useFormSubmit } from '@/lib/use-form-submit';

interface EmailCopy {
  button: string;
  sending: string;
  sentTo: string;
  couldNotSend: string;
  addEmailFirst: string;
}

export function EmailAccountantButton({ hasAccountantEmail, t }: { hasAccountantEmail: boolean; t: EmailCopy }) {
  const { busy, error, submit } = useFormSubmit();
  const [sent, setSent] = useState<string | null>(null);

  async function send() {
    setSent(null);
    const { ok, data } = await submit<{ sent_to: string }>('/api/email-accountant', { errorMessage: t.couldNotSend });
    if (ok) setSent(fmt(t.sentTo, { email: data?.sent_to ?? '' }));
  }

  return (
    <div className="space-y-2">
      <button
        onClick={send}
        disabled={busy || !hasAccountantEmail}
        className="btn btn-secondary btn-sm"
        title={hasAccountantEmail ? '' : t.addEmailFirst}
      >
        {busy ? t.sending : t.button}
      </button>
      {!hasAccountantEmail && <p className="text-sm text-muted">{t.addEmailFirst}</p>}
      {error ? <p className="text-sm text-error-600">{error}</p> : sent && <p className="text-sm text-muted">{sent}</p>}
    </div>
  );
}
