'use client';

// Animated SMS thread in a realistic iPhone frame (hero visual). Plays an authentic Tally
// conversation — user texts an expense, Tally "types", then replies — and loops. The copy
// mirrors the real product voice (see docs/SYSTEM-PROMPTS.md). Because Tally is a Twilio SMS
// number, outgoing bubbles are SMS-green (not iMessage-blue) — realistic and on-message
// ("it's just texting"). Honors prefers-reduced-motion by showing the full thread statically.

import { useEffect, useRef, useState } from 'react';

type Msg = { from: 'user' | 'tally'; text: React.ReactNode; photo?: boolean };

// Faux receipt "photo" — reads as a snapped receipt without shipping an image asset.
function ReceiptThumb() {
  return (
    <div className="w-[150px] rounded-lg bg-white p-2.5 shadow-sm ring-1 ring-black/5">
      <div className="text-[10px] font-bold tracking-wide text-gray-700">SWEETGREEN</div>
      <div className="text-[8px] text-gray-400">123 Market St</div>
      <div className="mt-2 space-y-1">
        <div className="h-1 w-full rounded-full bg-gray-200" />
        <div className="h-1 w-5/6 rounded-full bg-gray-200" />
        <div className="h-1 w-2/3 rounded-full bg-gray-200" />
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-dashed border-gray-300 pt-1.5">
        <span className="text-[9px] font-medium text-gray-500">TOTAL</span>
        <span className="text-[12px] font-bold text-gray-900">$92.40</span>
      </div>
    </div>
  );
}

// Real product flow: snap a receipt → Tally reads + classifies → asks the why → confirms
// with IRC + deductible amount + "documentation complete" (meals are 50%, ≥$75 needs context).
// The confirm bubble carries a plain-English IRC summary card (the "why"), faithful to the
// seeded §274 short_summary — this is the product's differentiator, so the hero shows it.
const SCRIPT: Msg[] = [
  { from: 'user', photo: true, text: <ReceiptThumb /> },
  {
    from: 'tally',
    text: <>Got it — $92.40 at Sweetgreen. Business meal? Tell me who you were with and I&apos;ll log it.</>,
  },
  { from: 'user', text: 'Client lunch — Sarah @ Acme, Q3 planning' },
  {
    from: 'tally',
    text: (
      <>
        ✓ Documentation complete. Client meal →{' '}
        <span className="font-semibold">$46.20 deductible</span> (50%).
        <span className="mt-1.5 block rounded-lg bg-black/[0.06] px-2 py-1.5 text-[11px] leading-snug text-gray-600">
          <span className="font-semibold text-gray-800">IRC §274</span> · Business meals are 50%
          deductible when there&apos;s a clear business purpose and a business contact present.
        </span>
      </>
    ),
  },
];

function Bubble({ from, photo, children }: { from: Msg['from']; photo?: boolean; children: React.ReactNode }) {
  const base = `max-w-[80%] animate-bubble-in rounded-[18px] ${
    photo ? 'p-1' : 'px-3 py-2 text-[13px] leading-snug'
  }`;
  return from === 'user' ? (
    <div className="flex justify-end">
      <div className={`${base} rounded-br-[5px] bg-[#34C759] text-white`}>{children}</div>
    </div>
  ) : (
    <div className="flex justify-start">
      <div className={`${base} rounded-bl-[5px] bg-[#E9E9EB] text-gray-900`}>{children}</div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex gap-1 rounded-[18px] rounded-bl-[5px] bg-[#E9E9EB] px-3.5 py-3">
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-gray-500" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-gray-500" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-gray-500" />
      </div>
    </div>
  );
}

// --- iOS status-bar glyphs (kept tiny + inline so there's no icon dependency) ---
const Cellular = () => (
  <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor" aria-hidden>
    <rect x="0" y="7" width="3" height="4" rx="1" />
    <rect x="4.7" y="5" width="3" height="6" rx="1" />
    <rect x="9.3" y="2.5" width="3" height="8.5" rx="1" />
    <rect x="14" y="0" width="3" height="11" rx="1" />
  </svg>
);
const Wifi = () => (
  <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor" aria-hidden>
    <path d="M8 2.4c2.3 0 4.5.9 6.1 2.5l-1.5 1.5A6.5 6.5 0 0 0 8 4.5 6.5 6.5 0 0 0 3.4 6.4L1.9 4.9A8.6 8.6 0 0 1 8 2.4Z" />
    <path d="M8 6c1.2 0 2.4.5 3.2 1.4L8 10.6 4.8 7.4A4.5 4.5 0 0 1 8 6Z" />
  </svg>
);
const Battery = () => (
  <svg width="26" height="12" viewBox="0 0 26 12" fill="none" aria-hidden>
    <rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="currentColor" strokeOpacity="0.4" />
    <rect x="2" y="2" width="16" height="8" rx="1.5" fill="currentColor" />
    <path d="M23.5 4c1 .3 1 3.7 0 4V4Z" fill="currentColor" fillOpacity="0.4" />
  </svg>
);

export function AnimatedPhone() {
  const [count, setCount] = useState(0); // messages revealed
  const [typing, setTyping] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view inside the fixed-height screen (like real Messages) —
  // the thread scrolls up rather than the phone growing taller.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [count, typing]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const id = setTimeout(() => setCount(SCRIPT.length), 0);
      timers.current.push(id);
      return () => clearTimeout(id);
    }

    const run = () => {
      let t = 0;
      const at = (delay: number, fn: () => void) => {
        t += delay;
        timers.current.push(setTimeout(fn, t));
      };
      setCount(0);
      setTyping(false);
      SCRIPT.forEach((m, i) => {
        if (m.from === 'tally') {
          at(500, () => setTyping(true));
          at(1300, () => {
            setTyping(false);
            setCount(i + 1);
          });
        } else {
          at(i === 0 ? 500 : 1000, () => setCount(i + 1));
        }
      });
      at(3500, run); // pause, then loop
    };
    run();

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  return (
    <div data-testid="hero-phone" className="mx-auto w-[300px] max-w-full">
      {/* Titanium-ish frame */}
      <div className="relative rounded-[3rem] border-[11px] border-gray-950 bg-gray-950 shadow-2xl shadow-gray-900/30">
        <div className="relative overflow-hidden rounded-[2.2rem] bg-white">
          {/* Status bar */}
          <div className="relative z-10 flex items-center justify-between px-6 pb-1.5 pt-2.5 text-[11px] font-semibold text-gray-900">
            <span className="tracking-tight">9:41</span>
            <div className="flex items-center gap-1.5">
              <Cellular />
              <Wifi />
              <Battery />
            </div>
          </div>
          {/* Dynamic Island */}
          <div className="absolute left-1/2 top-[9px] z-20 h-[22px] w-[74px] -translate-x-1/2 rounded-full bg-black" />

          {/* Contact header */}
          <div className="relative flex flex-col items-center gap-1 border-b border-gray-200/80 bg-gray-50/90 px-4 pb-2 pt-1.5 backdrop-blur">
            <span className="absolute left-3 top-3 text-lg leading-none text-[#007AFF]" aria-hidden>
              ‹
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">T</div>
            <span className="flex items-center gap-0.5 text-[11px] font-medium text-gray-900">
              Tally
              <svg width="8" height="8" viewBox="0 0 8 8" className="text-gray-400" fill="currentColor" aria-hidden>
                <path d="M1 2.5 4 5.5 7 2.5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>

          {/* Thread */}
          <div ref={threadRef} className="flex h-[360px] flex-col gap-1.5 overflow-hidden px-3 pb-3 pt-3">
            <p className="pb-1 text-center text-[10px] text-gray-400">
              <span className="font-semibold text-gray-500">Text Message</span> · Today 9:41 AM
            </p>
            {SCRIPT.slice(0, count).map((m, i) => (
              <Bubble key={i} from={m.from} photo={m.photo}>
                {m.text}
              </Bubble>
            ))}
            {typing && <TypingIndicator />}
          </div>

          {/* Input bar */}
          <div className="flex items-center gap-2 border-t border-gray-200/80 bg-gray-50 px-3 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-300 text-base leading-none text-gray-400">
              +
            </div>
            <div className="flex flex-1 items-center justify-between rounded-full border border-gray-300 bg-white py-1 pl-3 pr-1 text-[12px] text-gray-400">
              Text Message
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[10px] text-gray-500" aria-hidden>
                ↑
              </span>
            </div>
          </div>

          {/* Home indicator */}
          <div className="flex justify-center pb-2 pt-1">
            <div className="h-1 w-28 rounded-full bg-gray-900/80" />
          </div>
        </div>
      </div>
    </div>
  );
}
