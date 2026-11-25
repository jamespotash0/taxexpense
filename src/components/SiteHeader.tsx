// Landing nav: a flat sticky bar, same color as the page. Wordmark left; section links, Log in and
// Get started on the right. Links collapse to just the two buttons on phones.
import Link from 'next/link';

/** The mark: four tally strokes crossed by one red slash, the way you count to five. The red is
 *  the WHY accent. `light` draws it for dark backgrounds (Penny's avatar). */
export function TallyMark({ className = 'h-7 w-7', light = false }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden strokeLinecap="butt">
      <path d="M8 6v20M13.33 6v20M18.67 6v20M24 6v20" stroke={light ? '#fff' : '#101210'} strokeWidth="2.4" />
      <path d="M4 22.4 28 9.6" stroke="#d92d20" strokeWidth="2.4" />
    </svg>
  );
}

// `back`: on inner pages the wordmark is the way home, so a back arrow slides in on hover/focus
// (and is always shown on touch screens, which have no hover).
export function TallyWordmark({ back = false }: { back?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2" aria-label={back ? 'Back to Tally home' : 'Tally home'}>
      {back && (
        <span
          aria-hidden
          className="-mr-2 flex w-0 items-center overflow-hidden text-[#101210] opacity-0 transition-all duration-200 group-hover:mr-0 group-hover:w-5 group-hover:opacity-100 group-focus-visible:mr-0 group-focus-visible:w-5 group-focus-visible:opacity-100 pointer-coarse:mr-0 pointer-coarse:w-5 pointer-coarse:opacity-100"
        >
          <svg viewBox="0 0 16 16" className="h-5 w-5 shrink-0" fill="none"><path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      )}
      <TallyMark className="h-7 w-7" />
      <span className="text-[1.15rem] font-semibold tracking-[-0.03em] text-[#101210]">Tally</span>
    </Link>
  );
}

export function SiteHeader({
  login,
  getStarted,
  links,
}: {
  login: string;
  getStarted: string;
  links: { href: string; label: string }[];
}) {
  return (
    <header className="sticky top-0 z-30 bg-[#fafafa]/95 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-[80rem] items-center justify-between gap-4 px-5 sm:px-6">
        <TallyWordmark />
        <div className="flex items-center gap-1 text-[0.9rem] font-medium text-[#101210]">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="hidden rounded-full px-3.5 py-2 transition-colors hover:bg-black/[0.05] md:block">
              {l.label}
            </a>
          ))}
          <Link href="/login" className="ml-1 rounded-full px-4 py-[0.55rem] transition-colors hover:bg-black/[0.05]">
            {login}
          </Link>
          <Link href="/start" className="rounded-full bg-[#101210] px-4 py-[0.6rem] text-white transition-colors hover:bg-[#d92d20]">
            {getStarted}
          </Link>
        </div>
      </nav>
    </header>
  );
}
