// How it works, told as outcomes: three large rows (a current year, a why on every write-off, a
// finished year for the accountant). Each shows the result at real UI scale on a stone stage and
// assembles itself once as it scrolls into view (InView sets data-inview; CSS does the rest; reduced
// motion shows the finished card). Sides alternate on desktop. Contents are illustrative.
import type { Dict } from '@/i18n/dictionaries';
import { InView } from './Reveal';

const card = 'w-full max-w-[24rem] rounded-[20px] bg-white p-6 shadow-[0_1px_2px_rgba(16,18,16,0.05),0_24px_48px_-28px_rgba(16,18,16,0.3)] ring-1 ring-black/[0.05]';
const muted = 'text-[#6f726d]';
const EASE = 'ease-[cubic-bezier(0.16,1,0.3,1)]';
// Rises into place when its row is in view.
const rise = `translate-y-2 opacity-0 transition-[opacity,transform] duration-700 ${EASE} group-data-[inview]:translate-y-0 group-data-[inview]:opacity-100 motion-reduce:translate-y-0 motion-reduce:opacity-100`;
const pop = `scale-50 opacity-0 transition-[opacity,transform] duration-500 ${EASE} group-data-[inview]:scale-100 group-data-[inview]:opacity-100 motion-reduce:scale-100 motion-reduce:opacity-100`;
const d = (ms: number) => ({ transitionDelay: `${ms}ms` });

const Check = ({ className = 'h-4 w-4', style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 16 16" style={style} className={`${className} shrink-0`} fill="none" aria-hidden><circle cx="8" cy="8" r="7" fill="#0f7a47" /><path d="m4.8 8.2 2.1 2.1 4.3-4.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const VIGNETTES: React.ReactNode[] = [
  // A month that's already done: the bar fills, then each expense checks off.
  <div key="0" className={card}>
    <div className="flex items-baseline justify-between">
      <p className="text-[1rem] text-[#101210]">November</p>
      <p className={`text-[0.9rem] ${muted}`}>23 expenses</p>
    </div>
    <p className="mt-1 text-[2.4rem] leading-none tracking-[-0.04em] tabular-nums text-[#101210]">$2,184.60</p>
    <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#e3f3ea]" aria-hidden>
      <div style={d(150)} className={`h-1.5 w-0 rounded-full bg-[#0f7a47] transition-[width] duration-[1600ms] ${EASE} group-data-[inview]:w-full motion-reduce:w-full`} />
    </div>
    <p style={d(1100)} className={`mt-2 flex items-center gap-1.5 text-[0.88rem] text-[#0f7a47] ${rise}`}><Check className="h-3.5 w-3.5" /> 23 of 23 documented</p>
    <ul className="mt-5 divide-y divide-black/[0.06] border-t border-black/[0.06] text-[0.92rem]">
      {[['Adobe', 'Software', '$59.99'], ['Shell', 'Car', '$54.10'], ['Sweetgreen', 'Client meal', '$92.40']].map(([n, c, a], i) => (
        <li key={n} style={d(300 + i * 220)} className={`flex items-center gap-3 py-2.5 ${rise}`}>
          <Check className={`h-3.5 w-3.5 ${pop}`} style={d(450 + i * 220)} />
          <span className="flex-1 text-[#101210]">{n} <span className={muted}>· {c}</span></span>
          <span className="tabular-nums text-[#101210]">{a}</span>
        </li>
      ))}
    </ul>
  </div>,
  // The why, written onto the record, then every required detail checks off.
  <div key="1" className={card}>
    <div className="flex items-baseline justify-between">
      <p className="text-[1rem] text-[#101210]">Sweetgreen</p>
      <p className="text-[1rem] tabular-nums text-[#101210]">$92.40</p>
    </div>
    <p className={`mt-0.5 text-[0.88rem] ${muted}`}>Client meal · IRC §274(d)</p>
    <div className="mt-5 rounded-[14px] bg-[#f6f6f4] px-4 py-3.5">
      <p className={`text-[0.8rem] ${muted}`}>Why</p>
      <p style={d(250)} className={`mt-1 text-[1.15rem] leading-snug tracking-[-0.01em] text-[#101210] transition-[clip-path] duration-[1300ms] ${EASE} [clip-path:inset(0_100%_0_0)] group-data-[inview]:[clip-path:inset(0_0_0_0)] motion-reduce:[clip-path:none]`}>
        Client lunch w/ Sarah from Acme
      </p>
    </div>
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[0.88rem]">
      {['Amount', 'Date', 'Place', 'Who'].map((f, i) => (
        <span key={f} className="flex items-center gap-1.5 text-[#101210]"><Check className={`h-3.5 w-3.5 ${pop}`} style={d(1100 + i * 140)} />{f}</span>
      ))}
    </div>
  </div>,
  // A finished year: the file attaches, then it's marked documented.
  <div key="2" className={card}>
    <p className={`text-[0.88rem] ${muted}`}>To <span className="text-[#101210]">Dana Kim, CPA</span></p>
    <p className="mt-1 text-[1rem] text-[#101210]">2026 business expenses</p>
    <div style={d(200)} className={`mt-5 flex items-center gap-3 rounded-[14px] bg-[#f6f6f4] p-3.5 ${rise}`}>
      <span aria-hidden className="flex h-10 w-9 items-center justify-center rounded-[6px] bg-white text-[0.62rem] font-semibold tracking-[0.04em] text-[#0f7a47] ring-1 ring-black/[0.06]">CSV</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.92rem] text-[#101210]">tally-2026.csv</p>
        <p className={`text-[0.8rem] tabular-nums ${muted}`}>214 expenses · $38,412.75</p>
      </div>
    </div>
    <div className="mt-5 flex items-center justify-between">
      <p style={d(700)} className={`flex items-center gap-1.5 text-[0.88rem] text-[#0f7a47] ${rise}`}><Check className="h-3.5 w-3.5" /> All documented</p>
      <span style={d(900)} className={`rounded-full bg-[#101210] px-4 py-2 text-[0.88rem] text-white ${pop}`}>Send</span>
    </div>
  </div>,
];

export function Features({ t }: { t: Dict['features'] }) {
  return (
    <div className="mx-auto max-w-[80rem]">
      <h2 className="max-w-[40rem] text-balance text-[clamp(2.1rem,4.4vw,2.9rem)] font-normal leading-[1.1] tracking-[-0.018em] text-[#101210]">{t.heading}</h2>
      <ol className="mt-16 space-y-20 lg:mt-24 lg:space-y-28">
        {t.items.map((f, i) => (
          <li key={f.title} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-20">
            <div className={i % 2 ? 'lg:order-2' : ''}>
              <h3 className="text-balance text-[clamp(1.6rem,3vw,2.1rem)] font-normal leading-[1.15] tracking-[-0.02em] text-[#101210]">{f.title}</h3>
              <p className="mt-4 max-w-[30rem] text-pretty text-[1.1rem] leading-[1.6] text-[#6f726d]">{f.body}</p>
            </div>
            <InView className="group flex items-center justify-center rounded-[28px] bg-[#f3f2ee] px-5 py-12 sm:px-10 sm:py-16">
              <div aria-hidden className="contents">{VIGNETTES[i]}</div>
            </InView>
          </li>
        ))}
      </ol>
    </div>
  );
}
