// Landing nav: a wide, floating white pill (sticky). Wordmark left; section links, an outlined
// Log in and the red Get started on the right. Links collapse to just the two buttons on phones.
import Link from 'next/link';

export function TallyWordmark() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Tally home">
      <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#101210]">
        <svg viewBox="0 0 100 100" className="h-[60%] w-[60%]" fill="none" stroke="#fff" strokeLinecap="round">
          <path d="M18 18h64M50 18v66" strokeWidth="12" />
          <path d="M34 44h32M34 61h32M34 78h32" strokeWidth="8" stroke="#ff6b60" />
        </svg>
      </span>
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
    <header className="sticky top-0 z-30 px-3 pt-2 sm:px-6">
      <nav className="mx-auto flex h-[3.25rem] max-w-[80rem] items-center justify-between gap-4 rounded-full bg-white/90 pl-5 pr-2 shadow-[0_1px_2px_rgba(16,18,16,0.04),0_6px_24px_-8px_rgba(16,18,16,0.12)] ring-1 ring-black/[0.06] backdrop-blur-md">
        <TallyWordmark />
        <div className="flex items-center gap-1 text-[0.9rem] font-medium text-[#101210]">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="hidden rounded-full px-3.5 py-2 hover:bg-black/[0.04] md:block">
              {l.label}
            </a>
          ))}
          <Link href="/login" className="ml-1 rounded-full px-4 py-[0.55rem] ring-1 ring-black/[0.12] hover:bg-black/[0.03]">
            {login}
          </Link>
          <Link href="/start" className="rounded-full bg-[#d92d20] px-4 py-[0.6rem] text-white transition-colors hover:bg-[#b8241a]">
            {getStarted}
          </Link>
        </div>
      </nav>
    </header>
  );
}
