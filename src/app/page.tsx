// Landing page (EPIC-5), localized (DEC-025). ZeroSettle-style: hero, use cases, who it is for, features, pricing, FAQ, closing card.
// Server Component: resolves locale + dictionary.
import Link from 'next/link';
import { HeroThread } from '@/components/HeroThread';
import { HeroExposure } from '@/components/HeroExposure';
import { LandingFaq } from '@/components/LandingFaq';
import { Announcement } from '@/components/Announcement';
import { RecordCosts } from '@/components/RecordCosts';
import { Features } from '@/components/Features';
import { BlurFade } from '@/components/Reveal';
import { SiteHeader, TallyWordmark } from '@/components/SiteHeader';
import { LandingPricing } from '@/components/LandingPricing';
import { TrackedLink } from '@/components/TrackedLink';
import { TrafficSource } from '@/components/TrafficSource';
import { type HeroVariant } from '@/lib/ab';
import { getI18n } from '@/i18n/server';

export default async function Home() {
  const { locale, t } = await getI18n();
  // Copy A/B is paused (DEC-079): render the single champion for everyone — including browsers
  // still holding an old ab_hero=B/C cookie from earlier testing. Re-enable by reading the cookie.
  const heroVariant: HeroVariant = 'A';

  return (
    <div className="relative overflow-x-clip bg-[#fafafa] text-gray-900">
      {/* Records where the visit came from (utm_source/ref or external referrer, e.g. Product Hunt)
          once per session — aggregate channel analytics, no PII (DEC-084). Renders nothing. */}
      <TrafficSource locale={locale} />

      <HeroExposure variant={heroVariant} />

      <Announcement text={t.announce} short={t.announceShort} href="/start" />

      {/* Nav: floating pill that tightens on scroll. */}
      <SiteHeader
        login={t.nav.login}
        getStarted={t.nav.getStarted}
        links={[
          { href: '#how-it-works', label: t.nav.howItWorks },
          { href: '#pricing', label: t.nav.pricing },
          { href: '#faq', label: 'FAQ' },
        ]}
      />

      {/* Hero: one rounded panel on a soft pastel wash. Headline + texting CTA left, a real-looking
          iMessage thread with Tally right, honest trust strip along the bottom. */}
      <section className="px-3 pt-4 sm:px-6">
        <div className="hero-wash relative mx-auto max-w-[80rem] overflow-hidden rounded-[32px] sm:rounded-[40px]">
          <div className="grid items-center gap-12 px-6 pb-12 pt-14 sm:px-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:px-14 lg:pb-16 lg:pt-20">
            <div>
              <h1 className="text-balance text-[clamp(2.6rem,5.6vw,4.4rem)] font-medium leading-[1.04] tracking-[-0.04em] text-[#101210]">
                {t.hero.line1pre}
                <span className="text-[#d92d20]">{t.hero.line1em}</span>
                {t.hero.line1post}
              </h1>
              <p className="mt-6 max-w-[33rem] text-pretty text-[1.15rem] leading-[1.5] text-[#4a4d48] sm:text-[1.25rem]">{t.hero.subtitle}</p>

              <div className="mt-9">
                <StartButton label={t.nav.getStarted} variant={heroVariant} experiment="hero-copy" />
              </div>
              <p className="mt-3 pl-1 text-[0.88rem] text-[#6f726d]">{t.hero.disclaimer}</p>
            </div>

            <HeroThread />
          </div>

          {/* Trust strip: product facts only (no logos or stats exist to show). */}
          <div className="mx-6 border-t border-black/[0.08] py-6 sm:mx-10 lg:mx-14">
            <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[0.9rem] text-[#4a4d48]">
              {t.hero.trust.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#d92d20]" fill="none" aria-hidden><path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Time saved: out of the spreadsheet, into real time. */}
      <section id="how-it-works" className="scroll-mt-24 px-5 pt-24 sm:px-6 lg:pt-32">
        <BlurFade>
          <Features t={t.features} />
        </BlurFade>
      </section>

      {/* Compliance: the IRS rules, beside what a missing record costs. */}
      <section className="px-5 pt-24 sm:px-6 lg:pt-32">
        <RecordCosts t={t.costs} />
      </section>

      {/* Pricing and FAQ side by side; stacked on phones. */}
      <section id="pricing" className="scroll-mt-24 px-5 pt-24 sm:px-6 lg:pt-32">
        <div className="mx-auto grid max-w-[80rem] gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <BlurFade>
            <h2 className="text-balance text-[clamp(2.1rem,4.4vw,2.9rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-[#101210]">{t.pricing.title}</h2>
            <div className="mt-10">
              <LandingPricing t={t.pricing} ctaLabel={t.nav.getStarted} />
            </div>
          </BlurFade>
          <BlurFade delay={0.08} >
            <div id="faq" className="scroll-mt-24">
              <LandingFaq t={t.faq} />
            </div>
          </BlurFade>
        </div>
      </section>

      {/* Closing card: same soft wash as the hero, same CTA. */}
      <section className="px-3 pt-24 sm:px-6 lg:pt-32">
        <div className="hero-wash mx-auto flex max-w-[80rem] flex-col items-start gap-8 rounded-[32px] px-6 py-12 sm:rounded-[40px] sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:px-14 lg:py-16">
          <div>
            <h2 className="text-balance text-[clamp(2.1rem,4.4vw,2.9rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-[#101210]">{t.cta.heading}</h2>
            <p className="mt-3 max-w-[30rem] text-[1.1rem] text-[#4a4d48]">{t.cta.sub}</p>
          </div>
          <div className="shrink-0">
            <StartButton label={t.nav.getStarted} variant={heroVariant} experiment="footer-cta" />
          </div>
        </div>
      </section>

      <footer className="mx-auto mt-20 max-w-[80rem] px-5 pb-10 sm:px-6">
        <div className="grid gap-10 border-t border-black/[0.08] pt-12 sm:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <TallyWordmark />
            <p className="mt-3 max-w-[16rem] text-[0.9rem] text-[#6f726d]">{t.footer.tagline}</p>
          </div>
          <nav aria-label="Product" className="flex flex-col gap-2.5 text-[0.92rem]">
            <p className="text-[0.82rem] font-medium text-[#8a8d88]">Product</p>
            <a href="#how-it-works" className="text-[#4a4d48] hover:text-[#101210]">{t.nav.howItWorks}</a>
            <a href="#pricing" className="text-[#4a4d48] hover:text-[#101210]">{t.nav.pricing}</a>
            <Link href="/login" className="text-[#4a4d48] hover:text-[#101210]">{t.nav.login}</Link>
          </nav>
          <nav aria-label="Legal" className="flex flex-col items-start gap-2.5 text-[0.92rem]">
            <p className="text-[0.82rem] font-medium text-[#8a8d88]">Legal</p>
            <Link href="/privacy" className="text-[#4a4d48] hover:text-[#101210]">{t.footer.privacy}</Link>
            <Link href="/terms" className="text-[#4a4d48] hover:text-[#101210]">{t.footer.terms}</Link>
          </nav>
        </div>
        <p className="mt-12 text-[0.82rem] text-[#8a8d88]">© {new Date().getFullYear()} Tally. {t.footer.tagline}</p>
      </footer>
    </div>
  );
}

// The one CTA: /start. No phone number anywhere on the landing; the shared Linq line drops texts
// from numbers that haven't registered on /start first (DEC-089).
function StartButton({ label, variant, experiment }: { label: string; variant: HeroVariant; experiment: string }) {
  return (
    <TrackedLink
      href="/start"
      event="hero_cta_click"
      data={{ experiment, variant }}
      className="inline-flex items-center gap-2 rounded-full bg-[#d92d20] px-7 py-4 text-[1.05rem] font-medium text-white shadow-[0_8px_24px_-10px_rgba(217,45,32,0.6)] transition-colors hover:bg-[#b8241a]"
    >
      {label}
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden><path d="M3 8h9.5m0 0L8.5 4M12.5 8l-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </TrackedLink>
  );
}
