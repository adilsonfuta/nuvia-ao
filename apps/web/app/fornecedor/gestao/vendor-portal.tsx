"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

type PortfolioItem = { id: string; altText: string; sortOrder: number; isCover: boolean; status: "PENDING" | "APPROVED" | "REJECTED"; rejectionReason: string | null; imageUrl?: string };
type Submission = { id: string; status: "PENDING" | "APPROVED" | "REJECTED"; reason: string | null; createdAt: string };
type SupplierReview = { id: string; rating: number; communicationRating: number; punctualityRating: number; qualityRating: number; comment: string | null; isAnonymous: boolean; createdAt: string; reviewerName: string | null; response: string | null; responseStatus: "PENDING" | "APPROVED" | "REJECTED" | null; responseReason: string | null; quoteRequest: { project: { title: string; date: string | null } } };
type VendorProfile = {
  id: string; slug: string; name: string; category: string; status: string; description: string | null;
  services: string[]; serviceAreas: string[]; websiteUrl: string | null; instagramUrl: string | null;
  facebookUrl: string | null; tiktokUrl: string | null; portfolio: PortfolioItem[];
  profileSubmissions: Submission[]; reviews: SupplierReview[];
};
type Claim = { id: string; status: "PENDING" | "APPROVED" | "REJECTED"; reason: string | null; createdAt: string; vendor: { id: string; name: string; slug: string; status: string } };
type PortalData = { vendors: VendorProfile[]; claims: Claim[] };
const lines = (value: string) => value.split("\n").map((part) => part.trim()).filter(Boolean);
const statusLabel = (status: string) => status === "PENDING" ? "À espera de revisão" : status === "APPROVED" ? "Publicado" : "Precisa de alterações";
const profileStatusLabel = (status: string) => status === "ACTIVE" ? "Perfil activo" : status === "SUSPENDED" ? "Perfil suspenso" : "Perfil em revisão";

export default function VendorPortal() {
  const [data, setData] = useState<PortalData>({ vendors: [], claims: [] });
  const [selectedId, setSelectedId] = useState("");
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

  const refresh = async () => {
    const next = await api<PortalData>("/vendor-portal");
    setData(next);
    const selected = next.vendors.find((item) => item.id === selectedId) ?? next.vendors[0];
    setSelectedId(selected?.id ?? "");
    if (selected) {
      setDescription(selected.description ?? "");
      setServicesText(selected.services.join("\n"));
      setAreasText(selected.serviceAreas.join("\n"));
      setWebsiteUrl(selected.websiteUrl ?? "");
      setInstagramUrl(selected.instagramUrl ?? "");
      setFacebookUrl(selected.facebookUrl ?? "");
      setTiktokUrl(selected.tiktokUrl ?? "");
    }
  };

  useEffect(() => { void refresh().catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  const selected = useMemo(() => data.vendors.find((item) => item.id === selectedId) ?? null, [data.vendors, selectedId]);
  const orderedItems = useMemo(() => selected?.portfolio.filter((item) => item.status !== "REJECTED").slice().sort((a, b) => a.sortOrder - b.sortOrder) ?? [], [selected]);
  const pendingSubmission = selected?.profileSubmissions.find((item) => item.status === "PENDING");

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
  if (loading) return <main className="catalog-page"><p>A carregar a área de fornecedor…</p></main>;
  if (error && !data.vendors.length && !data.claims.length) return <main className="catalog-page"><a className="planner-back" href="/">← Início</a><section className="catalog-empty"><h1>Área de fornecedor</h1><p>{error}</p><a className="button button-primary" href="/entrar">Entrar na conta</a></section></main>;

  return <main className="catalog-page vendor-portal-page">
    <a className="planner-back" href="/dashboard">← Dashboard</a>
    <header className="vendor-portal-heading"><div><p className="eyebrow">Espaço do prestador</p><h1>Área de fornecedor</h1><p>Actualiza o perfil e o portefólio. O conteúdo novo só aparece publicamente depois da revisão.</p></div>{selected && <a className="button button-outline" href={`/fornecedores/${selected.slug}`} target="_blank" rel="noreferrer">Ver perfil público ↗</a>}</header>
    {(error || notice) && <p className={error ? "form-error" : "vendor-portal-notice"} role={error ? "alert" : "status"}>{error || notice}</p>}
    {data.vendors.length > 0 ? <>
      {data.vendors.length > 1 && <label className="vendor-portal-select">Perfil<select value={selectedId} onChange={e => setSelectedId(e.target.value)}>{data.vendors.map(v => <option key={v.id} value={v.id}>{v.name} · {v.category}</option>)}</select></label>}
      {selected && <>
        <section className="vendor-portal-status"><div><span className={selected.status === "ACTIVE" ? "verified-badge" : "unverified-badge"}>{profileStatusLabel(selected.status)}</span><h2>{selected.name}</h2><p>{selected.category} · {selected.slug}</p>{selected.status === "PENDING" && <small>A equipa está a rever a apresentação do negócio. Podes preparar imagens enquanto isso.</small>}</div><div><strong>{orderedItems.length}/8</strong><small>imagens no portefólio</small></div></section>
        <div className="vendor-portal-grid">
          <form className="dash-panel vendor-portal-form" onSubmit={submitProfile}>
            <p className="eyebrow">Perfil público</p><h2>Descrição e ligações</h2>
            {pendingSubmission && <p className="vendor-pending-note">Tens uma alteração enviada em {new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium" }).format(new Date(pendingSubmission.createdAt))}. Aguarda revisão antes de enviar outra.</p>}
            {selected.profileSubmissions.filter(s => s.status === "REJECTED").slice(0, 1).map(s => <p className="vendor-rejected-note" key={s.id}>Última alteração recusada: {s.reason || "revê os dados e tenta novamente."}</p>)}
            <label>Sobre o serviço<textarea maxLength={2000} value={description} onChange={e => setDescription(e.target.value)}/></label>
            <label>Serviços, um por linha<textarea value={servicesText} onChange={e => setServicesText(e.target.value)}/></label>
            <label>Zonas atendidas, uma por linha<textarea value={areasText} onChange={e => setAreasText(e.target.value)}/></label>
            <h3>Redes sociais e site</h3><p className="empty-copy">Usa endereços HTTPS completos, por exemplo https://instagram.com/nomedonegocio.</p>
            <label>Site / portefólio<input type="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://…"/></label>
            <label>Instagram<input type="url" value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/…"/></label>
            <label>Facebook<input type="url" value={facebookUrl} onChange={e => setFacebookUrl(e.target.value)} placeholder="https://facebook.com/…"/></label>
            <label>TikTok<input type="url" value={tiktokUrl} onChange={e => setTiktokUrl(e.target.value)} placeholder="https://tiktok.com/@…"/></label>
            <button className="button button-primary" disabled={busy || Boolean(pendingSubmission)}>{busy ? "A enviar…" : "Enviar alterações para revisão"}</button>
          </form>
          <div className="vendor-portal-stack">
            <form className="dash-panel vendor-portfolio-upload" onSubmit={submitImage}>
              <p className="eyebrow">Trabalhos reais</p><h2>Adicionar imagem</h2><p>Carregamos e optimizamos JPEG, PNG e WebP até 8 MB. Máximo de 8 imagens por perfil.</p>
              <label>Imagem<input id="vendor-portfolio-file" type="file" accept="image/jpeg,image/png,image/webp" required onChange={e => setImageFile(e.target.files?.[0] ?? null)}/></label>
              <label>Descrição acessível da imagem<input required minLength={8} maxLength={180} value={altText} onChange={e => setAltText(e.target.value)} placeholder="Ex.: Decoração floral numa cerimónia em Luanda"/></label>
              <button className="button button-primary" disabled={busy || orderedItems.length >= 8}>{busy ? "A carregar…" : "Carregar para revisão"}</button>
            </form>
            <section className="dash-panel vendor-portfolio-manager"><div className="panel-title"><div><p className="eyebrow">Portefólio</p><h2>As tuas imagens</h2></div></div>
              {selected.portfolio.length ? <div className="vendor-portal-gallery">{selected.portfolio.map(item => <article key={item.id} className={item.status === "REJECTED" ? "rejected" : ""}><img src={`/api/v1/vendor-portal/${selected.id}/portfolio/${item.id}/image`} alt={item.altText}/><div className="vendor-portfolio-item-copy"><strong>{item.altText}</strong><span className={`vendor-content-status ${item.status.toLowerCase()}`}>{statusLabel(item.status)}{item.isCover ? " · capa" : ""}</span>{item.status === "REJECTED" && item.rejectionReason && <small>{item.rejectionReason}</small>}</div>{item.status !== "REJECTED" && <div className="vendor-portfolio-item-actions"><button type="button" disabled={busy} onClick={() => void moveItem(item, -1)} aria-label="Mover imagem para cima">↑</button><button type="button" disabled={busy} onClick={() => void moveItem(item, 1)} aria-label="Mover imagem para baixo">↓</button><button type="button" disabled={busy || item.isCover} onClick={() => void makeCover(item)}>{item.isCover ? "Capa" : "Definir capa"}</button></div>}<button type="button" className="vendor-remove-image" disabled={busy} onClick={() => void removeItem(item)}>Remover</button></article>)}</div> : <p className="profile-missing">Ainda não adicionaste imagens. As imagens carregadas passam por revisão antes de aparecerem no perfil.</p>}
            </section>
          </div>
        </div>
        <section className="dash-panel vendor-supplier-reviews"><header><div><p className="eyebrow">Experiências partilhadas</p><h2>Avaliações dos clientes</h2></div><span>{selected.reviews.length}</span></header>{selected.reviews.length ? selected.reviews.map(review => <article key={review.id}><div className="vendor-supplier-review-heading"><strong>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)} · {review.reviewerName || "Cliente anónimo"}</strong><small>{review.quoteRequest.project.title} · {new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeZone: "Africa/Luanda" }).format(new Date(review.createdAt))}</small></div>{review.comment && <p>{review.comment}</p>}<small>Qualidade {review.qualityRating}/5 · Comunicação {review.communicationRating}/5 · Pontualidade {review.punctualityRating}/5 · contratação registada no evento</small>{review.responseStatus === "APPROVED" && review.response ? <blockquote><strong>A tua resposta publicada</strong><br/>{review.response}</blockquote> : review.responseStatus === "PENDING" ? <p className="vendor-pending-note">A tua resposta está à espera de revisão.</p> : <form onSubmit={event => void submitReviewReply(event, review)}><label>{review.responseStatus === "REJECTED" ? `Resposta recusada: ${review.responseReason || "revê o texto e tenta novamente."} · Nova resposta` : "Responder publicamente"}<textarea required minLength={8} maxLength={1500} value={replyDrafts[review.id] ?? (review.responseStatus === "REJECTED" ? review.response ?? "" : "")} onChange={event => setReplyDrafts(current => ({ ...current, [review.id]: event.target.value }))} placeholder="Agradece o comentário ou esclarece a experiência com respeito."/></label><button className="button button-outline" disabled={busy}>{busy ? "A enviar…" : "Enviar resposta para revisão"}</button><small>A equipa revê as respostas antes de as publicar.</small></form>}</article>) : <p className="profile-missing">As avaliações aprovadas dos teus serviços contratados aparecerão aqui.</p>}</section>
      </>}
    </> : <section className="vendor-claim-workspace"><p className="eyebrow">Acesso ao perfil</p><h2>Ainda não tens um perfil associado</h2><p>Se o teu negócio já aparece no directório, pede para associar o perfil existente. Se ainda não está listado, cria o teu perfil profissional e envia-o para revisão.</p><div className="vendor-auth-actions"><a className="button button-primary" href="/fornecedores/aderir">Criar perfil do meu negócio</a><a className="button button-outline" href="/fornecedores">Encontrar perfil existente</a></div>{data.claims.length > 0 && <div className="vendor-claim-list"><h3>Pedidos de acesso</h3>{data.claims.map(claim => <article key={claim.id}><strong>{claim.vendor.name}</strong><span className={`vendor-content-status ${claim.status.toLowerCase()}`}>{statusLabel(claim.status)}</span>{claim.reason && <small>{claim.reason}</small>}</article>)}</div>}</section>}
  </main>;
}
