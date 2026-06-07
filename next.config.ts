import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. A stray lockfile at ~/package-lock.json
  // made Next/Turbopack infer the wrong root; this silences that and keeps resolution
  // anchored here.
  turbopack: {
    root: import.meta.dirname,
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
