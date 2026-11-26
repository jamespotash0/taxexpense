import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. A stray lockfile at ~/package-lock.json
  // made Next/Turbopack infer the wrong root; this silences that and keeps resolution
  // anchored here.
  turbopack: {
    root: import.meta.dirname,
  },
  poweredByHeader: false,
  // Baseline security headers on every response. No full CSP yet (Sentry, Speed Insights and the
  // inline JSON-LD need allowances); frame-ancestors alone blocks clickjacking of /settings etc.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Source-map upload target. Auth comes from SENTRY_AUTH_TOKEN (env, not committed).
  org: "qwohter",
  project: "tallyai",

  // Quiet the build logs unless something goes wrong.
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces (slightly slower build).
  widenClientFileUpload: true,

  // Route browser→Sentry requests through this app to dodge ad-blockers.
  tunnelRoute: "/monitoring",
});
