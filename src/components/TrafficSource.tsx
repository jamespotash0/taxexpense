'use client';

// Fires once per session to record where this visit came from — a utm_source/ref param or an
// external referrer (e.g. a Product Hunt launch link) — to /api/traffic for aggregate channel
// analytics (DEC-084). No PII; renders nothing. Skips direct/no-attribution visits entirely, and
// guards against React StrictMode's double-effect via a sessionStorage flag set before sending.
import { useEffect } from 'react';

const SESSION_KEY = 'tally_traffic_recorded';

export function TrafficSource({ locale }: { locale?: string }) {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return; // already recorded this session

      const params = new URLSearchParams(window.location.search);
      const source = params.get('utm_source') || params.get('ref') || params.get('via');

      const referrer = document.referrer || '';
      let externalRef = false;
      if (referrer) {
        try {
          externalRef = new URL(referrer).hostname !== window.location.hostname;
        } catch {
          /* unparseable referrer → ignore */
        }
      }
      if (!source && !externalRef) return; // direct / no attribution → nothing to record

      // Mark BEFORE sending so a re-render (incl. StrictMode's double-invoke) can't double-fire.
      sessionStorage.setItem(SESSION_KEY, '1');

      const payload = JSON.stringify({
        source,
        medium: params.get('utm_medium'),
        campaign: params.get('utm_campaign'),
        referrer: externalRef ? referrer : null, // server keeps the host only
        path: window.location.pathname,
        locale: locale ?? null,
      });

      // sendBeacon survives the navigation a CTA click triggers; fetch+keepalive is the fallback.
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/traffic', new Blob([payload], { type: 'application/json' }));
      } else {
        void fetch('/api/traffic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      /* analytics must never break the page */
    }
  }, [locale]);

  return null;
}
