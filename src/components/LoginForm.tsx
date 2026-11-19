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
      <h1 className="text-[2rem] font-bold leading-tight tracking-[-0.03em]">{t.title}</h1>
      <p className="mt-2 text-[0.9375rem] text-muted">{t.subtitle}</p>

      {phase === 'phone' ? (
        <form onSubmit={requestCode} className="mt-8 space-y-3">
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t.phonePlaceholder}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            aria-label={t.phonePlaceholder}
            className="field min-h-14 text-lg"
          />
          <button
            type="submit"
            disabled={busy}
            className="btn btn-primary min-h-14 w-full text-base"
          >
            {busy ? t.sending : t.sendCode}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-8 space-y-3">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={t.codePlaceholder}
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
            aria-label={t.codePlaceholder}
            className="field num min-h-14 text-center text-2xl font-semibold tracking-[0.4em]"
          />
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="btn btn-primary min-h-14 w-full text-base"
          >
            {busy ? t.verifying : t.verify}
          </button>
          <button
            type="button"
            onClick={() => { setPhase('phone'); setCode(''); setError(null); }}
            className="w-full py-2 text-sm font-semibold text-muted hover:text-foreground"
          >
            {t.useDifferent}
          </button>
        </form>
      )}

      {error && <p role="alert" className="mt-3 text-sm font-medium text-error-600">{error}</p>}
    </div>
  );
}
