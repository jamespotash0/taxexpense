import type { Metadata } from 'next';
import './globals.css';

// TSNAP-034 (David): system font stack — no custom web fonts in V1.
export const metadata: Metadata = {
  title: 'Tally — capture the why',
  description: 'Text your business expenses. Tally captures the why, the IRS way.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
