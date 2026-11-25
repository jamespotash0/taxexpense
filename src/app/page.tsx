// Landing page (EPIC-5), localized (DEC-025). Plain page, one accent: hero, how it works (3 rows), IRS costs, pricing, FAQ, closing line.
// Server Component: resolves locale + dictionary.
import Link from 'next/link';
import { Geist } from 'next/font/google';
import { HeroThread } from '@/components/HeroThread';
import { HeroExposure } from '@/components/HeroExposure';
import { LandingFaq } from '@/components/LandingFaq';
import { RecordCosts } from '@/components/RecordCosts';
import { Features } from '@/components/Features';
import { BlurFade, InView } from '@/components/Reveal';
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
    <div className={`${geist.className} relative overflow-x-clip bg-white text-gray-900 antialiased selection:bg-[#fdecea] selection:text-[#101210]`}>
      {/* Records where the visit came from (utm_source/ref or external referrer, e.g. Product Hunt)
          once per session — aggregate channel analytics, no PII (DEC-084). Renders nothing. */}
      <TrafficSource locale={locale} />

      <HeroExposure variant={heroVariant} />

      {/* Nav: flat sticky bar. */}
      <SiteHeader login={t.nav.login} getStarted={t.nav.getStarted} />

      {/* Hero: centered headline and CTA, then the conversation with Penny as the product shot. */}
      <section className="px-5 pb-20 pt-16 sm:px-6 lg:pb-24 lg:pt-28">
        <div className="mx-auto max-w-[80rem]">
          <div className="mx-auto max-w-[66rem] text-center">
            <h1 className="text-balance text-[clamp(2.7rem,5.6vw,4.6rem)] font-normal leading-[1.04] tracking-[-0.04em] text-[#101210]">
              {t.hero.line1pre}
              <span className="text-[#d92d20] sm:block">{t.hero.line1em}</span>
              {t.hero.line1post}
            </h1>
            <p className="mx-auto mt-6 max-w-[36rem] text-pretty text-[1.15rem] leading-[1.5] text-[#6f726d] sm:text-[1.25rem]">{t.hero.subtitle}</p>

            <div className="mt-9">
              <StartButton label={t.nav.getStarted} variant={heroVariant} experiment="hero-copy" />
            </div>
            <p className="mt-4 text-[0.85rem] text-[#8a8d88]">{t.hero.disclaimer}</p>
          </div>

          <div className="mt-16 lg:mt-20">
            <HeroThread />
          </div>
        </div>
      </section>

      {/* Who it's for: a quiet row where a logo cloud would sit (no customer logos exist). */}
      <section aria-label={t.hero.builtFor} className="px-5 pb-24 sm:px-6 lg:pb-32">
        <InView className="group mx-auto max-w-[80rem] border-t border-black/[0.06] pt-10 text-center">
          <p className="text-[0.85rem] text-[#8a8d88]">{t.hero.builtFor}</p>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 sm:gap-x-14">
            {t.hero.audienceChips.map((a, i) => (
              <li
                key={a}
                style={{ transitionDelay: `${100 + i * 100}ms` }}
                className="translate-y-1.5 text-[1.05rem] font-medium tracking-[-0.02em] text-[#7d807a] opacity-0 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[inview]:translate-y-0 group-data-[inview]:opacity-100 motion-reduce:translate-y-0 motion-reduce:opacity-100 sm:text-[1.2rem]"
              >
                {a}
              </li>
            ))}
          </ul>
        </InView>
      </section>

      {/* How it works: three rows, one idea each. */}
      <section id="how-it-works" className="scroll-mt-16 bg-white px-5 pb-28 pt-8 sm:px-6 lg:pb-40 lg:pt-12">
        <BlurFade>
          <Features t={t.features} />
        </BlurFade>
      </section>

      {/* Compliance: the IRS rules, beside what a missing record costs. */}
      <section className="bg-[#101210] px-5 py-28 selection:bg-[#d92d20] selection:text-white sm:px-6 lg:py-40">
        <RecordCosts t={t.costs} />
      </section>

      {/* Pricing and FAQ side by side; stacked on phones. */}
      <section id="pricing" className="scroll-mt-16 px-5 py-28 sm:px-6 lg:py-40">
        <div className="mx-auto grid max-w-[80rem] gap-20 lg:grid-cols-2 lg:gap-24">
          <BlurFade>
            <h2 className="text-balance text-[clamp(2.1rem,4.4vw,2.9rem)] font-normal leading-[1.1] tracking-[-0.018em] text-[#101210]">{t.pricing.title}</h2>
            <div className="mt-8">
              <LandingPricing t={t.pricing} ctaLabel={t.nav.getStarted} />
            </div>
          </BlurFade>
          <div id="faq" className="scroll-mt-16">
            <LandingFaq t={t.faq} />
          </div>
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

      {/* One footer row: mark and copyright left, the few links right. */}
      <footer className="mx-auto flex max-w-[80rem] flex-col gap-5 px-5 py-10 text-[0.88rem] text-[#6f726d] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <TallyWordmark />
          <span>© {new Date().getFullYear()} Tally. {t.footer.tagline}</span>
        </div>
        <nav aria-label="Footer" className="flex gap-6">
          <Link href="/login" className="hover:text-[#101210]">{t.nav.login}</Link>
          <Link href="/privacy" className="hover:text-[#101210]">{t.footer.privacy}</Link>
          <Link href="/terms" className="hover:text-[#101210]">{t.footer.terms}</Link>
        </nav>
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
