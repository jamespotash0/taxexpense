// Phone-OTP login page (TSNAP-035/036). The form is a client component; wrap in
// Suspense because it reads useSearchParams. Localized per DEC-026.
import Link from 'next/link';
import { Suspense } from 'react';
import { LoginForm } from '@/components/LoginForm';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { getI18n } from '@/i18n/server';
import { formatUsPhone } from '@/lib/phone';

export default async function LoginPage() {
  const { locale, t } = await getI18n();
  // You can only log in after texting Tally at least once, so users who land here
  // without an account need a way out: home, and the number to text to get started.
  // Mirror the hero's live-number logic — a real Twilio number makes the CTA an sms:
  // link; otherwise route to /start (the placeholder number isn't textable).
  const liveNumber = process.env.TWILIO_PHONE_NUMBER || '';
  const number = liveNumber ? formatUsPhone(liveNumber) : '';
  const startHref = liveNumber
    ? `sms:${liveNumber.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent('Hi Tally')}`
    : '/start';

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          {t.app.login.backHome}
        </Link>
        <LocaleSwitcher current={locale} />
      </div>
      <Suspense fallback={<p className="text-sm text-muted">{t.app.login.loading}</p>}>
        <LoginForm t={t.app.login} />
      </Suspense>
      <p className="mt-8 border-t border-border pt-6 text-sm text-muted">
        {t.app.login.noAccount}{' '}
        <Link href={startHref} className="font-medium text-primary hover:underline">
          {number ? (() => {
            // Split on the {number} token so the phone number itself stays unbreakable -- its
            // internal spaces/hyphen are break points that would otherwise split it mid-number
            // (e.g. "475-" wrapping away from "4986"). Mirrors the dashboard empty-state pattern.
            const [before, after] = t.app.login.noAccountCta.split('{number}');
            return (<>{before}<span className="whitespace-nowrap">{number}</span>{after}</>);
          })() : t.app.login.noAccountCtaFallback}
        </Link>
      </p>
    </main>
  );
}
