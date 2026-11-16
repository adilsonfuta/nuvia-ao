import type { MetadataRoute } from 'next';

const publicRoutes = ['', '/planear', '/fornecedores', '/espacos', '/casamento-civil', '/guias'];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!baseUrl) return [];
  const lastModified = new Date();
  return publicRoutes.map((route) => ({
    url: `${baseUrl.replace(/\/$/, '')}${route}`,
    lastModified,
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : 0.7,
  }));
}
