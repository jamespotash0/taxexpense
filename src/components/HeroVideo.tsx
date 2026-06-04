'use client';

// Landing hero centerpiece — ONE clean, cinematic auto-loop (design direction: credible-first).
// A short "day in the life" montage — coffee, gas, the client lunch, then the calm payoff —
// plays silently and loops forever. No play/pause, no scrubber, no SMS thread or IRC captions
// over it: the footage carries the mood. The substantiation/tax-code detail it used to overlay
// now lives further down the page (How it works, Why Tally, FAQ), where there's room to earn it.
//
// We can't stitch the clips into a single file here, so they're sequenced in JS with a soft
// crossfade (advance on `ended`, preload the next so the seam stays smooth). Real clips live in
// /public/hero/story/*.mp4; until/if one 404s, a warm Ken-Burns gradient shows through so the
// frame never looks broken. Reduced-motion users get that gradient as a static still.

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';

// The montage arc: everyday spend → everyday spend → the client lunch → walk into tax time calm.
const CLIPS = [
  '/hero/story/montage_coffee.mp4',
  '/hero/story/montage_gas.mp4',
  '/hero/story/montage_lunch.mp4',
  '/hero/story/payoff.mp4',
];

// Warm filmic stand-in (and reduced-motion still) — matches the hero glow / cinematic system.
const FALLBACK_BG = 'linear-gradient(135deg, #2a1c12 0%, #7c4a2d 48%, #c98a4b 100%)';

function Frame({ children }: { children?: React.ReactNode }) {
  return (
    <div data-testid="hero-video" className="mx-auto w-full max-w-[540px]">
      <div className="lift relative aspect-[3/2] overflow-hidden rounded-[28px] bg-gray-950 shadow-2xl shadow-gray-900/40 ring-1 ring-white/10">
        {/* Warm filmic backdrop — shows through until a clip paints, and if any clip 404s. */}
        <div aria-hidden className="ken-burns absolute inset-0" style={{ background: FALLBACK_BG }} />
        {children}
        {/* Soft cinematic vignette for depth (no copy lives over the footage anymore). */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/5" />
      </div>
    </div>
  );
}

export function HeroVideo() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Play the now-active clip from the top, and warm up the next one so the crossfade is seamless.
  useEffect(() => {
    if (reduced) return;
    const current = videoRefs.current[active];
    if (current) {
      current.currentTime = 0;
      current.play().catch(() => {});
    }
    const next = videoRefs.current[(active + 1) % CLIPS.length];
    if (next && next.preload !== 'auto') {
      next.preload = 'auto';
      next.load();
    }
  }, [active, reduced]);

  if (reduced) {
    return <Frame />;
  }

  return (
    <Frame>
      {CLIPS.map((src, i) => (
        <video
          key={src}
          ref={(el) => {
            videoRefs.current[i] = el;
          }}
          className={`scene-fade absolute inset-0 h-full w-full object-cover ${i === active ? 'opacity-100' : 'opacity-0'}`}
          src={src}
          muted
          playsInline
          preload={i === 0 ? 'auto' : 'none'}
          autoPlay={i === 0}
          onEnded={() => setActive((a) => (a + 1) % CLIPS.length)}
          // If a clip 404s, hide the <video> so the warm gradient shows through instead.
          onError={(e) => {
            (e.currentTarget as HTMLVideoElement).style.display = 'none';
          }}
          aria-hidden={i !== active}
        />
      ))}
    </Frame>
  );
}
