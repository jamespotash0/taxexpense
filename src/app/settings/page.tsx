// Settings page (DEC-014). Server loads current values; client form saves them.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { SettingsForm } from '@/components/SettingsForm';
import { EmailAccountantButton } from '@/components/EmailAccountantButton';
import { DeleteAccountButton } from '@/components/DeleteAccountButton';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?returnTo=/settings');

  const { data: org } = await getSupabaseAdmin()
    .from('organizations')
    .select('name')
    .eq('id', user.organization_id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-lg p-4 sm:p-8">
      <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">← Back</Link>
      <h1 className="mt-4 text-xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-gray-500">
        Logged in as {user.phone_number}. We collect email + business name here, not over text.
      </p>
      <div className="mt-6">
        <SettingsForm
          initial={{
            full_name: user.full_name ?? '',
            email: user.email ?? '',
            organization_name: (org?.name as string | null) ?? '',
            accountant_email: user.accountant_email ?? '',
          }}
        />
      </div>

      <div className="mt-8 border-t border-gray-100 pt-6">
        <h2 className="text-sm font-medium">Accountant</h2>
        <p className="mb-3 mt-1 text-sm text-gray-500">Send this month&apos;s expenses (CSV) to your accountant.</p>
        <EmailAccountantButton hasAccountantEmail={!!user.accountant_email} />
      </div>

      <div className="mt-8 border-t border-gray-100 pt-6">
        <h2 className="text-sm font-medium text-error-700">Danger zone</h2>
        <p className="mb-3 mt-1 text-sm text-gray-500">Delete your account and all data permanently.</p>
        <DeleteAccountButton />
      </div>
    </main>
  );
}
