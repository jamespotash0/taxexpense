'use client';

// Landing hero: an iPhone in Messages, texting Penny. The receipt photo goes first, then the note
// is typed letter by letter in the compose bar and sent; Penny types, logs it with its IRC section,
// and marks it complete. $92.40 meal + photo + context means nothing else is required, so Penny
// asks nothing (the substantiation tree, quietly).
//
// First paint is the finished thread (no JS / reduced motion keep it). After a hold it replays on
// a loop. The phone drifts slightly as the page scrolls past it.
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { TallyMark } from './SiteHeader';

const NOTE = 'Client lunch w/ Sarah from Acme';
// 0 empty, 1 photo sent, 2 typing the note, 3 note sent, 4 Penny typing, 5 reply, 6 complete.
const FINAL = 6;

function Avatar({ size = 28 }: { size?: number }) {
  return (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-full bg-[#101210]" style={{ width: size, height: size }}>
      <TallyMark light className="h-[62%] w-[62%]" />
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

function StatusBar() {
  return (
    <div className="relative flex h-11 items-center justify-between px-7 pt-1 text-[0.82rem] font-semibold text-[#101210]">
      <span className="tabular-nums">9:41</span>
      {/* Dynamic Island */}
      <span aria-hidden className="absolute left-1/2 top-2.5 h-[1.65rem] w-[5.6rem] -translate-x-1/2 rounded-full bg-black" />
      <span aria-hidden className="flex items-center gap-1.5">
        <svg viewBox="0 0 18 12" className="h-3 w-[1.1rem]" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
        <svg viewBox="0 0 16 12" className="h-3 w-4" fill="currentColor"><path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.2-1.3A10.4 10.4 0 0 0 8 .4 10.4 10.4 0 0 0 .8 3.3L2 4.6a8.6 8.6 0 0 1 6-2.4Zm0 3.6c1.4 0 2.6.5 3.6 1.4l1.2-1.3A7 7 0 0 0 8 4a7 7 0 0 0-4.8 1.9l1.2 1.3c1-.9 2.2-1.4 3.6-1.4Zm0 3.5c.5 0 1 .2 1.3.5L8 11.2 6.7 9.8c.3-.3.8-.5 1.3-.5Z" /></svg>
        <svg viewBox="0 0 27 13" className="h-3 w-[1.6rem]" fill="none"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="currentColor" opacity="0.4" /><rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor" /><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" opacity="0.45" /></svg>
      </span>
    </div>
  );
}

const me = 'self-end max-w-[78%] rounded-[20px] rounded-br-[6px] bg-[#0b84ff] px-3.5 py-2 text-[0.93rem] leading-[1.3] text-white';
const them = 'max-w-[80%] rounded-[20px] rounded-bl-[6px] bg-[#e9e9eb] px-3.5 py-2 text-[0.93rem] leading-[1.3] text-black';

export function HeroThread() {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(FINAL);
  const [typed, setTyped] = useState(0);
  const p = reduced ? FINAL : phase;

  useEffect(() => {
    if (reduced) return;
    let alive = true;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(2600); // hold the finished thread first
      while (alive) {
        setTyped(0);
        setPhase(0);
        await wait(700);
        if (!alive) return;
        setPhase(1);
        await wait(1000);
        setPhase(2);
        for (let i = 1; i <= NOTE.length && alive; i++) {
          setTyped(i);
          await wait(40 + Math.random() * 60); // uneven, like a thumb
        }
        await wait(450);
        if (!alive) return;
        setPhase(3);
        setTyped(0);
        await wait(1000);
        setPhase(4);
        await wait(1500);
        setPhase(5);
        await wait(1100);
        setPhase(6);
        await wait(4800);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reduced]);

  // Gentle drift as the hero scrolls away.
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [24, -24]);
  const rotate = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [1.5, -1.5]);

  const composing = p === 2;

  return (
    <motion.div ref={ref} style={{ y, rotate }} className="relative mx-auto w-full max-w-[22.5rem]">
      <div
        role="img"
        aria-label="Example text conversation: a receipt photo and a note sent to Penny, Tally's assistant, which logs it as a client meal under IRC section 274(d) with documentation complete."
        className="rounded-[3.4rem] bg-[#101210] p-[0.6rem] shadow-[0_2px_4px_rgba(16,18,16,0.12),0_50px_100px_-40px_rgba(16,18,16,0.55)] ring-1 ring-black/20"
      >
        <div className="flex h-[38rem] flex-col overflow-hidden rounded-[2.85rem] bg-white">
          <StatusBar />

          {/* Messages header */}
          <div className="relative flex flex-col items-center border-b border-black/[0.06] pb-2.5 pt-1">
            <svg aria-hidden viewBox="0 0 12 20" className="absolute left-5 top-4 h-[1.1rem] w-[0.7rem]" fill="none"><path d="M10 2 2 10l8 8" stroke="#0b84ff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <Avatar size={44} />
            <span className="mt-1 text-[0.75rem] font-medium text-[#101210]">
              Penny <span className="text-[#8a8d88]">›</span>
            </span>
            <svg aria-hidden viewBox="0 0 24 24" className="absolute right-5 top-4 h-5 w-5" fill="none" stroke="#0b84ff" strokeWidth="1.8" strokeLinejoin="round"><rect x="2.5" y="6.5" width="13" height="11" rx="2.5" /><path d="m15.5 11 5.5-3.5v9L15.5 13" /></svg>
          </div>

          {/* Thread */}
          <div className="flex flex-1 flex-col gap-1.5 overflow-hidden px-3.5 pt-3">
            <p className="text-center text-[0.72rem] text-[#8a8d88]">
              <span className="font-semibold">Today</span> 12:48 PM
            </p>
            {p >= 1 && (
              <div className="animate-bubble-in mt-1 self-end overflow-hidden rounded-[18px] rounded-br-[6px] ring-1 ring-black/5">
                <Receipt />
              </div>
            )}
            {p >= 3 && <p className={`animate-bubble-in ${me}`}>{NOTE}</p>}
            {p >= 3 && <p className="animate-bubble-in self-end pr-1 text-[0.68rem] text-[#8a8d88]">Delivered</p>}

            {p === 4 && (
              <div className="flex items-end gap-1.5">
                <Avatar />
                <div className="animate-bubble-in flex gap-1 rounded-[20px] rounded-bl-[6px] bg-[#e9e9eb] px-3.5 py-3" aria-hidden>
                  <span className="typing-dot h-2 w-2 rounded-full bg-[#8a8d88]" />
                  <span className="typing-dot h-2 w-2 rounded-full bg-[#8a8d88]" />
                  <span className="typing-dot h-2 w-2 rounded-full bg-[#8a8d88]" />
                </div>
              </div>
            )}
            {p >= 5 && (
              <div className="flex items-end gap-1.5">
                <span className="w-7 shrink-0">{p === 5 && <Avatar />}</span>
                <p className={`animate-bubble-in ${them}`}>Logged $92.40 at Sweetgreen as a client meal. That typically falls under IRC §274(d).</p>
              </div>
            )}
            {p >= 6 && (
              <div className="flex items-end gap-1.5">
                <Avatar />
                <p className={`animate-bubble-in ${them} flex items-center gap-1.5 font-semibold text-[#0f7a47]`}>
                  <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" aria-hidden><circle cx="8" cy="8" r="7" fill="#0f7a47" /><path d="m4.8 8.2 2.1 2.1 4.3-4.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Documentation complete
                </p>
              </div>
            )}
          </div>

          {/* Compose bar: the note is typed here, then sent */}
          <div className="flex items-end gap-2 px-3 pb-2 pt-2">
            <span aria-hidden className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e9e9eb]">
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="#6f726d" strokeWidth="1.8" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
            </span>
            <div className="flex min-h-9 flex-1 items-center gap-1 rounded-full py-1.5 pl-3.5 pr-1 ring-1 ring-black/[0.12]">
              <span className={`flex-1 truncate text-[0.93rem] ${composing ? 'text-[#101210]' : 'text-[#a6a8a4]'}`}>
                {composing ? NOTE.slice(0, typed) : 'iMessage'}
                {composing && <span aria-hidden className="caret-blink ml-[1px] inline-block h-[1.05em] w-[2px] translate-y-[2px] rounded-full bg-[#0b84ff]" />}
              </span>
              {composing && typed > 0 ? (
                <span aria-hidden className="animate-bubble-in flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0b84ff]">
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" /></svg>
                </span>
              ) : (
                <svg aria-hidden viewBox="0 0 16 16" className="mr-2 h-4 w-4 shrink-0" fill="none" stroke="#a6a8a4" strokeWidth="1.6" strokeLinecap="round"><rect x="5.5" y="1.5" width="5" height="8.5" rx="2.5" /><path d="M3 7.5a5 5 0 0 0 10 0M8 12.5V15" /></svg>
              )}
            </div>
          </div>
          <span aria-hidden className="mx-auto mb-2 mt-1 h-[5px] w-[8rem] rounded-full bg-[#101210]" />
        </div>
      </div>
    </motion.div>
  );
}
