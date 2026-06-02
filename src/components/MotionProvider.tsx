'use client';

// Global Framer Motion config — honors the OS "reduce motion" setting everywhere.
import { MotionConfig } from 'framer-motion';

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
