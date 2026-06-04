'use client';

// Landing pricing block (DEC-027): single card + Monthly/Yearly toggle, trial badge,
// what's-included checklist. CTA enters the funnel (/start) — checkout happens later,
// after the trial, on /pricing. Prices come from the shared PLANS config.
import { useState } from 'react';
import Link from 'next/link';
import { PLANS } from '@/lib/pricing';
import { formatMoney } from '@/lib/format';
import { fmt } from '@/i18n/config';
import type { Dict } from '@/i18n/dictionaries';

export function LandingPricing({ t, trialDays, ctaLabel }: { t: Dict['pricing']; trialDays: number; ctaLabel: string }) {
  const [annual, setAnnual] = useState(true);
  const plan = annual ? PLANS.annual : PLANS.weekly;

  return (
    <div className="mx-auto max-w-md">
      {/* Billing-period toggle */}
      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 text-sm">
          <button
            onClick={() => setAnnual(false)}
            aria-pressed={!annual}
            className={`rounded-full px-4 py-1.5 font-medium transition-colors ${!annual ? 'bg-primary text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {t.planWeekly}
          </button>
          <button
            onClick={() => setAnnual(true)}
            aria-pressed={annual}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 font-medium transition-colors ${annual ? 'bg-primary text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {t.planAnnual}
            <span className={`rounded-full px-2 py-0.5 text-xs ${annual ? 'bg-white/20 text-white' : 'bg-accent-50 text-accent'}`}>{t.save}</span>
          </button>
        </div>
      </div>

      {/* Plan card */}
      <div className="lift relative rounded-2xl border border-accent bg-white p-7 text-center shadow-xl shadow-accent/10 ring-1 ring-accent">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent-50 px-3 py-1 text-xs font-medium text-accent">
          {fmt(t.badge, { days: trialDays })}
        </span>

        <p className="mt-4 flex items-baseline justify-center gap-1">
          <span className="text-5xl font-semibold tracking-tight">{formatMoney(plan.displayCents)}</span>
          <span className="text-gray-500">{plan.unit === 'wk' ? t.perWk : t.perMo}</span>
        </p>
        <p className="mt-1 text-sm text-gray-500">
          {annual ? fmt(t.billedYearly, { price: formatMoney(plan.priceCents) }) : t.billedWeekly}
        </p>

        <Link
          href="/start"
          className="press mt-6 block rounded-xl bg-accent px-4 py-3 text-center text-sm font-medium text-white hover:bg-accent-hover"
        >
          {ctaLabel}
        </Link>
        <p className="mt-3 text-sm font-medium text-gray-600">{t.noCommit}</p>

        <ul className="mt-6 inline-block space-y-2.5 text-left text-sm text-gray-600">
          {t.included.map((f) => (
            <li key={f} className="flex gap-2">
              <span className="shrink-0 text-accent">✓</span>
              {f}
            </li>
          ))}
        </ul>

        <p className="mt-6 text-xs text-gray-400">{t.trust}</p>
      </div>
    </div>
  );
}
