// "Why Tally exists" — the why has a short shelf life (DEC-043). A two-row process contrast:
// the old way (purchase → wait → guess) vs. with Tally (purchase → text → documented, cited).
// Server component (composes Reveal only).
import { Reveal } from '@/components/Reveal';
import type { Dict } from '@/i18n/dictionaries';

const Arrow = () => (
  <svg width="20" height="12" viewBox="0 0 20 12" fill="none" aria-hidden className="shrink-0">
    <path d="M1 6h17m0 0-5-4.5M18 6l-5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Flow({
  label,
  steps,
  tone,
}: {
  label: string;
  steps: readonly string[];
  tone: 'old' | 'new';
}) {
  const isNew = tone === 'new';
  return (
    <div
      className={`rounded-2xl border p-5 sm:p-6 ${
        isNew ? 'border-accent/30 bg-accent-50/50' : 'border-gray-200 bg-white'
      }`}
    >
      <p className={`text-xs font-semibold uppercase tracking-wider ${isNew ? 'text-accent' : 'text-gray-400'}`}>
        {label}
      </p>
      <div className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 ${isNew ? 'text-gray-700' : 'text-gray-500'}`}>
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          return (
            <div key={step} className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
                  isNew
                    ? last
                      ? 'bg-success-50 text-success-700 ring-1 ring-success-600/20'
                      : 'bg-white text-gray-800 ring-1 ring-gray-200'
                    : last
                      ? 'bg-warning-50 text-warning-700'
                      : 'bg-gray-100 text-gray-500'
                }`}
              >
                {isNew && last && <span aria-hidden>✓</span>}
                {step}
              </span>
              {!last && <span className={isNew ? 'text-accent/50' : 'text-gray-300'}><Arrow /></span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WhyTally({ t }: { t: Dict['whyTally'] }) {
  return (
    <>
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">{t.eyebrow}</p>
        <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{t.heading}</h2>
        <p className="mt-4 text-lg text-gray-600">{t.sub}</p>
      </Reveal>
      <Reveal className="mx-auto mt-12 max-w-3xl space-y-4" delay={0.06}>
        <Flow label={t.oldLabel} steps={t.oldSteps} tone="old" />
        <Flow label={t.newLabel} steps={t.newSteps} tone="new" />
      </Reveal>
    </>
  );
}
