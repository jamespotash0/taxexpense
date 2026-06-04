'use client';

// Phone-OTP login (TSNAP-035/036). Two phases: phone → code. On success the
// verify endpoint sets the session cookie; we navigate to returnTo/dashboard.
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFormSubmit } from '@/lib/use-form-submit';

interface LoginCopy {
  title: string;
  subtitle: string;
  phonePlaceholder: string;
  sendCode: string;
  sending: string;
  codePlaceholder: string;
  verify: string;
  verifying: string;
  useDifferent: string;
  errSend: string;
  errInvalid: string;
  errGeneric: string;
}

export function LoginForm({ t }: { t: LoginCopy }) {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get('returnTo') || '/dashboard';

  const { busy, error, setError, submit } = useFormSubmit();
  const [phase, setPhase] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    const { ok } = await submit('/api/auth/request-code', {
      body: { phone_number: phone },
      errorMessage: t.errSend,
    });
    if (ok) setPhase('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const { ok } = await submit('/api/auth/verify-code', {
      body: { phone_number: phone, code },
      errorMessage: t.errInvalid,
    });
    if (ok) {
      router.replace(returnTo);
      router.refresh();
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
      <p className="mt-1 text-sm text-muted">{t.subtitle}</p>

      {phase === 'phone' ? (
        <form onSubmit={requestCode} className="mt-6 space-y-3">
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t.phonePlaceholder}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary hover:bg-primary-hover px-4 py-2 text-white disabled:opacity-50"
          >
            {busy ? t.sending : t.sendCode}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-6 space-y-3">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={t.codePlaceholder}
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-center text-lg tracking-[0.4em] outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="w-full rounded-md bg-primary hover:bg-primary-hover px-4 py-2 text-white disabled:opacity-50"
          >
            {busy ? t.verifying : t.verify}
          </button>
          <button
            type="button"
            onClick={() => { setPhase('phone'); setCode(''); setError(null); }}
            className="w-full text-sm text-muted underline"
          >
            {t.useDifferent}
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-error-600">{error}</p>}
    </div>
  );
}
