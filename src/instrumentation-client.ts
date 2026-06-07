// Sentry — browser init. Next.js loads this automatically on the client.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance tracing sample rate (browser).
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,

  enableLogs: true,
  debug: false,
});

// Surfaces slow client-side navigations as Sentry transactions.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
