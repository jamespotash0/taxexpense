// One-line announcement above the nav. A soft light sweeps across it now and then (CSS only; off
// for reduced motion). Not sticky: it scrolls away and the nav pill takes the top.
import Link from 'next/link';

export function Announcement({ text, short, href }: { text: string; short: string; href: string }) {
  return (
    <div className="flex justify-center px-3 pt-3">
      <Link
        href={href}
        className="announce-shine group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-[#101210] px-3.5 py-1.5 text-[0.84rem] font-medium text-white transition-shadow hover:shadow-[0_8px_22px_-8px_rgba(16,18,16,0.45)]"
      >
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#ff5a4d]" />
        <span className="hidden sm:inline">{text}</span>
        <span className="sm:hidden">{short}</span>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" aria-hidden>
          <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </div>
  );
}
