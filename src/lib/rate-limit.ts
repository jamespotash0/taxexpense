// Best-effort in-memory sliding-window rate limiter. Per-process only — state resets on cold
// start and is NOT shared across serverless lanes, so treat it as a courtesy throttle, not a
// security guarantee. Flows that need a hard limit (OTP) use the DB-backed counter in lib/auth.
// `now` is injected (not read from Date.now here) so callers and tests stay deterministic.
export function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, number[]>();

  /** Records an attempt for `key` at `now`; returns true if the limit is already exceeded. */
  return function isRateLimited(key: string, now: number): boolean {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent); // keep the pruned list; don't record this (blocked) attempt
      return true;
    }
    recent.push(now);
    hits.set(key, recent);
    return false;
  };
}
