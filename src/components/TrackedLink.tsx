'use client';

// Link that fires an analytics event on click before navigating. Used to attribute
// hero conversions (CTA, "try it" tap) to the A/B variant the visitor was shown.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { track } from '@/lib/analytics';

type Props = {
  href: string;
  event: string;
  data?: Record<string, string | number | boolean>;
  className?: string;
  children: ReactNode;
};

export function TrackedLink({ href, event, data, className, children }: Props) {
  const onClick = () => track(event, data ?? {});
  // sms:/tel:/mailto:/external need a plain anchor; internal routes use next/link.
  if (/^(sms:|tel:|mailto:|https?:)/.test(href)) {
    return (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
