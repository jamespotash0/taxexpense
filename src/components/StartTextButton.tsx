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
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#d92d20] px-6 py-3.5 text-[1rem] font-medium text-white transition-colors hover:bg-[#b8241a] disabled:opacity-60';

const icon = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H9l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5z" />
  </svg>
);

export function StartTextButton({ register, number, smsHref, t }: Props) {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(!register);

  if (done) {
    return (
      <>
        <p className="mt-9 text-[2.25rem] font-medium tracking-[-0.03em] text-[#101210]">{number}</p>
        <a href={smsHref} className={`${btn} mt-5`}>
          {icon}
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
    <form onSubmit={submit} className="mt-9 max-w-[32rem]">
      <div className="flex items-center gap-2 rounded-full bg-white p-1.5 pl-5 shadow-[0_8px_30px_-12px_rgba(16,18,16,0.18)] ring-1 ring-black/[0.08] focus-within:ring-2 focus-within:ring-[#d92d20]/40">
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          aria-label={t.placeholder}
          aria-invalid={error}
          placeholder={t.placeholder}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="min-w-0 flex-1 bg-transparent py-2 text-[1.05rem] text-[#101210] outline-none placeholder:text-[#8a8d88]"
        />
        <button type="submit" disabled={busy} className={btn}>
          {icon}
          <span className="hidden sm:inline">{t.text}</span>
          <span className="sm:hidden">{t.text.split(' ')[0]}</span>
        </button>
      </div>
      {error && <p role="alert" className="mt-2 pl-5 text-[0.9rem] text-[#b8241a]">{t.error}</p>}
    </form>
  );
}
