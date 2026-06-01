// Centralized environment access with fail-fast on missing server secrets.
// Jordan (security): secrets live only in env vars; never log their values.
// Server-only secrets are read lazily via requireEnv() so a missing var fails at
// the call site with a clear message rather than silently producing `undefined`.

/** Read a required server-side env var. Throws if missing/empty. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Add it to .env.local (and Vercel project settings). See .env.example.`,
    );
  }
  return value;
}

/** Read an optional env var, returning undefined if unset. */
export function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

// Public (NEXT_PUBLIC_*) vars are inlined at build time and safe in the client bundle.
export const PUBLIC_ENV = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? '',
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? '',
};
