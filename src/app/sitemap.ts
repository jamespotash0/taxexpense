import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { getSupabaseAdmin } from '@/lib/supabase';

export const revalidate = 86400;

// Public, indexable marketing/legal pages only. App and auth routes are excluded
// (and disallowed in robots.ts) since they require a session or carry no SEO value.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = [
    { path: '/', priority: 1.0 },
    { path: '/pricing', priority: 0.8 },
    { path: '/privacy', priority: 0.3 },
    { path: '/terms', priority: 0.3 },
  ];

  // Public IRC reference pages (/irc/[section]). A DB hiccup drops them, not the whole sitemap.
  try {
    const { data } = await getSupabaseAdmin().from('irc_summaries').select('section_id');
    for (const { section_id } of data ?? []) routes.push({ path: `/irc/${section_id}`, priority: 0.5 });
  } catch {}

  return routes.map(({ path, priority }) => ({
    url: `${SITE_URL}${path === '/' ? '' : path}`,
    changeFrequency: 'monthly',
    priority,
  }));
}
