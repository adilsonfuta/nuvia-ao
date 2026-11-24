import type { MetadataRoute } from 'next';
import { publicSiteUrl } from './lib/server-public-api';

export default function robots(): MetadataRoute.Robots {
  return {
    // Sensitive pages carry page-level noindex metadata. Keep them crawlable so
    // search engines can read that rule; robots.txt is not an access-control tool.
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${publicSiteUrl()}/sitemap.xml`,
    host: publicSiteUrl(),
  };
}
