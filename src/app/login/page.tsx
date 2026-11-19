// Phone-OTP login page (TSNAP-035/036). The form is a client component; wrap in
// Suspense because it reads useSearchParams. Localized per DEC-026.
import Link from 'next/link';
import { Suspense } from 'react';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/AppIcons';
import { LoginForm } from '@/components/LoginForm';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { getI18n } from '@/i18n/server';
import { formatUsPhone } from '@/lib/phone';
import { publicSmsNumber } from '@/lib/env';

export default async function LoginPage() {
  const { locale, t } = await getI18n();
  // You can only log in after texting Tally at least once, so users who land here
  // without an account need a way out: home, and the number to text to get started.
  // Mirror the hero's live-number logic — a real Twilio number makes the CTA an sms:
  // link; otherwise route to /start (the placeholder number isn't textable).
  const liveNumber = publicSmsNumber() || '';
  const number = liveNumber ? formatUsPhone(liveNumber) : '';
  const startHref = liveNumber
    ? `sms:${liveNumber.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent('Hi Tally')}`
    : '/start';

  return (
    <AppShell wordmarkHref="/" width="max-w-md">
      <div className="flex min-h-[calc(100dvh-10rem)] flex-col justify-center py-6">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1 rounded-full bg-fill py-2 pl-2.5 pr-4 text-sm font-semibold hover:bg-fill-strong">
            <Icon name="back" size={18} />
            {t.app.login.backHome.replace(/^←\s*/, '')}
          </Link>
          <LocaleSwitcher current={locale} variant="text" />
        </div>
        <Suspense fallback={<p className="text-sm text-muted">{t.app.login.loading}</p>}>
          <LoginForm t={t.app.login} />
        </Suspense>
        <div className="mt-10 rounded-3xl bg-fill px-5 py-4 text-[0.9375rem]">
          <p className="text-muted">{t.app.login.noAccount}</p>
          <Link href={startHref} className="mt-1 inline-block font-semibold text-primary hover:underline">
            {number ? (() => {
              // Split on the {number} token so the phone number itself stays unbreakable.
              const [before, after] = t.app.login.noAccountCta.split('{number}');
              return (<>{before}<span className="whitespace-nowrap">{number}</span>{after}</>);
            })() : t.app.login.noAccountCtaFallback}
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
