// Sentry — server (Node.js runtime) init. Loaded by src/instrumentation.ts.
// Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of transactions for performance monitoring. Bump in dev if needed.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,

  // Structured logs → Sentry. See https://docs.sentry.io/product/explore/logs/
  enableLogs: true,

  // Set true locally to see what the SDK is doing.
  debug: false,
});
