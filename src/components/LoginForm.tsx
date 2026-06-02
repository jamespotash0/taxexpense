'use client';

// Phone-OTP login (TSNAP-035/036). Two phases: phone → code. On success the
// verify endpoint sets the session cookie; we navigate to returnTo/dashboard.
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get('returnTo') || '/dashboard';

  const [phase, setPhase] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not send a code.');
      setPhase('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid code.');
      router.replace(returnTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Log in to Tally</h1>
      <p className="mt-1 text-sm text-gray-500">
        We&apos;ll text a 6-digit code to your phone. (You must have texted Tally at least once.)
      </p>

      {phase === 'phone' ? (
        <form onSubmit={requestCode} className="mt-6 space-y-3">
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(415) 555-1234"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-base outline-none focus:border-gray-900"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-6 space-y-3">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-center text-lg tracking-[0.4em] outline-none focus:border-gray-900"
          />
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="w-full rounded-md bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
          >
            {busy ? 'Verifying…' : 'Verify & log in'}
          </button>
          <button
            type="button"
            onClick={() => { setPhase('phone'); setCode(''); setError(null); }}
            className="w-full text-sm text-gray-500 underline"
          >
            Use a different number
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
