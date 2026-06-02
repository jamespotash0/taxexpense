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

  const order: PlanId[] = ['annual', 'monthly'];

  return (
    <div>
      <div className="grid items-start gap-5 sm:grid-cols-2">
        {order.map((id) => {
          const p = PLANS[id];
          const featured = id === 'annual';
          return (
            <div
              key={id}
              className={`relative rounded-2xl border bg-white p-6 ${
                featured ? 'border-accent shadow-xl shadow-accent/10 ring-1 ring-accent' : 'border-gray-200'
              }`}
            >
              {featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">
                  {t.mostPopular}
                </span>
              )}
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{featured ? t.planAnnual : t.planMonthly}</h3>
                {featured && <span className="rounded-full bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent">{t.save}</span>}
              </div>

              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">{formatMoney(p.perMonthCents)}</span>
                <span className="text-gray-500">{t.perMo}</span>
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {p.interval === 'year' ? fmt(t.billedYearly, { price: formatMoney(p.priceCents) }) : t.billedMonthly}
              </p>

              <button
                onClick={() => subscribe(id)}
                disabled={busy !== null}
                className={`mt-5 w-full rounded-xl px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${
                  featured ? 'bg-accent text-white hover:bg-accent-hover' : 'bg-primary text-white hover:bg-primary-hover'
                }`}
              >
                {busy === id ? t.starting : t.subscribe}
              </button>

              <ul className="mt-5 space-y-2 text-sm text-gray-600">
                {t.included.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-accent">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {error && <p className="mt-3 text-center text-sm text-error-600">{error}</p>}
      <p className="mt-5 text-center text-xs text-gray-400">{t.trust}</p>
    </div>
  );
}
