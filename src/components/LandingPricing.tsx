'use client';

// Landing pricing (DEC-027): one plan, one wide white card. Left: billing-period switch, price,
// CTA. Right: what's included. CTA enters the funnel (/start); checkout happens after the trial
// on /pricing. Prices come from the shared PLANS config.
import { useState } from 'react';
import Link from 'next/link';
import { PLANS, type PlanId } from '@/lib/pricing';
import { formatMoney } from '@/lib/format';
import { fmt } from '@/i18n/config';
import type { Dict } from '@/i18n/dictionaries';

export function LandingPricing({ t, ctaLabel }: { t: Dict['pricing']; ctaLabel: string }) {
  const [selected, setSelected] = useState<PlanId>('annual');
  const plan = PLANS[selected];

  const tabs: { id: PlanId; label: string }[] = [
    { id: 'weekly', label: t.planWeekly },
    { id: 'monthly', label: t.planMonthly },
    { id: 'annual', label: t.planAnnual },
  ];
  const billedLabel =
    plan.interval === 'year'
      ? fmt(t.billedYearly, { price: formatMoney(plan.priceCents) })
      : plan.interval === 'month'
        ? t.billedMonthly
        : t.billedWeekly;

  return (
    <div className="overflow-hidden rounded-[28px] bg-white ring-1 ring-black/[0.06]">
      <div className="p-6 sm:p-10">
        <div className="inline-flex rounded-full bg-[#f0f0ee] p-1" role="group" aria-label="Billing period">
          {tabs.map((tab) => {
            const active = selected === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelected(tab.id)}
                aria-pressed={active}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.9rem] font-medium transition-colors ${
                  active ? 'bg-white text-[#101210] shadow-[0_1px_3px_rgba(16,18,16,0.12)]' : 'text-[#6f726d] hover:text-[#101210]'
                }`}
              >
                {tab.label}
                {tab.id === 'annual' && <span className="text-[0.75rem] font-semibold text-[#d92d20]">{t.save}</span>}
              </button>
            );
          })}
        </div>

        <p className="mt-8 flex items-baseline gap-1.5">
          <span className="text-[3.5rem] font-semibold leading-none tracking-[-0.04em] text-[#101210]">{formatMoney(plan.displayCents)}</span>
          <span className="text-[1.05rem] text-[#6f726d]">{plan.unit === 'wk' ? t.perWk : t.perMo}</span>
        </p>
        <p className="mt-2 text-[0.95rem] text-[#6f726d]">{billedLabel}</p>

        <Link href="/start" className="mt-8 flex w-full items-center justify-center rounded-full bg-[#d92d20] py-3.5 text-[1rem] font-medium text-white transition-colors hover:bg-[#b8241a]">
          {ctaLabel}
        </Link>
      </div>

      <div className="border-t border-black/[0.06] bg-[#fafaf9] p-6 sm:p-10">
        <ul className="space-y-4">
          {t.included.map((f) => (
            <li key={f} className="flex gap-3 text-[1rem] text-[#101210]">
              <svg viewBox="0 0 16 16" className="mt-1 h-4 w-4 shrink-0 text-[#d92d20]" fill="none" aria-hidden><path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
