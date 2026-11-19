"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../lib/api";
import { formatAOA } from "../lib/format";
import { ListPagination } from "../lib/list-pagination";

type Venue = { id: string; slug: string; name: string; venueType: string; description: string | null; province: string | null; municipality: string | null; address: string | null; mapsUrl: string | null; capacityMin: number | null; capacityMax: number | null; priceFrom: number | string | null; priceTo: number | string | null; galleryUrls: string[]; phone: string | null; email: string | null; websiteUrl: string | null; amenities: string[]; eventTypes: string[]; verifiedAt: string | null };
type VenueList = { items: Venue[]; total: number; status: string; page: number; pageSize: number; totalPages: number };
const provinces = ["Bengo", "Benguela", "Bié", "Cabinda", "Cuando", "Cubango", "Cuanza Norte", "Cuanza Sul", "Cunene", "Huambo", "Huíla", "Icolo e Bengo", "Luanda", "Lunda Norte", "Lunda Sul", "Malanje", "Moxico", "Moxico Leste", "Namibe", "Uíge", "Zaire"];

export default function VenueDirectory() {
  const [data, setData] = useState<VenueList | null>(null);
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState("");
  const [venueType, setVenueType] = useState("");
  const [capacity, setCapacity] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(filters: { search: string; province: string; venueType: string; capacity: string }, nextPage = page, nextPageSize = pageSize) {
    setLoading(true); setError("");
    const params = new URLSearchParams();
    if (filters.search.trim()) params.set("search", filters.search.trim());
    if (filters.province) params.set("province", filters.province);
    if (filters.venueType) params.set("type", filters.venueType);
    if (filters.capacity) params.set("capacity", filters.capacity);
    params.set("page", String(nextPage)); params.set("pageSize", String(nextPageSize));
    try { setData(await api<VenueList>(`/venues?${params.toString()}`)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar os espaços."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filters = { search: params.get("q") ?? "", province: params.get("province") ?? "", venueType: params.get("type") ?? "", capacity: params.get("capacity") ?? "" };
    setSearch(filters.search); setProvince(filters.province); setVenueType(filters.venueType); setCapacity(filters.capacity);
    setPage(1); void load(filters, 1);
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const filters = { search, province, venueType, capacity };
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (province) params.set("province", province);
    if (venueType) params.set("type", venueType);
    if (capacity) params.set("capacity", capacity);
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
    setPage(1); void load(filters, 1);
  }

  return <section className="venue-directory">
    <form className="venue-filters" onSubmit={submit}>
      <label>Pesquisar<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome ou município" /></label>
      <label>Província<select value={province} onChange={event => setProvince(event.target.value)}><option value="">Todas</option>{provinces.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Tipo<select value={venueType} onChange={event => setVenueType(event.target.value)}><option value="">Todos os tipos</option><option>Quinta</option><option>Salão de festas</option><option>Hotel</option><option>Restaurante</option><option>Praia ou espaço ao ar livre</option><option>Outro</option></select></label>
      <label>Capacidade mínima<select value={capacity} onChange={event => setCapacity(event.target.value)}><option value="">Qualquer capacidade</option><option value="100">100 pessoas</option><option value="250">250 pessoas</option><option value="500">500 pessoas</option></select></label>
      <button className="button button-primary">Pesquisar</button>
    </form>
    {error ? <div className="venue-empty" role="alert"><h2>Não foi possível carregar o catálogo</h2><p>{error}</p><button className="button button-outline" onClick={() => void load({ search, province, venueType, capacity })}>Tentar novamente</button></div> : loading && !data ? <p className="venue-loading" role="status">A carregar espaços…</p> : data?.items.length ? <>
      <div className="venue-results-heading"><strong>{data.total} {data.total === 1 ? "espaço publicado" : "espaços publicados"}</strong><small>Dados revistos; confirma disponibilidade e condições antes de reservar.</small></div>
      <div className="venue-grid">{data.items.map(venue => <article className="venue-card" key={venue.id}>
        <Link className="venue-card-image" href={`/espacos/${venue.slug}`} aria-label={`Ver ${venue.name}`}>
          {venue.galleryUrls[0] ? <img src={venue.galleryUrls[0]} alt={`Espaço ${venue.name}`} loading="lazy" referrerPolicy="no-referrer" /> : <span aria-hidden="true">⌂</span>}
          <span className="venue-verified">Dados revistos</span>
        </Link>
        <div className="venue-card-body"><p className="eyebrow">{venue.venueType}</p><h2><Link href={`/espacos/${venue.slug}`}>{venue.name}</Link></h2><p className="venue-location">{[venue.municipality, venue.province].filter(Boolean).join(" · ")}</p>
          <div className="venue-card-facts">{venue.capacityMax && <span>Até {venue.capacityMax.toLocaleString("pt-AO")} pessoas</span>}<span>{venue.priceFrom != null || venue.priceTo != null ? `${formatAOA(venue.priceFrom)} – ${formatAOA(venue.priceTo)}` : "Preço sob consulta"}</span></div>
          <Link className="venue-card-link" href={`/espacos/${venue.slug}`}>Ver espaço e contactos <span aria-hidden="true">→</span></Link>
        </div>
      </article>)}</div>
      <ListPagination page={data.page} pageSize={data.pageSize} total={data.total} label="espaços" onPageChange={(next) => { setPage(next); void load({ search, province, venueType, capacity }, next); }} onPageSizeChange={(size) => { setPageSize(size); setPage(1); void load({ search, province, venueType, capacity }, 1, size); }} />
    </> : <div className="venue-empty"><span aria-hidden="true">⌂</span><h2>{data?.total ? "Nenhum espaço corresponde à pesquisa" : "Estamos a preparar o catálogo de espaços"}</h2><p>{data?.total ? "Experimenta alterar a província, o tipo ou a capacidade." : "Os espaços só aparecem aqui depois de a equipa confirmar as informações com os responsáveis. Ainda não apresentamos disponibilidade ou preços não verificados."}</p>{data?.total ? <button className="button button-outline" onClick={() => { setSearch(""); setProvince(""); setVenueType(""); setCapacity(""); void load({ search: "", province: "", venueType: "", capacity: "" }); }}>Limpar pesquisa</button> : <Link className="button button-outline" href="/planear">Organizar o meu plano →</Link>}</div>}
  </section>;
}
