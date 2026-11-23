'use client';

// Plan cards → Stripe Checkout (DEC-021). Localized (DEC-025). The money screen.
import { useState } from 'react';
import { PLANS, type PlanId } from '@/lib/pricing';
import { formatMoney } from '@/lib/format';
import { fmt } from '@/i18n/config';
import type { Dict } from '@/i18n/dictionaries';

export function PlanPicker({ t }: { t: Dict['pricing'] }) {
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subscribe(plan: PlanId) {
    setBusy(plan);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (res.status === 401) {
        window.location.assign('/login?returnTo=/pricing');
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.message || 'Could not start checkout.');
      window.location.assign(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(null);
    }
  }

  const order: PlanId[] = ['weekly', 'monthly', 'annual'];
  const planLabel = (id: PlanId) => (id === 'annual' ? t.planAnnual : id === 'monthly' ? t.planMonthly : t.planWeekly);
  const billedLabel = (interval: string, price: string) =>
    interval === 'year' ? fmt(t.billedYearly, { price }) : interval === 'month' ? t.billedMonthly : t.billedWeekly;

  return (
    <div>
      <div className="grid items-stretch gap-4 sm:grid-cols-3">
        {order.map((id) => {
          const p = PLANS[id];
          const featured = id === 'annual';
          return (
            <div
              key={id}
              className={`relative flex flex-col rounded-[28px] bg-white p-6 sm:p-7 ${
                featured ? 'shadow-[0_30px_70px_-35px_rgba(16,18,16,0.4)] ring-2 ring-[#d92d20]' : 'ring-1 ring-black/[0.07]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[1.25rem] font-medium tracking-[-0.02em]">{planLabel(id)}</h3>
                {featured && (
                  <span className="rounded-full bg-[#fdecea] px-2.5 py-1 text-[0.75rem] font-semibold text-[#d92d20]">
                    {t.mostPopular} · {t.save}
                  </span>
                )}
              </div>

              <p className="mt-6 flex items-baseline gap-1.5">
                <span className="text-[2.75rem] font-semibold leading-none tracking-[-0.04em]">{formatMoney(p.displayCents)}</span>
                <span className="text-[#6f726d]">{p.unit === 'wk' ? t.perWk : t.perMo}</span>
              </p>
              <p className="mb-6 mt-2 text-[0.92rem] text-[#6f726d]">{billedLabel(p.interval, formatMoney(p.priceCents))}</p>

              <button
                onClick={() => subscribe(id)}
                disabled={busy !== null}
                className={`mt-auto w-full rounded-full px-4 py-3.5 text-[1rem] font-medium transition-colors disabled:opacity-50 ${
                  featured ? 'bg-[#d92d20] text-white hover:bg-[#b8241a]' : 'bg-white text-[#101210] ring-1 ring-black/[0.14] hover:bg-[#f4f4f2]'
                }`}
              >
                {busy === id ? t.starting : t.subscribe}
              </button>
            </div>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-3 text-center text-[0.92rem] text-[#b8241a]">{error}</p>}

      {/* Same plan at three billing periods, so what's included is listed once. */}
      <ul className="mt-4 grid gap-x-8 gap-y-3 rounded-[28px] bg-white p-6 ring-1 ring-black/[0.07] sm:grid-cols-2 sm:p-8">
        {t.included.map((f) => (
          <li key={f} className="flex gap-3 text-[1rem]">
            <svg viewBox="0 0 16 16" className="mt-1 h-4 w-4 shrink-0 text-[#d92d20]" fill="none" aria-hidden><path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {f}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-center text-[0.85rem] text-[#6f726d]">{t.trust}</p>
    </div>
  );
}
