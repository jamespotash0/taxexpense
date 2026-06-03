// Public IRC reference page (DEC-036). The "view in plain English" target for the §-link
// Tally appends to every categorization SMS. Reads the same irc_summaries the AI cites, so the
// explanation a user reads here is exactly what drove their categorization. Reference data only
// (no user data, no auth). Recordkeeping, not tax advice — disclaimer shown.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getIrcSummary } from '@/lib/irc';

export const dynamic = 'force-dynamic';

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
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm font-medium text-accent hover:text-accent-hover">
        ← Tally
      </Link>

      <p className="mt-8 text-sm font-semibold uppercase tracking-wider text-accent">IRC §{irc.section_id}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{irc.title}</h1>
      {irc.deduction_percentage != null && (
        <p className="mt-3 inline-flex rounded-full bg-accent-50 px-3 py-1 text-sm font-medium text-accent">
          Typically {irc.deduction_percentage}% deductible
        </p>
      )}

      <div className="mt-8 space-y-7">
        {sections
          .filter((s) => s.body)
          .map((s) => (
            <section key={s.label}>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">{s.label}</h2>
              <p className="mt-2 text-gray-700">{s.body}</p>
            </section>
          ))}
      </div>

      {irc.source_url && (
        <p className="mt-8 text-sm text-gray-500">
          Read the statute:{' '}
          <a href={irc.source_url} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-4 hover:underline">
            {irc.source_url.replace(/^https?:\/\//, '')}
          </a>
        </p>
      )}

      <p className="mt-10 border-t border-gray-100 pt-6 text-xs text-gray-400">
        Recordkeeping, not tax advice. For your specific situation, consult a licensed tax professional.
      </p>

      <Link
        href="/start"
        className="mt-8 inline-flex rounded-xl bg-accent px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
      >
        Capture the why with Tally →
      </Link>
    </main>
  );
}
