// /start — "text us to get started" (DEC-056, supersedes DEC-048/049). Onboarding now happens
// ENTIRELY over SMS; this page's only job is to hand the visitor to the text thread (or, on a
// computer where sms: dead-ends, tell them to text from their phone) and offer a login link for
// returning users. The old multi-step web question funnel was removed — its answers never
// reached the SMS flow (no phone to key on), so users got re-asked. See JOURNAL DEC-056.
import Link from 'next/link';
import Image from 'next/image';
import { getI18n } from '@/i18n/server';
import { formatUsPhone } from '@/lib/phone';

export const metadata = { title: 'Get started · Tally' };

export default async function StartPage() {
  const { t } = await getI18n();
  const o = t.onboarding;
  // Fall back to a placeholder (reserved 555-01xx fictional range) so the page always shows a
  // number to text even before the real Twilio number is wired. A real env number always wins.
  const rawNumber = process.env.TWILIO_PHONE_NUMBER || '+1 (415) 555-0134';
  const number = formatUsPhone(rawNumber);
  const smsHref = `sms:${rawNumber.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent('Hi Tally')}`;

  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12 text-center">
      <Link href="/" aria-label={o.backHome} className="absolute left-6 top-6 flex items-center gap-2">
        <Image src="/brand/tally-logo.svg" alt="" width={28} height={28} className="rounded-md" priority />
        <span className="text-lg font-semibold tracking-tight">Tally</span>
      </Link>
      <span className="mx-auto inline-flex items-center gap-2 rounded-full bg-accent-50 px-3 py-1 text-xs font-medium text-accent">
        {o.startBadge}
      </span>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">{o.startTitle}</h1>
      <p className="mt-3 text-gray-500 sm:text-lg">{o.startSub}</p>

      <p className="mt-8 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">{number}</p>

      <a
        href={smsHref}
        className="press mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-7 py-3.5 text-base font-medium text-white shadow-lg shadow-accent/20 transition-colors hover:bg-accent-hover"
      >
        <span aria-hidden>💬</span>
        {o.startText}
      </a>

      <p className="mt-4 text-xs text-gray-400">{o.startDesktopNote}</p>
      <p className="mt-1 text-xs text-gray-400">{o.startDisclaimer}</p>

      <p className="mt-10 border-t border-border pt-6 text-sm text-gray-500">
        {o.startHaveAccount}{' '}
        <Link href="/login" className="font-medium text-accent hover:underline">{t.nav.login}</Link>
      </p>
    </main>
  );
}
