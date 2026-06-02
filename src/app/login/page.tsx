// Phone-OTP login page (TSNAP-035/036). The form is a client component; wrap in
// Suspense because it reads useSearchParams.
import { Suspense } from 'react';
import { LoginForm } from '@/components/LoginForm';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-8">
      <Suspense fallback={<p className="text-sm text-gray-400">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
