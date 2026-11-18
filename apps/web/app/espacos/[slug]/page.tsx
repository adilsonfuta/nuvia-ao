"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../lib/api";
import { formatAOA } from "../../lib/format";

type Venue = { id: string; slug: string; name: string; venueType: string; description: string | null; province: string | null; municipality: string | null; address: string | null; mapsUrl: string | null; capacityMin: number | null; capacityMax: number | null; priceFrom: number | string | null; priceTo: number | string | null; amenities: string[]; eventTypes: string[]; galleryUrls: string[]; phone: string | null; email: string | null; websiteUrl: string | null; bookingTerms: string | null; paymentTerms: string | null; cancellationTerms: string | null; verifiedAt: string | null };

export default function VenueProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void api<Venue>(`/venues/${encodeURIComponent(slug)}`).then(setVenue).catch(cause => setError(cause instanceof Error ? cause.message : "Este espaço não está disponível.")); }, [slug]);
  if (!venue) return <main className="venue-page"><a className="catalog-back" href="/espacos">← Espaços</a><div className="venue-empty" role={error ? "alert" : "status"}><h2>{error ? "Este espaço não está disponível" : "A carregar espaço…"}</h2>{error && <p>{error}</p>}</div></main>;
  const reviewed = venue.verifiedAt ? new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeZone: "Africa/Luanda" }).format(new Date(venue.verifiedAt)) : "";
  return <main className="venue-page venue-profile-page">
    <a className="catalog-back" href="/espacos">← Todos os espaços</a>
    <header className="venue-profile-heading"><p className="eyebrow">{venue.venueType} · {[venue.municipality, venue.province].filter(Boolean).join(", ")}</p><h1>{venue.name}</h1><p>{venue.address}</p><span className="venue-verified">Informações revistas{reviewed ? ` em ${reviewed}` : " pela equipa Nuvia"}</span></header>
    {venue.galleryUrls.length > 0 && <section className="venue-gallery" aria-label="Fotografias do espaço">{venue.galleryUrls.map((url, index) => <img key={`${url}-${index}`} src={url} alt={`${venue.name}, fotografia ${index + 1}`} loading={index > 2 ? "lazy" : "eager"} referrerPolicy="no-referrer" />)}</section>}
    <div className="venue-profile-grid"><div className="venue-profile-main">
      {venue.description && <section className="dash-panel venue-profile-section"><h2>Sobre o espaço</h2><p>{venue.description}</p></section>}
      <section className="dash-panel venue-profile-section"><h2>Detalhes</h2><div className="venue-detail-facts"><article><small>Capacidade</small><strong>{venue.capacityMin != null && venue.capacityMax != null ? `${venue.capacityMin}–${venue.capacityMax} pessoas` : venue.capacityMax != null ? `Até ${venue.capacityMax} pessoas` : venue.capacityMin != null ? `A partir de ${venue.capacityMin} pessoas` : "Por confirmar"}</strong></article><article><small>Preço publicado</small><strong>{venue.priceFrom != null && venue.priceTo != null ? `${formatAOA(venue.priceFrom)} – ${formatAOA(venue.priceTo)}` : venue.priceFrom != null ? `A partir de ${formatAOA(venue.priceFrom)}` : venue.priceTo != null ? `Até ${formatAOA(venue.priceTo)}` : "Sob consulta"}</strong></article></div>{venue.amenities.length > 0 && <><h3>Características</h3><ul className="venue-amenities">{venue.amenities.map(item => <li key={item}>{item}</li>)}</ul></>}{venue.eventTypes.length > 0 && <><h3>Eventos recebidos</h3><ul className="venue-amenities">{venue.eventTypes.map(item => <li key={item}>{item}</li>)}</ul></>}</section>
      {(venue.bookingTerms || venue.paymentTerms || venue.cancellationTerms) && <section className="dash-panel venue-profile-section"><h2>Condições indicadas</h2>{venue.bookingTerms && <p><strong>Reserva:</strong> {venue.bookingTerms}</p>}{venue.paymentTerms && <p><strong>Pagamento:</strong> {venue.paymentTerms}</p>}{venue.cancellationTerms && <p><strong>Cancelamento:</strong> {venue.cancellationTerms}</p>}</section>}
      {venue.mapsUrl && <section className="venue-map-link"><a className="button button-outline" href={venue.mapsUrl} target="_blank" rel="noreferrer">Ver localização no mapa ↗</a></section>}
    </div><aside className="dash-panel venue-contact-panel"><p className="eyebrow">Fala directamente com o espaço</p><h2>Confirma a tua data</h2><p>Disponibilidade, valores finais e condições devem ser confirmados com o responsável. A Nuvia não gere reservas.</p>{venue.phone && <a className="button button-primary" href={`tel:${venue.phone}`}>Ligar {venue.phone}</a>}{venue.email && <a className="button button-outline" href={`mailto:${venue.email}?subject=${encodeURIComponent(`Informação sobre ${venue.name}`)}`}>Enviar email</a>}{venue.websiteUrl && <a className="venue-external-link" href={venue.websiteUrl} target="_blank" rel="noreferrer">Website do espaço ↗</a>}{!venue.phone && !venue.email && !venue.websiteUrl && <p className="venue-contact-missing">Contacto directo por confirmar.</p>}</aside></div>
    <footer className="venue-trust-note">Perfil revisto pela equipa Nuvia em {reviewed || "data indicada"}. A revisão confirma a informação do perfil, não garante o serviço, a disponibilidade ou os preços.</footer>
  </main>;
}
