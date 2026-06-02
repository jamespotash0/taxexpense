// Landing page (EPIC-5: TSNAP-049+). Hero, how-it-works, FAQ, footer. Server Component
// so it can read the Tally number. Copy reinforces "capture the WHY" positioning.
import Link from 'next/link';

export default function Home() {
  const number = process.env.TWILIO_PHONE_NUMBER ?? '';

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      {/* Hero */}
      <section>
        <h1 className="text-4xl font-semibold tracking-tight">Tally</h1>
        <p className="mt-4 text-xl text-gray-700">
          Your bank knows <span className="font-medium">what</span> you spent — but not{' '}
          <span className="font-medium">why</span>. Tally captures both.
        </p>
        <p className="mt-3 text-gray-600">
          Text your business expenses to a number — a photo or a quick note. Tally categorizes
          them under the right IRS section and only asks for a receipt when the tax code actually
          requires it. No app to install.
        </p>

        <div className="mt-8 rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Start by texting</p>
          <p className="mt-1 text-2xl font-semibold">{number || 'number coming soon'}</p>
          {/* TCPA opt-in disclosure (Jordan / EPIC-7) */}
          <p className="mt-3 text-xs text-gray-500">
            By texting Tally you agree to receive SMS messages from us about your expenses. Message
            &amp; data rates may apply. Reply STOP to opt out at any time. See our{' '}
            <Link href="/privacy" className="underline">Privacy Policy</Link> and{' '}
            <Link href="/terms" className="underline">Terms</Link>.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="mt-14">
        <h2 className="text-lg font-semibold">How it works</h2>
        <ol className="mt-4 space-y-3 text-gray-700">
          <li><span className="font-medium">1. Text it.</span> Snap a receipt or type &ldquo;$48 lunch with Sarah re partnership.&rdquo;</li>
          <li><span className="font-medium">2. Tally captures the why.</span> It categorizes the expense, cites the IRC section, and asks for context only when the IRS requires it.</li>
          <li><span className="font-medium">3. Review &amp; export.</span> See everything in your dashboard. Export a clean CSV, or email it to your accountant.</li>
        </ol>
      </section>

      {/* FAQ */}
      <section className="mt-14">
        <h2 className="text-lg font-semibold">FAQ</h2>
        <div className="mt-4 space-y-5 text-gray-700">
          <div>
            <p className="font-medium">Is this tax advice?</p>
            <p className="text-sm text-gray-600">No. Tally is a recordkeeping tool, not a tax advisor. For your specific situation, consult a licensed tax professional.</p>
          </div>
          <div>
            <p className="font-medium">Do I need to send a receipt every time?</p>
            <p className="text-sm text-gray-600">Only when the IRS requires it — generally strict categories at or over $75, plus lodging. For smaller items, your text is the written record.</p>
          </div>
          <div>
            <p className="font-medium">Who is it for?</p>
            <p className="text-sm text-gray-600">Self-employed people who pay business expenses from a mix of cards and want effortless, real-time capture.</p>
          </div>
        </div>
      </section>

      <footer className="mt-16 border-t border-gray-100 pt-6 text-sm text-gray-500">
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-gray-900">Privacy</Link>
          <Link href="/terms" className="hover:text-gray-900">Terms</Link>
          <Link href="/login" className="hover:text-gray-900">Log in</Link>
        </div>
        <p className="mt-3 text-xs text-gray-400">© {new Date().getFullYear()} Tally. Recordkeeping, not tax advice.</p>
      </footer>
    </main>
  );
}
