// Receipt detail + edit (TSNAP-040). Server Component loads data + signed photo URL +
// IRC summary, then hands off to the client editor.
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { getReceipt } from '@/lib/receipts';
import { getSignedReceiptUrl } from '@/lib/ocr';
import { getIrcSummary } from '@/lib/irc';
import { getUserAgencyIds } from '@/lib/agency';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/AppIcons';
import { ReceiptEditor } from '@/components/ReceiptEditor';
import { SubstantiationBadge } from '@/components/SubstantiationBadge';
import { formatMoney, formatDate } from '@/lib/format';
import { getI18n } from '@/i18n/server';

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!user) redirect(`/login?returnTo=/receipts/${id}`);

  const { t } = await getI18n();
  const r = t.app.receipt;

  const receipt = await getReceipt(user.organization_id, id);
  if (!receipt) notFound();

  const [photoUrl, irc, agencyIds] = await Promise.all([
    receipt.photo_url ? getSignedReceiptUrl(receipt.photo_url).catch(() => null) : Promise.resolve(null),
    getIrcSummary(receipt.irc_section),
    getUserAgencyIds(user.id),
  ]);
  const category =
    receipt.category && receipt.category in t.app.categories
      ? (t.app.categories as Record<string, string>)[receipt.category]
      : t.app.categories.uncategorized;

  const explainer = irc ? (
    <div className="rounded-[28px] bg-primary-50 p-6">
      <h2 className="text-2xl font-bold tracking-[-0.03em] text-primary">§{irc.section_id}</h2>
      <p className="mt-0.5 font-semibold">{irc.title}</p>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-foreground/80">{irc.short_summary}</p>
      {irc.worth_noting && <p className="mt-3 text-sm leading-relaxed text-muted">{r.worthNoting} {irc.worth_noting}</p>}
      <Link href={`/irc/${irc.section_id}`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
        {r.readMore}
        <Icon name="chevron" size={16} />
      </Link>
      <p className="mt-5 border-t border-primary/15 pt-4 text-xs leading-relaxed text-muted">{r.ircNote}</p>
    </div>
  ) : null;

  return (
    <AppShell nav={t.app.nav} showAgency={agencyIds.length > 0} width="max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <Link href="/dashboard" aria-label={t.app.nav.back.replace(/^←\s*/, '')} className="flex size-10 items-center justify-center rounded-full bg-fill text-foreground transition-colors hover:bg-fill-strong">
          <Icon name="back" size={20} />
        </Link>
        <SubstantiationBadge
          substantiationComplete={receipt.substantiation_complete}
          needsReceipt={receipt.needs_receipt}
          missingFields={receipt.substantiation_missing_fields}
          labels={t.app.badge}
        />
      </div>

      <header className="mt-6">
        <h1 className="text-[1.375rem] font-bold tracking-[-0.02em]">{receipt.vendor ?? r.title}</h1>
        <p className="display-amount mt-2">{formatMoney(receipt.amount_cents)}</p>
        <p className="mt-2 text-[0.9375rem] text-muted">{formatDate(receipt.transaction_date)} · {category}</p>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ReceiptEditor receipt={receipt} photoUrl={photoUrl} t={r} categories={t.app.categories} explainer={explainer && <div className="lg:hidden">{explainer}</div>} />
        {explainer && <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">{explainer}</aside>}
      </div>
    </AppShell>
  );
}
