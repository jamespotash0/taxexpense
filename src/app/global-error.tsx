'use client';

// Catches errors thrown in the root layout that Next.js can't otherwise render,
// reports them to Sentry, and shows a minimal fallback. Must render its own
// <html>/<body> because it replaces the root layout when it fires.
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
        <h2>Something went wrong</h2>
        <p>We&apos;ve been notified and are looking into it.</p>
      </body>
    </html>
  );
}
