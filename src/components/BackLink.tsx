'use client';
// "Back" that returns to where the visitor came from (same page, same scroll spot), e.g. the
// consent text on /start. Only when there's nothing of ours to go back to (opened directly, or
// arrived from another site) does it fall through to its href.
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function BackLink({ href = '/', label = 'Back' }: { href?: string; label?: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(e) => {
        // Navigation API lists only same-origin history entries, so index > 0 means one of our pages
        // is behind this one, even after client-side navigations (which never update
        // document.referrer). Browsers without it fall back to the referrer of the last full load.
        const nav = (window as { navigation?: { currentEntry?: { index: number } | null } }).navigation;
        const cameFromUs = nav?.currentEntry
          ? nav.currentEntry.index > 0
          : document.referrer.startsWith(window.location.origin) && window.history.length > 1;
        if (cameFromUs) {
          e.preventDefault();
          router.back();
        }
      }}
      className="group inline-flex items-center gap-1.5 text-[0.95rem] text-[#6f726d] transition-colors hover:text-[#101210]"
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" fill="none" aria-hidden>
        <path d="M12.5 8H3m0 0 4-4M3 8l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </Link>
  );
}
