// Landing nav: a flat sticky bar, same color as the page. Wordmark left; Log in and Get started right.
import Link from 'next/link';

/** The mark: four tally strokes crossed by one red slash, the way you count to five. The red is
 *  the WHY accent. `light` draws it for dark backgrounds (Penny's avatar). */
export function TallyMark({ className = 'h-7 w-7', light = false, slash = '#d92d20' }: { className?: string; light?: boolean; slash?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden strokeLinecap="butt">
      <path d="M8 6v20M13.33 6v20M18.67 6v20M24 6v20" stroke={light ? '#fff' : '#101210'} strokeWidth="2.4" />
      <path d="M4 22.4 28 9.6" stroke={slash} strokeWidth="2.4" />
    </svg>
  );
}

// `back`: on inner pages the wordmark is the way home, so a back arrow slides in on hover/focus
// (and is always shown on touch screens, which have no hover).
// `onRed`: white strokes and wordmark with an ink slash, for the red closing band.
export function TallyWordmark({ back = false, onRed = false }: { back?: boolean; onRed?: boolean }) {
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
      <TallyMark className="h-7 w-7" light={onRed} slash={onRed ? '#101210' : undefined} />
      <span className={`text-[1.15rem] font-semibold tracking-[-0.03em] ${onRed ? 'text-white' : 'text-[#101210]'}`}>Tally</span>
    </Link>
  );
}

export function SiteHeader({ login, getStarted }: { login: string; getStarted: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-black/[0.05] bg-white/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-[80rem] items-center justify-between gap-4 px-5 sm:px-6">
        <TallyWordmark />
        <div className="flex items-center gap-1 text-[0.9rem] font-medium text-[#101210]">
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
