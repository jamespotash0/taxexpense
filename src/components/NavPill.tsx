'use client';

// The nav's pill. At the top of the page it sits wide and quiet; once you scroll it pulls in to a
// tighter, more solid pill with a deeper shadow, so it reads as floating above the content.
import { useEffect, useState } from 'react';

export function NavPill({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <nav
      data-scrolled={scrolled || undefined}
      className="mx-auto flex h-[3.4rem] max-w-[62rem] items-center justify-between gap-4 rounded-full bg-white/75 pl-5 pr-1.5 ring-1 ring-black/[0.06] backdrop-blur-xl backdrop-saturate-150 transition-[max-width,background-color,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] data-scrolled:max-w-[52rem] data-scrolled:bg-white/90 data-scrolled:shadow-[0_2px_6px_rgba(16,18,16,0.05),0_18px_40px_-16px_rgba(16,18,16,0.22)] motion-reduce:transition-none"
    >
      {children}
    </nav>
  );
}
