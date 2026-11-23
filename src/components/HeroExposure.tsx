'use client';

// Fires hero_exposure once per view for A/B attribution (DEC-079). Renders nothing.
import { useEffect } from 'react';
import { track } from '@/lib/analytics';
import type { HeroVariant } from '@/lib/ab';

export function HeroExposure({ variant }: { variant: HeroVariant }) {
  useEffect(() => {
    track('hero_exposure', { experiment: 'hero-copy', variant });
  }, [variant]);
  return null;
}
