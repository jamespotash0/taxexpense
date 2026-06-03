// Phone-OTP login page (TSNAP-035/036). The form is a client component; wrap in
// Suspense because it reads useSearchParams. Localized per DEC-026.
import { Suspense } from 'react';
import { LoginForm } from '@/components/LoginForm';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { getI18n } from '@/i18n/server';

export default async function LoginPage() {
  const { locale, t } = await getI18n();
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-8">
      <div className="mb-6 flex justify-end">
        <LocaleSwitcher current={locale} />
      </div>
      <Suspense fallback={<p className="text-sm text-muted">{t.app.login.loading}</p>}>
        <LoginForm t={t.app.login} />
      </Suspense>
    </main>
  );
}
