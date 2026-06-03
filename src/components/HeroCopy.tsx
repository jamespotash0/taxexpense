'use client';

// Hero headline + subtitle, A/B tested (experiment: hero-copy).
//  A = original "what / why" contrast.
//  B = conversational / first-person: Tally speaks ("Hey, I'm Tally. Text me the why.").
// Variant is decided server-side (cookie via middleware); this just renders it and
// fires the exposure event so conversions can be attributed to the variant shown.
import { useEffect } from 'react';
import { track } from '@/lib/analytics';
import type { HeroVariant } from '@/lib/ab';

type CopyA = {
  line1pre: string;
  line1em: string;
  line1post: string;
  line2pre: string;
  line2em: string;
  line2post: string;
  subtitle: string;
};
type CopyB = { line1pre: string; line1em: string; line1post: string; line2: string; subtitle: string };

const squiggle = (
  <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden>
    <path className="squiggle-draw" pathLength={100} d="M1 6 Q 25 1 50 5 T 99 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export function HeroCopy({ variant, a, b }: { variant: HeroVariant; a: CopyA; b: CopyB }) {
  useEffect(() => {
    track('hero_exposure', { experiment: 'hero-copy', variant });
  }, [variant]);

  // Mobile starts at text-4xl (36px) — text-5xl (48px) overflowed 390px-wide phones,
  // especially long variant-B words ("deductions"). Scales up from sm: onward.
  const headingClass = 'reveal text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl';
  // Scales down on phones (text-base) and widens its container on large screens — at the
  // capped max-w-xl the long subtitle wrapped to 3 lines past ~1125px; lg:max-w-3xl keeps it to 2.
  const subClass = 'reveal-2 mx-auto mt-5 max-w-xl text-balance text-base text-gray-600 sm:mt-6 sm:text-lg lg:mx-0 lg:max-w-xl';

  if (variant === 'B') {
    return (
      <>
        <h1 className={headingClass}>
          <span className="block">
            {b.line1pre}
            <span className="relative whitespace-nowrap text-accent">
              {b.line1em}
              {squiggle}
            </span>
            {b.line1post}
          </span>
          <span className="block">{b.line2}</span>
        </h1>
        <p className={subClass}>{b.subtitle}</p>
      </>
    );
  }

  return (
    <>
      <h1 className={headingClass}>
        <span className="block">
          {a.line1pre}
          <span className="text-gray-400">{a.line1em}</span>
          {a.line1post}
        </span>
        <span className="block">
          {a.line2pre}
          <span className="relative whitespace-nowrap text-accent">
            {a.line2em}
            {squiggle}
          </span>
          {a.line2post}
        </span>
      </h1>
      <p className={subClass}>{a.subtitle}</p>
    </>
  );
}
