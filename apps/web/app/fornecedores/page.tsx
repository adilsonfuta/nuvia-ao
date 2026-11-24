import type { Metadata } from "next";
import VendorDirectory, { type VendorDirectoryData } from "./vendor-directory";
import { getPublicApi, jsonLd, publicSiteUrl } from "../lib/server-public-api";

export const dynamic = "force-dynamic";
const title = "Fornecedores para casamentos e eventos em Angola";
const description = "Encontra catering, decoração, fotografia, música e outros profissionais para o teu casamento, alambamento ou evento em Angola.";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const params = await searchParams;
  const filtered = ["q", "category", "province", "projectId"].some((key) => Boolean(params[key]));
  return {
    title,
    description,
    alternates: { canonical: "/fornecedores" },
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title, description, url: "/fornecedores", type: "website", images: [{ url: "/casal-angolano-hero.png", width: 1536, height: 1024, alt: "Profissionais para eventos em Angola" }] },
    twitter: { card: "summary_large_image", title, description, images: ["/casal-angolano-hero.png"] },
  };
}

export default async function Page() {
  const initialData = await getPublicApi<VendorDirectoryData>("/vendors?page=1&pageSize=20").catch(() => undefined);
  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: `${publicSiteUrl()}/fornecedores`,
    inLanguage: "pt-AO",
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: publicSiteUrl() },
      { "@type": "ListItem", position: 2, name: "Fornecedores", item: `${publicSiteUrl()}/fornecedores` },
    ],
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(collection) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />
    <main className="catalog-page">
      <header className="catalog-heading">
        <p className="eyebrow">Profissionais para a tua celebração</p>
        <h1>Encontra fornecedores para o teu evento.</h1>
        <p>Pesquisa perfis por serviço e província. Os perfis de demonstração são fictícios e não representam disponibilidade, preços ou recomendações verificadas.</p>
        <a className="button button-outline vendor-join-link" href="/fornecedores/aderir">Tens um negócio? Cria o teu perfil <span aria-hidden="true">→</span></a>
      </header>
      <VendorDirectory initialData={initialData ?? undefined} />
    </main>
  </>;
}
