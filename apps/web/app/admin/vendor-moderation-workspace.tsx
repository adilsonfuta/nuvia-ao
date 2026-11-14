"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";

type VendorClaim = { id: string; message: string; createdAt: string; vendor: { id: string; name: string; slug: string }; user: { name: string | null; email: string } };
type PortfolioReview = { id: string; altText: string; isCover: boolean; uploadedAt: string; vendor: { id: string; name: string; slug: string }; uploader: { name: string | null; email: string } | null };
type ProfileReview = { id: string; payload: Record<string, unknown>; createdAt: string; vendor: { id: string; name: string; slug: string }; submitter: { name: string | null; email: string } | null };
type RatingReview = { id: string; rating: number; communicationRating: number; punctualityRating: number; qualityRating: number; comment: string | null; isAnonymous: boolean; status: "PENDING" | "APPROVED" | "REJECTED"; response: string | null; responseStatus: "PENDING" | "APPROVED" | "REJECTED" | null; createdAt: string; vendor: { id: string; name: string; slug: string }; reviewer: { name: string | null; email: string } | null; quoteRequest: { project: { title: string; date: string | null; kind: string } } };
type QueueTab = "claims" | "portfolio" | "profiles" | "reviews" | "replies";
type Decision = { kind: QueueTab; id: string; title: string };

export function VendorModerationWorkspace() {
  const [claims, setClaims] = useState<VendorClaim[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioReview[]>([]);
  const [profiles, setProfiles] = useState<ProfileReview[]>([]);
  const [reviews, setReviews] = useState<RatingReview[]>([]);
  const [tab, setTab] = useState<QueueTab>("claims");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    const [nextClaims, nextPortfolio, nextProfiles, nextReviews] = await Promise.all([
      api<VendorClaim[]>("/admin/vendor-claims"),
      api<PortfolioReview[]>("/admin/vendor-portfolio"),
      api<ProfileReview[]>("/admin/vendor-profile-submissions"),
      api<RatingReview[]>("/admin/vendor-reviews"),
    ]);
    setClaims(nextClaims); setPortfolio(nextPortfolio); setProfiles(nextProfiles); setReviews(nextReviews);
  }
  useEffect(() => { void refresh().catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);

  async function perform(path: string, status: "APPROVED" | "REJECTED", rejectionReason?: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const body = { status, ...(rejectionReason ? { reason: rejectionReason } : {}) };
      await api(path, { method: "PATCH", body: JSON.stringify(body) });
      await refresh();
      setNotice(status === "APPROVED" ? "Alteração aprovada e publicada." : "Alteração recusada; o motivo ficou registado.");
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível guardar a decisão."); return false; }
    finally { setBusy(false); }
  }
  function askRejection(kind: QueueTab, id: string, title: string) { setDecision({ kind, id, title }); setReason(""); }
  async function saveRejection(event: FormEvent) {
    event.preventDefault();
    if (!decision || reason.trim().length < 8) return;
    const path = decision.kind === "claims" ? `/admin/vendor-claims/${decision.id}` : decision.kind === "portfolio" ? `/admin/vendor-portfolio/${decision.id}` : decision.kind === "profiles" ? `/admin/vendor-profile-submissions/${decision.id}` : `/admin/vendor-reviews/${decision.id}/${decision.kind === "reviews" ? "review" : "response"}`;
    if (await perform(path, "REJECTED", reason.trim())) setDecision(null);
  }
  const approve = (kind: QueueTab, id: string) => {
    const path = kind === "claims" ? `/admin/vendor-claims/${id}` : kind === "portfolio" ? `/admin/vendor-portfolio/${id}` : kind === "profiles" ? `/admin/vendor-profile-submissions/${id}` : `/admin/vendor-reviews/${id}/${kind === "reviews" ? "review" : "response"}`;
    void perform(path, "APPROVED");
  };

  return <div className="vendor-review-workspace">
    <header className="vendor-review-heading"><div><p className="eyebrow">Confiança e qualidade</p><h2>Revisão de fornecedores</h2><p>Confirma pedidos de acesso e revê perfis, imagens, avaliações e respostas antes de as publicar.</p></div><span>{claims.length + portfolio.length + profiles.length + reviews.filter(item => item.status === "PENDING").length + reviews.filter(item => item.responseStatus === "PENDING").length} pendentes</span></header>
    {(error || notice) && <p className={error ? "form-error" : "dashboard-notice"} role={error ? "alert" : "status"}>{error || notice}</p>}
    <nav className="vendor-review-tabs" aria-label="Filas de revisão">{([ ["claims", `Pedidos de acesso · ${claims.length}`], ["portfolio", `Imagens · ${portfolio.length}`], ["profiles", `Alterações de perfil · ${profiles.length}`], ["reviews", `Avaliações · ${reviews.filter(item => item.status === "PENDING").length}`], ["replies", `Respostas · ${reviews.filter(item => item.responseStatus === "PENDING").length}`] ] as const).map(([key, label]) => <button key={key} className={tab === key ? "current" : ""} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {loading ? <p className="empty-copy">A carregar a fila…</p> : <>
      {tab === "claims" && (claims.length ? <div className="vendor-review-list">{claims.map(item => <article className="dash-panel vendor-review-card" key={item.id}><div className="vendor-review-card-heading"><div><p className="eyebrow">Pedido de acesso</p><h3>{item.vendor.name}</h3><a href={`/fornecedores/${item.vendor.slug}`} target="_blank" rel="noreferrer">Ver perfil público ↗</a></div><time>{new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium" }).format(new Date(item.createdAt))}</time></div><p><strong>{item.user.name || item.user.email}</strong> · {item.user.email}</p><blockquote>{item.message}</blockquote><p className="vendor-review-caution">A aprovação associa o perfil à conta e dá acesso para editar o perfil e gerir imagens.</p><div className="vendor-review-actions"><button className="button button-outline" disabled={busy} onClick={() => askRejection("claims", item.id, item.vendor.name)}>Recusar com motivo</button><button className="button button-primary" disabled={busy} onClick={() => approve("claims", item.id)}>Aprovar associação</button></div></article>)}</div> : <EmptyQueue text="Não há pedidos de acesso por rever." />)}
      {tab === "portfolio" && (portfolio.length ? <div className="vendor-review-grid">{portfolio.map(item => <article className="dash-panel vendor-review-media-card" key={item.id}><img src={`/api/v1/admin/vendor-portfolio/${item.id}/image`} alt={item.altText}/><div><p className="eyebrow">{item.vendor.name}{item.isCover ? " · capa proposta" : ""}</p><h3>{item.altText}</h3><small>Enviada por {item.uploader?.name || item.uploader?.email || "conta de fornecedor"} · {new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium" }).format(new Date(item.uploadedAt))}</small><a href={`/fornecedores/${item.vendor.slug}`} target="_blank" rel="noreferrer">Ver perfil público ↗</a><div className="vendor-review-actions"><button className="button button-outline" disabled={busy} onClick={() => askRejection("portfolio", item.id, item.altText)}>Recusar com motivo</button><button className="button button-primary" disabled={busy} onClick={() => approve("portfolio", item.id)}>Aprovar imagem</button></div></div></article>)}</div> : <EmptyQueue text="Não há imagens à espera de revisão." />)}
      {tab === "profiles" && (profiles.length ? <div className="vendor-review-list">{profiles.map(item => <article className="dash-panel vendor-review-card" key={item.id}><div className="vendor-review-card-heading"><div><p className="eyebrow">Alteração de perfil</p><h3>{item.vendor.name}</h3><a href={`/fornecedores/${item.vendor.slug}`} target="_blank" rel="noreferrer">Ver perfil público ↗</a></div><small>Enviada por {item.submitter?.name || item.submitter?.email || "prestador"}</small></div><p>{String(item.payload.description || "Sem descrição submetida")}</p><div className="vendor-review-link-list">{([ ["Site", "websiteUrl"], ["Instagram", "instagramUrl"], ["Facebook", "facebookUrl"], ["TikTok", "tiktokUrl"] ] as const).map(([label, key]) => item.payload[key] ? <a key={key} href={String(item.payload[key])} target="_blank" rel="noreferrer">{label} ↗</a> : null)}</div><p><strong>Serviços:</strong> {Array.isArray(item.payload.services) ? item.payload.services.join(" · ") : "—"}</p><p><strong>Zonas:</strong> {Array.isArray(item.payload.serviceAreas) ? item.payload.serviceAreas.join(" · ") : "—"}</p><div className="vendor-review-actions"><button className="button button-outline" disabled={busy} onClick={() => askRejection("profiles", item.id, item.vendor.name)}>Recusar com motivo</button><button className="button button-primary" disabled={busy} onClick={() => approve("profiles", item.id)}>Aprovar alterações</button></div></article>)}</div> : <EmptyQueue text="Não há alterações de perfil à espera de revisão." />)}
      {tab === "reviews" && (reviews.filter(item => item.status === "PENDING").length ? <div className="vendor-review-list">{reviews.filter(item => item.status === "PENDING").map(item => <article className="dash-panel vendor-review-card" key={item.id}><div className="vendor-review-card-heading"><div><p className="eyebrow">Avaliação de serviço contratado</p><h3>{item.vendor.name} · {item.rating}/5 ★</h3></div><small>{item.quoteRequest.project.title} · {item.reviewer?.name || item.reviewer?.email || "Conta removida"}{item.isAnonymous ? " · publicação anónima" : " · nome autorizado"}</small></div><p>Qualidade {item.qualityRating}/5 · Comunicação {item.communicationRating}/5 · Pontualidade {item.punctualityRating}/5</p>{item.comment && <blockquote>{item.comment}</blockquote>}<p className="vendor-review-caution">Apenas membros do evento puderam avaliar um serviço contratado depois da data registada.</p><div className="vendor-review-actions"><button className="button button-outline" disabled={busy} onClick={() => askRejection("reviews", item.id, item.vendor.name)}>Recusar com motivo</button><button className="button button-primary" disabled={busy} onClick={() => approve("reviews", item.id)}>Aprovar avaliação</button></div></article>)}</div> : <EmptyQueue text="Não há avaliações à espera de revisão." />)}
      {tab === "replies" && (reviews.filter(item => item.responseStatus === "PENDING").length ? <div className="vendor-review-list">{reviews.filter(item => item.responseStatus === "PENDING").map(item => <article className="dash-panel vendor-review-card" key={item.id}><div className="vendor-review-card-heading"><div><p className="eyebrow">Resposta do prestador</p><h3>{item.vendor.name} · resposta à avaliação {item.rating}/5</h3></div><small>{item.quoteRequest.project.title}</small></div><blockquote>{item.response}</blockquote><div className="vendor-review-actions"><button className="button button-outline" disabled={busy} onClick={() => askRejection("replies", item.id, item.vendor.name)}>Recusar com motivo</button><button className="button button-primary" disabled={busy} onClick={() => approve("replies", item.id)}>Aprovar resposta</button></div></article>)}</div> : <EmptyQueue text="Não há respostas de fornecedores à espera de revisão." />)}
    </>}
    {decision && <div className="admin-dialog-backdrop"><form className="admin-reason-dialog" onSubmit={saveRejection}><button type="button" className="admin-dialog-close" aria-label="Fechar" onClick={() => setDecision(null)}>×</button><p className="eyebrow">Motivo obrigatório</p><h2>Recusar conteúdo</h2><p>O motivo será guardado no histórico para <strong>{decision.title}</strong>.</p><label>Motivo<textarea autoFocus minLength={8} maxLength={500} required value={reason} onChange={e => setReason(e.target.value)}/></label><small>{reason.trim().length}/500 caracteres · mínimo 8</small><div><button type="button" className="button button-outline" disabled={busy} onClick={() => setDecision(null)}>Cancelar</button><button className="button button-primary" disabled={busy || reason.trim().length < 8}>{busy ? "A guardar…" : "Confirmar recusa"}</button></div></form></div>}
  </div>;
}

function EmptyQueue({ text }: { text: string }) { return <section className="vendor-review-empty"><span aria-hidden="true">✓</span><h3>Fila limpa</h3><p>{text}</p></section>; }
