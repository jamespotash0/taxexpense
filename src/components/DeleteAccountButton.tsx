'use client';

// Danger zone: delete account + all data (CCPA/GDPR). Wired to DELETE /api/account.
// Two-step, type-to-confirm to prevent accidental deletion.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormSubmit } from '@/lib/use-form-submit';

interface DeleteCopy {
  deleteMyAccount: string;
  warningBefore: string;
  warningAfter: string;
  permanentlyDelete: string;
  deleting: string;
  cancel: string;
  couldNotDelete: string;
  errGeneric: string;
}

export function DeleteAccountButton({ t }: { t: DeleteCopy }) {
  const router = useRouter();
  const { busy, error, setError, submit } = useFormSubmit();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');

  async function destroy() {
    const { ok } = await submit('/api/account', { method: 'DELETE', errorMessage: t.couldNotDelete });
    if (ok) {
      router.replace('/');
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-error-600 px-4 py-2 text-sm text-error-600 hover:bg-error-50"
      >
        {t.deleteMyAccount}
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-error-600 bg-error-50 p-4">
      <p className="text-sm text-error-700">
        {t.warningBefore}<span className="font-mono font-semibold">DELETE</span>{t.warningAfter}
      </p>
      <input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="DELETE"
        className="w-40 rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-error-600"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={destroy}
          disabled={busy || confirm !== 'DELETE'}
          className="rounded-md bg-error-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? t.deleting : t.permanentlyDelete}
        </button>
        <button onClick={() => { setOpen(false); setConfirm(''); setError(null); }} className="text-sm text-muted underline">
          {t.cancel}
        </button>
      </div>
      {error && <p className="text-sm text-error-700">{error}</p>}
    </div>
  );
}
