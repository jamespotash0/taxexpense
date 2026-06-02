// Pricing / paywall page (DEC-021) — localized (DEC-025). The conversion screen.
import Link from 'next/link';
import { PlanPicker } from '@/components/PlanPicker';
import { Reveal } from '@/components/Reveal';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { TRIAL_DAYS } from '@/lib/pricing';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/config';

export const metadata = { title: 'Pricing — Tally' };

export default async function PricingPage() {
  const { locale, t } = await getI18n();
  const p = t.pricing;

  return (
    <div className="relative overflow-hidden text-gray-900">
      <div className="hero-glow pointer-events-none absolute inset-0 -z-10" />

      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">Tally</Link>
        <div className="flex items-center gap-3">
          <LocaleSwitcher current={locale} />
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">{t.nav.login}</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-20 pt-8">
        <Reveal className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/70 px-3 py-1 text-xs font-medium text-gray-600">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {fmt(p.badge, { days: TRIAL_DAYS })}
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">{p.title}</h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-gray-600">{p.subtitle}</p>
        </Reveal>

        <Reveal className="mt-10" delay={0.08}>
          <PlanPicker t={p} />
        </Reveal>

        <Reveal className="mt-14 rounded-2xl border border-gray-200 bg-white/70 p-6 text-center" delay={0.05}>
          <p className="text-sm text-gray-600">{p.value}</p>
        </Reveal>

        <div className="mx-auto mt-14 max-w-2xl">
          <h2 className="text-xl font-semibold tracking-tight">{p.faqHeading}</h2>
          <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white/70">
            {p.faqs.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                  {f.q}
                  <span className="ml-4 text-gray-400 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-gray-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>

        <p className="mt-10 text-center text-sm text-gray-500">
          {p.notReady} <Link href="/start" className="font-medium text-accent hover:underline">{p.startTrialLink}</Link>
        </p>
      </main>
    </div>
  );
}
