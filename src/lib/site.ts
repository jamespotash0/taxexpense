// Single source of truth for the public site URL.
// Driven by NEXT_PUBLIC_APP_URL (set to https://tallywhy.com in Vercel),
// with a production fallback matching the URL fallbacks elsewhere in the codebase.
import { PUBLIC_ENV } from '@/lib/env';

export const SITE_URL = PUBLIC_ENV.appUrl || 'https://tallywhy.com';
