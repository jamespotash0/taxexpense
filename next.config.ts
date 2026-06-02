import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. A stray lockfile at ~/package-lock.json
  // made Next/Turbopack infer the wrong root; this silences that and keeps resolution
  // anchored here.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
