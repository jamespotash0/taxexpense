'use client';

// Landing hero: a clean AI-chat panel with Penny (no phone frame). The receipt photo goes first,
// then the note is typed letter by letter in the message box and sent; Penny thinks, logs it with
// its IRC section, and marks it complete. $92.40 meal + photo + context means nothing else is required, so Penny
// asks nothing (the substantiation tree, quietly).
//
// First paint is the finished thread (no JS / reduced motion keep it). It replays once on load.
import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
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

const me = 'self-end max-w-[80%] rounded-[18px] bg-[#f0f0ee] px-4 py-2.5 text-[0.95rem] leading-[1.4] text-[#101210]';

// `className` sets the panel height (the conversation is bottom-anchored, so a shorter panel trims
// the top and keeps Penny's reply in view).
export function HeroThread({ className = 'h-[27rem]' }: { className?: string }) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(FINAL);
  const [typed, setTyped] = useState(0);
  const p = reduced ? FINAL : phase;

  useEffect(() => {
    if (reduced) return;
    let alive = true;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      // Plays once shortly after load, then stays on the finished thread (no loop back to empty).
      await wait(500);
      {
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
      }
    })();
    return () => {
      alive = false;
    };
  }, [reduced]);

  const composing = p === 2;

  return (
    <div
      role="img"
      aria-label="Example conversation: a receipt photo and a note sent to Penny, Tally's assistant, which logs it as a client meal under IRC section 274(d) with documentation complete."
      className={`mx-auto flex ${className} w-full max-w-[32rem] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_1px_2px_rgba(16,18,16,0.06),0_24px_60px_-30px_rgba(16,18,16,0.25)] ring-1 ring-black/[0.06]`}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-black/[0.06] px-5 py-3.5">
        <Avatar size={28} />
        <span className="text-[0.95rem] font-medium text-[#101210]">Penny</span>
        <span className="text-[0.85rem] text-[#8a8d88]">Tally assistant</span>
      </div>

      {/* Conversation */}
      <div className="flex flex-1 flex-col justify-end gap-3 overflow-hidden px-5 pb-2 [mask-image:linear-gradient(to_bottom,transparent,black_3rem)]">
        {p >= 1 && (
          <div className="animate-bubble-in self-end overflow-hidden rounded-[14px] ring-1 ring-black/[0.08]">
            <Receipt />
          </div>
        )}
        {p >= 3 && <p className={`animate-bubble-in ${me}`}>{NOTE}</p>}

        {p === 4 && (
          <div className="flex items-center gap-2.5" aria-hidden>
            <Avatar size={24} />
            <span className="flex gap-1">
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#8a8d88]" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#8a8d88]" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#8a8d88]" />
            </span>
          </div>
        )}
        {p >= 5 && (
          <div className="animate-bubble-in flex gap-2.5">
            <Avatar size={24} />
            <div className="pt-0.5 text-[0.95rem] leading-[1.5] text-[#101210]">
              <p>Logged $92.40 at Sweetgreen as a client meal. That typically falls under IRC §274(d).</p>
              {p >= 6 && (
                <p className="animate-bubble-in mt-2 flex items-center gap-1.5 text-[0.9rem] font-medium text-[#0f7a47]">
                  <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" aria-hidden><circle cx="8" cy="8" r="7" fill="#0f7a47" /><path d="m4.8 8.2 2.1 2.1 4.3-4.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Documentation complete
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Message box: the note is typed here, then sent */}
      <div className="p-3">
        <div className="flex items-center gap-2 rounded-[16px] bg-[#f6f6f4] py-2 pl-4 pr-2 ring-1 ring-black/[0.06]">
          <span className={`flex-1 truncate text-[0.95rem] ${composing ? 'text-[#101210]' : 'text-[#a6a8a4]'}`}>
            {composing ? NOTE.slice(0, typed) : 'Message Penny'}
            {composing && <span aria-hidden className="caret-blink ml-[1px] inline-block h-[1.05em] w-[2px] translate-y-[2px] rounded-full bg-[#101210]" />}
          </span>
          <span aria-hidden className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${composing && typed > 0 ? 'bg-[#d92d20]' : 'bg-[#e4e4e2]'}`}>
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" /></svg>
          </span>
        </div>
      </div>
    </div>
  );
}
