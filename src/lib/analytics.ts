// Minimal analytics shim. Forwards events to whatever's wired up at runtime
// (GTM dataLayer, PostHog, gtag) and logs in dev. No-op on the server. This lets
// us A/B test now and swap in a real analytics tool later without touching call sites.
type Props = Record<string, string | number | boolean>;

export function track(event: string, props: Props = {}): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as {
    dataLayer?: unknown[];
    posthog?: { capture?: (e: string, p?: Props) => void };
    gtag?: (...args: unknown[]) => void;
  };
  (w.dataLayer ||= []).push({ event, ...props });
  w.posthog?.capture?.(event, props);
  w.gtag?.('event', event, props);
  if (process.env.NODE_ENV !== 'production') console.debug('[track]', event, props);
}
