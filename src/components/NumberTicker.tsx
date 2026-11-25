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
  decimals,
}: {
  value: number;
  from?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
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

  // Cents when asked for, or when counting from a dollar amount ($92.40 -> $0.00); whole numbers
  // otherwise. Thousands get separators ($2,184.60).
  const d = decimals ?? (Number.isInteger(from) ? 0 : 2);
  const shown = n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {shown}
      {suffix}
    </span>
  );
}
