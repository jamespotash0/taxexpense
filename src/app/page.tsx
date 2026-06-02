// Landing page (EPIC-5) — localized (DEC-025), trendy skin, cinematic scroll-reveal.
// Server Component: resolves locale + dictionary, reads the Tally number.
import Link from 'next/link';
import { AnimatedPhone } from '@/components/AnimatedPhone';
import { InstallButton } from '@/components/InstallButton';
import { Reveal, Stagger, StaggerItem } from '@/components/Reveal';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/config';

export default async function Home() {
  const { locale, t } = await getI18n();
  const number = process.env.TWILIO_PHONE_NUMBER ?? '';

  const tiles = [
    { tag: t.bento.t1tag, title: t.bento.t1title, body: t.bento.t1body, wide: true, chips: true },
    { tag: t.bento.t2tag, title: t.bento.t2title, body: t.bento.t2body, wide: false, chips: false },
    { tag: t.bento.t3tag, title: t.bento.t3title, body: t.bento.t3body, wide: false, chips: false },
    { tag: t.bento.t4tag, title: t.bento.t4title, body: t.bento.t4body, wide: true, chips: false },
  ];

  return (
    <div className="text-gray-900">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/70 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <span className="text-lg font-semibold tracking-tight">Tally</span>
          <div className="flex items-center gap-2 text-sm">
            <LocaleSwitcher current={locale} />
            <Link href="/login" className="rounded-full px-4 py-2 text-gray-600 hover:text-gray-900">{t.nav.login}</Link>
            <Link href="/start" className="rounded-full bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary-hover">
              {t.nav.getStarted}
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero — headline-first, centered (Linear-style); phone cinematic reveals on scroll */}
      <section className="relative overflow-hidden">
        <div className="hero-glow pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto max-w-3xl px-6 pt-24 text-center md:pt-32">
          <h1 className="reveal text-balance text-5xl font-semibold leading-[1.03] tracking-tight sm:text-6xl md:text-7xl">
            <span className="block">
              {t.hero.line1pre}
              <span className="text-gray-400">{t.hero.line1em}</span>
              {t.hero.line1post}
            </span>
            <span className="block">
              {t.hero.line2pre}
              <span className="relative whitespace-nowrap text-accent">
                {t.hero.line2em}
                <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden>
                  <path d="M1 6 Q 25 1 50 5 T 99 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              {t.hero.line2post}
            </span>
          </h1>
          <p className="reveal-2 mx-auto mt-6 max-w-xl text-balance text-lg text-gray-600">{t.hero.subtitle}</p>

          <div className="reveal-3 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/start"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-base font-medium text-white shadow-lg shadow-accent/20 transition-colors hover:bg-accent-hover"
            >
              {t.hero.ctaTrial}
            </Link>
            <InstallButton
              label={t.install.button}
              help={t.install.help}
              installedText={t.install.installed}
              className="[&_button]:rounded-xl [&_button]:border [&_button]:border-gray-300 [&_button]:!bg-white [&_button]:!text-gray-900 [&_button]:hover:!bg-gray-50"
            />
          </div>

          {number && <p className="reveal-3 mt-4 text-sm text-gray-500">{fmt(t.hero.secondary, { number })}</p>}
          <p className="mt-3 text-xs text-gray-400">{t.hero.disclaimer}</p>
        </div>

        {/* Cinematic product visual sits below the headline and fades up as you scroll. */}
        <Reveal className="mx-auto mt-16 max-w-sm px-6 pb-20 md:mt-20 md:pb-28" delay={0.05}>
          <AnimatedPhone />
        </Reveal>
      </section>

      {/* Proof strip */}
      <section className="border-y border-gray-100 bg-gray-50/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-2 px-6 py-5 text-sm text-gray-500">
          <span className="font-medium text-gray-700">{t.proof.madeFor}</span>
          {t.proof.roles.map((a) => (
            <span key={a} className="rounded-full bg-white px-3 py-1 ring-1 ring-gray-200">{a}</span>
          ))}
        </div>
      </section>

      {/* Bento feature grid */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <h2 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">{t.bento.heading}</h2>
        </Reveal>
        <Stagger className="mt-10 grid auto-rows-[minmax(0,1fr)] grid-cols-1 gap-4 sm:grid-cols-3">
          {tiles.map((tile) => (
            <StaggerItem key={tile.title} className={`lift rounded-2xl border border-gray-200 bg-white p-7 ${tile.wide ? 'sm:col-span-2' : ''}`}>
              <span className="inline-block rounded-lg bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent">{tile.tag}</span>
              <h3 className="mt-4 text-xl font-semibold">{tile.title}</h3>
              <p className="mt-2 max-w-md text-gray-600">{tile.body}</p>
              {tile.chips && (
                <div className="mt-5 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-success-50 px-3 py-1 text-success-700">{t.bento.chipComplete}</span>
                  <span className="rounded-full bg-warning-50 px-3 py-1 text-warning-700">{t.bento.chipSnap}</span>
                </div>
              )}
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Accent CTA band */}
      <section id="install" className="px-6 pb-20">
        <Reveal className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-primary px-8 py-16 text-center text-white sm:py-20">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t.cta.heading}</h2>
          <p className="mx-auto mt-3 max-w-md text-gray-300">
            {number ? fmt(t.cta.sub, { number }) : t.cta.subNoNumber}
          </p>
          <div className="mt-8 flex justify-center">
            <Link href="/start" className="rounded-xl bg-accent px-6 py-3.5 text-base font-medium text-white transition-colors hover:bg-accent-hover">
              {t.cta.button}
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold text-gray-900">Tally</span>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-gray-900">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-900">Terms</Link>
            <Link href="/login" className="hover:text-gray-900">{t.nav.login}</Link>
          </div>
          <span className="text-xs text-gray-400">© {new Date().getFullYear()} Tally · {t.footer.tagline}</span>
        </div>
      </footer>
    </div>
  );
}
