'use client';

// /start CTA. On Twilio it's a plain sms: link. On Linq's shared line (DEC-089) a number must be on
// the contact list before its texts reach us, so the same button first takes the visitor's number,
// registers it via /api/hero-optin, then opens Messages. One step either way.

import { useState } from 'react';

type Props = {
  register: boolean;
  number: string;
  smsHref: string;
  t: { text: string; placeholder: string; error: string };
};

const btn =
  'press inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-7 py-3.5 text-base font-medium text-white shadow-lg shadow-accent/20 transition-colors hover:bg-accent-hover disabled:opacity-60';

export function StartTextButton({ register, number, smsHref, t }: Props) {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(!register);

  if (done) {
    return (
      <>
        <p className="mt-8 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">{number}</p>
        <a href={smsHref} className={`${btn} mt-6`}>
          <span aria-hidden>💬</span>
          {t.text}
        </a>
      </>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const res = await fetch('/api/hero-optin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phone }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(true);
    setDone(true);
    window.location.href = smsHref;
  }

  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        aria-label={t.placeholder}
        placeholder={t.placeholder}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="rounded-xl border border-border px-4 py-3.5 text-center text-lg"
      />
      <button type="submit" disabled={busy} className={btn}>
        <span aria-hidden>💬</span>
        {t.text}
      </button>
      {error && <p role="alert" className="text-sm text-red-600">{t.error}</p>}
    </form>
  );
}
