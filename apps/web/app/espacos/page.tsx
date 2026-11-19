import VenueDirectory from "./venue-directory";

export const metadata = {
  title: "Espaços para eventos | Nuvia",
  description: "Encontra quintas, salões e locais para o teu evento em Angola.",
};

export default function SpacesPage() {
  return <main className="venue-page"><a className="catalog-back" href="/">← Início</a><header className="venue-page-heading"><p className="eyebrow">Espaços para celebrar</p><h1>Encontra o local certo para o teu evento.</h1><p>Pesquisa espaços publicados e compara fotografias, localização e capacidade. Perfis de demonstração aparecem identificados; confirma sempre disponibilidade e condições directamente com o responsável.</p></header><VenueDirectory /></main>;
}
