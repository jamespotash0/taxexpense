// Landing page (EPIC-5), localized (DEC-025): hero, how it works (3 rows), IRS costs, red close + footer.
// Pricing and the FAQ live on /pricing.
// Server Component: resolves locale + dictionary.
import Link from 'next/link';
import { HeroVisual } from '@/components/HeroVisual';
import { HeroExposure } from '@/components/HeroExposure';
import { RecordCosts } from '@/components/RecordCosts';
import { Features } from '@/components/Features';
import { BlurFade } from '@/components/Reveal';
import { SiteHeader, TallyWordmark } from '@/components/SiteHeader';
import { TrackedLink } from '@/components/TrackedLink';
import { TrafficSource } from '@/components/TrafficSource';
import { type HeroVariant } from '@/lib/ab';
import { getI18n } from '@/i18n/server';
import { geist } from './fonts';

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
      <SiteHeader login={t.nav.login} getStarted={t.nav.getStarted} pricing={t.nav.pricing} />

      {/* Hero (Privy-style split), one screen tall: copy on a pale ground left, a full-bleed red panel
          right holding the dashboard and Penny, then the social bar along the bottom. */}
      <section className="flex min-h-[calc(100svh-4rem)] flex-col">
        <div className="grid flex-1 lg:grid-cols-2">
          <div className="flex flex-col justify-center bg-[#f7f7f8] px-5 py-14 sm:px-6 lg:py-16 lg:pl-[max(1.5rem,calc((100vw-80rem)/2))] lg:pr-14">
            <BlurFade>
              <h1 className="text-balance text-[clamp(2.8rem,5vw,5.25rem)] font-normal leading-[1.02] tracking-[-0.04em] text-[#101210]">
              {t.hero.line1pre}
              <span className="text-[#d92d20]">{t.hero.line1em}</span>
              {t.hero.line1post}
              </h1>
            </BlurFade>
            <BlurFade delay={0.08}>
              <p className="mt-7 max-w-[36rem] text-pretty text-[1.15rem] leading-[1.5] text-[#2c2e2a] sm:text-[1.3rem]">{t.hero.subtitle}</p>
            </BlurFade>
            <BlurFade delay={0.16}>
            <div className="mt-10 flex flex-wrap gap-3">
              <StartButton label={t.nav.getStarted} variant={heroVariant} experiment="hero-copy" ink />
              <a href="#how-it-works" className="inline-flex items-center rounded-full px-7 py-4 text-[1.05rem] font-medium text-[#101210] ring-[1.5px] ring-inset ring-[#101210] transition-colors hover:bg-[#101210] hover:text-white">
                {t.nav.howItWorks}
              </a>
            </div>
            <p className="mt-4 text-[0.85rem] text-[#8a8d88]">{t.hero.disclaimer}</p>
            </BlurFade>
          </div>
          <HeroVisual />
        </div>

        {/* Social bar: who it's for, as a slow marquee with faded edges (no customer logos exist yet).
            Two copies of the list scroll as one strip; the second is hidden from screen readers. Pauses
            on hover; static and wrapped under reduced motion. */}
        <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4 px-5 py-8 sm:px-6 lg:flex-row lg:items-center lg:gap-10 lg:py-9">
          <p className="shrink-0 text-[0.85rem] text-[#8a8d88]">{t.hero.builtFor}</p>
          <div className="group relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] motion-reduce:[mask-image:none]">
            <div className="marquee flex w-max group-hover:[animation-play-state:paused] motion-reduce:w-auto motion-reduce:flex-wrap">
              {[0, 1].map((copy) => (
                <ul key={copy} aria-hidden={copy === 1 || undefined} className={`flex shrink-0 items-center ${copy === 1 ? 'motion-reduce:hidden' : 'motion-reduce:flex-wrap motion-reduce:gap-y-3'}`}>
                  {t.hero.audienceChips.map((a) => (
                    <li key={a} className="whitespace-nowrap pr-12 text-[1.15rem] tracking-[-0.015em] text-[#4a4d48] sm:pr-16 sm:text-[1.3rem]">
                      {a}
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
      <section className="bg-[#101210] px-5 py-24 selection:bg-[#d92d20] selection:text-white sm:px-6 lg:py-36">
        <RecordCosts t={t.costs} />
      </section>

      {/* Closing: full red band, white type, white button, with the footer at its foot. */}
      <section className="bg-[#d92d20] px-5 pb-7 pt-16 selection:bg-white selection:text-[#d92d20] sm:px-6 lg:pt-24">
        <BlurFade className="mx-auto flex max-w-[40rem] flex-col items-center text-center">
          <h2 className="text-balance text-[clamp(2.4rem,5vw,3.6rem)] font-normal leading-[1.08] tracking-[-0.02em] text-white">{t.cta.heading}</h2>
          <p className="mt-4 max-w-[30rem] text-pretty text-[1.1rem] text-white/85">{t.cta.sub}</p>
          <div className="mt-8">
            <StartButton label={t.nav.getStarted} variant={heroVariant} experiment="footer-cta" onRed />
          </div>
        </BlurFade>

        {/* The footer lives inside the red band: one row, mark and copyright left, links right. */}
        <footer className="mx-auto mt-14 flex max-w-[80rem] flex-col gap-5 border-t border-white/20 pt-6 text-[0.88rem] text-white/80 sm:flex-row sm:items-center sm:justify-between lg:mt-20">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <TallyWordmark onRed />
            <span>© {new Date().getFullYear()} Tally. {t.footer.tagline}</span>
          </div>
          <nav aria-label="Footer" className="flex gap-6">
            <Link href="/pricing" className="hover:text-white">{t.nav.pricing}</Link>
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
function StartButton({ label, variant, experiment, onRed = false, ink = false }: { label: string; variant: HeroVariant; experiment: string; onRed?: boolean; ink?: boolean }) {
  return (
    <TrackedLink
      href="/start"
      event="hero_cta_click"
      data={{ experiment, variant }}
      className={`inline-flex items-center gap-2 rounded-full px-7 py-4 text-[1.05rem] font-medium transition-colors ${
        onRed ? 'bg-white text-[#d92d20] hover:bg-[#fbeeec] focus-visible:outline-white' : ink ? 'bg-[#101210] text-white hover:bg-[#d92d20]' : 'bg-[#d92d20] text-white hover:bg-[#b8241a]'
      }`}
    >
      {label}
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden><path d="M3 8h9.5m0 0L8.5 4M12.5 8l-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </TrackedLink>
  );
}
