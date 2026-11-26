// Single source of truth for the public site URL.
// Driven by NEXT_PUBLIC_APP_URL (set to https://tallywhy.com in Vercel),
// with a production fallback matching the URL fallbacks elsewhere in the codebase.
import { PUBLIC_ENV } from '@/lib/env';

export const SITE_URL = PUBLIC_ENV.appUrl || 'https://tallywhy.com';

// Public social profiles. Fill in a URL to show it in the landing footer and in the
// Organization JSON-LD `sameAs` (helps search engines tie the profiles to the site).
// Empty entries render nothing.
export const SOCIAL_LINKS: { label: string; href: string }[] = [
  { label: 'X', href: '' },
  { label: 'Instagram', href: '' },
  { label: 'TikTok', href: '' },
  { label: 'LinkedIn', href: '' },
  { label: 'Product Hunt', href: '' },
].filter((s) => s.href);
