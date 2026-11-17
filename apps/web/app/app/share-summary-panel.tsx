"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import "./summary-share.css";

type ShareSettings = { enabled: boolean; showFinancial: boolean; showGuestCounts: boolean; showVendors: boolean; showCompletedTasks: boolean; showProgram: boolean; sharePath: string | null };
const defaults: ShareSettings = { enabled: false, showFinancial: false, showGuestCounts: true, showVendors: false, showCompletedTasks: true, showProgram: true, sharePath: null };

export function ShareSummaryPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const [settings, setSettings] = useState<ShareSettings>(defaults);
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => setSettings(await api<ShareSettings>(`/projects/${projectId}/share-summary`)), [projectId]);
  useEffect(() => { void refresh().catch((e) => setError(e instanceof Error ? e.message : "Não foi possível carregar as definições.")); }, [refresh]);
  useEffect(() => { setOrigin(window.location.origin); }, []);

  function change(key: keyof Omit<ShareSettings, "sharePath">, value: boolean) {
    setSettings(current => ({ ...current, [key]: value }));
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { setSettings(await api<ShareSettings>(`/projects/${projectId}/share-summary`, { method: "PUT", body: JSON.stringify({ enabled: settings.enabled, showFinancial: settings.showFinancial, showGuestCounts: settings.showGuestCounts, showVendors: settings.showVendors, showCompletedTasks: settings.showCompletedTasks, showProgram: settings.showProgram }) })); setNotice(settings.enabled ? "Resumo actualizado. O link está activo." : "Resumo desactivado. O link deixou de estar acessível."); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível guardar o resumo."); }
    finally { setBusy(false); }
  }
  async function rotate() {
    if (!window.confirm("O link actual deixará de funcionar. Terás de partilhar o novo link. Continuar?")) return;
    setBusy(true); setError(""); setNotice("");
    try { const result = await api<{ sharePath: string }>(`/projects/${projectId}/share-summary/rotate-link`, { method: "POST" }); setSettings(current => ({ ...current, sharePath: result.sharePath })); setNotice("Novo link criado; o anterior foi revogado."); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível gerar outro link."); }
    finally { setBusy(false); }
  }
  async function copy() {
    if (!settings.sharePath) return;
    try { await navigator.clipboard.writeText(`${origin}${settings.sharePath}`); setNotice("Link copiado para partilhar."); }
    catch { setError("Não foi possível copiar o link. Selecciona-o e copia manualmente."); }
  }
  const publicUrl = settings.sharePath ? `${origin}${settings.sharePath}` : "";

  return <div className="share-summary-workspace">
    <header className="share-summary-heading"><div><p className="eyebrow">Uma visão clara para a família</p><h1>Resumo partilhável</h1><p>Cria uma página de consulta para os noivos, familiares e pessoas próximas acompanharem os preparativos sem entrar na dashboard.</p></div><span className={`share-summary-status ${settings.enabled ? "active" : "inactive"}`}>{settings.enabled ? "Link activo" : "Link desactivado"}</span></header>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="share-summary-notice" role="status">{notice}</p>}
    <section className="dash-panel share-summary-panel"><div><p className="eyebrow">Controla o que aparece</p><h2>Privacidade do resumo</h2><p className="share-summary-copy">O link é apenas de leitura. Nomes de convidados, valores individuais e comprovativos nunca são publicados.</p></div>
      <form onSubmit={(event) => void save(event)} className="share-summary-form">
        <label className="share-summary-master"><input type="checkbox" checked={settings.enabled} disabled={!canEdit} onChange={event => change("enabled", event.target.checked)}/><span><strong>Publicar página de resumo</strong><small>Podes desactivar o link a qualquer momento.</small></span></label>
        <fieldset disabled={!canEdit}><legend>Escolhe os dados públicos</legend>
          <label><input type="checkbox" checked={settings.showGuestCounts} onChange={event => change("showGuestCounts", event.target.checked)}/><span><strong>Convidados</strong><small>Mostrar apenas totais confirmados, pendentes e recusados.</small></span></label>
          <label><input type="checkbox" checked={settings.showFinancial} onChange={event => change("showFinancial", event.target.checked)}/><span><strong>Resumo financeiro</strong><small>Mostrar despesas pagas, contribuições confirmadas e saldo líquido, sem nomes ou valores individuais.</small></span></label>
          <label><input type="checkbox" checked={settings.showVendors} onChange={event => change("showVendors", event.target.checked)}/><span><strong>Fornecedores contactados</strong><small>Mostrar nomes, categorias e estado do pedido.</small></span></label>
          <label><input type="checkbox" checked={settings.showCompletedTasks} onChange={event => change("showCompletedTasks", event.target.checked)}/><span><strong>Lista de tarefas concluídas</strong><small>Os títulos são públicos; responsáveis e notas internas não aparecem.</small></span></label>
          <label><input type="checkbox" checked={settings.showProgram} onChange={event => change("showProgram", event.target.checked)}/><span><strong>Programa e locais</strong><small>Inclui apenas momentos já marcados como visíveis aos convidados.</small></span></label>
        </fieldset>
        {!canEdit ? <p className="share-summary-readonly">Tens acesso de consulta. Pede a uma pessoa responsável para alterar estas opções.</p> : <button className="button button-primary compact" disabled={busy}>{busy ? "A guardar…" : "Guardar e actualizar link"}</button>}
      </form>
    </section>
    <section className="dash-panel share-summary-link"><div><p className="eyebrow">Partilha segura</p><h2>Link do evento</h2><p>Qualquer pessoa com o link pode consultar os dados seleccionados. Não o publiques em locais abertos se o resumo incluir informações que preferes manter entre familiares.</p></div>
      {settings.sharePath ? <><label>Endereço público<input readOnly value={publicUrl || settings.sharePath}/></label><div className="share-summary-actions">{settings.enabled && <><a className="button button-outline compact" href={settings.sharePath} target="_blank" rel="noreferrer">Pré-visualizar ↗</a><button className="button button-primary compact" type="button" onClick={() => void copy()}>Copiar link</button></>}{canEdit && <button type="button" className="share-summary-rotate" disabled={busy} onClick={() => void rotate()}>Gerar novo link e revogar o actual</button>}</div></> : <p className="share-summary-empty">Guarda as definições para criar o primeiro link.</p>}
    </section>
  </div>;
}
