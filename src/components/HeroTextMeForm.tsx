'use client';

// Boardy-style "text me first" CTA (hero A/B arm C). Instead of a bare sms: link — which
// dead-ends on desktop and captures no consent/attribution — the visitor enters THEIR number
// and we send the first text. POSTs to /api/hero-optin (rate-limited, sends via Twilio when
// configured, simulates otherwise so the beta works before the number is live).
import { useState } from 'react';
import { track } from '@/lib/analytics';
import type { HeroVariant } from '@/lib/ab';

type Strings = {
  eyebrow: string;
  placeholder: string;
  button: string;
  sending: string;
  success: string;
  consent: string;
  errInvalid: string;
  errRate: string;
  errServer: string;
};

type Status = 'idle' | 'sending' | 'done' | 'error';

export function HeroTextMeForm({ variant, t }: { variant: HeroVariant; t: Strings }) {
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    setError('');
    // Unified top-line conversion event (matches TextNumberCta) so arms stay comparable.
    track('hero_cta_engaged', { experiment: 'hero-cta', variant, method: 'phone_optin' });
    track('hero_optin_submit', { experiment: 'hero-cta', variant });
    try {
      const res = await fetch('/api/hero-optin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone_number: phone }),
      });
      if (res.ok) {
        setStatus('done');
        track('hero_optin_success', { experiment: 'hero-cta', variant });
        return;
      }
      const reason = (await res.json().catch(() => ({})))?.error ?? 'server_error';
      setError(reason === 'invalid_phone' ? t.errInvalid : reason === 'rate_limited' ? t.errRate : t.errServer);
      setStatus('error');
      track('hero_optin_error', { experiment: 'hero-cta', variant, reason });
    } catch {
      setError(t.errServer);
      setStatus('error');
      track('hero_optin_error', { experiment: 'hero-cta', variant, reason: 'network' });
    }
  }

  if (status === 'done') {
    return (
      <div className="reveal-3 mt-8 flex flex-col items-center">
        <p className="inline-flex items-center gap-2 rounded-xl bg-success-50 px-5 py-3.5 text-sm font-medium text-success-700 sm:text-base">
          <span aria-hidden>✓</span>
          {t.success}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="reveal-3 mt-8 flex flex-col items-center">
      <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{t.eyebrow}</span>
      <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t.placeholder}
          aria-label={t.placeholder}
          aria-invalid={status === 'error'}
          className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          className="press inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-base font-medium text-white shadow-lg shadow-accent/20 hover:bg-accent-hover disabled:opacity-70"
        >
          <span aria-hidden>💬</span>
          {status === 'sending' ? t.sending : t.button}
        </button>
      </div>
      {status === 'error' && (
        <p className="mt-2 text-sm text-warning-700" role="alert">
          {error}
        </p>
      )}
      <p className="mt-3 max-w-md text-center text-xs text-gray-400">{t.consent}</p>
    </form>
  );
}
