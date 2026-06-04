'use client';

// Primary "Text {number}" CTA for hero arms A/B (and the footer).
// Why a button, not a bare <a href="sms:…">: on desktop, sms: links are a no-op, so the old
// link was a dead-end that still logged a "click" — a hollow, misleading conversion (Priya).
// This copies the number to the clipboard so desktop visitors get a real next step, opens
// Messages on mobile, and fires ONE consistent `hero_cta_engaged` event so the conversion is
// comparable across arms (the copy test A/B, and arm C's form if it's ever re-enabled).
import { useEffect, useRef, useState } from 'react';
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
  hideIcon = false,
  inline = false,
}: {
  number: string;
  smsHref: string;
  variant?: HeroVariant;
  label: string;
  copiedLabel: string;
  className?: string;
  experiment?: string;
  /** Drop the 💬 glyph when the CTA renders as an inline text link rather than a button. */
  hideIcon?: boolean;
  /** Inline link mode: keep the number visible (don't swap it to the "Copied" label); show a
   *  small ✓ confirmation that clears on its own. */
  inline?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSms = smsHref.startsWith('sms:');

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

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
        // Inline links keep their number; clear the ✓ after a moment so it stays subtle.
        if (inline) {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1800);
        }
      } catch {
        /* clipboard blocked — the mobile sms: open below still works */
      }
    }
    window.location.href = smsHref;
  }

  return (
    <button type="button" onClick={onClick} className={className} aria-live="polite">
      {!hideIcon && <span aria-hidden>💬</span>}
      {/* Inline mode never swaps the number out; button mode shows the full copied label. */}
      {inline ? label : copied ? copiedLabel : label}
      {inline && copied && <span className="ml-1 text-success-600" aria-hidden>✓</span>}
    </button>
  );
}
