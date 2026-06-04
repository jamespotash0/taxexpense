'use client';

// Lazy cinematic background video for the section tiles (TaxSeason). Loads and plays ONLY once
// scrolled into view, and pauses when it leaves — so a couple of multi-MB clips below the fold
// never weigh down first paint. Muted, looping, no controls. A warm Ken-Burns gradient sits
// behind it (and is all reduced-motion users see, or if the clip 404s); the scene-scrim on top
// keeps overlaid white copy legible over bright footage.
import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';

export function ScrollVideo({
  src,
  gradient,
  kb,
  videoClassName,
}: {
  src: string;
  gradient: string;
  kb?: { x: string; y: string };
  /** Extra classes on the <video> (e.g. a grayscale/desaturate filter for the "without" tile). */
  videoClassName?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.preload = 'auto';
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div
        aria-hidden
        className="ken-burns absolute inset-0"
        style={{ background: gradient, ...(kb ? { ['--kb-x' as string]: kb.x, ['--kb-y' as string]: kb.y } : {}) }}
      />
      {!reduced && (
        <video
          ref={ref}
          className={`absolute inset-0 h-full w-full object-cover ${videoClassName ?? ''}`}
          src={src}
          muted
          loop
          playsInline
          preload="none"
          onError={(e) => {
            (e.currentTarget as HTMLVideoElement).style.display = 'none';
          }}
          aria-hidden
        />
      )}
      <div aria-hidden className="scene-scrim absolute inset-0" />
    </>
  );
}
