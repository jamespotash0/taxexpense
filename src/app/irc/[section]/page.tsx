// Public IRC reference page (DEC-036). The "view in plain English" target for the §-link
// Tally appends to every categorization SMS. Reads the same irc_summaries the AI cites, so the
// explanation a user reads here is exactly what drove their categorization. Reference data only
// (no user data, no auth). Recordkeeping, not tax advice — disclaimer shown.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getIrcSummary } from '@/lib/irc';
import { SiteHeader } from '@/components/SiteHeader';
import { BackLink } from '@/components/BackLink';
import { legalLink } from '@/components/LegalPage';
import { getI18n } from '@/i18n/server';
import { geist } from '@/app/fonts';

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

  const { t } = await getI18n();

  return (
    <div className={`${geist.className} min-h-screen bg-white text-[#101210] antialiased selection:bg-[#fdecea]`}>
      <SiteHeader login={t.nav.login} getStarted={t.nav.getStarted} pricing={t.nav.pricing} />

      <main className="px-5 pb-28 pt-10 sm:px-6 lg:pt-14">
        <article className="mx-auto max-w-[44rem]">
          <BackLink />
          <h1 className="mt-8 text-balance text-[clamp(2.5rem,5vw,4rem)] font-normal leading-[1.04] tracking-[-0.04em]">
            <span className="block text-[#d92d20]">IRC §{irc.section_id}</span>
            {irc.title}
          </h1>
          {irc.deduction_percentage != null && (
            <p className="mt-5 text-[1.05rem] text-[#6f726d]">Typically {irc.deduction_percentage}% deductible.</p>
          )}

          <div className="mt-14 border-t border-black/[0.08]">
            {sections
              .filter((s) => s.body)
              .map((s) => (
                <section key={s.label} className="border-b border-black/[0.08] py-8">
                  <h2 className="text-[1.3rem] font-normal tracking-[-0.015em]">{s.label}</h2>
                  <p className="mt-3 max-w-[62ch] text-[1rem] leading-relaxed text-[#4a4d48]">{s.body}</p>
                </section>
              ))}
          </div>

          {irc.source_url && (
            <p className="mt-10 text-[0.95rem] text-[#6f726d]">
              Read the statute:{' '}
              <a href={irc.source_url} target="_blank" rel="noopener noreferrer" className={`break-all ${legalLink}`}>
                {irc.source_url.replace(/^https?:\/\//, '')}
              </a>
            </p>
          )}

          <p className="mt-4 text-[0.95rem] text-[#6f726d]">
            Recordkeeping, not tax advice. For your specific situation, consult a licensed tax professional.
          </p>

          <Link href="/start" className="mt-10 inline-flex rounded-full bg-[#101210] px-5 py-3 text-[0.95rem] font-medium text-white transition-colors hover:bg-[#d92d20]">
            Capture the why with Tally
          </Link>
        </article>
      </main>
    </div>
  );
}
