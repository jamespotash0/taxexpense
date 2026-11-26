'use client';

// Phone-OTP login (TSNAP-035/036). Two phases: phone → code. On success the
// verify endpoint sets the session cookie; we navigate to returnTo/dashboard.
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFormSubmit } from '@/lib/use-form-submit';

// Landing-world controls (the page no longer sits inside the app shell's .app tokens).
const field =
  'w-full min-h-14 rounded-full bg-[#f4f4f2] px-5 text-lg text-[#101210] outline-none ring-1 ring-transparent transition placeholder:text-[#8a8d88] focus:bg-white focus:ring-2 focus:ring-[#d92d20]/40';
const btn =
  'min-h-14 w-full rounded-full bg-[#d92d20] text-base font-medium text-white transition-colors hover:bg-[#b8241a] disabled:opacity-50';

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
  const raw = params.get('returnTo');
  // Same-origin paths only: "//evil.com" and "/\\evil.com" are protocol-relative off-site redirects.
  const returnTo = raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : '/dashboard';

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
    <div className="w-full">
      <h1 className="text-[2rem] font-medium leading-[1.1] tracking-[-0.035em]">{t.title}</h1>
      <p className="mt-3 text-pretty text-[1rem] leading-[1.5] text-[#6f726d]">{t.subtitle}</p>

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
            className={field}
          />
          <button
            type="submit"
            disabled={busy}
            className={btn}
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
            className={`${field} text-center text-2xl font-semibold tabular-nums tracking-[0.4em]`}
          />
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className={btn}
          >
            {busy ? t.verifying : t.verify}
          </button>
          <button
            type="button"
            onClick={() => { setPhase('phone'); setCode(''); setError(null); }}
            className="w-full py-2 text-[0.92rem] font-medium text-[#6f726d] hover:text-[#101210]"
          >
            {t.useDifferent}
          </button>
        </form>
      )}

      {error && <p role="alert" className="mt-3 text-[0.92rem] font-medium text-[#b8241a]">{error}</p>}
    </div>
  );
}
