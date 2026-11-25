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
    <div className={`${geist.className} relative overflow-x-clip bg-white text-gray-900 antialiased selection:bg-[#fdecea] selection:text-[#101210]`}>
      {/* Records where the visit came from (utm_source/ref or external referrer, e.g. Product Hunt)
          once per session — aggregate channel analytics, no PII (DEC-084). Renders nothing. */}
      <TrafficSource locale={locale} />

      <HeroExposure variant={heroVariant} />

      {/* Nav: flat sticky bar. */}
      <SiteHeader login={t.nav.login} getStarted={t.nav.getStarted} />

      {/* Hero: content sits high under the nav (text left, Penny right, stacked on phones, then who it's
          for), and the section fills the first screen so the next section only shows on scroll. */}
      <section className="min-h-[calc(100svh-4rem)] px-5 pb-16 pt-10 sm:px-6 lg:pb-20 lg:pt-14">
        <div className="mx-auto grid w-full max-w-[80rem] items-center gap-12 lg:grid-cols-[1.45fr_1fr] lg:gap-14">
          <div>
            <h1 className="text-balance text-[clamp(2.8rem,5.9vw,5.75rem)] font-normal leading-[1.02] tracking-[-0.04em] text-[#101210]">
              {t.hero.line1pre}
              <span className="text-[#d92d20]">{t.hero.line1em}</span>
              {t.hero.line1post}
            </h1>
            <p className="mt-7 max-w-[42rem] text-pretty text-[1.15rem] leading-[1.5] text-[#6f726d] sm:text-[1.4rem]">{t.hero.subtitle}</p>
            <div className="mt-10">
              <StartButton label={t.nav.getStarted} variant={heroVariant} experiment="hero-copy" />
            </div>
            <p className="mt-3.5 text-[0.85rem] text-[#8a8d88]">{t.hero.disclaimer}</p>
          </div>
          <HeroThread />
        </div>

        {/* Social bar: who it's for, as a slow marquee with faded edges (no customer logos exist yet).
            Two copies of the list scroll as one strip; the second is hidden from screen readers. Pauses
            on hover; static and wrapped under reduced motion. */}
        <div className="mx-auto mt-12 flex w-full max-w-[80rem] flex-col gap-5 border-t border-black/[0.06] pt-8 lg:mt-14 lg:flex-row lg:items-center lg:gap-10">
          <p className="shrink-0 text-[0.85rem] text-[#8a8d88]">{t.hero.builtFor}</p>
          <div className="group relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] motion-reduce:[mask-image:none]">
            <div className="marquee flex w-max group-hover:[animation-play-state:paused] motion-reduce:w-auto motion-reduce:flex-wrap">
              {[0, 1].map((copy) => (
                <ul key={copy} aria-hidden={copy === 1 || undefined} className={`flex shrink-0 items-center ${copy === 1 ? 'motion-reduce:hidden' : 'motion-reduce:flex-wrap motion-reduce:gap-y-3'}`}>
                  {t.hero.audienceChips.map((a) => (
                    <li key={a} className="flex items-center whitespace-nowrap text-[1.2rem] font-medium tracking-[-0.02em] text-[#5f625c] sm:text-[1.35rem]">
                      {a}
                      <span aria-hidden className="mx-7 h-1.5 w-1.5 rounded-full bg-[#d92d20]/80 sm:mx-9" />
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works: three rows, one idea each. */}
      <section id="how-it-works" className="scroll-mt-16 bg-white px-5 pb-28 pt-8 sm:px-6 lg:pb-40 lg:pt-12">
        <Features t={t.features} />
      </section>

      {/* Compliance: the IRS rules, beside what a missing record costs. */}
      <section className="bg-[#101210] px-5 py-28 selection:bg-[#d92d20] selection:text-white sm:px-6 lg:py-40">
        <RecordCosts t={t.costs} />
      </section>

      {/* Pricing and FAQ side by side; stacked on phones. */}
      <section id="pricing" className="scroll-mt-16 px-5 py-28 sm:px-6 lg:py-40">
        {/* Two columns on a shared row grid (subgrid): headings align, and the card and FAQ list share one height. */}
        <div className="mx-auto grid max-w-[80rem] gap-20 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-x-24 lg:gap-y-10">
          <BlurFade className="lg:row-span-2 lg:grid lg:grid-rows-subgrid">
            <h2 className="text-balance text-[clamp(2.1rem,4.4vw,2.9rem)] font-normal leading-[1.1] tracking-[-0.018em] text-[#101210]">{t.pricing.title}</h2>
            <div className="mt-8 lg:mt-0">
              <LandingPricing t={t.pricing} ctaLabel={t.nav.getStarted} />
            </div>
          </BlurFade>
          <BlurFade id="faq" delay={0.1} className="scroll-mt-16 lg:row-span-2 lg:grid lg:grid-rows-subgrid">
            <LandingFaq t={t.faq} />
          </BlurFade>
        </div>
      </section>

      {/* Closing: full red band, white type, white button, with the footer at its foot. */}
      <section className="bg-[#d92d20] px-5 pb-10 pt-28 selection:bg-white selection:text-[#d92d20] sm:px-6 lg:pt-40">
        <BlurFade className="mx-auto flex max-w-[40rem] flex-col items-center text-center">
          <h2 className="text-balance text-[clamp(2.4rem,5vw,3.6rem)] font-normal leading-[1.08] tracking-[-0.02em] text-white">{t.cta.heading}</h2>
          <p className="mt-4 max-w-[30rem] text-pretty text-[1.1rem] text-white/85">{t.cta.sub}</p>
          <div className="mt-9">
            <StartButton label={t.nav.getStarted} variant={heroVariant} experiment="footer-cta" onRed />
          </div>
        </BlurFade>

        {/* The footer lives inside the red band: one row, mark and copyright left, links right. */}
        <footer className="mx-auto mt-28 flex max-w-[80rem] flex-col gap-5 border-t border-white/20 pt-8 text-[0.88rem] text-white/80 sm:flex-row sm:items-center sm:justify-between lg:mt-36">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <TallyWordmark onRed />
            <span>© {new Date().getFullYear()} Tally. {t.footer.tagline}</span>
          </div>
          <nav aria-label="Footer" className="flex gap-6">
            <Link href="/login" className="hover:text-white">{t.nav.login}</Link>
            <Link href="/privacy" className="hover:text-white">{t.footer.privacy}</Link>
            <Link href="/terms" className="hover:text-white">{t.footer.terms}</Link>
          </nav>
        </footer>
      </section>

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
