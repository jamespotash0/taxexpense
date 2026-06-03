'use client';

// Web onboarding (EPIC-9 funnel) — localized (DEC-025). Tappable, animated steps.
// Strings come from the dictionary slice passed by the server /start page.
import { useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import type { Dict } from '@/i18n/dictionaries';

const variants = {
  enter: { opacity: 0, x: 24 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
};

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
        selected ? 'border-accent bg-accent-50 text-accent' : 'border-gray-200 hover:border-gray-300'
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
}: {
  number: string;
  smsHref?: string;
  t: Dict['onboarding'];
}) {
  const TOTAL = 4;
  const [step, setStep] = useState(0);
  const [work, setWork] = useState<string | null>(null);
  const [pain, setPain] = useState<string | null>(null);

  const next = () => setStep((s) => Math.min(s + 1, TOTAL - 1));
  const progress = ((step + 1) / TOTAL) * 100;
  const pick = (setter: (v: string) => void, value: string) => {
    setter(value);
    setTimeout(next, 220);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <motion.div className="h-full rounded-full bg-accent" initial={false} animate={{ width: `${progress}%` }} transition={{ type: 'spring', stiffness: 200, damping: 30 }} />
        </div>

        <div className="flex flex-1 flex-col justify-center py-10">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="0" variants={variants} initial="enter" animate="center" exit="exit">
                <h1 className="text-2xl font-semibold tracking-tight">{t.q1}</h1>
                <p className="mt-2 text-sm text-gray-500">{t.q1sub}</p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {t.work.map((w) => <Chip key={w} label={w} selected={work === w} onClick={() => pick(setWork, w)} />)}
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="1" variants={variants} initial="enter" animate="center" exit="exit">
                <h1 className="text-2xl font-semibold tracking-tight">{t.q2}</h1>
                <p className="mt-2 text-sm text-gray-500">{t.q2sub}</p>
                <div className="mt-6 grid gap-3">
                  {t.pain.map((p) => <Chip key={p} label={p} selected={pain === p} onClick={() => pick(setPain, p)} />)}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="2" variants={variants} initial="enter" animate="center" exit="exit" className="text-center">
                <p className="text-5xl">💬</p>
                <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t.revealTitle}</h1>
                <p className="mt-3 text-gray-600">{t.revealBody}</p>
                <button onClick={next} className="mt-8 w-full rounded-xl bg-primary px-6 py-3.5 font-medium text-white hover:bg-primary-hover">
                  {t.revealButton}
                </button>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="3" variants={variants} initial="enter" animate="center" exit="exit" className="text-center">
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

        {step > 0 && step < 3 && (
          <button onClick={() => setStep((s) => Math.max(s - 1, 0))} className="self-center text-sm text-gray-400 hover:text-gray-600">
            {t.back}
          </button>
        )}
      </div>
    </MotionConfig>
  );
}
