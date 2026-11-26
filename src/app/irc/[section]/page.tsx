// Public IRC reference page (DEC-036). The "view in plain English" target for the §-link
// Tally appends to every categorization SMS. Reads the same irc_summaries the AI cites, so the
// explanation a user reads here is exactly what drove their categorization. Reference data only
// (no user data, no auth). Recordkeeping, not tax advice — disclaimer shown.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getIrcSummary } from '@/lib/irc';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/AppIcons';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  const irc = await getIrcSummary(section);
  if (!irc) return {};
  return {
    title: `IRC §${irc.section_id}: ${irc.title}`,
    description: irc.short_summary.slice(0, 160),
    alternates: { canonical: `/irc/${irc.section_id}` },
  };
}

export default async function IrcPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const irc = await getIrcSummary(section);
  if (!irc) notFound();

  const sections: { label: string; body: string | null }[] = [
    { label: 'In plain English', body: irc.short_summary },
    { label: 'How it usually works', body: irc.common_practice },
    { label: 'Worth noting', body: irc.worth_noting },
  ];

  return (
    <AppShell wordmarkHref="/" width="max-w-2xl">
      <article className="pb-6 pt-4 sm:pt-8">
        <h1 className="text-[2.25rem] font-bold leading-[1.1] tracking-[-0.035em] text-balance sm:text-[2.75rem]">
          <span className="block text-primary">IRC §{irc.section_id}</span>
          {irc.title}
        </h1>
        {irc.deduction_percentage != null && (
          <p className="chip mt-5 h-8 bg-primary-50 px-3.5 text-sm text-primary">Typically {irc.deduction_percentage}% deductible</p>
        )}

        <div className="mt-10 space-y-8">
          {sections
            .filter((s) => s.body)
            .map((s) => (
              <section key={s.label}>
                <h2 className="text-lg font-bold tracking-[-0.02em]">{s.label}</h2>
                <p className="mt-2 max-w-[65ch] text-[1.0625rem] leading-relaxed text-foreground/80">{s.body}</p>
              </section>
            ))}
        </div>

        {irc.source_url && (
          <p className="mt-10 text-[0.9375rem] text-muted">
            Read the statute:{' '}
            <a href={irc.source_url} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-primary hover:underline">
              {irc.source_url.replace(/^https?:\/\//, '')}
            </a>
          </p>
        )}

        <p className="mt-10 border-t border-border pt-6 text-sm text-muted">
          Recordkeeping, not tax advice. For your specific situation, consult a licensed tax professional.
        </p>

        <Link href="/start" className="btn btn-primary mt-8">
          Capture the why with Tally
          <Icon name="chevron" size={18} />
        </Link>
      </article>
    </AppShell>
  );
}
