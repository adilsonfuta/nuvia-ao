import type { Metadata } from "next";
import VenueDirectory, { type VenueDirectoryData } from "./venue-directory";
import { getPublicApi, jsonLd, publicSiteUrl } from "../lib/server-public-api";

export const dynamic = "force-dynamic";
const title = "Espaços para casamentos e eventos em Angola";
const description = "Pesquisa quintas, salões, hotéis e outros espaços para casamentos, alambamentos e festas em Angola.";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const params = await searchParams;
  const filtered = ["q", "province", "type", "capacity"].some((key) => Boolean(params[key]));
  return {
    title,
    description,
    alternates: { canonical: "/espacos" },
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title, description, url: "/espacos", type: "website", images: [{ url: "/espacos/demo/espaco-taliana.webp", alt: "Espaço para eventos em Angola" }] },
    twitter: { card: "summary_large_image", title, description, images: ["/espacos/demo/espaco-taliana.webp"] },
  };
}

export default async function SpacesPage() {
  const initialData = await getPublicApi<VenueDirectoryData>("/venues?page=1&pageSize=20").catch(() => undefined);
  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: `${publicSiteUrl()}/espacos`,
    inLanguage: "pt-AO",
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(collection) }} />
    <main className="venue-page">
      <a className="catalog-back" href="/">← Início</a>
      <header className="venue-page-heading"><p className="eyebrow">Espaços para celebrar</p><h1>Encontra o local certo para o teu evento.</h1><p>Pesquisa espaços publicados e compara fotografias, localização e capacidade. Perfis de demonstração aparecem identificados; confirma sempre disponibilidade e condições directamente com o responsável.</p></header>
      <VenueDirectory initialData={initialData ?? undefined} />
    </main>
  </>;
}
