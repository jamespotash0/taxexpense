// Landing page (EPIC-5), localized (DEC-025). Plain page, one accent: hero, how it works (3 rows), IRS costs, pricing, FAQ, closing line.
// Server Component: resolves locale + dictionary.
import Link from 'next/link';
import { Geist } from 'next/font/google';
import { HeroThread } from '@/components/HeroThread';
import { HeroExposure } from '@/components/HeroExposure';
import { LandingFaq } from '@/components/LandingFaq';
import { RecordCosts } from '@/components/RecordCosts';
import { Features } from '@/components/Features';
import { BlurFade } from '@/components/Reveal';
import { SiteHeader, TallyWordmark } from '@/components/SiteHeader';
import { LandingPricing } from '@/components/LandingPricing';
import { TrackedLink } from '@/components/TrackedLink';
import { TrafficSource } from '@/components/TrafficSource';
import { type HeroVariant } from '@/lib/ab';
import { getI18n } from '@/i18n/server';

const geist = Geist({ subsets: ['latin'], display: 'swap' });

export default async function Home() {
  const { locale, t } = await getI18n();
  // Copy A/B is paused (DEC-079): render the single champion for everyone — including browsers
  // still holding an old ab_hero=B/C cookie from earlier testing. Re-enable by reading the cookie.
  const heroVariant: HeroVariant = 'A';

  return (
    <div className={`${geist.className} relative overflow-x-clip bg-[#fafafa] text-gray-900 antialiased selection:bg-[#fdecea] selection:text-[#101210]`}>
      {/* Records where the visit came from (utm_source/ref or external referrer, e.g. Product Hunt)
          once per session — aggregate channel analytics, no PII (DEC-084). Renders nothing. */}
      <TrafficSource locale={locale} />

      <HeroExposure variant={heroVariant} />

      {/* Nav: flat sticky bar. */}
      <SiteHeader
        login={t.nav.login}
        getStarted={t.nav.getStarted}
        links={[
          { href: '#how-it-works', label: t.nav.howItWorks },
          { href: '#pricing', label: t.nav.pricing },
          { href: '#faq', label: 'FAQ' },
        ]}
      />

      {/* Hero: headline + CTA left; texting Penny, right. */}
      <section className="px-5 pt-12 sm:px-6 lg:pt-20">
        <div className="mx-auto grid max-w-[80rem] items-center gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
          <div>
            <h1 className="text-balance text-[clamp(2.6rem,5.6vw,4.4rem)] font-normal leading-[1.04] tracking-[-0.035em] text-[#101210]">
              {t.hero.line1pre}
              <span className="text-[#d92d20]">{t.hero.line1em}</span>
              {t.hero.line1post}
            </h1>
            <p className="mt-6 max-w-[33rem] text-pretty text-[1.15rem] leading-[1.5] text-[#6f726d] sm:text-[1.25rem]">{t.hero.subtitle}</p>

            <div className="mt-9">
              <StartButton label={t.nav.getStarted} variant={heroVariant} experiment="hero-copy" />
            </div>
            <p className="mt-6 flex items-start gap-2 text-[0.98rem] text-[#101210]">
              <svg viewBox="0 0 16 16" className="mt-[0.2rem] h-4 w-4 shrink-0 text-[#0f7a47]" fill="none" aria-hidden><path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {t.hero.builtFor}
            </p>
            <p className="mt-2 max-w-[33rem] text-[0.85rem] text-[#6f726d]">{t.hero.disclaimer}</p>
          </div>

          <HeroThread />
        </div>
      </section>

      {/* How it works: three rows, one idea each. */}
      <section id="how-it-works" className="mt-28 scroll-mt-16 bg-white px-5 py-28 sm:px-6 lg:mt-40 lg:py-40">
        <BlurFade>
          <Features t={t.features} />
        </BlurFade>
      </section>

      {/* Compliance: the IRS rules, beside what a missing record costs. */}
      <section className="bg-[#101210] px-5 py-28 selection:bg-[#d92d20] selection:text-white sm:px-6 lg:py-40">
        <RecordCosts t={t.costs} />
      </section>

      {/* Pricing: one centered block. FAQ below it. */}
      <section id="pricing" className="scroll-mt-16 px-5 pt-28 sm:px-6 lg:pt-40">
        <BlurFade className="mx-auto max-w-[34rem]">
          <h2 className="text-balance text-center text-[clamp(2.1rem,4.4vw,2.9rem)] font-normal leading-[1.1] tracking-[-0.018em] text-[#101210]">{t.pricing.title}</h2>
          <div className="mt-10">
            <LandingPricing t={t.pricing} ctaLabel={t.nav.getStarted} />
          </div>
        </BlurFade>
      </section>

      <section id="faq" className="scroll-mt-16 px-5 py-28 sm:px-6 lg:py-40">
        <div className="mx-auto max-w-[48rem]">
          <LandingFaq t={t.faq} />
        </div>
      </section>

      {/* Closing: full red band, white type, white button. */}
      <section className="bg-[#d92d20] px-5 py-28 selection:bg-white selection:text-[#d92d20] sm:px-6 lg:py-40">
        <div className="mx-auto flex max-w-[40rem] flex-col items-center text-center">
          <h2 className="text-balance text-[clamp(2.4rem,5vw,3.6rem)] font-normal leading-[1.08] tracking-[-0.02em] text-white">{t.cta.heading}</h2>
          <p className="mt-4 max-w-[30rem] text-pretty text-[1.1rem] text-white/85">{t.cta.sub}</p>
          <div className="mt-9">
            <StartButton label={t.nav.getStarted} variant={heroVariant} experiment="footer-cta" onRed />
          </div>
        </div>
      </section>

      <footer className="mx-auto mt-20 max-w-[80rem] px-5 pb-10 sm:px-6">
        <div className="grid gap-10 pt-4 sm:grid-cols-[1.5fr_1fr_1fr]">
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
function StartButton({ label, variant, experiment, onRed = false }: { label: string; variant: HeroVariant; experiment: string; onRed?: boolean }) {
  return (
    <TrackedLink
      href="/start"
      event="hero_cta_click"
      data={{ experiment, variant }}
      className={`inline-flex items-center gap-2 rounded-full px-7 py-4 text-[1.05rem] font-medium transition-colors ${
        onRed ? 'bg-white text-[#d92d20] hover:bg-[#fbeeec] focus-visible:outline-white' : 'bg-[#d92d20] text-white hover:bg-[#b8241a]'
      }`}
    >
      {label}
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden><path d="M3 8h9.5m0 0L8.5 4M12.5 8l-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </TrackedLink>
  );
}
