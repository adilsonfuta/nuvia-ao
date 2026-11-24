import type { Metadata } from "next";
import { notFound } from "next/navigation";
import VenueProfilePage, { type VenueProfileData } from "./venue-profile-client";
import { getPublicApi, jsonLd, publicSiteUrl } from "../../lib/server-public-api";

export const dynamic = "force-dynamic";
type RouteProps = { params: Promise<{ slug: string }> };

async function getVenue(slug: string) {
  return getPublicApi<VenueProfileData>(`/venues/${encodeURIComponent(slug)}`);
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const venue = await getVenue(slug);
  if (!venue) return { title: "Espaço não encontrado", robots: { index: false, follow: false } };
  const location = [venue.municipality, venue.province].filter(Boolean).join(", ");
  const title = `${venue.name} — ${venue.venueType}${location ? ` em ${location}` : " em Angola"}`;
  const description = (venue.description || `${venue.name} é um espaço para eventos em ${location || "Angola"}.`).replace(/\s+/g, " ").slice(0, 160);
  const image = venue.galleryUrls[0] || "/casal-angolano-hero.png";
  return {
    title,
    description,
    alternates: { canonical: `/espacos/${venue.slug}` },
    robots: venue.isDemo ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { title, description, url: `/espacos/${venue.slug}`, type: "website", images: [{ url: image, alt: venue.name }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function VenuePage({ params }: RouteProps) {
  const { slug } = await params;
  const venue = await getVenue(slug);
  if (!venue) notFound();
  const url = `${publicSiteUrl()}/espacos/${venue.slug}`;
  const image = venue.galleryUrls[0];
  const eventVenue = {
    "@context": "https://schema.org",
    "@type": "EventVenue",
    name: venue.name,
    description: venue.description || `${venue.name} é um espaço para eventos em Angola.`,
    url,
    ...(image ? { image: image.startsWith("http") ? image : `${publicSiteUrl()}${image}` } : {}),
    ...(venue.phone ? { telephone: venue.phone } : {}),
    ...(venue.email ? { email: venue.email } : {}),
    ...(venue.websiteUrl ? { sameAs: [venue.websiteUrl] } : {}),
    ...(venue.mapsUrl ? { hasMap: venue.mapsUrl } : {}),
    ...(venue.latitude !== null && venue.longitude !== null ? { geo: { "@type": "GeoCoordinates", latitude: venue.latitude, longitude: venue.longitude } } : {}),
    ...(venue.address || venue.municipality || venue.province ? { address: { "@type": "PostalAddress", ...(venue.address ? { streetAddress: venue.address } : {}), ...(venue.municipality ? { addressLocality: venue.municipality } : {}), ...(venue.province ? { addressRegion: venue.province } : {}), addressCountry: "AO" } } : {}),
    ...(venue.capacityMax !== null ? { maximumAttendeeCapacity: venue.capacityMax } : {}),
    ...(venue.eventTypes.length ? { keywords: venue.eventTypes } : {}),
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: publicSiteUrl() },
      { "@type": "ListItem", position: 2, name: "Espaços", item: `${publicSiteUrl()}/espacos` },
      { "@type": "ListItem", position: 3, name: venue.name, item: url },
    ],
  };
  return <>
    {!venue.isDemo && <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(eventVenue) }} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} /></>}
    <VenueProfilePage initialVenue={venue} />
  </>;
}
