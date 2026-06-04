'use client';

// Floating nav pill that condenses on scroll (DEC-027): at the top it's roomy; once you
// scroll it shrinks tightly (narrower, smaller logo + padding, stronger shadow) and stays stuck.
// Slides down on first paint via Framer Motion (reduced-motion honored by MotionProvider).
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function SiteHeader({
  login,
  getStarted,
}: {
  login: string;
  getStarted: string;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-30 px-4 pt-4"
    >
      {/* Only the width (max-w) + shadow change on scroll — the pill keeps its height. */}
      <nav
        className={`mx-auto flex items-center justify-between gap-4 rounded-full border border-gray-200/70 bg-white/80 py-2 pl-5 pr-2 backdrop-blur-md transition-all duration-300 ${
          scrolled ? 'max-w-sm shadow-md shadow-gray-900/10' : 'max-w-md shadow-lg shadow-gray-900/5'
        }`}
      >
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/brand/tally-logo.svg"
            alt="Tally logo"
            width={28}
            height={28}
            className="rounded-md"
            priority
          />
          <span className="text-lg font-semibold tracking-tight">Tally</span>
        </Link>
        <div className="flex items-center gap-1.5 text-sm sm:gap-2">
          <Link href="/login" className="rounded-full px-4 py-2 text-gray-600 hover:text-gray-900">{login}</Link>
          <Link
            href="/start"
            className="rounded-full bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary-hover"
          >
            {getStarted}
          </Link>
        </div>
      </nav>
    </motion.header>
  );
}
