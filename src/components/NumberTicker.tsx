'use client';

// Counts from `from` to `value` once, when it scrolls into view. Tabular numerals so the width
// doesn't jitter. Reduced motion (or no JS) shows the final value straight away.
import { useEffect, useRef, useState } from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';

export function NumberTicker({
  value,
  from = 0,
  prefix = '',
  suffix = '',
}: {
  value: number;
  from?: number;
  prefix?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const reduced = useReducedMotion();
  const [n, setN] = useState(value);

  useEffect(() => {
    if (!inView || reduced || from === value) return;
    const c = animate(from, value, { duration: 1.6, ease: [0.16, 1, 0.3, 1], onUpdate: setN });
    return () => c.stop();
  }, [inView, reduced, from, value]);

  // A dollar amount with cents keeps its cents all the way ($92.40 -> $0.00); whole numbers otherwise.
  const shown = !Number.isInteger(from) ? n.toFixed(2) : String(Math.round(n));
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {shown}
      {suffix}
    </span>
  );
}
