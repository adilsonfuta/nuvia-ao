import type { Metadata } from "next";
import { notFound } from "next/navigation";
import VendorPage, { type VendorProfileData } from "./vendor-profile-client";
import { getPublicApi, jsonLd, publicSiteUrl } from "../../lib/server-public-api";

export const dynamic = "force-dynamic";
type RouteProps = { params: Promise<{ slug: string }> };

async function getVendor(slug: string) {
  return getPublicApi<VendorProfileData>(`/vendors/${encodeURIComponent(slug)}?page=1&pageSize=10`);
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const vendor = await getVendor(slug);
  if (!vendor) return { title: "Fornecedor não encontrado", robots: { index: false, follow: false } };
  const title = `${vendor.name} — ${vendor.category} em ${vendor.municipality || vendor.province || "Angola"}`;
  const description = (vendor.description || `${vendor.name} presta serviços de ${vendor.category} para eventos em Angola.`).replace(/\s+/g, " ").slice(0, 160);
  const image = vendor.portfolio.find((item) => item.isCover)?.id
    ? `/api/v1/vendor-portfolio/${vendor.portfolio.find((item) => item.isCover)!.id}/image`
    : vendor.galleryUrls[0] || "/casal-angolano-hero.png";
  return {
    title,
    description,
    alternates: { canonical: `/fornecedores/${vendor.slug}` },
    robots: vendor.isDemo ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { title, description, url: `/fornecedores/${vendor.slug}`, type: "website", images: [{ url: image, alt: vendor.name }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function VendorProfilePage({ params }: RouteProps) {
  const { slug } = await params;
  const vendor = await getVendor(slug);
  if (!vendor) notFound();
  const url = `${publicSiteUrl()}/fornecedores/${vendor.slug}`;
  const image = vendor.portfolio.find((item) => item.isCover)?.id
    ? `${publicSiteUrl()}/api/v1/vendor-portfolio/${vendor.portfolio.find((item) => item.isCover)!.id}/image`
    : vendor.galleryUrls[0];
  const localBusiness = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: vendor.name,
    description: vendor.description || `${vendor.name} presta serviços de ${vendor.category} em Angola.`,
    url,
    ...(image ? { image: image.startsWith("http") ? image : `${publicSiteUrl()}${image}` } : {}),
    ...(vendor.phone ? { telephone: vendor.phone } : {}),
    ...(vendor.email ? { email: vendor.email } : {}),
    ...([vendor.websiteUrl, vendor.instagramUrl, vendor.facebookUrl, vendor.tiktokUrl].some(Boolean) ? { sameAs: [vendor.websiteUrl, vendor.instagramUrl, vendor.facebookUrl, vendor.tiktokUrl].filter(Boolean) } : {}),
    ...(vendor.municipality || vendor.province ? { address: { "@type": "PostalAddress", ...(vendor.municipality ? { addressLocality: vendor.municipality } : {}), ...(vendor.province ? { addressRegion: vendor.province } : {}), addressCountry: "AO" } } : {}),
    areaServed: vendor.serviceAreas,
    knowsAbout: [vendor.category, ...vendor.services],
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: publicSiteUrl() },
      { "@type": "ListItem", position: 2, name: "Fornecedores", item: `${publicSiteUrl()}/fornecedores` },
      { "@type": "ListItem", position: 3, name: vendor.name, item: url },
    ],
  };
  return <>
    {!vendor.isDemo && <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(localBusiness) }} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} /></>}
    <VendorPage initialVendor={vendor} />
  </>;
}
