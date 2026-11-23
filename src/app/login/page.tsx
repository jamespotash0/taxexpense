// Phone-OTP login page (TSNAP-035/036). The form is a client component; wrap in
// Suspense because it reads useSearchParams. Localized per DEC-026.
// Visual: same world as the landing and /start (pastel-wash panel, white card, red pill CTA).
import Link from 'next/link';
import { Suspense } from 'react';
import { LoginForm } from '@/components/LoginForm';
import { TallyWordmark } from '@/components/SiteHeader';
import { getI18n } from '@/i18n/server';

export const metadata = { title: 'Log in · Tally' };

export default async function LoginPage() {
  const { t } = await getI18n();

  return (
    <main className="min-h-screen bg-[#fafafa] px-3 pb-10 pt-4 text-[#101210] sm:px-6">
      <div className="mx-auto flex h-[3.25rem] max-w-[80rem] items-center justify-between px-2">
        <TallyWordmark back />
      </div>

      <div className="hero-wash mx-auto mt-3 flex min-h-[calc(100dvh-9rem)] max-w-[80rem] flex-col items-center justify-center rounded-[32px] px-4 py-12 sm:rounded-[40px]">
        <div className="w-full max-w-[26rem] rounded-[28px] bg-white p-7 shadow-[0_30px_70px_-35px_rgba(16,18,16,0.35)] ring-1 ring-black/[0.06] sm:p-9">
          <Suspense fallback={<p className="text-[0.95rem] text-[#6f726d]">{t.app.login.loading}</p>}>
            <LoginForm t={t.app.login} />
          </Suspense>
        </div>

        {/* You can only log in after texting Tally once; everyone else goes to /start (the one
            entry point, and the only way to register on the shared Linq line, DEC-089). */}
        <p className="mt-6 text-center text-[0.95rem] text-[#4a4d48]">
          {t.app.login.noAccount}{' '}
          <Link href="/start" className="font-medium text-[#d92d20] underline decoration-[#d92d20]/30 underline-offset-4 hover:decoration-[#d92d20]">
            {t.app.login.noAccountCtaFallback}
          </Link>
        </p>
      </div>
    </main>
  );
}
