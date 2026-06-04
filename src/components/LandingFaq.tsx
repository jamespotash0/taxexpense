// Landing FAQ (DEC-043). Spec-accurate, compliance-checked answers (recordkeeping-not-advice).
// Native <details>/<summary> — accessible and zero client JS. Server component.
import { Reveal } from '@/components/Reveal';
import type { Dict } from '@/i18n/dictionaries';

export function LandingFaq({ t }: { t: Dict['faq'] }) {
  return (
    <>
      <Reveal className="text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t.heading}</h2>
      </Reveal>
      <Reveal className="mx-auto mt-8 max-w-2xl divide-y divide-gray-200 border-y border-gray-200" delay={0.06}>
        {t.items.map((item) => (
          <details key={item.q} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left font-medium text-gray-900 [&::-webkit-details-marker]:hidden">
              {item.q}
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden
                className="shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180"
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <p className="pb-5 pr-8 text-gray-600">{item.a}</p>
          </details>
        ))}
      </Reveal>
    </>
  );
}
