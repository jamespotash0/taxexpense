// Features grid (ZeroSettle-style): each tile is a gray frame holding a tiny piece of working UI,
// then a short title and one line. Vignette contents are illustrative. Server component.
import type { Dict } from '@/i18n/dictionaries';

const meBubble = 'rounded-[16px] rounded-br-[5px] bg-[#0b84ff] px-3 py-1.5 text-[0.85rem] text-white';
const themBubble = 'rounded-[16px] rounded-bl-[5px] bg-[#e9e9eb] px-3 py-1.5 text-[0.85rem] text-[#101210]';
const check = (
  <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" aria-hidden><circle cx="8" cy="8" r="7" fill="#0f7a47" /><path d="m4.8 8.2 2.1 2.1 4.3-4.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const VIGNETTES: React.ReactNode[] = [
  // Cites the tax code
  <div key="0" className="w-full max-w-[16rem] rounded-2xl bg-[#f6f6f4] p-4">
    <p className="text-[0.95rem] font-semibold text-[#101210]">Sweetgreen</p>
    <p className="text-[0.8rem] text-[#6f726d]">Client meal · $92.40</p>
    <span className="mt-3 inline-flex rounded-full bg-[#fdecea] px-3 py-1 text-[0.82rem] font-semibold text-[#d92d20]">IRC §274(d)</span>
  </div>,
  // Asks only when required
  <div key="1" className="flex w-full max-w-[17rem] flex-col gap-1.5">
    <p className={`${meBubble} self-end`}>Client dinner, $140</p>
    <p className={`${themBubble} self-start`}>Over $75, so snap the receipt when you can.</p>
  </div>,
  // Your text is the record
  <div key="2" className="flex w-full max-w-[17rem] flex-col gap-2">
    <p className={`${meBubble} self-end`}>Coffee w/ a referral partner, $11.20</p>
    <p className="flex items-center gap-1.5 self-start text-[0.85rem] font-semibold text-[#0f7a47]">{check} Your text is the record</p>
  </div>,
  // Receipt photos
  <div key="3" className="w-[9.5rem] -rotate-3 rounded-lg bg-white px-3 py-3 text-[#101210] shadow-[0_10px_24px_-12px_rgba(16,18,16,0.4)] ring-1 ring-black/5">
    <p className="text-center text-[0.62rem] font-bold tracking-[0.08em]">SHELL</p>
    <div className="mt-2 space-y-1 text-[0.55rem]">
      <p className="flex justify-between"><span>Unleaded 13.2 gal</span><span>54.10</span></p>
    </div>
    <p className="mt-2 flex justify-between border-t border-dashed border-[#d4d4d2] pt-1.5 text-[0.62rem] font-bold"><span>TOTAL</span><span>$54.10</span></p>
  </div>,
  // Web dashboard
  <ul key="4" className="w-full max-w-[17rem] divide-y divide-black/[0.06] rounded-2xl bg-white text-[0.85rem] ring-1 ring-black/[0.06]">
    {[['Sweetgreen', '$92.40', true], ['Hilton Denver', '$412.00', false], ['Adobe', '$59.99', true]].map(([n, a, ok]) => (
      <li key={n as string} className="flex items-center gap-2 px-3 py-2.5">
        <span className="flex-1 font-medium text-[#101210]">{n}</span>
        <span className="text-[#6f726d]">{a}</span>
        <span className={`h-2 w-2 rounded-full ${ok ? 'bg-[#0f7a47]' : 'bg-[#f0a020]'}`} aria-hidden />
      </li>
    ))}
  </ul>,
  // CSV and QuickBooks
  <div key="5" className="flex gap-3">
    {['CSV', 'QBO'].map((f) => (
      <span key={f} className="flex h-[5.5rem] w-[4.5rem] flex-col items-center justify-end rounded-xl bg-white pb-3 text-[0.8rem] font-bold text-[#101210] shadow-[0_8px_20px_-12px_rgba(16,18,16,0.4)] ring-1 ring-black/5">
        <svg viewBox="0 0 24 24" className="mb-2 h-6 w-6 text-[#0f7a47]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M7 3.5h7l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1zM14 3.5v4h4" /></svg>
        {f}
      </span>
    ))}
  </div>,
  // Email your accountant
  <div key="6" className="w-full max-w-[17rem] rounded-2xl bg-white p-4 text-[0.82rem] ring-1 ring-black/[0.06]">
    <p className="text-[#6f726d]">To: <span className="text-[#101210]">your accountant</span></p>
    <p className="mt-2 rounded-lg bg-[#f6f6f4] px-2.5 py-2 font-medium text-[#101210]">expenses-2026.csv</p>
    <span className="mt-3 inline-flex rounded-full bg-[#0b84ff] px-3.5 py-1.5 font-semibold text-white">Send</span>
  </div>,
  // Month-end review
  <div key="7" className="w-full max-w-[16rem] rounded-2xl bg-white p-4 ring-1 ring-black/[0.06]">
    <p className="text-[0.9rem] font-semibold text-[#101210]">November</p>
    <p className="text-[0.8rem] text-[#6f726d]">2 expenses need a why</p>
    <div className="mt-3 h-2 rounded-full bg-[#eeeeec]" aria-hidden><div className="h-2 w-[85%] rounded-full bg-[#0f7a47]" /></div>
  </div>,
  // You have the final say
  <div key="8" className="w-full max-w-[16rem] rounded-2xl bg-white p-4 ring-1 ring-black/[0.06]">
    <p className="text-[0.75rem] font-medium text-[#6f726d]">Category</p>
    <p className="mt-1 flex items-center justify-between rounded-lg bg-[#f6f6f4] px-3 py-2 text-[0.88rem] font-medium text-[#101210]">
      Client meal
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[#6f726d]" fill="none" aria-hidden><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </p>
    <p className="mt-2 text-[0.75rem] text-[#6f726d]">Edited by you</p>
  </div>,
];

export function Features({ t }: { t: Dict['features'] }) {
  return (
    <div className="mx-auto max-w-[80rem]">
      <h2 className="text-balance text-[clamp(2.1rem,4.4vw,2.9rem)] font-normal leading-[1.1] tracking-[-0.018em] text-[#101210]">{t.heading}</h2>
      <p className="mt-4 max-w-[38rem] text-pretty text-[1.1rem] leading-[1.55] text-[#6f726d]">{t.sub}</p>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {t.items.map((f, i) => (
          <li key={f.title} className="rounded-[28px] bg-[#ececea] p-2">
            <div aria-hidden className="flex h-[11rem] items-center sm:h-[13.5rem] justify-center rounded-[22px] bg-white px-5">{VIGNETTES[i]}</div>
            <div className="px-4 pb-4 pt-5">
              <h3 className="text-[1.3rem] font-normal tracking-[-0.02em] text-[#101210]">{f.title}</h3>
              <p className="mt-1.5 text-[1rem] leading-relaxed text-[#6f726d]">{f.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
