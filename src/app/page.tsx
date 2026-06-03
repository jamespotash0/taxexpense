// Landing page (EPIC-5) — localized (DEC-025), trendy skin, cinematic scroll-reveal.
// Server Component: resolves locale + dictionary, reads the Tally number.
import Link from 'next/link';
import { cookies } from 'next/headers';
import { HeroVideo } from '@/components/HeroVideo';
import { HowItWorks } from '@/components/HowItWorks';
import { Reveal } from '@/components/Reveal';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { SiteHeader } from '@/components/SiteHeader';
import { LandingPricing } from '@/components/LandingPricing';
import { HeroCopy } from '@/components/HeroCopy';
import { HeroTextMeForm } from '@/components/HeroTextMeForm';
import { TextNumberCta } from '@/components/TextNumberCta';
import { TrackedLink } from '@/components/TrackedLink';
import { TRIAL_DAYS } from '@/lib/pricing';
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
  const number = liveNumber || '+1 (415) 555-0134';
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
      <SiteHeader login={t.nav.login} getStarted={t.nav.getStarted} howItWorks={t.nav.howItWorks} pricing={t.nav.pricing} />

      {/* Hero — two-column on lg: copy left, the live phone tilted toward the lower-right (SE).
          Stacks centered below lg. */}
      <section className="relative">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-24 pb-20 md:pt-32 lg:grid-cols-2 lg:gap-8 lg:pb-28 lg:px-8">
          {/* Left — copy + CTA */}
          <div className="text-center lg:text-left">
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
              <>
                <p className="reveal-3 mt-8 text-xs font-semibold uppercase tracking-wider text-gray-500">{t.hero.tryEyebrow}</p>
                <div className="reveal-3 mt-2 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                  <TextNumberCta
                    number={number}
                    smsHref={smsHref!}
                    variant={heroVariant}
                    label={fmt(t.hero.tryText, { number })}
                    copiedLabel={t.hero.copied}
                    className="press inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3.5 text-sm font-medium text-white shadow-lg shadow-accent/20 hover:bg-accent-hover sm:px-6 sm:text-base"
                  />
                  <TrackedLink
                    href="/start"
                    event="hero_cta_click"
                    data={{ experiment: 'hero-copy', variant: heroVariant }}
                    className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 sm:text-base"
                  >
                    {t.hero.ctaTrial}
                  </TrackedLink>
                </div>
              </>
            )}

            <p className="reveal-3 mt-4 text-xs text-gray-400">{t.hero.disclaimer}</p>
          </div>

          {/* Right — the interactive video centerpiece: a cinematic moment of spending with
              the Tally SMS thread typing in over it (reduced-motion → static phone). */}
          <Reveal className="flex justify-center lg:justify-end" delay={0.05}>
            <HeroVideo />
          </Reveal>
        </div>
      </section>

      {/* How it works — cinematic 3-scene flow: Text it → Tally captures the why → ready by tax time. */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24 lg:px-8">
        <HowItWorks t={t.bento} />
      </section>

      {/* Pricing — cinematic dark band with an accent glow. The white plan card pops against
          it (white = credible for money); the value line adds the "why it's worth it" substance. */}
      <section id="pricing" className="scroll-mt-24 px-6 py-20 lg:px-8">
        <Reveal className="relative mx-auto max-w-page overflow-hidden rounded-[2rem] bg-primary px-6 py-16 text-center shadow-2xl shadow-gray-900/20 sm:py-20">
          {/* Cinematic backdrop: warm ink with a drifting indigo glow (distinct from the flat-ink footer). */}
          <div
            aria-hidden
            className="ken-burns absolute inset-0"
            style={{ background: 'radial-gradient(60% 55% at 50% -5%, rgba(79,70,229,0.40), transparent 70%), linear-gradient(160deg, #0d1326 0%, #111827 58%, #1b1530 100%)' }}
          />
          <div className="relative z-10">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{t.pricing.title}</h2>
            <p className="mx-auto mt-3 max-w-md text-gray-300">{t.pricing.subtitle}</p>
            <div className="mt-10">
              <LandingPricing t={t.pricing} trialDays={TRIAL_DAYS} ctaLabel={t.hero.ctaTrial} />
            </div>
            <p className="mx-auto mt-8 max-w-md text-sm leading-relaxed text-gray-400">{t.pricing.value}</p>
          </div>
        </Reveal>
      </section>

      {/* Footer — one closing card: the text-to-test CTA up top, the footer nav folded in below. */}
      <footer id="install" className="px-6 pb-10 pt-16 lg:px-8">
        <Reveal className="mx-auto max-w-page overflow-hidden rounded-3xl bg-primary text-white">
          {/* Closing CTA — text the number to try it for real */}
          <div className="px-8 py-16 text-center sm:py-20">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t.cta.heading}</h2>
            <p className="mx-auto mt-3 max-w-md text-gray-300">
              {number ? fmt(t.cta.sub, { number }) : t.cta.subNoNumber}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3">
              {number ? (
                <>
                  <TextNumberCta
                    number={number}
                    smsHref={smsHref}
                    label={fmt(t.hero.tryText, { number })}
                    copiedLabel={t.hero.copied}
                    experiment="footer-cta"
                    className="press inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-base font-medium text-white hover:bg-accent-hover"
                  />
                  <Link href="/start" className="inline-flex items-center py-2 text-sm font-medium text-gray-300 underline-offset-4 hover:text-white hover:underline">
                    {t.cta.button}
                  </Link>
                </>
              ) : (
                <Link href="/start" className="rounded-xl bg-accent px-6 py-3.5 text-base font-medium text-white transition-colors hover:bg-accent-hover">
                  {t.cta.button}
                </Link>
              )}
            </div>
            <p className="mt-5 text-xs text-gray-400">{t.hero.disclaimer}</p>
          </div>

          {/* Footer nav — now lives inside the card */}
          <div className="flex flex-col gap-3 border-t border-white/10 px-8 py-6 text-sm text-gray-400 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-semibold text-white">Tally</span>
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
