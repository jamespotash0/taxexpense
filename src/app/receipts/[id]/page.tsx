// Receipt detail + edit (TSNAP-040). Server Component loads data + signed photo URL +
// IRC summary, then hands off to the client editor.
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { getReceipt } from '@/lib/receipts';
import { getSignedReceiptUrl } from '@/lib/ocr';
import { getIrcSummary } from '@/lib/irc';
import { ReceiptEditor } from '@/components/ReceiptEditor';
import { SubstantiationBadge } from '@/components/SubstantiationBadge';
import { getI18n } from '@/i18n/server';

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!user) redirect(`/login?returnTo=/receipts/${id}`);

  const { t } = await getI18n();
  const r = t.app.receipt;

  const receipt = await getReceipt(user.organization_id, id);
  if (!receipt) notFound();

  const [photoUrl, irc] = await Promise.all([
    receipt.photo_url ? getSignedReceiptUrl(receipt.photo_url).catch(() => null) : Promise.resolve(null),
    getIrcSummary(receipt.irc_section),
  ]);

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">{t.app.nav.back}</Link>
        <SubstantiationBadge
          substantiationComplete={receipt.substantiation_complete}
          needsReceipt={receipt.needs_receipt}
          missingFields={receipt.substantiation_missing_fields}
          labels={t.app.badge}
        />
      </div>

      <h1 className="mt-4 text-xl font-semibold">{r.title}</h1>

      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <ReceiptEditor receipt={receipt} photoUrl={photoUrl} t={r} categories={t.app.categories} />
        </div>
        <aside className="text-sm">
          {irc ? (
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="font-medium">IRC §{irc.section_id} — {irc.title}</p>
              <p className="mt-2 text-gray-600">{irc.short_summary}</p>
              {irc.worth_noting && <p className="mt-2 text-xs text-gray-500">{r.worthNoting} {irc.worth_noting}</p>}
              <p className="mt-3 text-xs text-gray-400">{r.ircNote}</p>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
