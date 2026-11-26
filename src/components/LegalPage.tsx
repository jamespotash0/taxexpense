// Shared layout for the policy pages (/terms, /privacy). Same world as the landing and /pricing:
// Geist, white ground, the marketing nav with the wordmark, one red accent, hairline-ruled sections.
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { BackLink } from '@/components/BackLink';
import { getI18n } from '@/i18n/server';
import { geist } from '@/app/fonts';

export const legalLink = 'text-[#d92d20] underline decoration-[#d92d20]/30 underline-offset-4 hover:decoration-[#d92d20]';

export async function LegalPage({
  title,
  lastUpdated,
  sections,
  seeAlso,
}: {
  title: string;
  lastUpdated: string;
  sections: { title: string; body: React.ReactNode }[];
  seeAlso: { href: string; label: string };
}) {
  const { t } = await getI18n();

  return (
    <div className={`${geist.className} min-h-screen bg-white text-[#101210] antialiased selection:bg-[#fdecea]`}>
      <SiteHeader login={t.nav.login} getStarted={t.nav.getStarted} pricing={t.nav.pricing} />

      <main className="px-5 pb-28 pt-10 sm:px-6 lg:pt-14">
        <article className="mx-auto max-w-[44rem]">
          <BackLink />
          <h1 className="mt-8 text-balance text-[clamp(2.5rem,5vw,4rem)] font-normal leading-[1.04] tracking-[-0.04em]">{title}</h1>
          <p className="mt-5 text-[1.05rem] text-[#6f726d]">Last updated {lastUpdated}. A V1 draft pending legal review.</p>

          <div className="mt-14 border-t border-black/[0.08]">
            {sections.map((s) => (
              <section key={s.title} className="border-b border-black/[0.08] py-8">
                <h2 className="text-[1.3rem] font-normal tracking-[-0.015em]">{s.title}</h2>
                <p className="mt-3 max-w-[62ch] text-[1rem] leading-relaxed text-[#4a4d48]">{s.body}</p>
              </section>
            ))}
          </div>

          <p className="mt-10 text-[0.95rem] text-[#6f726d]">
            See also our{' '}
            <Link href={seeAlso.href} className={legalLink}>{seeAlso.label}</Link>.
          </p>
        </article>
      </main>
    </div>
  );
}
