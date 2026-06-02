// Landing page (EPIC-5). Three sections: animated hero, small features, footer.
// No pricing. Hero visual = animated SMS thread (AnimatedPhone). Design per David's
// principles (restraint, one accent, no gradients/glows) + Sofia (motion + a11y).
import Link from 'next/link';
import { AnimatedPhone } from '@/components/AnimatedPhone';
import { InstallButton } from '@/components/InstallButton';

const FEATURES = [
  {
    title: 'Asks only when required',
    body: 'No nagging. Tally follows the real IRS substantiation rules — it asks for a receipt only when the tax code actually requires one.',
  },
  {
    title: 'Cites the tax code',
    body: 'Every expense is categorized with its IRC section (§162, §274, §179…) and a deductible amount, so your records hold up.',
  },
  {
    title: 'Just text or WhatsApp',
    body: 'Capture in the moment from the app you already use. Review and export anytime — or email it straight to your accountant.',
  },
];

export default function Home() {
  const number = process.env.TWILIO_PHONE_NUMBER ?? '';
  const smsHref = number ? `sms:${number.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent('Hi Tally')}` : undefined;

  return (
    <div className="text-gray-900">
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/80 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <span className="text-lg font-semibold tracking-tight">Tally</span>
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">Log in</Link>
        </nav>
      </header>

      {/* 1 — Hero */}
      <section className="mx-auto grid max-w-5xl items-center gap-12 px-6 py-16 md:grid-cols-2 md:py-24">
        <div>
          <p className="text-sm font-medium text-gray-500">For the self-employed</p>
          <h1 className="mt-3 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Your bank knows <span className="text-gray-400">what</span>.
            <br />
            Tally knows <span className="underline decoration-2 underline-offset-4">why</span>.
          </h1>
          <p className="mt-5 max-w-md text-lg text-gray-600">
            Text a photo or a quick note. Tally logs every business expense the IRS way — and only
            asks for a receipt when the tax code actually requires it.
          </p>

          {/* Say hello CTA */}
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            {smsHref ? (
              <a
                href={smsHref}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-white transition-colors hover:bg-primary-hover"
              >
                Say hello 👋
              </a>
            ) : (
              <InstallButton />
            )}
            {number && (
              <p className="text-sm text-gray-600">
                text <span className="font-medium text-gray-900">{number}</span>
                <span className="text-gray-400"> · or WhatsApp</span>
              </p>
            )}
          </div>

          <div className="mt-5">
            <InstallButton className="text-sm" />
          </div>

          <p className="mt-4 text-xs text-gray-400">
            Recordkeeping, not tax advice. By messaging Tally you agree to receive texts; reply STOP to
            opt out. See our <Link href="/privacy" className="underline">Privacy</Link> &amp;{' '}
            <Link href="/terms" className="underline">Terms</Link>.
          </p>
        </div>

        <AnimatedPhone />
      </section>

      {/* 2 — Features */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">Built around the actual rules</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-gray-200 bg-white p-6">
                <h3 className="font-medium">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 — Footer / say hello */}
      <footer className="border-t border-gray-100">
        <div className="mx-auto max-w-5xl px-6 py-14 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Say hello to easy tax time</h2>
          {number && (
            <p className="mt-3 text-gray-600">
              Text <span className="font-medium text-gray-900">{number}</span> with your first expense.
            </p>
          )}
          <div className="mt-6 flex justify-center">
            {smsHref ? (
              <a href={smsHref} className="rounded-lg bg-primary px-6 py-3 text-base font-medium text-white hover:bg-primary-hover">
                Say hello 👋
              </a>
            ) : (
              <InstallButton />
            )}
          </div>
          <div className="mt-10 flex flex-col items-center gap-3 border-t border-gray-100 pt-6 text-sm text-gray-500 sm:flex-row sm:justify-between">
            <span className="font-semibold text-gray-900">Tally</span>
            <div className="flex gap-5">
              <Link href="/privacy" className="hover:text-gray-900">Privacy</Link>
              <Link href="/terms" className="hover:text-gray-900">Terms</Link>
              <Link href="/login" className="hover:text-gray-900">Log in</Link>
            </div>
            <span className="text-xs text-gray-400">© {new Date().getFullYear()} Tally</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
