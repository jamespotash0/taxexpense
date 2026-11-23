// Pricing / paywall page (DEC-021), localized (DEC-025). The conversion screen.
// Visual: same world as the landing, /start and /login (pastel-wash panel, white cards, red CTA).
import Link from 'next/link';
import { PlanPicker } from '@/components/PlanPicker';
import { TallyWordmark } from '@/components/SiteHeader';
import { TRIAL_DAYS } from '@/lib/pricing';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/config';

export const metadata = { title: 'Pricing · Tally' };

export default async function PricingPage() {
  const { t } = await getI18n();
  const p = t.pricing;

  return (
    <main className="min-h-screen bg-[#fafafa] px-3 pb-16 pt-4 text-[#101210] sm:px-6">
      <div className="mx-auto flex h-[3.25rem] max-w-[80rem] items-center justify-between gap-3 px-2">
        <TallyWordmark back />
        <div className="flex items-center gap-3">
          <Link href="/login" className="rounded-full px-4 py-[0.55rem] text-[0.9rem] font-medium ring-1 ring-black/[0.12] hover:bg-black/[0.03]">
            {t.nav.login}
          </Link>
        </div>
      </div>

      <div className="hero-wash mx-auto mt-3 max-w-[80rem] rounded-[32px] px-4 py-12 sm:rounded-[40px] sm:px-10 lg:px-14 lg:py-16">
        <div className="text-center">
          <span className="inline-flex rounded-full bg-white px-3.5 py-1.5 text-[0.85rem] font-medium text-[#d92d20] ring-1 ring-black/[0.06]">
            {fmt(p.badge, { days: TRIAL_DAYS })}
          </span>
          <h1 className="mt-6 text-balance text-[clamp(2.4rem,5vw,3.75rem)] font-medium leading-[1.05] tracking-[-0.04em]">{p.title}</h1>
          <p className="mx-auto mt-4 max-w-[30rem] text-pretty text-[1.15rem] text-[#4a4d48]">{p.subtitle}</p>
        </div>
        <div className="mx-auto mt-10 max-w-[64rem]">
          <PlanPicker t={p} />
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-[48rem] px-2">
        <p className="text-pretty text-[1.1rem] leading-relaxed text-[#4a4d48]">{p.value}</p>

        <h2 className="mt-14 text-[clamp(1.8rem,3.6vw,2.4rem)] font-semibold tracking-[-0.03em]">{p.faqHeading}</h2>
        <div className="mt-6 border-t border-black/[0.08]">
          {p.faqs.map((f) => (
            <details key={f.q} className="group border-b border-black/[0.08]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-[1.05rem] [&::-webkit-details-marker]:hidden">
                {f.q}
                <svg viewBox="0 0 16 16" fill="none" aria-hidden className="h-4 w-4 shrink-0 text-[#6f726d] transition-transform duration-200 group-open:rotate-180">
                  <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <p className="max-w-[62ch] pb-6 pr-8 text-[1rem] leading-relaxed text-[#6f726d]">{f.a}</p>
            </details>
          ))}
        </div>

        <p className="mt-10 text-[0.95rem] text-[#6f726d]">
          {p.notReady}{' '}
          <Link href="/start" className="font-medium text-[#d92d20] underline decoration-[#d92d20]/30 underline-offset-4 hover:decoration-[#d92d20]">
            {p.startTrialLink}
          </Link>
        </p>
      </div>
    </main>
  );
}
