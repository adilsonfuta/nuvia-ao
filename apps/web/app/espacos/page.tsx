import VenueDirectory from "./venue-directory";

export const metadata = {
  title: "Espaços para eventos | Nuvia",
  description: "Encontra quintas, salões e locais para o teu evento em Angola.",
};

export default function SpacesPage() {
  return <main className="venue-page"><a className="catalog-back" href="/">← Início</a><header className="venue-page-heading"><p className="eyebrow">Espaços para celebrar</p><h1>Encontra o local certo para o teu evento.</h1><p>Pesquisa espaços publicados com localização, capacidade e contacto revistos pela equipa Nuvia. Confirma sempre a disponibilidade directamente com o espaço.</p></header><VenueDirectory /></main>;
}
