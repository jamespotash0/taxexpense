// Hero visual: a full-bleed red panel (bleeds to the right edge of the screen) holding a Tally
// dashboard window, cropped by the edge, and the conversation with Penny overlapping it in front.
// Dashboard contents are an illustrative example. Server component (HeroThread is the client part).
import { HeroThread } from './HeroThread';
import { NumberTicker } from './NumberTicker';
import { BlurFade } from './Reveal';

const Check = () => (
  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden><circle cx="8" cy="8" r="7" fill="#0f7a47" /><path d="m4.8 8.2 2.1 2.1 4.3-4.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const ROWS: [string, string, string, string][] = [
  ['Nov 24', 'Adobe', 'Software', '$59.99'],
  ['Nov 21', 'Hilton Denver', 'Lodging', '$412.00'],
  ['Nov 18', 'Uber', 'Travel', '$38.20'],
  ['Nov 12', 'Shell', 'Car', '$54.10'],
  ['Nov 7', 'Sweetgreen', 'Client meal', '$92.40'],
];

function DashboardWindow() {
  return (
    <div className="w-[44rem] overflow-hidden rounded-[14px] bg-white shadow-[0_30px_80px_-30px_rgba(60,8,4,0.55)] ring-1 ring-black/[0.06]">
      <div className="flex items-center gap-3 border-b border-black/[0.06] bg-[#f6f6f4] px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-black/[0.12]" />
          <span className="h-2.5 w-2.5 rounded-full bg-black/[0.12]" />
          <span className="h-2.5 w-2.5 rounded-full bg-black/[0.12]" />
        </span>
        <span className="rounded-full bg-white px-4 py-1 text-[0.72rem] text-[#6f726d] ring-1 ring-black/[0.05]">tallywhy.com/dashboard</span>
      </div>
      <div className="p-7">
        <p className="text-[0.8rem] text-[#6f726d]">Spent in November</p>
        <p className="mt-1 text-[2.6rem] leading-none tracking-[-0.04em] tabular-nums text-[#101210]"><NumberTicker value={2184.6} prefix="$" decimals={2} /></p>
        <div className="mt-5 flex items-center gap-3">
          <div className="bar-fill h-1.5 w-56 rounded-full bg-[#0f7a47]" aria-hidden />
          <p className="flex items-center gap-1.5 text-[0.8rem] text-[#0f7a47]"><Check /> <NumberTicker value={23} /> of 23 documented</p>
        </div>
        <ul className="mt-6 divide-y divide-black/[0.06] border-t border-black/[0.06] text-[0.85rem]">
          {ROWS.map(([d, n, c, a]) => (
            <li key={n} className="grid grid-cols-[4rem_1fr_8rem_5rem] items-center gap-3 py-2.5">
              <span className="tabular-nums text-[#6f726d]">{d}</span>
              <span className="text-[#101210]">{n} <span className="text-[#6f726d]">· {c}</span></span>
              <span className="flex items-center gap-1.5 text-[0.78rem] text-[#0f7a47]"><Check /> Complete</span>
              <span className="text-right tabular-nums text-[#101210]">{a}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function HeroVisual() {
  return (
    <div
      aria-hidden
      className="relative h-[34rem] overflow-hidden bg-[#d92d20] lg:h-full lg:min-h-[32rem]"
      style={{
        backgroundImage:
          'radial-gradient(60% 55% at 20% 15%, rgba(255,140,120,0.55), transparent 70%), radial-gradient(55% 60% at 85% 90%, rgba(120,10,4,0.45), transparent 70%), radial-gradient(40% 40% at 70% 30%, rgba(255,255,255,0.10), transparent 70%)',
      }}
    >
      {/* Dashboard, cropped by the right edge of the screen (desktop only). */}
      <BlurFade delay={0.25} className="absolute left-[26%] top-[11%] hidden lg:block">
        <DashboardWindow />
      </BlurFade>
      {/* Penny, in front. */}
      <div className="absolute inset-x-5 bottom-8 sm:inset-x-auto sm:left-1/2 sm:w-[24rem] sm:-translate-x-1/2 lg:bottom-[9%] lg:left-[9%] lg:w-[23rem] lg:translate-x-0">
        <BlurFade delay={0.4} className="rounded-[26px] shadow-[0_40px_80px_-30px_rgba(60,8,4,0.6)]">
          <HeroThread />
        </BlurFade>
      </div>
    </div>
  );
}
