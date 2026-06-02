'use client';

// Animated SMS thread in an iPhone frame (hero visual). Plays a real conversation —
// user texts an expense, Tally "types", then replies — and loops. Honors
// prefers-reduced-motion by showing the full thread statically (Sofia / a11y).

import { useEffect, useRef, useState } from 'react';

type Msg = { from: 'user'; text: string } | { from: 'tally'; text: React.ReactNode };

const SCRIPT: Msg[] = [
  { from: 'user', text: '📷  $340 dinner w/ John from Acme re Q3' },
  {
    from: 'tally',
    text: (
      <>
        Got it — $340 client dinner with John (Acme). Over $75, so snap the receipt when you can and
        I&apos;ll attach it.
        <br />
        <br />
        IRC §274 → <span className="font-semibold">$170 deductible</span>.
      </>
    ),
  },
  { from: 'user', text: '$48 lunch with Sarah re partnership' },
  {
    from: 'tally',
    text: (
      <>
        ✓ Documentation complete. Under $75 — your text is the record.{' '}
        <span className="font-semibold">$24 deductible</span>.
      </>
    ),
  },
];

function Bubble({ from, children }: { from: Msg['from']; children: React.ReactNode }) {
  // Always animate; the prefers-reduced-motion CSS media query neutralizes it.
  const base = 'max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug animate-bubble-in';
  return from === 'user' ? (
    <div className="flex justify-end">
      <div className={`${base} rounded-br-md bg-primary text-white`}>{children}</div>
    </div>
  ) : (
    <div className="flex justify-start">
      <div className={`${base} rounded-bl-md border border-gray-200 bg-white text-gray-800`}>{children}</div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex gap-1 rounded-2xl rounded-bl-md border border-gray-200 bg-white px-4 py-3">
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-gray-400" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-gray-400" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-gray-400" />
      </div>
    </div>
  );
}

export function AnimatedPhone() {
  const [count, setCount] = useState(0); // messages revealed
  const [typing, setTyping] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Reduced-motion: reveal the full thread once, no looping/typing animation.
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
    <div className="mx-auto w-[300px] max-w-full">
      <div className="overflow-hidden rounded-[2.75rem] border-[10px] border-gray-900 bg-gray-900 shadow-2xl">
        <div className="mx-auto h-6 w-32 rounded-b-2xl bg-gray-900" />
        <div className="flex min-h-[440px] flex-col gap-2.5 bg-gray-50 px-3 pb-6 pt-2">
          <p className="py-1 text-center text-[11px] text-gray-400">Tally · now</p>
          {SCRIPT.slice(0, count).map((m, i) => (
            <Bubble key={i} from={m.from}>
              {m.text}
            </Bubble>
          ))}
          {typing && <TypingIndicator />}
        </div>
      </div>
    </div>
  );
}
