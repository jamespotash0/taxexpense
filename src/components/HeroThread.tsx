'use client';

// Landing hero: a realistic iMessage thread with Tally. The user texts a receipt photo and the
// reason; Tally types, then logs it with the IRC section. $92.40 meal + photo + context means
// nothing else is required, so Tally asks nothing (the substantiation tree, quietly).
//
// First paint is the finished thread (no JS / reduced motion get the complete conversation);
// after a short hold it replays on a loop.
import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';

const FINAL = 5;
// beat -> hold ms before the next beat. 0 = empty, 1 photo, 2 note, 3 typing, 4 reply, 5 done.
const HOLDS = [700, 1100, 1300, 1500, 1100, 4200];

function TallyAvatar({ size = 28 }: { size?: number }) {
  return (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-full bg-[#101210]" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-[56%] w-[56%]" fill="none" stroke="#fff" strokeLinecap="round">
        <path d="M18 18h64M50 18v66" strokeWidth="12" />
        <path d="M34 44h32M34 61h32M34 78h32" strokeWidth="8" stroke="#ff6b60" />
      </svg>
    </span>
  );
}

function Receipt() {
  return (
    <div className="w-[9.5rem] bg-white px-3 py-2.5 text-[#101210]">
      <p className="text-center text-[0.62rem] font-bold tracking-[0.08em]">SWEETGREEN</p>
      <p className="text-center text-[0.5rem] text-[#8a8d88]">Nov 7 · 12:41 PM</p>
      <div className="mt-2 space-y-1 text-[0.55rem]">
        <p className="flex justify-between"><span>Harvest bowl</span><span>16.95</span></p>
        <p className="flex justify-between"><span>Kale caesar</span><span>15.45</span></p>
        <p className="flex justify-between"><span>x4 guests</span><span>&nbsp;</span></p>
      </div>
      <p className="mt-2 flex justify-between border-t border-dashed border-[#d4d4d2] pt-1.5 text-[0.62rem] font-bold">
        <span>TOTAL</span>
        <span>$92.40</span>
      </p>
    </div>
  );
}

const me = 'self-end max-w-[78%] rounded-[20px] rounded-br-[6px] bg-[#0b84ff] px-3.5 py-2 text-[0.95rem] leading-[1.3] text-white';
const them = 'max-w-[80%] rounded-[20px] rounded-bl-[6px] bg-[#e9e9eb] px-3.5 py-2 text-[0.95rem] leading-[1.3] text-black';

export function HeroThread() {
  const reduced = useReducedMotion();
  const [live, setLive] = useState(FINAL);
  const beat = reduced ? FINAL : live;

  useEffect(() => {
    if (reduced) return;
    let b = FINAL;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      b = (b + 1) % (FINAL + 1);
      setLive(b);
      timer = setTimeout(tick, HOLDS[b]);
    };
    timer = setTimeout(tick, 2600); // hold the finished thread first
    return () => clearTimeout(timer);
  }, [reduced]);

  return (
    <div
      role="img"
      aria-label="Example text conversation: a receipt photo and a note sent to Tally, which logs it as a client meal under IRC section 274(d) with documentation complete."
      className="relative mx-auto flex h-[34rem] w-full max-w-[23.5rem] flex-col overflow-hidden rounded-[44px] bg-white px-4 pt-5 shadow-[0_40px_90px_-40px_rgba(16,18,16,0.45)] ring-1 ring-black/5"
    >
      {/* Conversation header */}
      <div className="flex flex-col items-center">
        <TallyAvatar size={46} />
        <span className="-mt-1 rounded-full bg-white px-2.5 py-0.5 text-[0.8rem] font-semibold text-[#101210] shadow-[0_1px_4px_rgba(0,0,0,0.12)]">
          Tally <span className="text-[#8a8d88]">›</span>
        </span>
      </div>
      <span aria-hidden className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.12)]">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#101210" strokeWidth="1.8" strokeLinejoin="round"><rect x="3" y="7" width="12" height="10" rx="2.5" /><path d="m15 11 5-3v8l-5-3" /></svg>
      </span>

      <p className="mt-4 text-center text-[0.78rem] text-[#8a8d88]">
        <span className="font-semibold">Today</span> 12:48 PM
      </p>

      <div className="mt-3 flex flex-1 flex-col gap-1.5">
        {beat >= 1 && (
          <div className="animate-bubble-in self-end overflow-hidden rounded-[18px] rounded-br-[6px] ring-1 ring-black/5">
            <Receipt />
          </div>
        )}
        {beat >= 2 && <p className={`animate-bubble-in ${me}`}>Client lunch w/ Sarah from Acme</p>}
        {beat >= 2 && <p className="animate-bubble-in self-end pr-1 text-[0.7rem] text-[#8a8d88]">Delivered</p>}

        {beat >= 3 && <p className="ml-9 text-[0.72rem] text-[#8a8d88]">Tally</p>}
        {beat === 3 && (
          <div className="flex items-end gap-1.5">
            <TallyAvatar />
            <div className="animate-bubble-in flex gap-1 rounded-[20px] rounded-bl-[6px] bg-[#e9e9eb] px-3.5 py-3" aria-hidden>
              <span className="typing-dot h-2 w-2 rounded-full bg-[#8a8d88]" />
              <span className="typing-dot h-2 w-2 rounded-full bg-[#8a8d88]" />
              <span className="typing-dot h-2 w-2 rounded-full bg-[#8a8d88]" />
            </div>
          </div>
        )}
        {beat >= 4 && (
          <div className="flex items-end gap-1.5">
            <span className={beat >= 5 ? 'w-7 shrink-0' : ''}>{beat === 4 && <TallyAvatar />}</span>
            <p className={`animate-bubble-in ${them}`}>Logged $92.40 at Sweetgreen as a client meal. That typically falls under IRC §274(d).</p>
          </div>
        )}
        {beat >= 5 && (
          <div className="flex items-end gap-1.5">
            <TallyAvatar />
            <p className={`animate-bubble-in ${them} flex items-center gap-1.5 font-semibold text-[#0f7a47]`}>
              <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" aria-hidden><circle cx="8" cy="8" r="7" fill="#0f7a47" /><path d="m4.8 8.2 2.1 2.1 4.3-4.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Documentation complete
            </p>
          </div>
        )}
      </div>

      {/* Composer */}
      <div aria-hidden className="mb-4 mt-2 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e9e9eb] text-[1.1rem] leading-none text-[#8a8d88]">+</span>
        <span className="flex h-8 flex-1 items-center rounded-full px-3 text-[0.85rem] text-[#b4b6b2] ring-1 ring-[#e3e3e1]">iMessage</span>
      </div>
    </div>
  );
}
