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
        className="btn btn-danger btn-sm"
      >
        {t.deleteMyAccount}
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-3xl bg-error-50 p-5">
      <p className="text-sm text-error-700">
        {t.warningBefore}<span className="font-mono font-semibold">DELETE</span>{t.warningAfter}
      </p>
      <input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="DELETE"
        className="field w-44 bg-white"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={destroy}
          disabled={busy || confirm !== 'DELETE'}
          className="btn btn-sm bg-error-600 text-white hover:bg-error-700"
        >
          {busy ? t.deleting : t.permanentlyDelete}
        </button>
        <button onClick={() => { setOpen(false); setConfirm(''); setError(null); }} className="text-sm font-semibold text-muted hover:text-foreground">
          {t.cancel}
        </button>
      </div>
      {error && <p className="text-sm text-error-700">{error}</p>}
    </div>
  );
}
