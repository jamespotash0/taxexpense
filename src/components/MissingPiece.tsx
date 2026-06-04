// "The Missing Piece" — the problem section (council DEC-028, the highest-leverage idea from
// the ChatGPT draft, made product-true). Three receipts you can no longer explain, then the
// cold WHAT your bank keeps vs. the WHY it forgets — the warm half nods to the cinematic
// gradient system and to what Tally actually captures. Server component (composes client
// motion primitives only).
import { Reveal, Stagger, StaggerItem } from '@/components/Reveal';
import type { Dict } from '@/i18n/dictionaries';

// A faux thermal receipt — cold, factual, and unable to answer the one question that matters.
function Receipt({
  merchant,
  amount,
  label,
  hint,
  className,
}: {
  merchant: string;
  amount: string;
  label: string;
  hint: string;
  className?: string;
}) {
  return (
    <div className={`w-[160px] rounded-md bg-white p-4 shadow-xl shadow-gray-900/10 ring-1 ring-black/5 ${className ?? ''}`}>
      <div className="text-center">
        <div className="text-[11px] font-bold uppercase tracking-wide text-gray-800">{merchant}</div>
        <div className="text-[8px] text-gray-400">123 Market St</div>
      </div>
      <div className="my-2.5 space-y-1 border-y border-dashed border-gray-200 py-2.5">
        <div className="h-1 w-full rounded-full bg-gray-100" />
        <div className="h-1 w-4/5 rounded-full bg-gray-100" />
        <div className="h-1 w-3/5 rounded-full bg-gray-100" />
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-[9px] font-medium uppercase tracking-wide text-gray-400">{label}</span>
        <span className="text-sm font-bold text-gray-900">{amount}</span>
      </div>
      {/* The question the receipt can't answer — stamped across it. */}
      <div className="mt-2 text-right">
        <span className="font-serif text-base italic text-accent/70">{hint}</span>
      </div>
    </div>
  );
}

export function MissingPiece({ t }: { t: Dict['missingPiece'] }) {
  const rotations = ['-rotate-[5deg]', 'rotate-[2deg]', 'rotate-[6deg]'];
  const offsets = ['md:translate-y-3', 'md:-translate-y-2', 'md:translate-y-4'];

  return (
    <>
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">{t.eyebrow}</p>
        <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{t.heading}</h2>
        <p className="mt-4 text-lg text-gray-600">{t.sub}</p>
      </Reveal>

      {/* Scattered receipts */}
      <Stagger className="mt-12 flex flex-wrap items-center justify-center gap-5 sm:gap-8">
        {t.receipts.map((r, i) => (
          <StaggerItem key={r.merchant} className={`${offsets[i]}`}>
            <div className="lift">
              <Receipt merchant={r.merchant} amount={r.amount} label={r.label} hint={t.receiptHint} className={rotations[i]} />
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      {/* The contrast: cold WHAT (your bank) vs. warm WHY (the part that counts / what Tally adds). */}
      <Reveal className="mx-auto mt-14 max-w-3xl" delay={0.06}>
        <div className="grid overflow-hidden rounded-3xl shadow-xl shadow-gray-900/10 ring-1 ring-gray-200 md:grid-cols-2">
          {/* Left — the bank's cold record */}
          <div className="bg-white p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t.bankTitle}</p>
            <ul className="mt-4 space-y-3">
              {t.bankItems.map((item) => (
                <li key={item} className="flex items-center gap-3 text-gray-700">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Right — the why it forgets, on the clean brand-indigo (what Tally captures) */}
          <div className="relative overflow-hidden p-8 text-white">
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: 'radial-gradient(120% 120% at 0% 0%, #6366f1 0%, #4f46e5 45%, #4338ca 100%)' }}
            />
            {/* A faint grid sheen keeps the flat indigo from reading as a plain block. */}
            <div aria-hidden className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(60% 60% at 85% 110%, rgba(255,255,255,0.18), transparent 70%)' }} />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70">{t.whyTitle}</p>
              <ul className="mt-4 space-y-3">
                {t.whyItems.map((item) => (
                  <li key={item} className="flex items-center gap-3 font-medium">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px] font-semibold backdrop-blur" aria-hidden>
                      T
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-xl text-center text-sm text-gray-500">{t.footnote}</p>
      </Reveal>
    </>
  );
}
