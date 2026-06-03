'use client';

// Primary "Text {number}" CTA for hero arms A/B (and the footer).
// Why a button, not a bare <a href="sms:…">: on desktop, sms: links are a no-op, so the old
// link was a dead-end that still logged a "click" — a hollow, misleading conversion (Priya).
// This copies the number to the clipboard so desktop visitors get a real next step, opens
// Messages on mobile, and fires ONE consistent `hero_cta_engaged` event so the conversion is
// comparable across arms (the copy test A/B, and arm C's form if it's ever re-enabled).
import { useState } from 'react';
import { track } from '@/lib/analytics';
import type { HeroVariant } from '@/lib/ab';

export function TextNumberCta({
  number,
  smsHref,
  variant,
  label,
  copiedLabel,
  className,
  experiment = 'hero-copy',
}: {
  number: string;
  smsHref: string;
  variant?: HeroVariant;
  label: string;
  copiedLabel: string;
  className?: string;
  experiment?: string;
}) {
  const [copied, setCopied] = useState(false);
  const isSms = smsHref.startsWith('sms:');

  async function onClick() {
    track('hero_cta_engaged', {
      experiment,
      ...(variant ? { variant } : {}),
      method: isSms ? 'text_number' : 'web_start',
    });
    if (isSms) {
      // Desktop: sms: won't open anything, so the copy IS the path. Mobile: it also opens
      // Messages below, and the copy is a harmless bonus.
      try {
        await navigator.clipboard.writeText(number);
        setCopied(true);
      } catch {
        /* clipboard blocked — the mobile sms: open below still works */
      }
    }
    window.location.href = smsHref;
  }

  return (
    <button type="button" onClick={onClick} className={className} aria-live="polite">
      <span aria-hidden>💬</span>
      {copied ? copiedLabel : label}
    </button>
  );
}
