'use client';

// Landing hero centerpiece — ONE clean, cinematic auto-loop (design direction: credible-first).
// A short "day in the life" montage plays silently and loops forever: no play/pause, no scrubber.
// Over each moment of spending, a light capture overlay types in — the receipt is snapped and
// the person logs the *why* in a quick text, ending on a small "✓ Logged". That's the WHAT→WHY
// made visible. Deliberately light: NO IRC citations, NO "asks only when required" lines — that
// substantiation detail lives further down the page (How it works, Why Tally, FAQ).
//
// We can't stitch the clips into one file here, so they're sequenced in JS with a soft crossfade
// (advance on `ended`, preload the next so the seam stays smooth). The capture beats are driven
// off the active clip's own `currentTime`, so the overlay stays in lockstep with the footage.
// Clips live in /public/hero/story/*.mp4; a warm Ken-Burns gradient shows through until one paints
// (and if one 404s). Reduced-motion users get that gradient as a static still.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';

type Scene = {
  id: string;
  clip: string;
  /** The receipt that gets "snapped", plus the one-line why the person texts to log it. */
  receipt?: { merchant: string; total: string };
  why?: string;
};

// everyday spend → everyday spend → the client lunch → walk into tax time calm (no overlay).
const SCENES: Scene[] = [
  { id: 'coffee', clip: '/hero/story/montage_coffee.mp4', receipt: { merchant: 'BLUE BOTTLE', total: '$11.20' }, why: 'Coffee w/ a referral partner' },
  { id: 'gas', clip: '/hero/story/montage_gas.mp4', receipt: { merchant: 'SHELL', total: '$54.10' }, why: 'Drove to the Tahoe job site' },
  { id: 'lunch', clip: '/hero/story/montage_lunch.mp4', receipt: { merchant: 'SWEETGREEN', total: '$92.40' }, why: 'Client lunch, Sarah @ Acme' },
  { id: 'payoff', clip: '/hero/story/payoff.mp4' },
];

// Fractions of each clip at which the capture beats reveal (receipt → why text → logged).
const BEATS = { receipt: 0.1, why: 0.42, logged: 0.74 };

const FALLBACK_BG = 'linear-gradient(135deg, #2a1c12 0%, #7c4a2d 48%, #c98a4b 100%)';

function ReceiptThumb({ merchant, total }: { merchant: string; total: string }) {
  return (
    <div className="w-[124px] rounded-lg bg-white p-2 shadow-sm ring-1 ring-black/5">
      <div className="text-[9px] font-bold tracking-wide text-gray-700">{merchant}</div>
      <div className="text-[7px] text-gray-400">123 Market St</div>
      <div className="mt-1.5 space-y-1">
        <div className="h-1 w-full rounded-full bg-gray-200" />
        <div className="h-1 w-5/6 rounded-full bg-gray-200" />
        <div className="h-1 w-2/3 rounded-full bg-gray-200" />
      </div>
      <div className="mt-1.5 flex items-center justify-between border-t border-dashed border-gray-300 pt-1">
        <span className="text-[8px] font-medium text-gray-500">TOTAL</span>
        <span className="text-[11px] font-bold text-gray-900">{total}</span>
      </div>
    </div>
  );
}

function UserBubble({ children, receipt }: { children?: React.ReactNode; receipt?: boolean }) {
  return (
    <div className="flex justify-end">
      <div className={`max-w-[88%] animate-bubble-in rounded-[16px] rounded-br-[5px] bg-[#34C759] text-white ${receipt ? 'p-1' : 'px-2.5 py-1.5 text-[12px] leading-snug'}`}>
        {children}
      </div>
    </div>
  );
}

function Frame({ children }: { children?: React.ReactNode }) {
  return (
    <div data-testid="hero-video" className="mx-auto w-full max-w-[480px]">
      <div className="lift relative aspect-[4/5] overflow-hidden rounded-[28px] bg-gray-950 shadow-2xl shadow-gray-900/40 ring-1 ring-white/10">
        {/* Warm filmic backdrop — shows through until a clip paints, and if any clip 404s. */}
        <div aria-hidden className="ken-burns absolute inset-0" style={{ background: FALLBACK_BG }} />
        {children}
        {/* Soft cinematic vignette for depth. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/5" />
      </div>
    </div>
  );
}

export function HeroVideo() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0); // 0–1 within the active clip
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Play the now-active clip from the top and warm up the next one so the crossfade is
  // seamless. (Beats reset to 0 in onEnded, alongside the active-clip advance.)
  useEffect(() => {
    if (reduced) return;
    const current = videoRefs.current[active];
    if (current) {
      current.currentTime = 0;
      current.play().catch(() => {});
    }
    const next = videoRefs.current[(active + 1) % SCENES.length];
    if (next && next.preload !== 'auto') {
      next.preload = 'auto';
      next.load();
    }
  }, [active, reduced]);

  const scene = SCENES[active];
  const showReceipt = progress >= BEATS.receipt;
  const showWhy = progress >= BEATS.why;
  const showLogged = progress >= BEATS.logged;
  const hasOverlay = useMemo(() => Boolean(scene.receipt && scene.why), [scene]);

  if (reduced) {
    return <Frame />;
  }

  return (
    <Frame>
      {SCENES.map((s, i) => (
        <video
          key={s.id}
          ref={(el) => {
            videoRefs.current[i] = el;
          }}
          className={`scene-fade absolute inset-0 h-full w-full object-cover ${i === active ? 'opacity-100' : 'opacity-0'}`}
          src={s.clip}
          muted
          playsInline
          preload={i === 0 ? 'auto' : 'none'}
          autoPlay={i === 0}
          onTimeUpdate={(e) => {
            if (i !== active) return;
            const v = e.currentTarget;
            if (v.duration) setProgress(v.currentTime / v.duration);
          }}
          onEnded={() => {
            setProgress(0);
            setActive((a) => (a + 1) % SCENES.length);
          }}
          onError={(e) => {
            (e.currentTarget as HTMLVideoElement).style.display = 'none';
          }}
          aria-hidden={i !== active}
        />
      ))}

      {/* Capture overlay — the receipt snapped + the why texted in, ending on ✓ Logged. Only on
          the spend scenes; the payoff scene plays clean. */}
      {hasOverlay && (
        <div key={`cap-${scene.id}`} className="panel-rise absolute right-3 top-3 z-10 w-[220px] max-w-[78%]">
          <div className="rounded-2xl border border-white/15 bg-white/85 p-2 shadow-xl shadow-black/20 backdrop-blur-md">
            <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-white">T</span>
              <span className="text-[11px] font-semibold text-gray-900">Tally</span>
              <span className="ml-auto text-[9px] font-medium text-gray-400">just now</span>
            </div>
            <div className="flex flex-col gap-1">
              {showReceipt && (
                <UserBubble receipt>
                  <ReceiptThumb merchant={scene.receipt!.merchant} total={scene.receipt!.total} />
                </UserBubble>
              )}
              {showWhy && <UserBubble>{scene.why}</UserBubble>}
              {showLogged && (
                <div className="flex justify-start">
                  <div className="max-w-[88%] animate-bubble-in rounded-[16px] rounded-bl-[5px] bg-[#E9E9EB] px-2.5 py-1.5 text-[12px] font-medium leading-snug text-gray-900">
                    ✓ Logged
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Frame>
  );
}
