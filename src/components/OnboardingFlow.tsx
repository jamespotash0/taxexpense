'use client';

// Web onboarding (EPIC-9 funnel) — localized (DEC-025). Tappable, animated steps.
// Strings come from the dictionary slice passed by the server /start page.
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import type { Dict } from '@/i18n/dictionaries';

const variants = {
  enter: { opacity: 0, x: 24 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
};

// White cards that read clearly against the off-white page (#f7f7fb). Three explicit states:
//   inactive → white + light border + subtle shadow
//   hover    → darker border, lifted shadow (only when not selected)
//   active   → accent border + ring + tinted fill (selection is obvious before Continue)
function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-xl border bg-white px-4 py-3 text-left text-sm font-medium shadow-sm transition-all ${
        selected
          ? 'border-accent text-accent ring-2 ring-accent/30 bg-accent-50'
          : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:shadow-md'
      }`}
    >
      {label}
    </button>
  );
}

export function OnboardingFlow({
  number,
  smsHref,
  t,
  locale,
}: {
  number: string;
  smsHref?: string;
  t: Dict['onboarding'];
  locale: string;
}) {
  const TOTAL = 6;
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [work, setWork] = useState<string | null>(null);
  const [pain, setPain] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const next = () => setStep((s) => Math.min(s + 1, TOTAL - 1));
  const progress = ((step + 1) / TOTAL) * 100;

  // Send the funnel answers to the server: always records a lead (name/work/pain — funnel
  // analytics), and pre-seeds the user row when a phone is included so the SMS flow can skip
  // the questions already answered here. `withPhone` is false on the "skip" path.
  const postFunnel = (withPhone: boolean) =>
    fetch('/api/onboarding/preseed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone_number: withPhone && phone.trim() ? phone.trim() : undefined,
        full_name: name.trim() || undefined,
        business_type: work || undefined,
        pain: pain.trim() || undefined,
        locale,
      }),
    }).catch(() => {
      // best-effort — the user can still onboard fully over SMS, so never block the funnel
    });

  // Submit the number: await so the button can show a "Saving…" state, then advance.
  const submitPhone = async () => {
    if (!phone.trim() || submitting) return;
    setSubmitting(true);
    await postFunnel(true);
    setSubmitting(false);
    next();
  };

  // Skip the number: still record the lead (fire-and-forget so it feels instant), then advance.
  const skipPhone = () => {
    void postFunnel(false);
    next();
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
        <div className="mb-3 flex justify-end">
          <Link
            href="/"
            className="-mr-1 rounded-lg px-2 py-1 text-sm text-gray-400 transition-colors hover:text-gray-600"
            aria-label={t.exitAria}
          >
            {t.exitLabel}
          </Link>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-gray-200">
          <motion.div className="h-full rounded-full bg-accent" initial={false} animate={{ width: `${progress}%` }} transition={{ type: 'spring', stiffness: 200, damping: 30 }} />
        </div>

        <div className="flex flex-1 flex-col justify-center py-10">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="0" variants={variants} initial="enter" animate="center" exit="exit">
                <h1 className="text-2xl font-semibold tracking-tight">{t.nameTitle}</h1>
                <p className="mt-2 text-sm text-gray-500">{t.nameSub}</p>
                <form
                  className="mt-6"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (name.trim()) next();
                  }}
                >
                  <input
                    type="text"
                    autoFocus
                    autoComplete="given-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.namePlaceholder}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-base outline-none transition-colors focus:border-accent"
                  />
                  <button
                    type="submit"
                    disabled={!name.trim()}
                    className="mt-4 w-full rounded-xl bg-primary px-6 py-3.5 font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t.nameContinue}
                  </button>
                </form>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="1" variants={variants} initial="enter" animate="center" exit="exit">
                <h1 className="text-2xl font-semibold tracking-tight">{t.q1}</h1>
                <p className="mt-2 text-sm text-gray-500">{t.q1sub}</p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {t.work.map((w) => <Chip key={w} label={w} selected={work === w} onClick={() => setWork(w)} />)}
                </div>
                <button
                  type="button"
                  onClick={next}
                  disabled={!work}
                  className="mt-6 w-full rounded-xl bg-primary px-6 py-3.5 font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t.continueLabel}
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="2" variants={variants} initial="enter" animate="center" exit="exit">
                <h1 className="text-2xl font-semibold tracking-tight">{t.q2}</h1>
                <p className="mt-2 text-sm text-gray-500">{t.q2sub}</p>
                <form
                  className="mt-6"
                  onSubmit={(e) => {
                    e.preventDefault();
                    next();
                  }}
                >
                  <textarea
                    autoFocus
                    rows={4}
                    value={pain}
                    onChange={(e) => setPain(e.target.value)}
                    placeholder={t.painPlaceholder}
                    className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-base shadow-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
                  />
                  <button
                    type="submit"
                    className="mt-4 w-full rounded-xl bg-primary px-6 py-3.5 font-medium text-white transition-colors hover:bg-primary-hover"
                  >
                    {t.continueLabel}
                  </button>
                </form>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="3" variants={variants} initial="enter" animate="center" exit="exit" className="text-center">
                <p className="text-5xl">💬</p>
                <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t.revealTitle}</h1>
                <p className="mt-3 text-gray-600">{t.revealBody}</p>
                <button onClick={next} className="mt-8 w-full rounded-xl bg-primary px-6 py-3.5 font-medium text-white hover:bg-primary-hover">
                  {t.revealButton}
                </button>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="4" variants={variants} initial="enter" animate="center" exit="exit">
                <h1 className="text-2xl font-semibold tracking-tight">{t.phoneTitle}</h1>
                <p className="mt-2 text-sm text-gray-500">{t.phoneSub}</p>
                <form
                  className="mt-6"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitPhone();
                  }}
                >
                  <input
                    type="tel"
                    autoFocus
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t.phonePlaceholder}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-base shadow-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
                  />
                  <button
                    type="submit"
                    disabled={!phone.trim() || submitting}
                    className="mt-4 w-full rounded-xl bg-primary px-6 py-3.5 font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {submitting ? t.phoneSaving : t.continueLabel}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={skipPhone}
                  className="mt-3 w-full text-sm text-gray-400 transition-colors hover:text-gray-600"
                >
                  {t.phoneSkip}
                </button>
                <p className="mt-4 text-center text-xs text-gray-400">{t.phoneDisclaimer}</p>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div key="5" variants={variants} initial="enter" animate="center" exit="exit" className="text-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-accent-50 px-3 py-1 text-xs font-medium text-accent">{t.startBadge}</span>
                <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t.startTitle}</h1>
                <p className="mt-2 text-gray-600">{t.startSub}</p>
                {number && <p className="mt-5 text-2xl font-semibold">{number}</p>}
                <div className="mt-6 flex flex-col gap-3">
                  {smsHref && (
                    <a href={smsHref} className="w-full rounded-xl bg-accent px-6 py-3.5 font-medium text-white hover:bg-accent-hover">
                      {t.startText}
                    </a>
                  )}
                  <p className="text-xs text-gray-400">{t.startWhatsapp}</p>
                </div>
                <p className="mt-6 text-xs text-gray-400">{t.startDisclaimer}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {step > 0 && step < 5 && (
          <button onClick={() => setStep((s) => Math.max(s - 1, 0))} className="self-center text-sm text-gray-400 hover:text-gray-600">
            {t.back}
          </button>
        )}
      </div>
    </MotionConfig>
  );
}
