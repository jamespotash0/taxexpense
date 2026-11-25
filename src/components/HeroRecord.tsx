'use client';

// Landing hero: one text becomes one numbered expense record. The text bubble sits on the leaf's
// corner; the fields fill in order, the Why line types last, then the record is marked complete
// and the serial ticks to the next number. Plays once. First paint (no JS, reduced motion) is the
// finished record. Values are an illustrative example.
import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { Dict } from '@/i18n/dictionaries';

const FIELDS = 4; // date, paid to, amount, category; then why, then complete
const DONE = FIELDS + 2;

export function HeroRecord({ t }: { t: Dict['hero']['record'] }) {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(DONE);
  const [typed, setTyped] = useState(t.whyValue.length);
  const s = reduced ? DONE : step;
  const why = reduced ? t.whyValue : t.whyValue.slice(0, typed);

  useEffect(() => {
    if (reduced) return;
    let alive = true;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      setStep(0);
      setTyped(0);
      await wait(900);
      for (let i = 1; i <= FIELDS && alive; i++) {
        setStep(i);
        await wait(280);
      }
      if (!alive) return;
      setStep(FIELDS + 1);
      for (let i = 1; i <= t.whyValue.length && alive; i++) {
        setTyped(i);
        await wait(28 + Math.random() * 30);
      }
      await wait(350);
      if (alive) setStep(DONE);
    })();
    return () => {
      alive = false;
    };
  }, [reduced, t.whyValue]);

  const rows: [string, string][] = [
    [t.date, t.dateValue],
    [t.paidTo, 'Sweetgreen'],
    [t.amount, '$92.40'],
    [t.category, t.categoryValue],
  ];
  const shown = (i: number) => (s > i ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1');

  return (
    <figure className="relative mx-auto w-full max-w-[26rem] pt-10 lg:mr-0">
      {/* The text it came from */}
      <div className="absolute left-0 top-0 z-10 flex max-w-[20rem] items-center gap-2.5 rounded-[18px] rounded-bl-[6px] bg-[#101210] py-2.5 pl-2.5 pr-4 text-[0.92rem] leading-snug text-white shadow-[0_12px_28px_-14px_rgba(16,18,16,0.6)] sm:-left-8">
        <span aria-hidden className="flex h-9 w-7 shrink-0 flex-col justify-center gap-[3px] rounded-[4px] bg-white px-1.5">
          <span className="h-[2px] rounded-full bg-[#101210]/70" />
          <span className="h-[2px] w-3/4 rounded-full bg-[#101210]/30" />
          <span className="h-[2px] rounded-full bg-[#101210]/30" />
          <span className="h-[2px] w-1/2 rounded-full bg-[#101210]/70" />
        </span>
        {t.whyValue}
      </div>

      {/* Carbon copy, peeking out beneath */}
      <div aria-hidden className="absolute inset-x-3 bottom-[-0.75rem] top-14 rounded-[6px] bg-[#e7e7e4]" />

      {/* The record leaf */}
      <div className="relative rounded-[6px] bg-white px-6 pb-6 pt-14 shadow-[0_1px_2px_rgba(16,18,16,0.06),0_30px_60px_-30px_rgba(16,18,16,0.35)] ring-1 ring-black/[0.05] sm:px-7">
        <div className="flex items-baseline justify-between">
          <figcaption className="text-[0.95rem] text-[#101210]">{t.label}</figcaption>
          <span className="tabular-nums text-[0.95rem] tracking-[0.02em] text-[#d92d20]">
            No. {s >= DONE ? '000142' : '000141'}
          </span>
        </div>

        <dl className="mt-5 border-t border-black/[0.08] text-[0.95rem]">
          {rows.map(([k, v], i) => (
            <div key={k} className="flex items-baseline justify-between gap-6 border-b border-black/[0.08] py-3">
              <dt className="text-[#6f726d]">{k}</dt>
              <dd className={`text-right tabular-nums text-[#101210] transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${shown(i)}`}>{v}</dd>
            </div>
          ))}
          <div className="py-3">
            <dt className="text-[#6f726d]">{t.why}</dt>
            <dd className="mt-1 min-h-[2.6rem] text-[1.35rem] leading-[1.2] tracking-[-0.01em] text-[#101210]">
              {why}
              {s === FIELDS + 1 && <span aria-hidden className="caret-blink ml-[2px] inline-block h-[1em] w-[2px] translate-y-[3px] bg-[#d92d20]" />}
            </dd>
          </div>
        </dl>

        {/* Perforation */}
        <div aria-hidden className="-mx-6 mt-2 border-t-2 border-dotted border-black/[0.12] sm:-mx-7" />

        <p className={`mt-4 flex items-center gap-2 text-[0.95rem] text-[#0f7a47] transition-opacity duration-500 ${s >= DONE ? 'opacity-100' : 'opacity-0'}`}>
          <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" aria-hidden><circle cx="8" cy="8" r="7" fill="#0f7a47" /><path d="m4.8 8.2 2.1 2.1 4.3-4.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {t.complete}
        </p>
      </div>
    </figure>
  );
}
