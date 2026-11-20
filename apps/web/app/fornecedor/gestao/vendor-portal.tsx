"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";
import { ListPagination, PaginatedList } from "../../lib/list-pagination";

type PortfolioItem = { id: string; altText: string; sortOrder: number; isCover: boolean; status: "PENDING" | "APPROVED" | "REJECTED"; rejectionReason: string | null; imageUrl?: string };
type Submission = { id: string; status: "PENDING" | "APPROVED" | "REJECTED"; reason: string | null; createdAt: string };
type SupplierReview = { id: string; rating: number; communicationRating: number; punctualityRating: number; qualityRating: number; comment: string | null; isAnonymous: boolean; createdAt: string; reviewerName: string | null; response: string | null; responseStatus: "PENDING" | "APPROVED" | "REJECTED" | null; responseReason: string | null; quoteRequest: { project: { title: string; date: string | null } } };
type VendorProfile = {
  id: string; slug: string; name: string; category: string; status: string; municipality: string | null; description: string | null;
  services: string[]; serviceAreas: string[]; websiteUrl: string | null; instagramUrl: string | null;
  facebookUrl: string | null; tiktokUrl: string | null; portfolio: PortfolioItem[];
  profileSubmissions: Submission[]; reviews: SupplierReview[];
};
type Claim = { id: string; status: "PENDING" | "APPROVED" | "REJECTED"; reason: string | null; createdAt: string; vendor: { id: string; name: string; slug: string; status: string } };
type Inquiry = { id: string; message: string; status: "NEW" | "SENT" | "RESPONDED" | "HIRED" | "CLOSED"; vendorViewedAt: string | null; eventDate?: string | null; partySize?: number | null; availabilityStatus?: "PENDING" | "AVAILABLE" | "UNAVAILABLE" | "ALTERNATIVE_PROPOSED"; quotedAmount: string | number | null; responseNote: string | null; respondedAt: string | null; createdAt: string; vendor: { id: string; name: string; slug: string; category: string }; project: { id: string; title: string; date: string | null; province: string | null; guestEstimate: number | null } };
type VenueInquiry = { id: string; message: string; status: string; eventDate: string | null; partySize: number | null; quotedAmount: string | number | null; responseNote: string | null; availabilityStatus: "PENDING" | "AVAILABLE" | "UNAVAILABLE" | "ALTERNATIVE_PROPOSED"; createdAt: string; venue: { id: string; name: string; slug: string }; project: { id: string; title: string; date: string | null; province: string | null; guestEstimate: number | null } | null; user: { name: string | null } };
type PortalData = {
  vendors: VendorProfile[];
  claims: Claim[];
  inquiries: Inquiry[];
  venueInquiries: VenueInquiry[];
  inquiryMeta: { page: number; pageSize: number; total: number; totalPages: number; unreadCount: number; openCount: number };
};
const lines = (value: string) => value.split("\n").map((part) => part.trim()).filter(Boolean);
const statusLabel = (status: string) => status === "PENDING" ? "À espera de revisão" : status === "APPROVED" ? "Publicado" : "Precisa de alterações";
const profileStatusLabel = (status: string) => status === "ACTIVE" ? "Perfil activo" : status === "SUSPENDED" ? "Perfil suspenso" : "Perfil em revisão";

export default function VendorPortal() {
  const [data, setData] = useState<PortalData>({ vendors: [], claims: [], inquiries: [], venueInquiries: [], inquiryMeta: { page: 1, pageSize: 10, total: 0, totalPages: 1, unreadCount: 0, openCount: 0 } });
  const [selectedId, setSelectedId] = useState("");
  const [activeSection, setActiveSection] = useState<"requests" | "profile" | "reviews">("requests");
  const [inquiryPage, setInquiryPage] = useState(1);
  const [inquiryPageSize, setInquiryPageSize] = useState(10);
  const [inquiryStatus, setInquiryStatus] = useState("ALL");
  const [inquirySearch, setInquirySearch] = useState("");
  const [inquirySearchDraft, setInquirySearchDraft] = useState("");
  const [selectedInquiryId, setSelectedInquiryId] = useState("");
  const [description, setDescription] = useState("");
  const [servicesText, setServicesText] = useState("");
  const [areasText, setAreasText] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [quoteAmounts, setQuoteAmounts] = useState<Record<string, string>>({});
  const [quoteNotes, setQuoteNotes] = useState<Record<string, string>>({});
  const loadedProfileId = useRef("");

  const refresh = useCallback(async () => {
    const params = new URLSearchParams({ inquiryPage: String(inquiryPage), inquiryPageSize: String(inquiryPageSize), inquiryStatus, inquirySearch });
    const next = await api<PortalData>(`/vendor-portal?${params.toString()}`);
    setData(next);
    const selected = next.vendors.find((item) => item.id === selectedId) ?? next.vendors[0];
    setSelectedId(selected?.id ?? "");
  }, [inquiryPage, inquiryPageSize, inquirySearch, inquiryStatus, selectedId]);

  useEffect(() => { void refresh().catch((e) => setError(e.message)).finally(() => setLoading(false)); }, [refresh]);
  const selected = useMemo(() => data.vendors.find((item) => item.id === selectedId) ?? null, [data.vendors, selectedId]);
  useEffect(() => {
    if (!selected || selected.id === loadedProfileId.current) return;
    loadedProfileId.current = selected.id;
    setDescription(selected.description ?? "");
    setServicesText(selected.services.join("\n"));
    setAreasText(selected.serviceAreas.join("\n"));
    setWebsiteUrl(selected.websiteUrl ?? "");
    setInstagramUrl(selected.instagramUrl ?? "");
    setFacebookUrl(selected.facebookUrl ?? "");
    setTiktokUrl(selected.tiktokUrl ?? "");
  }, [selected]);
  const orderedItems = useMemo(() => selected?.portfolio.filter((item) => item.status !== "REJECTED").slice().sort((a, b) => a.sortOrder - b.sortOrder) ?? [], [selected]);
  const pendingSubmission = selected?.profileSubmissions.find((item) => item.status === "PENDING");
  const selectedInquiry = data.inquiries.find((item) => item.id === selectedInquiryId) ?? null;
  useEffect(() => {
    if (!selectedInquiryId) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedInquiryId(""); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedInquiryId]);

  async function action(work: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await work(); await refresh(); setNotice(success); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível guardar as alterações."); }
    finally { setBusy(false); }
  }

  async function submitProfile(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    await action(() => api(`/vendor-portal/${selected.id}/profile-submissions`, {
      method: "POST",
      body: JSON.stringify({ description, services: lines(servicesText), serviceAreas: lines(areasText), websiteUrl: websiteUrl || null, instagramUrl: instagramUrl || null, facebookUrl: facebookUrl || null, tiktokUrl: tiktokUrl || null }),
    }), "Alteração enviada para revisão. O perfil público mantém os dados actuais até à aprovação.");
  }

  async function submitImage(event: FormEvent) {
    event.preventDefault();
    if (!selected || !imageFile) return;
    const form = new FormData();
    form.set("image", imageFile);
    form.set("altText", altText);
    await action(async () => {
      await api(`/vendor-portal/${selected.id}/portfolio`, { method: "POST", body: form });
      setImageFile(null); setAltText("");
      const input = document.getElementById("vendor-portfolio-file") as HTMLInputElement | null;
      if (input) input.value = "";
    }, "Imagem carregada e enviada para revisão.");
  }

  async function makeCover(item: PortfolioItem) {
    if (!selected) return;
    await action(() => api(`/vendor-portal/${selected.id}/portfolio/${item.id}`, { method: "PATCH", body: JSON.stringify({ isCover: true }) }), "Capa actualizada.");
  }
  async function moveItem(item: PortfolioItem, offset: number) {
    if (!selected) return;
    const from = orderedItems.findIndex((entry) => entry.id === item.id);
    const to = from + offset;
    if (to < 0 || to >= orderedItems.length) return;
    const ids = orderedItems.map((entry) => entry.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];
    await action(() => api(`/vendor-portal/${selected.id}/portfolio-order`, { method: "PATCH", body: JSON.stringify({ ids }) }), "Ordem do portefólio actualizada.");
  }
  async function removeItem(item: PortfolioItem) {
    if (!selected || !window.confirm("Remover esta imagem do portefólio?")) return;
    await action(() => api(`/vendor-portal/${selected.id}/portfolio/${item.id}`, { method: "DELETE" }), "Imagem removida.");
  }
  async function submitReviewReply(event: FormEvent, review: SupplierReview) {
    event.preventDefault();
    if (!selected || !replyDrafts[review.id]?.trim()) return;
    await action(() => api(`/vendor-portal/${selected.id}/reviews/${review.id}/response`, { method: "POST", body: JSON.stringify({ response: replyDrafts[review.id].trim() }) }), "Resposta enviada para revisão antes de ser publicada.");
    setReplyDrafts((current) => ({ ...current, [review.id]: "" }));
  }
  async function submitInquiryResponse(event: FormEvent, inquiry: Inquiry) {
    event.preventDefault();
    const availabilityStatus = String(new FormData(event.currentTarget as HTMLFormElement).get("availabilityStatus") ?? "PENDING");
    await action(() => api(`/vendor-portal/inquiries/${inquiry.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        quotedAmount: quoteAmounts[inquiry.id] === "" || quoteAmounts[inquiry.id] === undefined ? null : Number(quoteAmounts[inquiry.id]),
        responseNote: quoteNotes[inquiry.id]?.trim() || null,
        availabilityStatus,
      }),
    }), "Resposta enviada. O cliente vai recebê-la na área do evento.");
  }
  async function markInquiryRead(inquiry: Inquiry) {
    await action(() => api(`/vendor-portal/inquiries/${inquiry.id}/read`, { method: "PATCH" }), "Pedido marcado como visto.");
  }
  async function submitVenueInquiryResponse(event: FormEvent<HTMLFormElement>, inquiry: VenueInquiry) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = String(form.get("quotedAmount") ?? "");
    const responseNote = String(form.get("responseNote") ?? "");
    const availabilityStatus = String(form.get("availabilityStatus") ?? "PENDING");
    await action(() => api(`/vendor-portal/venue-inquiries/${inquiry.id}`, { method: "PATCH", body: JSON.stringify({ quotedAmount: amount ? Number(amount) : null, responseNote, availabilityStatus }) }), "Resposta enviada ao cliente.");
  }
  function applyInquirySearch(event: FormEvent) {
    event.preventDefault();
    setInquiryPage(1);
    setInquirySearch(inquirySearchDraft.trim());
  }
  if (loading) return <main className="catalog-page"><p>A carregar a área de fornecedor…</p></main>;
  if (error && !data.vendors.length && !data.claims.length) return <main className="catalog-page"><a className="planner-back" href="/">← Início</a><section className="catalog-empty"><h1>Área de fornecedor</h1><p>{error}</p><a className="button button-primary" href="/entrar">Entrar na conta</a></section></main>;

  return <main className="catalog-page vendor-portal-page">
    <a className="planner-back" href="/dashboard">← Dashboard</a>
    <header className="vendor-portal-heading"><div><p className="eyebrow">Espaço do prestador</p><h1>Área de fornecedor</h1><p>Responde aos clientes e gere a presença do teu negócio num só espaço.</p></div>{selected && <a className="button button-outline" href={`/fornecedores/${selected.slug}`} target="_blank" rel="noreferrer">Ver perfil público ↗</a>}</header>
    {(error || notice) && <p className={error ? "form-error" : "vendor-portal-notice"} role={error ? "alert" : "status"}>{error || notice}</p>}
    {data.vendors.length > 0 ? <>
      {data.vendors.length > 1 && <label className="vendor-portal-select">Perfil<select value={selectedId} onChange={e => setSelectedId(e.target.value)}>{data.vendors.map(v => <option key={v.id} value={v.id}>{v.name} · {v.category}</option>)}</select></label>}
      {selected && <>
        <section className="vendor-portal-status"><div><span className={selected.status === "ACTIVE" ? "verified-badge" : "unverified-badge"}>{profileStatusLabel(selected.status)}</span><h2>{selected.name}</h2><p>{selected.category}{selected.municipality ? ` · ${selected.municipality}` : ""}</p>{selected.status === "PENDING" && <small>A equipa está a rever a apresentação do negócio.</small>}</div><div className="vendor-portal-stats"><span><strong>{data.inquiryMeta.openCount}</strong><small>por responder</small></span><span><strong>{data.inquiryMeta.unreadCount}</strong><small>novos</small></span><span><strong>{selected.reviews.length}</strong><small>avaliações</small></span></div></section>
        <nav className="vendor-portal-tabs" aria-label="Secções da área de fornecedor"><button type="button" className={activeSection === "requests" ? "current" : ""} aria-current={activeSection === "requests" ? "page" : undefined} onClick={() => setActiveSection("requests")}>Pedidos <span>{data.inquiryMeta.openCount}</span></button><button type="button" className={activeSection === "profile" ? "current" : ""} aria-current={activeSection === "profile" ? "page" : undefined} onClick={() => setActiveSection("profile")}>Perfil e portefólio <span>{orderedItems.length}/8</span></button><button type="button" className={activeSection === "reviews" ? "current" : ""} aria-current={activeSection === "reviews" ? "page" : undefined} onClick={() => setActiveSection("reviews")}>Avaliações <span>{selected.reviews.length}</span></button></nav>

        {activeSection === "requests" && <section className="dash-panel vendor-inbox" aria-labelledby="vendor-inbox-title">
          <header className="vendor-inbox-heading"><div><p className="eyebrow">Caixa de entrada</p><h2 id="vendor-inbox-title">Pedidos de clientes</h2><p>Responde aos pedidos e acompanha cada conversa. Os contactos pessoais dos clientes não são partilhados.</p></div><span className="vendor-unread-counter">{data.inquiryMeta.unreadCount} por ver</span></header>
          <div className="vendor-inbox-summary"><span><strong>{data.inquiryMeta.total}</strong> nesta pesquisa</span><span><strong>{data.inquiryMeta.openCount}</strong> por responder</span><span><strong>{data.inquiryMeta.unreadCount}</strong> novos</span></div>
          <div className="vendor-inbox-tools"><form className="vendor-inbox-search" onSubmit={applyInquirySearch}><label className="visually-hidden" htmlFor="vendor-inquiry-search">Pesquisar pedidos</label><input id="vendor-inquiry-search" type="search" maxLength={100} value={inquirySearchDraft} onChange={event => setInquirySearchDraft(event.target.value)} placeholder="Pesquisar por evento, fornecedor ou mensagem"/><button className="button button-outline compact">Pesquisar</button></form><label className="vendor-inquiry-filter">Estado<select value={inquiryStatus} onChange={event => { setInquiryPage(1); setInquiryStatus(event.target.value); }}><option value="ALL">Todos os estados</option><option value="OPEN">Por responder</option><option value="RESPONDED">Respondidos</option><option value="HIRED">Contratados</option><option value="CLOSED">Fechados</option></select></label></div>
          {data.inquiries.length ? <div className="vendor-inbox-list">{data.inquiries.map(inquiry => <article key={inquiry.id} className={!inquiry.vendorViewedAt ? "vendor-inquiry-unread" : ""}><header><div><h3>{inquiry.project.title}</h3><small>{inquiry.vendor.name} · {new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeZone: "Africa/Luanda" }).format(new Date(inquiry.createdAt))}</small></div><div><span className={`vendor-request-status ${inquiry.status.toLowerCase()}`}>{inquiry.status === "NEW" || inquiry.status === "SENT" ? "Por responder" : inquiry.status === "RESPONDED" ? "Respondido" : inquiry.status === "HIRED" ? "Contratado" : "Fechado"}</span>{!inquiry.vendorViewedAt && <span className="vendor-inquiry-new">Novo</span>}</div></header><p>{inquiry.message}</p><div className="vendor-inquiry-meta">{(inquiry.eventDate || inquiry.project.date) && <span>Evento: {new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeZone: "Africa/Luanda" }).format(new Date(inquiry.eventDate || inquiry.project.date!))}</span>}{inquiry.project.province && <span>{inquiry.project.province}</span>}{(inquiry.partySize || inquiry.project.guestEstimate) && <span>{inquiry.partySize || inquiry.project.guestEstimate} pessoas</span>}</div><footer>{inquiry.quotedAmount != null && <strong>{new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(Number(inquiry.quotedAmount))}</strong>}<button type="button" className="button button-outline compact" onClick={() => { setSelectedInquiryId(inquiry.id); if (!inquiry.vendorViewedAt) void markInquiryRead(inquiry); }}>{inquiry.status === "NEW" || inquiry.status === "SENT" ? "Ver e responder" : "Ver pedido"} →</button></footer></article>)}</div> : <div className="vendor-inbox-empty"><span>✉</span><h3>{inquirySearch || inquiryStatus !== "ALL" ? "Nenhum pedido encontrado" : "Ainda não recebeste pedidos"}</h3><p>{inquirySearch || inquiryStatus !== "ALL" ? "Altera a pesquisa ou o estado seleccionado." : "Quando um cliente pedir informações sobre o teu serviço, a conversa vai aparecer aqui."}</p>{(inquirySearch || inquiryStatus !== "ALL") && <button type="button" className="vendor-inquiry-reset" onClick={() => { setInquirySearch(""); setInquirySearchDraft(""); setInquiryStatus("ALL"); setInquiryPage(1); }}>Limpar filtros</button>}</div>}
          <ListPagination page={data.inquiryMeta.page} pageSize={data.inquiryMeta.pageSize} total={data.inquiryMeta.total} label="pedidos" onPageChange={setInquiryPage} onPageSizeChange={(size) => { setInquiryPageSize(size); setInquiryPage(1); }} />
          {data.venueInquiries.length > 0 && <section className="venue-inquiries-inbox"><header><p className="eyebrow">Pedidos de espaços</p><h2>Disponibilidade e orçamento</h2><p>Pedidos associados aos espaços ligados ao teu perfil.</p></header><div className="vendor-inbox-list">{data.venueInquiries.map(inquiry => <article key={inquiry.id}><header><div><h3>{inquiry.venue.name}</h3><small>{inquiry.project?.title ?? inquiry.user.name ?? "Evento"} · {new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeZone: "Africa/Luanda" }).format(new Date(inquiry.createdAt))}</small></div><span className={`vendor-request-status ${inquiry.status.toLowerCase()}`}>{inquiry.status === "RESPONDED" ? "Respondido" : "Por responder"}</span></header><div className="vendor-inquiry-meta">{inquiry.eventDate && <span>Data: {new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeZone: "Africa/Luanda" }).format(new Date(inquiry.eventDate))}</span>}{inquiry.partySize && <span>{inquiry.partySize} pessoas</span>}</div><p>{inquiry.message}</p>{inquiry.responseNote && <p><strong>Resposta enviada:</strong> {inquiry.responseNote}</p>}<form className="vendor-inquiry-response" onSubmit={event => void submitVenueInquiryResponse(event, inquiry)}><label>Disponibilidade<select name="availabilityStatus" defaultValue={inquiry.availabilityStatus}><option value="PENDING">Por confirmar</option><option value="AVAILABLE">Disponível</option><option value="UNAVAILABLE">Indisponível</option><option value="ALTERNATIVE_PROPOSED">Propor alternativa</option></select></label><label>Valor proposto (Kz)<input name="quotedAmount" type="number" min="0" step="1" defaultValue={inquiry.quotedAmount ?? ""}/></label><label>Resposta<textarea name="responseNote" required minLength={8} maxLength={2000} defaultValue={inquiry.responseNote ?? ""} placeholder="Indica disponibilidade, condições e próximos passos."/></label><button className="button button-primary" disabled={busy}>{inquiry.status === "RESPONDED" ? "Actualizar resposta" : "Responder ao pedido"}</button></form></article>)}</div></section>}
        </section>}

        {activeSection === "profile" && <div className="vendor-profile-section"><div className="vendor-section-intro"><div><p className="eyebrow">Presença pública</p><h2>Perfil e portefólio</h2><p>Actualiza as informações do negócio e escolhe os trabalhos que queres mostrar.</p></div><span>{orderedItems.length}/8 imagens</span></div><div className="vendor-portal-grid">
          <form className="dash-panel vendor-portal-form" onSubmit={submitProfile}><p className="eyebrow">Perfil público</p><h2>Descrição e ligações</h2>{pendingSubmission && <p className="vendor-pending-note">Tens uma alteração enviada em {new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium" }).format(new Date(pendingSubmission.createdAt))}. Aguarda revisão antes de enviar outra.</p>}{selected.profileSubmissions.filter(s => s.status === "REJECTED").slice(0, 1).map(s => <p className="vendor-rejected-note" key={s.id}>Última alteração recusada: {s.reason || "revê os dados e tenta novamente."}</p>)}<label>Sobre o serviço<textarea maxLength={2000} value={description} onChange={e => setDescription(e.target.value)}/></label><label>Serviços, um por linha<textarea value={servicesText} onChange={e => setServicesText(e.target.value)}/></label><label>Zonas atendidas, uma por linha<textarea value={areasText} onChange={e => setAreasText(e.target.value)}/></label><h3>Redes sociais e site</h3><p className="empty-copy">Usa endereços HTTPS completos, por exemplo https://instagram.com/nomedonegocio.</p><label>Site / portefólio<input type="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://…"/></label><label>Instagram<input type="url" value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/…"/></label><label>Facebook<input type="url" value={facebookUrl} onChange={e => setFacebookUrl(e.target.value)} placeholder="https://facebook.com/…"/></label><label>TikTok<input type="url" value={tiktokUrl} onChange={e => setTiktokUrl(e.target.value)} placeholder="https://tiktok.com/@…"/></label><button className="button button-primary" disabled={busy || Boolean(pendingSubmission)}>{busy ? "A enviar…" : "Enviar alterações para revisão"}</button></form>
          <div className="vendor-portal-stack"><form className="dash-panel vendor-portfolio-upload" onSubmit={submitImage}><p className="eyebrow">Trabalhos reais</p><h2>Adicionar imagem</h2><p>Carregamos e optimizamos JPEG, PNG e WebP até 8 MB. Máximo de 8 imagens por perfil.</p><label>Imagem<input id="vendor-portfolio-file" type="file" accept="image/jpeg,image/png,image/webp" required onChange={e => setImageFile(e.target.files?.[0] ?? null)}/></label><label>Descrição acessível da imagem<input required minLength={8} maxLength={180} value={altText} onChange={e => setAltText(e.target.value)} placeholder="Ex.: Decoração floral numa cerimónia em Luanda"/></label><button className="button button-primary" disabled={busy || orderedItems.length >= 8}>{busy ? "A carregar…" : "Carregar para revisão"}</button></form>
            <section className="dash-panel vendor-portfolio-manager"><div className="panel-title"><div><p className="eyebrow">Portefólio</p><h2>As tuas imagens</h2></div></div>{selected.portfolio.length ? <div className="vendor-portal-gallery">{selected.portfolio.map(item => <article key={item.id} className={item.status === "REJECTED" ? "rejected" : ""}><img src={`/api/v1/vendor-portal/${selected.id}/portfolio/${item.id}/image`} alt={item.altText}/><div className="vendor-portfolio-item-copy"><strong>{item.altText}</strong><span className={`vendor-content-status ${item.status.toLowerCase()}`}>{statusLabel(item.status)}{item.isCover ? " · capa" : ""}</span>{item.status === "REJECTED" && item.rejectionReason && <small>{item.rejectionReason}</small>}</div>{item.status !== "REJECTED" && <div className="vendor-portfolio-item-actions"><button type="button" disabled={busy} onClick={() => void moveItem(item, -1)} aria-label="Mover imagem para cima">↑</button><button type="button" disabled={busy} onClick={() => void moveItem(item, 1)} aria-label="Mover imagem para baixo">↓</button><button type="button" disabled={busy || item.isCover} onClick={() => void makeCover(item)}>{item.isCover ? "Capa" : "Definir capa"}</button></div>}<button type="button" className="vendor-remove-image" disabled={busy} onClick={() => void removeItem(item)}>Remover</button></article>)}</div> : <p className="profile-missing">Ainda não adicionaste imagens. As imagens carregadas passam por revisão antes de aparecerem no perfil.</p>}</section></div>
        </div></div>}

        {activeSection === "reviews" && <section className="vendor-supplier-reviews vendor-reviews-section"><header><div><p className="eyebrow">Experiências partilhadas</p><h2>Avaliações dos clientes</h2></div><span>{selected.reviews.length}</span></header>{selected.reviews.length ? <PaginatedList items={selected.reviews} label="avaliações">{review => <article key={review.id}><div className="vendor-supplier-review-heading"><strong>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)} · {review.reviewerName || "Cliente anónimo"}</strong><small>{review.quoteRequest.project.title} · {new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeZone: "Africa/Luanda" }).format(new Date(review.createdAt))}</small></div>{review.comment && <p>{review.comment}</p>}<small>Qualidade {review.qualityRating}/5 · Comunicação {review.communicationRating}/5 · Pontualidade {review.punctualityRating}/5 · contratação registada no evento</small>{review.responseStatus === "APPROVED" && review.response ? <blockquote><strong>A tua resposta publicada</strong><br/>{review.response}</blockquote> : review.responseStatus === "PENDING" ? <p className="vendor-pending-note">A tua resposta está à espera de revisão.</p> : <form onSubmit={event => void submitReviewReply(event, review)}><label>{review.responseStatus === "REJECTED" ? `Resposta recusada: ${review.responseReason || "revê o texto e tenta novamente."} · Nova resposta` : "Responder publicamente"}<textarea required minLength={8} maxLength={1500} value={replyDrafts[review.id] ?? (review.responseStatus === "REJECTED" ? review.response ?? "" : "")} onChange={e => setReplyDrafts(current => ({ ...current, [review.id]: e.target.value }))} placeholder="Agradece o comentário ou esclarece a experiência com respeito."/></label><button className="button button-outline" disabled={busy}>{busy ? "A enviar…" : "Enviar resposta para revisão"}</button><small>A equipa revê as respostas antes de as publicar.</small></form>}</article>}</PaginatedList> : <p className="profile-missing">As avaliações aprovadas dos teus serviços contratados aparecerão aqui.</p>}</section>}
      </>}
    </> : <section className="vendor-claim-workspace"><p className="eyebrow">Acesso ao perfil</p><h2>Ainda não tens um perfil associado</h2><p>Se o teu negócio já aparece no directório, pede para associar o perfil existente. Se ainda não está listado, cria o teu perfil profissional e envia-o para revisão.</p><div className="vendor-auth-actions"><a className="button button-primary" href="/fornecedores/aderir">Criar perfil do meu negócio</a><a className="button button-outline" href="/fornecedores">Encontrar perfil existente</a></div>{data.claims.length > 0 && <div className="vendor-claim-list"><h3>Pedidos de acesso</h3><PaginatedList items={data.claims} label="pedidos de acesso">{claim => <article key={claim.id}><strong>{claim.vendor.name}</strong><span className={`vendor-content-status ${claim.status.toLowerCase()}`}>{statusLabel(claim.status)}</span>{claim.reason && <small>{claim.reason}</small>}</article>}</PaginatedList></div>}</section>}
    {selectedInquiry && <div className="vendor-inquiry-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedInquiryId(""); }}><section className="vendor-inquiry-drawer" role="dialog" aria-modal="true" aria-labelledby="vendor-inquiry-title"><header><div><p className="eyebrow">Pedido de cliente · {selectedInquiry.vendor.name}</p><h2 id="vendor-inquiry-title">{selectedInquiry.project.title}</h2><small>Recebido em {new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeZone: "Africa/Luanda" }).format(new Date(selectedInquiry.createdAt))}</small></div><button type="button" aria-label="Fechar pedido" onClick={() => setSelectedInquiryId("")}>×</button></header><span className={`vendor-request-status ${selectedInquiry.status.toLowerCase()}`}>{selectedInquiry.status === "NEW" || selectedInquiry.status === "SENT" ? "Por responder" : selectedInquiry.status === "RESPONDED" ? "Respondido" : selectedInquiry.status === "HIRED" ? "Contratado" : "Fechado"}</span><div className="vendor-inquiry-drawer-meta">{(selectedInquiry.eventDate || selectedInquiry.project.date) && <span>Data: {new Intl.DateTimeFormat("pt-AO", { dateStyle: "long", timeZone: "Africa/Luanda" }).format(new Date(selectedInquiry.eventDate || selectedInquiry.project.date!))}</span>}{selectedInquiry.project.province && <span>Local: {selectedInquiry.project.province}</span>}{(selectedInquiry.partySize || selectedInquiry.project.guestEstimate) && <span>Convidados: cerca de {selectedInquiry.partySize || selectedInquiry.project.guestEstimate}</span>}</div><section className="vendor-inquiry-message"><h3>Mensagem</h3><p>{selectedInquiry.message}</p></section>{selectedInquiry.responseNote && selectedInquiry.status !== "NEW" && selectedInquiry.status !== "SENT" && <section className="vendor-inquiry-message"><h3>A tua resposta anterior</h3><p>{selectedInquiry.responseNote}</p>{selectedInquiry.quotedAmount != null && <strong>{new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(Number(selectedInquiry.quotedAmount))}</strong>}</section>}{selectedInquiry.status !== "HIRED" && selectedInquiry.status !== "CLOSED" ? <form className="vendor-inquiry-response" onSubmit={event => void submitInquiryResponse(event, selectedInquiry)}><h3>{selectedInquiry.status === "RESPONDED" ? "Actualizar resposta" : "Responder ao cliente"}</h3><label>Disponibilidade<select name="availabilityStatus" defaultValue={selectedInquiry.availabilityStatus ?? "PENDING"}><option value="PENDING">Por confirmar</option><option value="AVAILABLE">Disponível</option><option value="UNAVAILABLE">Indisponível</option><option value="ALTERNATIVE_PROPOSED">Propor alternativa</option></select></label><label>Valor proposto (Kz)<input type="number" min="0" step="1" value={quoteAmounts[selectedInquiry.id] ?? (selectedInquiry.quotedAmount == null ? "" : String(selectedInquiry.quotedAmount))} onChange={event => setQuoteAmounts(current => ({ ...current, [selectedInquiry.id]: event.target.value }))}/></label><label>Mensagem<textarea required minLength={8} maxLength={2000} value={quoteNotes[selectedInquiry.id] ?? selectedInquiry.responseNote ?? ""} onChange={event => setQuoteNotes(current => ({ ...current, [selectedInquiry.id]: event.target.value }))} placeholder="Partilha disponibilidade, condições e próximos passos."/></label><button className="button button-primary" disabled={busy}>{busy ? "A enviar…" : selectedInquiry.status === "RESPONDED" ? "Actualizar resposta" : "Enviar resposta"}</button><small>O cliente receberá disponibilidade e resposta na área do evento.</small></form> : <p className="vendor-inquiry-closed">Este pedido está fechado. Já não é possível enviar uma nova resposta.</p>}</section></div>}
  </main>;
}
