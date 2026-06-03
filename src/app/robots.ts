import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Allow crawling of marketing pages; keep app/auth surfaces and API out of the index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/settings', '/login', '/start', '/receipts', '/api'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
