'use client';

// Reactive `prefers-reduced-motion` read, shared by the cinematic video components
// (HeroVideo, ScrollVideo). SSR snapshot is false; it updates live if the user toggles the
// OS setting. useSyncExternalStore avoids the setState-in-effect cascade-render pitfall.
import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
