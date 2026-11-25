// How it works: three large rows, one idea each (text it, asks only when required, export).
// Text on one side, a small quiet piece of UI on the other; sides alternate on desktop.
// Vignette contents are illustrative. Server component.
import type { Dict } from '@/i18n/dictionaries';

const meBubble = 'max-w-[85%] rounded-[18px] rounded-br-[5px] bg-[#0b84ff] px-3.5 py-2 text-[0.95rem] text-white';
const themBubble = 'max-w-[85%] rounded-[18px] rounded-bl-[5px] bg-[#e9e9eb] px-3.5 py-2 text-[0.95rem] text-[#101210]';
const check = (
  <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" aria-hidden><circle cx="8" cy="8" r="7" fill="#0f7a47" /><path d="m4.8 8.2 2.1 2.1 4.3-4.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const VIGNETTES: React.ReactNode[] = [
  // Text it: the text is the record
  <div key="0" className="flex w-full max-w-[20rem] flex-col gap-2">
    <p className={`${meBubble} self-end`}>Coffee w/ a referral partner, $11.20</p>
    <p className={`${themBubble} self-start`}>Got it. Logged as a client meal.</p>
    <p className="mt-1 flex items-center gap-1.5 self-start text-[0.9rem] font-medium text-[#0f7a47]">{check} Documentation complete</p>
  </div>,
  // Asks only when required, with the IRC cite
  <div key="1" className="flex w-full max-w-[20rem] flex-col gap-2">
    <p className={`${meBubble} self-end`}>Client dinner, $140</p>
    <p className={`${themBubble} self-start`}>Over $75, so snap the receipt when you can.</p>
    <span className="mt-1 inline-flex self-start rounded-full bg-[#fdecea] px-3 py-1 text-[0.85rem] font-medium text-[#d92d20]">IRC §274(d)</span>
  </div>,
  // Export
  <div key="2" className="flex gap-4">
    {['CSV', 'QBO'].map((f) => (
      <span key={f} className="flex h-[7rem] w-[5.75rem] flex-col items-center justify-end rounded-xl bg-white pb-4 text-[0.9rem] font-semibold text-[#101210] shadow-[0_10px_24px_-14px_rgba(16,18,16,0.4)] ring-1 ring-black/5">
        <svg viewBox="0 0 24 24" className="mb-2.5 h-7 w-7 text-[#0f7a47]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M7 3.5h7l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1zM14 3.5v4h4" /></svg>
        {f}
      </span>
    ))}
  </div>,
];

export function Features({ t }: { t: Dict['features'] }) {
  return (
    <div className="mx-auto max-w-[80rem]">
      <h2 className="max-w-[40rem] text-balance text-[clamp(2.1rem,4.4vw,2.9rem)] font-normal leading-[1.1] tracking-[-0.018em] text-[#101210]">{t.heading}</h2>
      <p className="mt-4 max-w-[38rem] text-pretty text-[1.1rem] leading-[1.55] text-[#6f726d]">{t.sub}</p>
      <ol className="mt-20 space-y-20 lg:mt-28 lg:space-y-32">
        {t.items.map((f, i) => (
          <li key={f.title} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-20">
            <div className={i % 2 ? 'lg:order-2' : ''}>
              <h3 className="text-balance text-[clamp(1.6rem,3vw,2.1rem)] font-normal leading-[1.15] tracking-[-0.02em] text-[#101210]">{f.title}</h3>
              <p className="mt-4 max-w-[30rem] text-pretty text-[1.1rem] leading-[1.6] text-[#6f726d]">{f.body}</p>
            </div>
            <div aria-hidden className="flex h-[18rem] items-center justify-center rounded-[28px] bg-[#f0f0ee] px-6 sm:h-[22rem]">
              {VIGNETTES[i]}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
