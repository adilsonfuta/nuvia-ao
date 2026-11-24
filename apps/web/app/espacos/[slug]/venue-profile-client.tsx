"use client";

import { useEffect, useRef, useState } from "react";
import { formatAOA } from "../../lib/format";
import { mapProviderLabel, openStreetMapEmbedUrl, openStreetMapUrl } from "../../lib/venue-map";
import { VenueInquiryBox } from "../venue-inquiry-box";

export type VenueProfileData = { id: string; slug: string; name: string; venueType: string; description: string | null; province: string | null; municipality: string | null; address: string | null; mapsUrl: string | null; latitude: number | null; longitude: number | null; capacityMin: number | null; capacityMax: number | null; priceFrom: number | string | null; priceTo: number | string | null; amenities: string[]; eventTypes: string[]; galleryUrls: string[]; phone: string | null; email: string | null; websiteUrl: string | null; bookingTerms: string | null; paymentTerms: string | null; cancellationTerms: string | null; verifiedAt: string | null; isDemo: boolean };

export default function VenueProfilePage({ initialVenue }: { initialVenue: VenueProfileData }) {
  const [venue, setVenue] = useState<VenueProfileData | null>(initialVenue);
  const [error, setError] = useState("");
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const galleryDialogRef = useRef<HTMLDialogElement>(null);
  const venuePhotoCount = venue?.galleryUrls.length ?? 0;
  useEffect(() => { setVenue(initialVenue); }, [initialVenue]);
  useEffect(() => {
    const dialog = galleryDialogRef.current;
    if (!dialog) return;
    if (activePhotoIndex !== null && !dialog.open) dialog.showModal();
    if (activePhotoIndex === null && dialog.open) dialog.close();
  }, [activePhotoIndex]);
  useEffect(() => {
    if (activePhotoIndex === null || venuePhotoCount === 0) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") { event.preventDefault(); setActivePhotoIndex(index => index === null ? null : (index + 1) % venuePhotoCount); }
      if (event.key === "ArrowLeft") { event.preventDefault(); setActivePhotoIndex(index => index === null ? null : (index - 1 + venuePhotoCount) % venuePhotoCount); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePhotoIndex, venuePhotoCount]);
  if (!venue) return <main className="venue-page"><a className="catalog-back" href="/espacos">← Espaços</a><div className="venue-empty" role={error ? "alert" : "status"}><h2>{error ? "Este espaço não está disponível" : "A carregar espaço…"}</h2>{error && <p>{error}</p>}</div></main>;
  const reviewed = venue.verifiedAt ? new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeZone: "Africa/Luanda" }).format(new Date(venue.verifiedAt)) : "";
  return <main className="venue-page venue-profile-page">
    <a className="catalog-back" href="/espacos">← Todos os espaços</a>
    <header className="venue-profile-heading"><p className="eyebrow">{venue.venueType} · {[venue.municipality, venue.province].filter(Boolean).join(", ") || "Localização por confirmar"}</p><h1>{venue.name}</h1>{venue.address && <p>{venue.address}</p>}<span className={venue.isDemo ? "venue-verified venue-demo-badge" : "venue-verified"}>{venue.isDemo ? "Perfil demonstrativo · dados por confirmar" : `Informações revistas${reviewed ? ` em ${reviewed}` : " pela equipa Nuvia"}`}</span></header>
    {venue.isDemo && <aside className="venue-demo-disclosure" role="note"><strong>Informação demonstrativa</strong><p>Este perfil foi criado para mostrar como o catálogo pode apresentar espaços. A imagem é conceptual e não é uma fotografia deste estabelecimento. A localização é uma referência pública, ainda por confirmar pelo responsável. Preços, capacidade, disponibilidade, contactos e condições não estão confirmados.</p></aside>}
    {venue.galleryUrls.length > 0 && <>
      <section className="venue-gallery" aria-label={venue.isDemo ? "Ilustrações conceptuais do perfil demonstrativo" : "Fotografias do espaço"}>
        {venue.galleryUrls.map((url, index) => <button className="venue-gallery-photo" type="button" key={`${url}-${index}`} onClick={() => setActivePhotoIndex(index)} aria-label={`Ampliar imagem ${index + 1} de ${venue.galleryUrls.length}`}>
          <img src={url} alt={venue.isDemo ? `Ilustração conceptual ${index + 1} para ${venue.name}; não é uma fotografia do estabelecimento` : `${venue.name}, fotografia ${index + 1}`} loading={index > 2 ? "lazy" : "eager"} referrerPolicy="no-referrer" />
          <span aria-hidden="true">Ampliar</span>
        </button>)}
      </section>
      <dialog className="venue-lightbox" ref={galleryDialogRef} aria-label={`Galeria de imagens de ${venue.name}`} onCancel={event => { event.preventDefault(); setActivePhotoIndex(null); }} onClose={() => setActivePhotoIndex(null)} onClick={event => { if (event.target === event.currentTarget) setActivePhotoIndex(null); }}>
        {activePhotoIndex !== null && <div className="venue-lightbox-inner">
          <header className="venue-lightbox-toolbar"><span>{venue.name}</span><button type="button" className="venue-lightbox-close" onClick={() => setActivePhotoIndex(null)} aria-label="Fechar galeria">×</button></header>
          <div className="venue-lightbox-stage">
            {venue.galleryUrls.length > 1 && <button type="button" className="venue-lightbox-nav previous" onClick={() => setActivePhotoIndex((activePhotoIndex - 1 + venue.galleryUrls.length) % venue.galleryUrls.length)} aria-label="Ver imagem anterior">‹</button>}
            <img src={venue.galleryUrls[activePhotoIndex]} alt={venue.isDemo ? `Ilustração conceptual ${activePhotoIndex + 1} para ${venue.name}; não é uma fotografia do estabelecimento` : `${venue.name}, fotografia ${activePhotoIndex + 1}`} referrerPolicy="no-referrer" />
            {venue.galleryUrls.length > 1 && <button type="button" className="venue-lightbox-nav next" onClick={() => setActivePhotoIndex((activePhotoIndex + 1) % venue.galleryUrls.length)} aria-label="Ver imagem seguinte">›</button>}
          </div>
          <footer className="venue-lightbox-footer"><span>{venue.isDemo ? "Imagem conceptual" : `Imagem ${activePhotoIndex + 1}`}</span><span aria-live="polite">{activePhotoIndex + 1} / {venue.galleryUrls.length}</span></footer>
        </div>}
      </dialog>
    </>}
    <div className="venue-profile-grid"><div className="venue-profile-main">
      {venue.description && <section className="dash-panel venue-profile-section"><h2>Sobre o espaço</h2><p>{venue.description}</p></section>}
      <section className="dash-panel venue-profile-section"><h2>Detalhes</h2><div className="venue-detail-facts"><article><small>Capacidade</small><strong>{venue.capacityMin != null && venue.capacityMax != null ? `${venue.capacityMin}–${venue.capacityMax} pessoas` : venue.capacityMax != null ? `Até ${venue.capacityMax} pessoas` : venue.capacityMin != null ? `A partir de ${venue.capacityMin} pessoas` : "Por confirmar"}</strong></article><article><small>Preço publicado</small><strong>{venue.priceFrom != null && venue.priceTo != null ? `${formatAOA(venue.priceFrom)} – ${formatAOA(venue.priceTo)}` : venue.priceFrom != null ? `A partir de ${formatAOA(venue.priceFrom)}` : venue.priceTo != null ? `Até ${formatAOA(venue.priceTo)}` : venue.isDemo ? "Por confirmar" : "Sob consulta"}</strong></article></div>{venue.amenities.length > 0 && <><h3>Características</h3><ul className="venue-amenities">{venue.amenities.map(item => <li key={item}>{item}</li>)}</ul></>}{venue.eventTypes.length > 0 && <><h3>Eventos recebidos</h3><ul className="venue-amenities">{venue.eventTypes.map(item => <li key={item}>{item}</li>)}</ul></>}</section>
      {(venue.bookingTerms || venue.paymentTerms || venue.cancellationTerms) && <section className="dash-panel venue-profile-section"><h2>Condições indicadas</h2>{venue.bookingTerms && <p><strong>Reserva:</strong> {venue.bookingTerms}</p>}{venue.paymentTerms && <p><strong>Pagamento:</strong> {venue.paymentTerms}</p>}{venue.cancellationTerms && <p><strong>Cancelamento:</strong> {venue.cancellationTerms}</p>}</section>}
      {(venue.mapsUrl || (venue.latitude != null && venue.longitude != null)) && <section className="venue-map-panel" aria-label="Localização do espaço">
        <div className="venue-map-heading"><div><p className="eyebrow">Localização</p><h2>Como chegar</h2>{venue.address && <p>{venue.address}</p>}</div>
          <a className="button button-outline" href={venue.mapsUrl || openStreetMapUrl(venue.latitude!, venue.longitude!)} target="_blank" rel="noreferrer">Abrir no {venue.mapsUrl ? mapProviderLabel(venue.mapsUrl) : "OpenStreetMap"} ↗</a>
        </div>
        {venue.latitude != null && venue.longitude != null && <iframe className="venue-map-frame" src={openStreetMapEmbedUrl(venue.latitude, venue.longitude)} title={`Mapa com a localização de ${venue.name}`} loading="lazy" referrerPolicy="no-referrer" />}
        {venue.mapsUrl && (venue.latitude == null || venue.longitude == null) && <p className="venue-map-link-note">Este link abre directamente no {mapProviderLabel(venue.mapsUrl)}. O mapa incorporado aparece quando o ponto exacto é indicado pelo responsável.</p>}
      </section>}
    </div><aside className="dash-panel venue-contact-panel"><p className="eyebrow">{venue.isDemo ? "Perfil demonstrativo" : "Fala directamente com o espaço"}</p><h2>{venue.isDemo ? "Dados comerciais" : "Confirma a tua data"}</h2><p>{venue.isDemo ? "Contacto, disponibilidade, capacidade e condições aguardam confirmação do estabelecimento. Este perfil não recebe pedidos nem reservas." : "Pede disponibilidade e orçamento; a resposta fica associada ao teu evento."}</p>{!venue.isDemo && <VenueInquiryBox venueId={venue.id} />}{!venue.isDemo && venue.phone && <a className="button button-outline" href={`tel:${venue.phone}`}>Ligar {venue.phone}</a>}{!venue.isDemo && venue.email && <a className="button button-outline" href={`mailto:${venue.email}?subject=${encodeURIComponent(`Informação sobre ${venue.name}`)}`}>Enviar email</a>}{!venue.isDemo && venue.websiteUrl && <a className="venue-external-link" href={venue.websiteUrl} target="_blank" rel="noreferrer">Website do espaço ↗</a>}{!venue.isDemo && !venue.phone && !venue.email && !venue.websiteUrl && <p className="venue-contact-missing">Contacto directo por confirmar.</p>}</aside></div>
    <footer className="venue-trust-note">{venue.isDemo ? "Perfil de demonstração com referências públicas não confirmadas pelo estabelecimento. A ilustração não é uma fotografia real do espaço." : `Perfil revisto pela equipa Nuvia em ${reviewed || "data indicada"}. A revisão confirma a informação do perfil, não garante o serviço, a disponibilidade ou os preços.`}</footer>
  </main>;
}
