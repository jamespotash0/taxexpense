'use client';

// Web onboarding (EPIC-9 funnel) — localized (DEC-025). Tappable, animated steps.
// Strings come from the dictionary slice passed by the server /start page.
// Flow (DEC-048): name → work → pain → how-it-works → text-the-number. The old phone-capture
// step was removed (confusing "skip the setup questions" framing for marginal value); we still
// record the lead on the final step, and the SMS flow asks the 2 remaining setup questions.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { fmt } from '@/i18n/config';
import type { Dict } from '@/i18n/dictionaries';

const STEP_NAMES = ['name', 'work', 'pain', 'how_it_works', 'start'] as const;

const variants = {
  enter: { opacity: 0, x: 24 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
};

// Shared field styling so every text input/textarea reads identically: white card, soft border,
// subtle shadow, accent focus ring. Scales up on desktop (sm:). Matches the work-step chips.
const FIELD =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-base shadow-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30 sm:px-5 sm:py-4 sm:text-lg';
const BTN_PRIMARY =
  'w-full rounded-xl bg-primary px-6 py-3.5 font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40 sm:py-4 sm:text-lg';

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
      className={`rounded-xl border bg-white px-4 py-3 text-left text-sm font-medium shadow-sm transition-all sm:px-5 sm:py-3.5 sm:text-base ${
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
  const TOTAL = 5;
  const QUESTION_STEPS = 3; // name, work, pain — the numbered "Step x of 3" set
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [work, setWork] = useState<string | null>(null);
  const [otherWork, setOtherWork] = useState('');
  const [pain, setPain] = useState('');

  const next = () => setStep((s) => Math.min(s + 1, TOTAL - 1));
  const progress = ((step + 1) / TOTAL) * 100;

  // Funnel instrumentation (DEC-049): a random per-mount session id ties this visitor's step
  // views together so we can compute per-step drop-off. Best-effort, no PII.
  const sessionId = useRef<string>('');
  if (!sessionId.current && typeof crypto !== 'undefined' && crypto.randomUUID) sessionId.current = crypto.randomUUID();
  const fired = useRef<Set<string>>(new Set());
  const track = (s: number, name: string) => {
    if (!sessionId.current) return;
    fetch('/api/onboarding/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true, // survive the navigation when the SMS link is tapped
      body: JSON.stringify({ session_id: sessionId.current, step: s, step_name: name, locale }),
    }).catch(() => {});
  };

  // One step-view event per step (guarded so re-renders / Strict Mode don't double-count).
  useEffect(() => {
    const key = `view:${step}`;
    if (fired.current.has(key)) return;
    fired.current.add(key);
    track(step, STEP_NAMES[step] ?? String(step));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // The last chip ("Something else") reveals a free-text box; that becomes the business type.
  const otherOption = t.work[t.work.length - 1];
  const isOther = work === otherOption;
  const businessType = (isOther ? otherWork.trim() : work) || undefined;
  const workReady = !!work && (!isOther || otherWork.trim().length > 0);

  // Record the funnel lead (name/work/pain) — no phone is collected anymore. Best-effort: the
  // user onboards fully over SMS regardless, so never block on the response.
  const recordLead = () =>
    fetch('/api/onboarding/preseed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: name.trim() || undefined,
        business_type: businessType,
        pain: pain.trim() || undefined,
        locale,
      }),
    }).catch(() => {});

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8 sm:max-w-xl sm:px-8">
        <div className="mb-3 flex justify-end">
          <Link
            href="/"
            className="-mr-1 rounded-lg px-2 py-1 text-sm text-gray-400 transition-colors hover:text-gray-600"
            aria-label={t.exitAria}
          >
            {t.exitLabel}
          </Link>
        </div>
        <div
          role="progressbar"
          aria-label={t.progressAria}
          aria-valuemin={1}
          aria-valuemax={TOTAL}
          aria-valuenow={step + 1}
          className="h-2 w-full overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-gray-200"
        >
          <motion.div className="h-full rounded-full bg-accent" initial={false} animate={{ width: `${progress}%` }} transition={{ type: 'spring', stiffness: 200, damping: 30 }} />
        </div>
        {/* Front-load the wedge (DEC-049): the WHY before any input. */}
        <p className="mt-3 text-center text-xs font-medium text-gray-400">{t.hook}</p>

        <div className="flex flex-1 flex-col justify-center py-10">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="0" variants={variants} initial="enter" animate="center" exit="exit">
                <p className="text-xs font-medium text-accent">{fmt(t.stepOf, { current: 1, total: QUESTION_STEPS })}</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{t.nameTitle}</h1>
                <p className="mt-2 text-sm text-gray-500 sm:text-base">{t.nameSub}</p>
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
                    className={FIELD}
                  />
                  <button type="submit" disabled={!name.trim()} className={`mt-4 ${BTN_PRIMARY}`}>
                    {t.nameContinue}
                  </button>
                </form>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="1" variants={variants} initial="enter" animate="center" exit="exit">
                <p className="text-xs font-medium text-accent">{fmt(t.stepOf, { current: 2, total: QUESTION_STEPS })}</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{t.q1}</h1>
                <p className="mt-2 text-sm text-gray-500 sm:text-base">{t.q1sub}</p>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {t.work.map((w) => (
                    <Chip key={w} label={w} selected={work === w} onClick={() => setWork(w)} />
                  ))}
                </div>
                <AnimatePresence initial={false}>
                  {isOther && (
                    <motion.input
                      key="other"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      type="text"
                      autoFocus
                      value={otherWork}
                      onChange={(e) => setOtherWork(e.target.value)}
                      placeholder={t.otherWorkPlaceholder}
                      className={`mt-3 ${FIELD}`}
                    />
                  )}
                </AnimatePresence>
                <button type="button" onClick={next} disabled={!workReady} className={`mt-6 ${BTN_PRIMARY}`}>
                  {t.continueLabel}
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="2" variants={variants} initial="enter" animate="center" exit="exit">
                <p className="text-xs font-medium text-accent">{fmt(t.stepOf, { current: 3, total: QUESTION_STEPS })}</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{t.q2}</h1>
                <p className="mt-2 text-sm text-gray-500 sm:text-base">{t.q2sub}</p>
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
                    className={`resize-none ${FIELD}`}
                  />
                  <button type="submit" className={`mt-4 ${BTN_PRIMARY}`}>
                    {t.continueLabel}
                  </button>
                </form>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="3" variants={variants} initial="enter" animate="center" exit="exit" className="text-center">
                <p className="text-5xl">💬</p>
                <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{t.revealTitle}</h1>
                <p className="mt-3 text-gray-600 sm:text-lg">{t.revealBody}</p>
                <button
                  onClick={() => {
                    void recordLead();
                    next();
                  }}
                  className={`mt-8 ${BTN_PRIMARY}`}
                >
                  {t.revealButton}
                </button>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="4" variants={variants} initial="enter" animate="center" exit="exit" className="text-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-accent-50 px-3 py-1 text-xs font-medium text-accent">{t.startBadge}</span>
                <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{t.startTitle}</h1>
                {number && <p className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{number}</p>}
                {smsHref && (
                  <a
                    href={smsHref}
                    onClick={() => track(step, 'text_click')}
                    className={`mt-6 block ${BTN_PRIMARY.replace('bg-primary', 'bg-accent').replace('hover:bg-primary-hover', 'hover:bg-accent-hover')}`}
                  >
                    {t.startText}
                  </a>
                )}
                <p className="mt-4 text-xs text-gray-400">{t.startWhatsapp} · {t.startDisclaimer}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {step > 0 && step < 4 && (
          <button onClick={() => setStep((s) => Math.max(s - 1, 0))} className="self-center text-sm text-gray-400 hover:text-gray-600">
            {t.back}
          </button>
        )}
      </div>
    </MotionConfig>
  );
}
