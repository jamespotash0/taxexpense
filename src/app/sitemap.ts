import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Public, indexable marketing/legal pages only. App and auth routes are excluded
// (and disallowed in robots.ts) since they require a session or carry no SEO value.
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: '/', priority: 1.0 },
    { path: '/pricing', priority: 0.8 },
    { path: '/privacy', priority: 0.3 },
    { path: '/terms', priority: 0.3 },
  ];

  return routes.map(({ path, priority }) => ({
    url: `${SITE_URL}${path === '/' ? '' : path}`,
    changeFrequency: 'monthly',
    priority,
  }));
}
