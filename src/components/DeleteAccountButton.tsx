'use client';

// Danger zone: delete account + all data (CCPA/GDPR). Wired to DELETE /api/account.
// Two-step, type-to-confirm to prevent accidental deletion.
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DeleteAccountButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function destroy() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/account', { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete your account. Try again.');
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-error-600 px-4 py-2 text-sm text-error-600 hover:bg-error-50"
      >
        Delete my account
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-error-600 bg-error-50 p-4">
      <p className="text-sm text-error-700">
        This permanently deletes your account, all receipts, and all receipt photos. This cannot
        be undone. Type <span className="font-mono font-semibold">DELETE</span> to confirm.
      </p>
      <input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="DELETE"
        className="w-40 rounded-md border border-gray-300 px-3 py-2 text-base outline-none focus:border-error-600"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={destroy}
          disabled={busy || confirm !== 'DELETE'}
          className="rounded-md bg-error-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? 'Deleting…' : 'Permanently delete'}
        </button>
        <button onClick={() => { setOpen(false); setConfirm(''); setError(null); }} className="text-sm text-gray-500 underline">
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-error-700">{error}</p>}
    </div>
  );
}
