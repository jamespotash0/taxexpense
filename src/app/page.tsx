// Landing page (EPIC-5) — localized (DEC-025), trendy skin, cinematic scroll-reveal.
// Server Component: resolves locale + dictionary, reads the Tally number.
import Link from 'next/link';
import Image from 'next/image';
import { cookies } from 'next/headers';
import { HeroVideo } from '@/components/HeroVideo';
import { MissingPiece } from '@/components/MissingPiece';
import { HowItWorks } from '@/components/HowItWorks';
import { WhyTally } from '@/components/WhyTally';
import { TaxSeason } from '@/components/TaxSeason';
import { Proof } from '@/components/Proof';
import { LandingFaq } from '@/components/LandingFaq';
import { Reveal } from '@/components/Reveal';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { SiteHeader } from '@/components/SiteHeader';
import { LandingPricing } from '@/components/LandingPricing';
import { HeroCopy } from '@/components/HeroCopy';
import { HeroTextMeForm } from '@/components/HeroTextMeForm';
import { TextNumberCta } from '@/components/TextNumberCta';
import { TrackedLink } from '@/components/TrackedLink';
import { TRIAL_DAYS } from '@/lib/pricing';
import { formatUsPhone } from '@/lib/phone';
import { AB_HERO_COOKIE, isHeroVariant, type HeroVariant } from '@/lib/ab';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/config';

export default async function Home() {
  const { locale, t } = await getI18n();
  // Texting the number IS the product entry (and the only way to test the beta), so it's the
  // primary CTA. The text-first hero must show even before the real Twilio number is wired, so
  // fall back to a placeholder (reserved 555-01xx fictional range) — the core "just text it"
  // mechanic stays visible. A real env number always wins and makes the CTA a live sms: link
  // with a prefilled "Hi Tally" draft; with the placeholder, the CTA routes to /start instead.
  const liveNumber = process.env.TWILIO_PHONE_NUMBER || '';
  const number = liveNumber ? formatUsPhone(liveNumber) : '+1 (415) 555-0134';
  const smsHref = liveNumber
    ? `sms:${liveNumber.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent('Hi Tally')}`
    : '/start';
  const abHero = (await cookies()).get(AB_HERO_COOKIE)?.value;
  const heroVariant: HeroVariant = isHeroVariant(abHero) ? abHero : 'A';

  return (
    <div className="relative overflow-x-clip text-gray-900">
      {/* Accent glow spans from the very top — behind the nav — so there's no white seam. */}
      <div className="hero-glow pointer-events-none absolute inset-x-0 top-0 -z-10 h-[820px]" />

      {/* Nav — floating pill that condenses on scroll (SiteHeader) */}
      <SiteHeader login={t.nav.login} getStarted={t.nav.getStarted} />

      {/* Hero — two-column on lg: copy left, the live phone tilted toward the lower-right (SE).
          Stacks centered below lg. */}
      <section className="relative">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-24 pb-20 md:pt-32 lg:grid-cols-2 lg:gap-8 lg:pb-28 lg:px-8">
          {/* Left — copy + CTA */}
          <div className="text-center lg:text-left">
            {/* Who it's for — answers the audience question before the headline. */}
            <p className="reveal mb-4 text-xs font-semibold uppercase tracking-wider text-accent">{t.hero.audienceEyebrow}</p>
            <HeroCopy
              variant={heroVariant}
              a={{
                line1pre: t.hero.line1pre,
                line1em: t.hero.line1em,
                line1post: t.hero.line1post,
                line2pre: t.hero.line2pre,
                line2em: t.hero.line2em,
                line2post: t.hero.line2post,
                subtitle: t.hero.subtitle,
              }}
              b={t.hero.vb}
            />

            {/* Primary + secondary CTAs. Arm C (see lib/ab.ts) swaps the sms: link for a "text me
                first" phone input. Arms A/B keep the text-the-number link. Centered on mobile,
                left-aligned from lg: to match the two-column layout. */}
            {heroVariant === 'C' ? (
              <HeroTextMeForm variant={heroVariant} t={t.heroForm} />
            ) : (
              // One primary action (start the trial); texting the number is offered as a
              // lighter, tappable line beneath — same intent, no competing buttons.
              <div className="reveal-3 mt-8 flex flex-col items-center gap-3 lg:items-start">
                <TrackedLink
                  href="/start"
                  event="hero_cta_click"
                  data={{ experiment: 'hero-copy', variant: heroVariant }}
                  className="press inline-flex items-center justify-center rounded-xl bg-accent px-7 py-3.5 text-base font-medium text-white shadow-lg shadow-accent/20 transition-colors hover:bg-accent-hover"
                >
                  {t.nav.getStarted}
                </TrackedLink>
                {/* Trial reassurance — the "free" lever stays as subordinate microcopy now that the
                    button verb is the action (not "Start free trial"). Reuses the pricing badge copy. */}
                <p className="-mt-1 text-xs text-gray-400">{fmt(t.pricing.badge, { days: TRIAL_DAYS })}</p>
                <p className="text-sm text-gray-500">
                  {t.hero.ctaOr}{' '}
                  <TextNumberCta
                    number={number}
                    smsHref={smsHref!}
                    variant={heroVariant}
                    hideIcon
                    inline
                    label={number}
                    copiedLabel={t.hero.copied}
                    className="font-semibold text-accent underline-offset-4 hover:underline"
                  />
                </p>
              </div>
            )}

            {/* Who it's for — entity chips read as "designed" rather than a run-on gray line. */}
            <div className="reveal-3 mt-6 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              {t.hero.audienceChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-gray-200 bg-white/70 px-3 py-1 text-xs font-medium text-gray-600 backdrop-blur-sm"
                >
                  {chip}
                </span>
              ))}
            </div>
            <p className="reveal-3 mt-4 text-xs text-gray-400">{t.hero.disclaimer}</p>
          </div>

          {/* Right — the interactive video centerpiece: a cinematic moment of spending with
              the Tally SMS thread typing in over it (reduced-motion → static phone). */}
          <Reveal className="flex justify-center lg:justify-end" delay={0.05}>
            <HeroVideo />
          </Reveal>
        </div>
      </section>

      {/* The Missing Piece — the problem before the solution (council DEC-028). */}
      <section className="mx-auto max-w-6xl px-6 py-24 lg:px-8">
        <MissingPiece t={t.missingPiece} />
      </section>

      {/* How it works — cinematic 3-scene flow: Text it → Tally captures the why → ready by tax time. */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24 lg:px-8">
        <HowItWorks t={t.bento} />
      </section>

      {/* Why Tally exists — capture-now vs. reconstruct-later (DEC-043). */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-8">
        <WhyTally t={t.whyTally} />
      </section>

      {/* Tax season, two ways — the payoff (DEC-043). */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-8">
        <TaxSeason t={t.taxSeason} />
      </section>

      {/* Pricing — just the plan card on the page (no dark band, no value line underneath). */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20 lg:px-8">
        <Reveal className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">{t.pricing.title}</h2>
          <p className="mx-auto mt-3 max-w-md text-gray-600">{t.pricing.subtitle}</p>
          <div className="mt-10">
            <LandingPricing t={t.pricing} trialDays={TRIAL_DAYS} ctaLabel={t.nav.getStarted} />
          </div>
        </Reveal>
      </section>

      {/* Why we built it — honest founding-insight line, not a fabricated testimonial (DEC-043). */}
      <section className="mx-auto max-w-page px-6 py-20 lg:px-8">
        <Proof t={t.proof} />
      </section>

      {/* FAQ — spec-accurate, compliance-checked (DEC-043). */}
      <section id="faq" className="mx-auto max-w-page scroll-mt-24 px-6 py-16 lg:px-8">
        <LandingFaq t={t.faq} />
      </section>

      {/* Footer — one compact closing band. Same ink + indigo glow as the pricing band (one
          consistent dark treatment, not a second bright color), with the logo and the footer
          nav folded in below a tightened CTA. */}
      <footer id="install" className="px-6 pb-10 pt-12 lg:px-8">
        <Reveal className="relative mx-auto max-w-page overflow-hidden rounded-3xl text-white">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: 'radial-gradient(60% 65% at 50% 0%, rgba(79,70,229,0.38), transparent 70%), linear-gradient(160deg, #0d1326 0%, #111827 60%, #1b1530 100%)' }}
          />
          {/* Closing CTA — tightened so the dark area stays compact */}
          <div className="relative z-10 px-8 py-12 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t.cta.heading}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-300">
              {number ? fmt(t.cta.sub, { number }) : t.cta.subNoNumber}
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-2.5">
              <Link
                href="/start"
                className="press inline-flex items-center justify-center rounded-xl bg-accent px-7 py-3.5 text-base font-medium text-white shadow-lg shadow-black/20 transition-colors hover:bg-accent-hover"
              >
                {t.nav.getStarted}
              </Link>
              <p className="text-sm text-gray-400">
                {t.hero.ctaOr}{' '}
                <TextNumberCta
                  number={number}
                  smsHref={smsHref}
                  hideIcon
                  inline
                  label={number}
                  copiedLabel={t.hero.copied}
                  experiment="footer-cta"
                  className="font-semibold text-indigo-300 underline-offset-4 hover:text-white hover:underline"
                />
              </p>
            </div>
          </div>

          {/* Footer nav — logo + links on a hairline divider */}
          <div className="relative z-10 flex flex-col gap-3 border-t border-white/10 px-8 py-5 text-sm text-gray-400 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/brand/tally-logo.svg" alt="Tally logo" width={24} height={24} className="rounded-md" />
              <span className="font-semibold text-white">Tally</span>
            </Link>
            <div className="flex items-center gap-5">
              <Link href="/privacy" className="inline-flex items-center py-2 hover:text-white">{t.footer.privacy}</Link>
              <Link href="/terms" className="inline-flex items-center py-2 hover:text-white">{t.footer.terms}</Link>
              <Link href="/login" className="inline-flex items-center py-2 hover:text-white">{t.nav.login}</Link>
              <span className="h-4 w-px bg-white/20" aria-hidden />
              <LocaleSwitcher current={locale} />
            </div>
            <span className="text-xs text-gray-500">© {new Date().getFullYear()} Tally · {t.footer.tagline}</span>
          </div>
        </Reveal>
      </footer>
    </div>
  );
}
