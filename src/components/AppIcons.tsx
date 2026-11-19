// One stroke icon set for the app surfaces (24px grid, 2px stroke, round caps). Decorative by
// default; pass a label to expose one to assistive tech.
import type { ReactNode } from 'react';

const PATHS: Record<string, ReactNode> = {
  home: <><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" /></>,
  sparkle: <><path d="M12 3.5c.5 3.8 2.7 6 6.5 6.5-3.8.5-6 2.7-6.5 6.5-.5-3.8-2.7-6-6.5-6.5 3.8-.5 6-2.7 6.5-6.5Z" /><path d="M18.5 15.5c.2 1.5 1 2.3 2.5 2.5-1.5.2-2.3 1-2.5 2.5-.2-1.5-1-2.3-2.5-2.5 1.5-.2 2.3-1 2.5-2.5Z" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" /></>,
  building: <><path d="M4 20V5.5A1.5 1.5 0 0 1 5.5 4h7A1.5 1.5 0 0 1 14 5.5V20M14 10h4.5A1.5 1.5 0 0 1 20 11.5V20M2.5 20h19M8 8h2M8 12h2M8 16h2" /></>,
  logout: <><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9.5 16.5 5 12l4.5-4.5M5 12h11" /></>,
  back: <><path d="m14.5 5.5-6.5 6.5 6.5 6.5" /></>,
  chevron: <><path d="m9.5 5.5 6.5 6.5-6.5 6.5" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7.5" /></>,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8.3 12.2 2.6 2.6 4.8-5" /></>,
  receipt: <><path d="M6 3.5v17l2-1.2 2 1.2 2-1.2 2 1.2 2-1.2 2 1.2v-17l-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2z" /><path d="M9 9h6M9 12.5h6M9 16h3.5" /></>,
  pen: <><path d="M15.5 4.5 19.5 8.5 9 19H5v-4z" /><path d="M13 7l4 4" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 1.8" /></>,
  download: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" /></>,
  camera: <><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2L9.5 4.5h5L16.3 7h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" /><circle cx="12" cy="12.5" r="3.3" /></>,
  scale: <><path d="M12 4v16M7 20h10M5 7h14M5 7l-2.5 6a3 3 0 0 0 5 0zM19 7l-2.5 6a3 3 0 0 0 5 0z" /></>,
  flag: <><path d="M5 21V4.5M5 4.5h11.5l-2 4 2 4H5" /></>,
  close: <><path d="M6 6l12 12M18 6 6 18" /></>,
  trash: <><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5" /></>,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className = '', label }: { name: IconName; size?: number; className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {PATHS[name]}
    </svg>
  );
}

/** The ledger-T mark from public/brand/tally-logo.svg, drawn in the app's violet. */
export function TallyMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className="shrink-0">
      <rect width="100" height="100" rx="24" fill="var(--color-primary)" />
      <g fill="none" stroke="#fff" strokeLinecap="round">
        <path d="M28 28h44M50 28v46" strokeWidth="7.5" />
        <path d="M40 42h20M40 54h20M40 66h20" strokeWidth="4.5" />
      </g>
    </svg>
  );
}
