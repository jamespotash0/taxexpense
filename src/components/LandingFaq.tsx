// Landing FAQ (DEC-043). Spec-accurate, compliance-checked answers (recordkeeping-not-advice).
// Native <details>/<summary>: accessible and zero client JS. Server component.
import type { Dict } from '@/i18n/dictionaries';

export function LandingFaq({ t }: { t: Dict['faq'] }) {
  return (
    <div>
      <h2 className="text-[clamp(2.1rem,4.4vw,2.9rem)] font-normal leading-[1.1] tracking-[-0.018em] text-[#101210]">{t.heading}</h2>
      <div className="mt-8 border-t border-black/[0.08]">
        {t.items.map((item) => (
          <details key={item.q} className="group border-b border-black/[0.08]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-[1.08rem] text-[#101210] [&::-webkit-details-marker]:hidden">
              {item.q}
              <svg viewBox="0 0 16 16" fill="none" aria-hidden className="h-4 w-4 shrink-0 text-[#6f726d] transition-transform duration-200 group-open:rotate-180">
                <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <p className="max-w-[62ch] pb-6 pr-8 text-[1rem] leading-relaxed text-[#6f726d]">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
