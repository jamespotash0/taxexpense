// Landing page (EPIC-5) — trendy/modern skin: glow hero, oversized type, bento feature
// grid, accent CTA band. Server Component (reads the Tally number); AnimatedPhone +
// InstallButton are client. Marketing accent (indigo) is landing-only; the app stays ink.
import Link from 'next/link';
import { AnimatedPhone } from '@/components/AnimatedPhone';
import { InstallButton } from '@/components/InstallButton';

const AUDIENCE = ['Freelancers', 'Consultants', 'Contractors', 'Creators', 'Photographers', 'Coaches'];

export default function Home() {
  const number = process.env.TWILIO_PHONE_NUMBER ?? '';
  const smsHref = number ? `sms:${number.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent('Hi Tally')}` : undefined;

  return (
    <div className="text-gray-900">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/70 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <span className="text-lg font-semibold tracking-tight">Tally</span>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/login" className="rounded-full px-4 py-2 text-gray-600 hover:text-gray-900">Log in</Link>
            <a
              href={smsHref ?? '#install'}
              className="rounded-full bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary-hover"
            >
              Get started
            </a>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-glow pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
          <div>
            <span className="reveal inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/70 px-3 py-1 text-xs font-medium text-gray-600">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> No app to learn — just text
            </span>
            <h1 className="reveal mt-5 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Your bank knows <span className="text-gray-400">what</span>.
              <br />
              Tally knows{' '}
              <span className="relative whitespace-nowrap text-accent">
                why
                <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden>
                  <path d="M1 6 Q 25 1 50 5 T 99 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              .
            </h1>
            <p className="reveal-2 mt-6 max-w-md text-lg text-gray-600">
              Text a photo or a quick note. Tally logs every business expense the IRS way — and only
              asks for a receipt when the tax code actually requires it.
            </p>

            <div className="reveal-3 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={smsHref ?? '#install'}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-base font-medium text-white shadow-lg shadow-accent/20 transition-colors hover:bg-accent-hover"
              >
                Say hello 👋
              </a>
              <InstallButton className="[&_button]:rounded-xl [&_button]:border [&_button]:border-gray-300 [&_button]:!bg-white [&_button]:!text-gray-900 [&_button]:hover:!bg-gray-50" />
            </div>

            {number && (
              <p className="reveal-3 mt-4 text-sm text-gray-500">
                or text <span className="font-medium text-gray-900">{number}</span> · WhatsApp too
              </p>
            )}
            <p className="mt-3 text-xs text-gray-400">Recordkeeping, not tax advice. Reply STOP to opt out.</p>
          </div>

          <div className="reveal-2">
            <AnimatedPhone />
          </div>
        </div>
      </section>

      {/* Proof strip — honest (no fake logos): who it's for */}
      <section className="border-y border-gray-100 bg-gray-50/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-2 px-6 py-5 text-sm text-gray-500">
          <span className="font-medium text-gray-700">Made for the self-employed:</span>
          {AUDIENCE.map((a) => (
            <span key={a} className="rounded-full bg-white px-3 py-1 ring-1 ring-gray-200">{a}</span>
          ))}
        </div>
      </section>

      {/* Bento feature grid */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Built around the rules the IRS actually cares about.
        </h2>
        <div className="mt-10 grid auto-rows-[minmax(0,1fr)] grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Big tile */}
          <div className="lift rounded-2xl border border-gray-200 bg-white p-7 sm:col-span-2">
            <span className="inline-block rounded-lg bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent">Smart substantiation</span>
            <h3 className="mt-4 text-xl font-semibold">Asks only when required</h3>
            <p className="mt-2 max-w-md text-gray-600">
              No nagging for receipts. Tally follows the real IRS substantiation rules — a photo is
              requested only when the tax code demands one (strict categories ≥ $75, or lodging).
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-success-50 px-3 py-1 text-success-700">✓ $48 lunch — documentation complete</span>
              <span className="rounded-full bg-warning-50 px-3 py-1 text-warning-700">⚠ $340 dinner — snap a receipt</span>
            </div>
          </div>

          {/* Tall/standard tile */}
          <div className="lift rounded-2xl border border-gray-200 bg-white p-7">
            <span className="inline-block rounded-lg bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent">Tax code</span>
            <h3 className="mt-4 text-xl font-semibold">Cites the section</h3>
            <p className="mt-2 text-gray-600">Every expense gets its IRC section (§162, §274, §179…) and a deductible amount, so your records hold up.</p>
          </div>

          <div className="lift rounded-2xl border border-gray-200 bg-white p-7">
            <span className="inline-block rounded-lg bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent">Capture</span>
            <h3 className="mt-4 text-xl font-semibold">Just text or WhatsApp</h3>
            <p className="mt-2 text-gray-600">Snap a receipt or fire off a note, in the moment, from the app you already use.</p>
          </div>

          <div className="lift rounded-2xl border border-gray-200 bg-white p-7 sm:col-span-2">
            <span className="inline-block rounded-lg bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent">Hand off</span>
            <h3 className="mt-4 text-xl font-semibold">Export, or email your accountant</h3>
            <p className="mt-2 max-w-md text-gray-600">
              Review everything in the app. Download a clean CSV, a QuickBooks-ready file, or email
              this month straight to your accountant — one tap.
            </p>
          </div>
        </div>
      </section>

      {/* Accent CTA band */}
      <section id="install" className="px-6 pb-20">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-primary px-8 py-16 text-center text-white sm:py-20">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Say hello to easy tax time.</h2>
          <p className="mx-auto mt-3 max-w-md text-gray-300">
            {number ? <>Text <span className="font-medium text-white">{number}</span> with your first expense.</> : 'Install Tally and send your first expense.'}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={smsHref ?? '#'}
              className="rounded-xl bg-accent px-6 py-3.5 text-base font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Say hello 👋
            </a>
            <InstallButton className="[&_button]:rounded-xl [&_button]:!bg-white [&_button]:!text-gray-900 [&_button]:hover:!bg-gray-100" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold text-gray-900">Tally</span>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-gray-900">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-900">Terms</Link>
            <Link href="/login" className="hover:text-gray-900">Log in</Link>
          </div>
          <span className="text-xs text-gray-400">© {new Date().getFullYear()} Tally · Recordkeeping, not tax advice.</span>
        </div>
      </footer>
    </div>
  );
}
