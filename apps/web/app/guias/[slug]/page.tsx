import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GuideArticleClient, { type GuideArticleData } from "./guide-article-client";
import { getPublicApi, jsonLd, publicSiteUrl } from "../../lib/server-public-api";
import { GUIDE_COVERS } from "../guide-data";

export const dynamic = "force-dynamic";
type RouteProps = { params: Promise<{ slug: string }> };

async function getGuide(slug: string) {
  return getPublicApi<GuideArticleData>(`/guides/${encodeURIComponent(slug)}`);
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) return { title: "Guia não encontrado", robots: { index: false, follow: false } };
  const title = guide.title;
  const description = guide.summary.slice(0, 160);
  const image = guide.coverImage || GUIDE_COVERS[guide.slug]?.src || "/casal-angolano-hero.png";
  return {
    title,
    description,
    alternates: { canonical: `/guias/${guide.slug}` },
    robots: guide.isDemo ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { title, description, url: `/guias/${guide.slug}`, type: "article", images: [{ url: image, alt: guide.title }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function GuidePage({ params }: RouteProps) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) notFound();
  const url = `${publicSiteUrl()}/guias/${guide.slug}`;
  const image = guide.coverImage || GUIDE_COVERS[guide.slug]?.src;
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.summary,
    inLanguage: "pt-AO",
    mainEntityOfPage: url,
    ...(guide.createdAt ? { datePublished: guide.createdAt } : {}),
    ...(guide.reviewedAt || guide.updatedAt ? { dateModified: guide.reviewedAt || guide.updatedAt } : {}),
    ...(image ? { image: image.startsWith("http") ? image : `${publicSiteUrl()}${image}` } : {}),
    author: { "@type": "Organization", name: "Nuvia", url: publicSiteUrl() },
    publisher: { "@type": "Organization", name: "Nuvia", url: publicSiteUrl() },
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: publicSiteUrl() },
      { "@type": "ListItem", position: 2, name: "Guias", item: `${publicSiteUrl()}/guias` },
      { "@type": "ListItem", position: 3, name: guide.title, item: url },
    ],
  };
  return <>
    {!guide.isDemo && <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(article) }} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} /></>}
    <GuideArticleClient initialGuide={guide} />
  </>;
}
