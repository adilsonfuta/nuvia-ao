import type { Metadata } from "next";
import GuidesPage, { type GuideSummary } from "./guide-library";
import { getPublicApi, publicSiteUrl } from "../lib/server-public-api";

export const dynamic = "force-dynamic";
const title = "Guias para casamentos e eventos em Angola";
const description = "Conselhos práticos para planear casamentos, organizar orçamentos, preparar convidados e tratar do casamento civil em Angola.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/guias" },
  openGraph: { title, description, url: "/guias", type: "website", images: [{ url: "/casal-angolano-hero.png", width: 1536, height: 1024, alt: "Casal angolano a planear uma celebração" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/casal-angolano-hero.png"] },
};

export default async function GuidesIndexPage() {
  const initialGuides = await getPublicApi<GuideSummary[]>("/guides").catch(() => undefined);
  return <GuidesPage initialGuides={initialGuides ?? undefined} />;
}
