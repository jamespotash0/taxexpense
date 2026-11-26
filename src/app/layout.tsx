import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { PWARegister } from '@/components/PWARegister';
import { MotionProvider } from '@/components/MotionProvider';
import { SITE_URL } from '@/lib/site';

const TITLE = 'Tally · capture the why';
const DESCRIPTION =
  'Your bank knows what you spent, not why. Text Tally your expenses and it records the business purpose the IRS asks for. Built for freelancers and the self-employed.';

// TSNAP-034 (David): system font stack — no custom web fonts. PWA wiring per DEC-019.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s · Tally' },
  description: DESCRIPTION,
  applicationName: 'Tally',
  category: 'finance',
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
  openGraph: {
    type: 'website',
    siteName: 'Tally',
    title: TITLE,
    description: DESCRIPTION,
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
        <SpeedInsights />
      </body>
    </html>
  );
}
