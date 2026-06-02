import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PWARegister } from '@/components/PWARegister';

// TSNAP-034 (David): system font stack — no custom web fonts. PWA wiring per DEC-019.
export const metadata: Metadata = {
  title: 'Tally — capture the why',
  description: 'Text your business expenses. Tally captures the why, the IRS way.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Tally', statusBarStyle: 'default' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
};

export const viewport: Viewport = {
  themeColor: '#111827',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
