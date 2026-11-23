'use client';

// Horizontal snap-scrolling row with prev/next buttons (touch and trackpads just swipe).
import { useRef } from 'react';

const EDGE = 'max(1.25rem, calc((100vw - 80rem) / 2))';

export function ScrollRow({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const by = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  const btn = 'flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#101210] ring-1 ring-black/[0.1] transition-colors hover:bg-[#f0f0ee]';

  return (
    <div>
      <div
        ref={ref}
        role="region"
        aria-label={label}
        tabIndex={0}
        // Side padding lines the first card up with the page content; scroll-padding keeps snapping there.
        style={{ paddingInline: EDGE, scrollPaddingInline: EDGE }}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <div className="mx-auto mt-6 flex max-w-[80rem] justify-end gap-2 px-5">
        <button type="button" onClick={() => by(-1)} aria-label="Previous" className={btn}>
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden><path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button type="button" onClick={() => by(1)} aria-label="Next" className={btn}>
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden><path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </div>
  );
}
