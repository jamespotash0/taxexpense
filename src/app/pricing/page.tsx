// Pricing page (DEC-021), localized (DEC-025): plans (→ Stripe Checkout, or login first) and the FAQ.
// Same world as the landing: Geist, white ground, the marketing nav, one red accent.
import Link from 'next/link';
import { PlanPicker } from '@/components/PlanPicker';
import { LandingFaq } from '@/components/LandingFaq';
import { SiteHeader } from '@/components/SiteHeader';
import { TRIAL_DAYS } from '@/lib/pricing';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/config';
import { geist } from '../fonts';

export const metadata = { title: 'Pricing · Tally' };

export default async function PricingPage() {
  const { t } = await getI18n();
  const p = t.pricing;
  // One FAQ: billing questions first, then the product questions (minus any asked twice).
  const asked = new Set(p.faqs.map((f) => f.q));
  const faq = { heading: p.faqHeading, items: [...p.faqs, ...t.faq.items.filter((f) => !asked.has(f.q))] };

  return (
    <div className={`${geist.className} min-h-screen bg-white text-[#101210] antialiased selection:bg-[#fdecea]`}>
      <SiteHeader login={t.nav.login} getStarted={t.nav.getStarted} pricing={t.nav.pricing} />

      <main className="px-5 pb-28 pt-16 sm:px-6 lg:pt-24">
        <div className="mx-auto max-w-[44rem] text-center">
          <h1 className="text-balance text-[clamp(2.5rem,5vw,4rem)] font-normal leading-[1.04] tracking-[-0.04em]">{p.title}</h1>
          <p className="mt-5 text-[1.15rem] text-[#6f726d] sm:text-[1.25rem]">
            {p.subtitle} <span className="text-[#d92d20]">{fmt(p.badge, { days: TRIAL_DAYS })}</span>
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-[64rem]">
          <PlanPicker t={p} />
        </div>

        <div className="mx-auto mt-28 max-w-[48rem] lg:mt-36">
          <LandingFaq t={faq} />
          <p className="mt-10 text-[0.95rem] text-[#6f726d]">
            {p.notReady}{' '}
            <Link href="/start" className="font-medium text-[#d92d20] underline decoration-[#d92d20]/30 underline-offset-4 hover:decoration-[#d92d20]">
              {p.startTrialLink}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
