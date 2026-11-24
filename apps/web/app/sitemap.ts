import type { MetadataRoute } from "next";
import { getPublicApi, publicSiteUrl } from "./lib/server-public-api";

export const dynamic = "force-dynamic";

type Guide = { slug: string; reviewedAt: string | null; isDemo: boolean };
type CatalogPage<T> = { items: T[]; totalPages: number };
type Vendor = { slug: string; verifiedAt: string | null; isDemo: boolean };
type Venue = { slug: string; verifiedAt: string | null; isDemo: boolean };

async function getAllPages<T>(path: string): Promise<T[]> {
  const first = await getPublicApi<CatalogPage<T>>(`${path}?page=1&pageSize=100`);
  if (!first) return [];
  const rest = await Promise.all(Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, index) =>
    getPublicApi<CatalogPage<T>>(`${path}?page=${index + 2}&pageSize=100`),
  ));
  return [
    ...first.items,
    ...rest.flatMap((page) => page?.items ?? []),
  ];
}

function date(value: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = publicSiteUrl();
  const staticRoutes = ["", "/planear", "/fornecedores", "/espacos", "/casamento-civil", "/guias"];
  const baseEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));

  const [guides, vendors, venues] = await Promise.allSettled([
    getPublicApi<Guide[]>("/guides"),
    getAllPages<Vendor>("/vendors"),
    getAllPages<Venue>("/venues"),
  ]);
  const entries: MetadataRoute.Sitemap = [...baseEntries];
  if (guides.status === "fulfilled") {
    for (const guide of guides.value ?? []) {
      if (!guide.isDemo) entries.push({ url: `${baseUrl}/guias/${encodeURIComponent(guide.slug)}`, ...(date(guide.reviewedAt) ? { lastModified: date(guide.reviewedAt) } : {}), changeFrequency: "monthly", priority: 0.65 });
    }
  }
  if (vendors.status === "fulfilled") {
    for (const vendor of vendors.value) {
      if (!vendor.isDemo) entries.push({ url: `${baseUrl}/fornecedores/${encodeURIComponent(vendor.slug)}`, ...(date(vendor.verifiedAt) ? { lastModified: date(vendor.verifiedAt) } : {}), changeFrequency: "monthly", priority: 0.6 });
    }
  }
  if (venues.status === "fulfilled") {
    for (const venue of venues.value) {
      if (!venue.isDemo) entries.push({ url: `${baseUrl}/espacos/${encodeURIComponent(venue.slug)}`, ...(date(venue.verifiedAt) ? { lastModified: date(venue.verifiedAt) } : {}), changeFrequency: "monthly", priority: 0.6 });
    }
  }
  return entries;
}
