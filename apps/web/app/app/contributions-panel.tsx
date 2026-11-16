"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { formatAOA } from "../lib/format";
import "./contributions.css";

type ContributionStatus = "PENDING" | "CONFIRMED" | "REJECTED";
type Campaign = { id: string; enabled: boolean; purpose: string; instructions: string; proofRequired: boolean; allowExpenseSelection: boolean; showProgress: boolean; goalAmount: number | string | null; sharePath: string; updatedAt: string };
type Contribution = { id: string; contributorName: string | null; isAnonymous: boolean; amount: number | string; paymentMethod: "BANK_TRANSFER" | "MOBILE_MONEY" | "CASH" | "OTHER"; message: string | null; status: ContributionStatus; reviewNote: string | null; createdAt: string; hasProof: boolean; expense: { id: string; title: string } | null };
type Result = { campaign: Campaign | null; contributions: Contribution[]; summary: { pending: number; confirmed: number; confirmedAmount: number }; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
type ExpenseOption = { id: string; title: string; amount: string | number; status: string };
const statusText: Record<ContributionStatus, string> = { PENDING: "Por confirmar", CONFIRMED: "Confirmada", REJECTED: "Recusada" };
const methodText = { BANK_TRANSFER: "Transferência", MOBILE_MONEY: "Pagamento móvel", CASH: "Numerário", OTHER: "Outro" };
const dateText = (value: string) => new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Luanda" }).format(new Date(value));

export function ContributionsPanel({ projectId, expenses, canEdit }: { projectId: string; expenses: ExpenseOption[]; canEdit: boolean }) {
  const [data, setData] = useState<Result | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [purpose, setPurpose] = useState("Apoio ao evento");
  const [instructions, setInstructions] = useState("");
  const [proofRequired, setProofRequired] = useState(false);
  const [allowExpenseSelection, setAllowExpenseSelection] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [goalAmount, setGoalAmount] = useState("");
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [origin, setOrigin] = useState("");
  const loadedCampaign = useRef("");

  const refresh = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), status });
    const next = await api<Result>(`/projects/${projectId}/contributions?${params.toString()}`);
    setData(next);
    const campaignStamp = next.campaign ? `${next.campaign.id}:${next.campaign.updatedAt}` : "none";
    if (loadedCampaign.current !== campaignStamp) {
      loadedCampaign.current = campaignStamp;
      setEnabled(next.campaign?.enabled ?? false);
      setPurpose(next.campaign?.purpose ?? "Apoio ao evento");
      setInstructions(next.campaign?.instructions ?? "");
      setProofRequired(next.campaign?.proofRequired ?? false);
      setAllowExpenseSelection(next.campaign?.allowExpenseSelection ?? false);
      setShowProgress(next.campaign?.showProgress ?? false);
      setGoalAmount(next.campaign?.goalAmount == null ? "" : String(next.campaign.goalAmount));
    }
  }, [page, projectId, status]);

  useEffect(() => { void refresh().catch(e => setError(e instanceof Error ? e.message : "Não foi possível carregar as contribuições.")).finally(() => setLoading(false)); }, [refresh]);
  useEffect(() => { setOrigin(window.location.origin); }, []);

  async function perform(work: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await work(); await refresh(); setNotice(success); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível concluir esta acção."); }
    finally { setBusy(false); }
  }

  async function saveCampaign(event: FormEvent) {
    event.preventDefault();
    await perform(() => api(`/projects/${projectId}/contributions`, { method: "PUT", body: JSON.stringify({ enabled, purpose, instructions, proofRequired, allowExpenseSelection, showProgress, goalAmount: goalAmount ? Number(goalAmount) : null }) }), enabled ? "Link de contribuições actualizado." : "Definições guardadas. O link está desactivado.");
  }

  async function review(item: Contribution, nextStatus: "CONFIRMED" | "REJECTED") {
    await perform(() => api(`/projects/${projectId}/contributions/${item.id}`, { method: "PATCH", body: JSON.stringify({ status: nextStatus, reviewNote: reviewNote[item.id]?.trim() || null }) }), nextStatus === "CONFIRMED" ? "Contribuição confirmada; entrou no total recebido." : "Contribuição recusada.");
  }

  async function remove(item: Contribution) {
    if (!window.confirm("Apagar este registo e o comprovativo associado? Esta acção não pode ser anulada.")) return;
    await perform(() => api(`/projects/${projectId}/contributions/${item.id}`, { method: "DELETE" }), "Registo e comprovativo apagados.");
  }

  async function copyLink() {
    if (!data?.campaign?.sharePath) return;
    const link = `${window.location.origin}${data.campaign.sharePath}`;
    try { await navigator.clipboard.writeText(link); setNotice("Link copiado. Podes partilhá-lo com familiares e amigos."); }
    catch { setError("Não foi possível copiar automaticamente. Selecciona e copia o link apresentado."); }
  }

  async function rotateLink() {
    if (!window.confirm("O link actual deixará de funcionar. As pessoas terão de receber o novo link. Continuar?")) return;
    await perform(() => api(`/projects/${projectId}/contributions/rotate-link`, { method: "POST" }), "Link anterior revogado. Partilha o novo link.");
  }

  if (loading) return <section className="dash-panel contributions-loading"><p>A carregar contribuições…</p></section>;
  if (!data) return <section className="dash-panel contributions-loading"><p>{error || "Não foi possível carregar as contribuições."}</p><button className="button button-outline" onClick={() => void refresh()}>Tentar novamente</button></section>;

  return <div className="contributions-workspace">
    <header className="contributions-heading"><div><p className="eyebrow">Apoio de familiares e amigos</p><h1>Contribuições</h1><p>Regista os apoios enviados para este evento. Os valores só contam como recebidos depois da tua confirmação.</p></div></header>
    {(error || notice) && <p className={error ? "form-error" : "contribution-notice"} role={error ? "alert" : "status"}>{error || notice}</p>}

    <div className="contribution-summary"><article><small>Por confirmar</small><strong>{data.summary.pending}</strong><span>aguardam revisão</span></article><article><small>Confirmadas</small><strong>{data.summary.confirmed}</strong><span>contribuições validadas</span></article><article><small>Total recebido</small><strong>{formatAOA(data.summary.confirmedAmount)}</strong><span>só inclui valores confirmados</span></article></div>

    <section className="dash-panel contribution-settings"><div className="contribution-section-heading"><div><p className="eyebrow">Link público</p><h2>Configurar contribuições</h2><p>As pessoas registam o apoio sem criar conta. A Nuvia não processa transferências nem confirma pagamentos.</p></div><span className={`contribution-link-state ${data.campaign?.enabled ? "active" : "inactive"}`}>{data.campaign?.enabled ? "Link activo" : "Link desactivado"}</span></div>
      {canEdit ? <form onSubmit={saveCampaign} className="contribution-settings-form">
        <label className="contribution-toggle"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}/><span><strong>Permitir contribuições por link</strong><small>Podes desactivar o link a qualquer momento.</small></span></label>
        <label>Finalidade<input required minLength={2} maxLength={120} value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Ex.: Apoio às despesas do casamento"/></label>
        <label>Instruções para pagamento<textarea required={enabled} maxLength={1600} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Indica o método e os dados de pagamento que queres partilhar."/><small>Estas instruções ficam visíveis a qualquer pessoa com o link. Confirma os dados e publica apenas informações destinadas a receber pagamentos.</small></label>
        <div className="contribution-setting-options"><label><input type="checkbox" checked={proofRequired} onChange={e => setProofRequired(e.target.checked)}/> Exigir comprovativo</label><label><input type="checkbox" checked={allowExpenseSelection} onChange={e => setAllowExpenseSelection(e.target.checked)}/> Permitir escolher uma despesa</label><label><input type="checkbox" checked={showProgress} onChange={e => setShowProgress(e.target.checked)}/> Mostrar progresso agregado no link</label></div>
        {showProgress && <label>Meta de contribuição (opcional, Kz)<input type="number" min="1" step="any" value={goalAmount} onChange={e => setGoalAmount(e.target.value)} placeholder="Sem meta definida"/></label>}
        {allowExpenseSelection && <p className="contribution-private-note">Serão mostradas no formulário público apenas as despesas ainda não marcadas como pagas. O público não verá os valores, nomes ou comprovativos das contribuições.</p>}
        <button className="button button-primary" disabled={busy}>{busy ? "A guardar…" : data.campaign ? "Guardar definições" : "Criar link de contribuição"}</button>
      </form> : <p className="contribution-private-note">Apenas pessoas com permissão de edição podem alterar estas definições.</p>}
      {data.campaign && <div className="contribution-share-box"><label>Link partilhável<input readOnly value={data.campaign.enabled ? `${origin}${data.campaign.sharePath}` : "Activa o link para o partilhar."}/></label><div>{data.campaign.enabled && <button type="button" className="button button-outline compact" onClick={() => void copyLink()}>Copiar link</button>}{canEdit && <button type="button" className="contribution-rotate" disabled={busy} onClick={() => void rotateLink()}>Gerar novo link</button>}</div><small>O link não mostra a lista de contribuições. Ao gerar outro, o anterior deixa de funcionar.</small></div>}
    </section>

    <section className="dash-panel contribution-list-panel"><header className="contribution-list-heading"><div><p className="eyebrow">Registos privados do evento</p><h2>Contribuições recebidas</h2><p>Comprovativos disponíveis apenas para membros deste evento.</p></div><label>Estado<select value={status} onChange={e => { setPage(1); setStatus(e.target.value); }}><option value="ALL">Todas</option><option value="PENDING">Por confirmar</option><option value="CONFIRMED">Confirmadas</option><option value="REJECTED">Recusadas</option></select></label></header>
      {data.contributions.length ? <div className="contribution-list">{data.contributions.map(item => <article key={item.id} className={`contribution-card ${item.status.toLowerCase()}`}>
        <header><div><strong>{item.isAnonymous ? "Contribuição anónima" : item.contributorName || "Sem nome indicado"}</strong><small>{dateText(item.createdAt)} · {methodText[item.paymentMethod]}</small></div><span className={`contribution-status ${item.status.toLowerCase()}`}>{statusText[item.status]}</span></header>
        <div className="contribution-card-value"><strong>{formatAOA(Number(item.amount))}</strong>{item.expense && <span>Para: {item.expense.title}</span>}</div>
        {item.message && <p className="contribution-message">{item.message}</p>}{item.reviewNote && item.status !== "PENDING" && <p className="contribution-review-note">Nota da organização: {item.reviewNote}</p>}
        <div className="contribution-card-actions">{item.hasProof ? <a className="contribution-proof-link" href={`/api/v1/projects/${projectId}/contributions/${item.id}/proof`} target="_blank" rel="noreferrer">Descarregar comprovativo ↗</a> : <small>Sem comprovativo</small>}{item.status === "PENDING" && canEdit && <div><label className="visually-hidden" htmlFor={`contribution-note-${item.id}`}>Nota privada da revisão</label><input id={`contribution-note-${item.id}`} maxLength={500} value={reviewNote[item.id] ?? ""} onChange={e => setReviewNote(current => ({ ...current, [item.id]: e.target.value }))} placeholder="Nota opcional"/><button type="button" className="button button-primary compact" disabled={busy} onClick={() => void review(item, "CONFIRMED")}>Confirmar</button><button type="button" className="button button-outline compact" disabled={busy} onClick={() => void review(item, "REJECTED")}>Recusar</button></div>}{canEdit && <button type="button" className="contribution-delete" disabled={busy} onClick={() => void remove(item)}>Apagar registo</button>}</div>
      </article>)}</div> : <div className="contribution-empty"><span>↗</span><h3>{status === "ALL" ? "Ainda não há contribuições" : "Nenhum registo neste estado"}</h3><p>{status === "ALL" ? "Quando alguém enviar um apoio, o registo aparece aqui para validação." : "Escolhe outro estado para consultar os registos."}</p></div>}
      {data.pagination.totalPages > 1 && <nav className="contribution-pagination" aria-label="Paginação das contribuições"><button type="button" className="button button-outline compact" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>← Anterior</button><span>Página {page} de {data.pagination.totalPages} · {data.pagination.total} registos</span><button type="button" className="button button-outline compact" disabled={page >= data.pagination.totalPages} onClick={() => setPage(value => Math.min(data.pagination.totalPages, value + 1))}>Seguinte →</button></nav>}
    </section>
    {!expenses.length && <p className="contribution-private-note">Ainda não há despesas no orçamento. Podes receber contribuições gerais; adiciona despesas para permitir que as pessoas indiquem o que pretendem apoiar.</p>}
    {expenses.length > 0 && allowExpenseSelection && <span className="visually-hidden">{expenses.length} despesas disponíveis para escolha no link público.</span>}
  </div>;
}
