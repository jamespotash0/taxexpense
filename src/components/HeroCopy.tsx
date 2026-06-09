'use client';

// Hero headline + subtitle. Champion copy is variant A (problem-framed "what / why"); B/C are
// dormant prototype arms (see lib/ab.ts + proxy.ts, DEC-079).
//
// Motion (framer-motion, already in the bundle — no three.js): the headline reveals word-by-word
// with a staggered blur-fade-rise (the "text reveal"); the accent word then runs a short
// letter-swap scramble and the squiggle draws itself underneath; the subtitle blur-fades in after.
// Each logical line is its own `text-balance` block (so a long sentence wraps as a balanced unit,
// not mid-phrase); the stagger is driven by a per-word delay computed from a running index, which
// lets words animate independently while staying inside their wrapping block.
// `prefers-reduced-motion` renders everything static. We still fire hero_exposure for attribution.
import { Fragment, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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

const headingClass = 'text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-[4rem]';
const subClass = 'mx-auto mt-5 max-w-xl text-balance text-base text-gray-600 sm:mt-6 sm:text-lg lg:mx-0 lg:max-w-xl';

const EASE = [0.16, 1, 0.3, 1] as const;
const STEP = 0.06; // seconds between successive words
const BASE = 0.12; // initial delay before the first word
const DUR = 0.6;

const SCRAMBLE_GLYPHS = 'abcdefghijklmnopqrstuvwxyz';

// Letter-swap: cycle each not-yet-settled character through random glyphs, settling left→right.
function Scramble({ text, run }: { text: string; run: boolean }) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (!run) return;
    const frames = 16;
    let frame = 0;
    const id = window.setInterval(() => {
      frame += 1;
      const settled = Math.floor((frame / frames) * text.length);
      setOut(
        text
          .split('')
          .map((ch, i) =>
            i < settled || ch === ' ' ? ch : SCRAMBLE_GLYPHS[Math.floor(Math.random() * SCRAMBLE_GLYPHS.length)],
          )
          .join(''),
      );
      if (frame >= frames) {
        window.clearInterval(id);
        setOut(text); // guarantee the real word on the final frame
      }
    }, 40);
    return () => window.clearInterval(id);
  }, [run, text]);
  return <>{out}</>;
}

// Self-drawing underline (pathLength 0→1). Pre-drawn (no animation) under reduced motion.
function Squiggle({ draw, reduced }: { draw: boolean; reduced: boolean }) {
  return (
    <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden>
      <motion.path
        d="M1 6 Q 25 1 50 5 T 99 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        initial={{ pathLength: reduced ? 1 : 0 }}
        animate={{ pathLength: draw ? 1 : 0 }}
        transition={{ duration: reduced ? 0 : 0.8, ease: EASE }}
      />
    </svg>
  );
}

type Token =
  | { kind: 'word'; text: string }
  | { kind: 'muted'; text: string; post: string }
  | { kind: 'accent'; text: string };

const words = (s: string): Token[] =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .map((text) => ({ kind: 'word', text }));

export function HeroCopy({ variant, a, b }: { variant: HeroVariant; a: CopyA; b: CopyB }) {
  const reduced = useReducedMotion() ?? false;
  // 0: revealing · 1: scramble the accent word · 2: draw the squiggle. Time-driven so it stays in
  // step with the staggered reveal without threading animation callbacks through split words.
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    track('hero_exposure', { experiment: 'hero-copy', variant });
  }, [variant]);

  useEffect(() => {
    if (reduced) return;
    const t1 = window.setTimeout(() => setPhase(1), 700); // accent word has revealed
    const t2 = window.setTimeout(() => setPhase(2), 1300); // scramble settled → draw underline
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [reduced]);

  const scrambleRun = !reduced && phase >= 1;
  const drawNow = reduced || phase >= 2;

  // Per-word reveal props. `idx` is the running word position across both lines, so the stagger
  // flows continuously even though words live in separate wrapping blocks.
  const reveal = (idx: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: '0.5em', filter: 'blur(10px)' },
          animate: { opacity: 1, y: '0em', filter: 'blur(0px)' },
          transition: { duration: DUR, delay: BASE + idx * STEP, ease: EASE },
        };

  // Render one logical line's tokens, advancing the shared word counter as we go.
  let counter = 0;
  const renderLine = (tokens: Token[], key: string) => (
    <span className="block text-balance" key={key}>
      {tokens.map((tok, i) => {
        const idx = counter++;
        const inner =
          tok.kind === 'muted' ? (
            <>
              <span className="text-gray-400">{tok.text}</span>
              {tok.post}
            </>
          ) : tok.kind === 'accent' ? (
            <span className="relative whitespace-nowrap text-accent">
              {scrambleRun ? <Scramble text={tok.text} run={scrambleRun} /> : tok.text}
              <Squiggle draw={drawNow} reduced={reduced} />
            </span>
          ) : (
            tok.text
          );
        return (
          <Fragment key={`${key}-${i}`}>
            <motion.span className="inline-block" {...reveal(idx)}>
              {inner}
            </motion.span>{' '}
          </Fragment>
        );
      })}
    </span>
  );

  const subtitle = (
    <motion.p
      className={subClass}
      initial={reduced ? false : { opacity: 0, y: '0.4em', filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: '0em', filter: 'blur(0px)' }}
      transition={{ duration: 0.7, delay: reduced ? 0 : 0.55, ease: EASE }}
    >
      {variant === 'B' ? b.subtitle : a.subtitle}
    </motion.p>
  );

  const line1: Token[] =
    variant === 'B'
      ? [...words(b.line1pre), { kind: 'accent', text: b.line1em }, ...(b.line1post ? [{ kind: 'word', text: b.line1post } as Token] : [])]
      : [...words(a.line1pre), { kind: 'muted', text: a.line1em, post: a.line1post }];
  const line2: Token[] =
    variant === 'B'
      ? words(b.line2)
      : [...words(a.line2pre), { kind: 'accent', text: a.line2em }, ...words(a.line2post)];

  return (
    <>
      <h1 className={headingClass}>
        {renderLine(line1, 'l1')}
        {renderLine(line2, 'l2')}
      </h1>
      {subtitle}
    </>
  );
}
