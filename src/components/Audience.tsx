// Who it's for: sole proprietors and single-member LLCs (both file Schedule C by default), what
// their money life looks like, and why texting fits it. Server component.
import type { Dict } from '@/i18n/dictionaries';

const ICONS = [
  // cards
  <path key="c" d="M3.5 7.5A2 2 0 0 1 5.5 5.5h13a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2zM3.5 10h17M7 15h3" />,
  // phone
  <path key="p" d="M8 3.5h8A1.5 1.5 0 0 1 17.5 5v14a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19V5A1.5 1.5 0 0 1 8 3.5zM11 17.5h2" />,
  // document
  <path key="d" d="M7 3.5h7l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1zM14 3.5v4h4M9 12.5h6M9 16h4" />,
];

export function Audience({ t }: { t: Dict['audience'] }) {
  return (
    <div className="mx-auto grid max-w-[80rem] gap-10 rounded-[32px] bg-white p-6 ring-1 ring-black/[0.06] sm:p-10 lg:grid-cols-2 lg:gap-16 lg:p-14">
      <div>
        <h2 className="text-balance text-[clamp(2.1rem,4.4vw,2.9rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-[#101210]">{t.heading}</h2>
        <p className="mt-5 max-w-[32rem] text-pretty text-[1.1rem] leading-relaxed text-[#6f726d]">{t.sub}</p>
        <ul className="mt-8 flex flex-wrap gap-2">
          {t.work.map((w) => (
            <li key={w} className="rounded-full px-4 py-2 text-[0.92rem] text-[#101210] ring-1 ring-black/[0.12]">{w}</li>
          ))}
        </ul>
      </div>
      <ul className="divide-y divide-black/[0.07] self-center">
        {t.points.map((pt, i) => (
          <li key={pt.title} className="flex gap-4 py-5 first:pt-0 last:pb-0">
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fdecea] text-[#d92d20]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[i]}</svg>
            </span>
            <div>
              <h3 className="text-[1.2rem] font-medium tracking-[-0.02em] text-[#101210]">{pt.title}</h3>
              <p className="mt-1 text-[1rem] leading-relaxed text-[#6f726d]">{pt.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
