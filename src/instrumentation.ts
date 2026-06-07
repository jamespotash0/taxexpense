// Next.js instrumentation hook — runs once per server runtime at startup.
// Loads the right Sentry config for the active runtime, and forwards
// nested React Server Component errors to Sentry via onRequestError.
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
