// App chrome for every logged-in and reference surface. Applies the app world (.app tokens in
// globals.css + Geist) without touching the landing page. Desktop: top bar with nav.
// Phone: slim top bar + bottom tab bar, like the consumer-fintech apps users already know.
import Link from 'next/link';
import { Geist } from 'next/font/google';
import { Icon, TallyMark, type IconName } from '@/components/AppIcons';

const geist = Geist({ subsets: ['latin'], variable: '--font-app', display: 'swap' });

type Tab = 'home' | 'cleanup' | 'settings' | 'agency';

interface NavCopy {
  home: string;
  cleanup: string;
  settings: string;
  agency: string;
  logout: string;
}

export function AppShell({
  children,
  nav,
  active,
  showAgency = false,
  wordmarkHref = '/dashboard',
  width = 'max-w-3xl',
}: {
  children: React.ReactNode;
  /** Omit for public/reference pages (login, IRC, legal): wordmark only, no tabs. */
  nav?: NavCopy;
  active?: Tab;
  showAgency?: boolean;
  wordmarkHref?: string;
  width?: string;
}) {
  const tabs: { key: Tab; href: string; icon: IconName; label: string }[] = nav
    ? [
        { key: 'home', href: '/dashboard', icon: 'home', label: nav.home },
        { key: 'cleanup', href: '/dashboard/cleanup', icon: 'sparkle', label: nav.cleanup },
        ...(showAgency ? [{ key: 'agency' as Tab, href: '/agency', icon: 'building' as IconName, label: nav.agency }] : []),
        { key: 'settings', href: '/settings', icon: 'gear', label: nav.settings },
      ]
    : [];

  return (
    <div className={`app ${geist.variable} flex min-h-screen flex-1 flex-col`}>
      <header className="sticky top-0 z-30 border-b border-border/70 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <div className="flex items-center gap-8">
            <Link href={wordmarkHref} className="flex items-center gap-2 rounded-xl text-[1.0625rem] font-bold tracking-tight">
              <TallyMark size={28} />
              Tally
            </Link>
            {nav && (
              <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
                {tabs.map((t) => (
                  <Link
                    key={t.key}
                    href={t.href}
                    aria-current={active === t.key ? 'page' : undefined}
                    className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                      active === t.key ? 'bg-fill text-foreground' : 'text-muted hover:text-foreground'
                    }`}
                  >
                    {t.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
          {nav && (
            <form action="/api/auth/logout" method="post" className="flex">
              <button type="submit" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-muted transition-colors hover:text-foreground">
                <Icon name="logout" size={18} />
                <span className="hidden sm:inline">{nav.logout}</span>
                <span className="sr-only sm:hidden">{nav.logout}</span>
              </button>
            </form>
          )}
        </div>
      </header>

      <main className={`mx-auto w-full ${width} flex-1 px-4 pb-28 pt-5 sm:px-6 sm:pb-16 sm:pt-8`}>{children}</main>

      {nav && (
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
        >
          <div className="mx-auto flex max-w-md justify-around">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={t.href}
                aria-current={active === t.key ? 'page' : undefined}
                className={`flex min-w-16 flex-col items-center gap-1 px-3 pb-2 pt-2.5 text-[0.6875rem] font-semibold ${
                  active === t.key ? 'text-primary' : 'text-muted'
                }`}
              >
                <Icon name={t.icon} size={22} />
                {t.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
