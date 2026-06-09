import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PWARegister } from '@/components/PWARegister';
import { MotionProvider } from '@/components/MotionProvider';
import { SITE_URL } from '@/lib/site';

const TITLE = 'Tally · capture the why';
const DESCRIPTION = 'Text your business expenses. Tally captures the why, the IRS way.';

// TSNAP-034 (David): system font stack — no custom web fonts. PWA wiring per DEC-019.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Tally', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/brand/tally-logo.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Tally',
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#111827',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <MotionProvider>{children}</MotionProvider>
        <PWARegister />
      </body>
    </html>
  );
}
