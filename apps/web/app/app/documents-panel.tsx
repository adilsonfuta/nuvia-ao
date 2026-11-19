"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ProjectKind } from "@casar/contracts";
import { api } from "../lib/api";
import { ListPagination, useListPage } from "../lib/list-pagination";
import "./documents.css";

type DocumentStatus = "TODO" | "IN_PROGRESS" | "READY" | "NOT_REQUIRED";
type ProjectDocument = {
  id: string; title: string; category: string; status: DocumentStatus; notes: string | null;
  dueAt: string | null; assigneeName: string | null; mimeType: string | null; byteSize: number | null;
  fileUploadedAt: string | null; uploadedBy: { id: string; name: string | null; email: string } | null;
};
type Suggestion = { title: string; category: string };
type Draft = { title: string; category: string; status: DocumentStatus; notes: string; dueAt: string; assigneeName: string };

const suggestions: Record<ProjectKind, Suggestion[]> = {
  WEDDING: [
    { title: "Bilhetes de Identidade válidos", category: "Identificação" },
    { title: "Documentos indicados pela conservatória", category: "Casamento civil" },
    { title: "Documentos do regime de bens, se aplicável", category: "Casamento civil" },
    { title: "Recibos e comprovativos do processo", category: "Casamento civil" },
  ],
  ALAMBAMENTO: [
    { title: "Lista de itens e responsabilidades acordados pelas famílias", category: "Famílias" },
    { title: "Orçamentos, recibos e comprovativos", category: "Financeiro" },
    { title: "Condições do espaço e dos serviços contratados", category: "Contratos" },
  ],
  PARTY: [
    { title: "Contrato e condições do espaço", category: "Espaço" },
    { title: "Contratos e comprovativos dos fornecedores", category: "Fornecedores" },
    { title: "Autorizações necessárias para o local, se aplicável", category: "Autorizações" },
  ],
  OTHER: [
    { title: "Documentos e comprovativos importantes", category: "Documentação" },
    { title: "Contratos e condições dos serviços", category: "Contratos" },
    { title: "Autorizações necessárias, se aplicável", category: "Autorizações" },
  ],
};
const statusLabels: Record<DocumentStatus, string> = { TODO: "Por tratar", IN_PROGRESS: "Em curso", READY: "Concluído", NOT_REQUIRED: "Não aplicável" };
const statusClasses: Record<DocumentStatus, string> = { TODO: "todo", IN_PROGRESS: "progress", READY: "ready", NOT_REQUIRED: "not-required" };
const emptyDraft: Draft = { title: "", category: "Documentação", status: "TODO", notes: "", dueAt: "", assigneeName: "" };
const dateInput = (value: string | null) => value ? new Date(value).toISOString().slice(0, 10) : "";
const isoDate = (value: string) => value ? new Date(`${value}T12:00:00+01:00`).toISOString() : null;
const fileSize = (bytes: number | null) => {
  if (bytes === null) return "";
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function DocumentsPanel({ projectId, projectKind, canEdit }: { projectId: string; projectKind: ProjectKind; canEdit: boolean }) {
  const [items, setItems] = useState<ProjectDocument[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<Record<string, Draft>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    setItems(await api<ProjectDocument[]>(`/projects/${projectId}/documents`));
  }
  useEffect(() => {
    setLoading(true);
    api<ProjectDocument[]>(`/projects/${projectId}/documents`).then(setItems).catch((cause) => setError(cause instanceof Error ? cause.message : "Não foi possível carregar os documentos.")).finally(() => setLoading(false));
  }, [projectId]);

  const counts = useMemo(() => ({
    total: items.length,
    ready: items.filter((item) => item.status === "READY").length,
    pending: items.filter((item) => item.status === "TODO" || item.status === "IN_PROGRESS").length,
    files: items.filter((item) => Boolean(item.mimeType)).length,
  }), [items]);
  const visibleItems = useMemo(() => items.filter((item) => {
    const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
    const query = search.trim().toLocaleLowerCase("pt-AO");
    const matchesQuery = !query || `${item.title} ${item.category} ${item.assigneeName ?? ""}`.toLocaleLowerCase("pt-AO").includes(query);
    return matchesStatus && matchesQuery;
  }), [items, search, statusFilter]);
  const { pageItems: displayedItems } = useListPage(visibleItems, page, pageSize);

  async function run(action: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await action(); await refresh(); setNotice(success); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível guardar as alterações."); }
    finally { setBusy(false); }
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    await run(async () => {
      await api(`/projects/${projectId}/documents`, { method: "POST", body: JSON.stringify({ title: draft.title, category: draft.category, notes: draft.notes || undefined, dueAt: isoDate(draft.dueAt) || undefined, assigneeName: draft.assigneeName || undefined }) });
      setDraft(emptyDraft);
    }, "Item adicionado à lista de documentos.");
  }
  async function addSuggestion(item: Suggestion) {
    await run(() => api(`/projects/${projectId}/documents`, { method: "POST", body: JSON.stringify(item) }), "Sugestão adicionada à lista.");
  }
  function editDraft(item: ProjectDocument): Draft {
    return { title: item.title, category: item.category, status: item.status, notes: item.notes ?? "", dueAt: dateInput(item.dueAt), assigneeName: item.assigneeName ?? "" };
  }
  async function saveItem(item: ProjectDocument) {
    const values = editing[item.id] ?? editDraft(item);
    await run(async () => {
      await api(`/projects/${projectId}/documents/${item.id}`, { method: "PATCH", body: JSON.stringify({ title: values.title, category: values.category, status: values.status, notes: values.notes || null, dueAt: isoDate(values.dueAt), assigneeName: values.assigneeName || null }) });
      setEditing((current) => { const next = { ...current }; delete next[item.id]; return next; });
    }, "Documento actualizado.");
  }
  async function upload(item: ProjectDocument, file: File | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("O ficheiro não pode exceder 10 MB."); return; }
    const form = new FormData(); form.append("file", file);
    await run(() => api(`/projects/${projectId}/documents/${item.id}/file`, { method: "POST", body: form }), "Ficheiro guardado em privado.");
  }
  async function remove(item: ProjectDocument) {
    if (!window.confirm(`Remover “${item.title}” e apagar o ficheiro anexado?`)) return;
    await run(() => api(`/projects/${projectId}/documents/${item.id}`, { method: "DELETE" }), "Item e ficheiro removidos.");
  }

  const listedSuggestions = suggestions[projectKind] ?? suggestions.OTHER;
  return <section className="documents-workspace">
    <header className="documents-heading"><div><p className="eyebrow">Preparativos do evento</p><h2>Documentos</h2><p>Organiza comprovativos, contratos e outros documentos importantes num só lugar.</p></div><span className="documents-kind-tag">{projectKind === "WEDDING" ? "Casamento" : projectKind === "ALAMBAMENTO" ? "Alambamento" : projectKind === "PARTY" ? "Festa" : "Outro evento"}</span></header>
    {error && <p className="documents-message error" role="alert">{error}<button type="button" onClick={() => setError("")}>Fechar</button></p>}
    {notice && <p className="documents-message success" role="status">{notice}<button type="button" onClick={() => setNotice("")}>Fechar</button></p>}
    <div className="documents-summary" aria-label="Resumo da documentação"><article><small>Itens na lista</small><strong>{counts.total}</strong></article><article><small>Por tratar</small><strong>{counts.pending}</strong></article><article><small>Concluídos</small><strong>{counts.ready}</strong></article><article><small>Com ficheiro</small><strong>{counts.files}</strong></article></div>

    {canEdit && <section className="dash-panel documents-suggestions"><div className="documents-section-title"><div><h3>Sugestões para este evento</h3><p>São pontos de partida editáveis, não uma lista de requisitos obrigatórios.</p></div></div><div className="documents-suggestion-list">{listedSuggestions.map((item) => { const added = items.some((saved) => saved.title.toLocaleLowerCase("pt-AO") === item.title.toLocaleLowerCase("pt-AO")); return <article key={item.title}><span><strong>{item.title}</strong><small>{item.category}</small></span><button type="button" className="button button-outline compact" disabled={busy || added} onClick={() => void addSuggestion(item)}>{added ? "Adicionado" : "Adicionar"}</button></article>; })}</div>{projectKind === "WEDDING" && <small className="documents-legal-note">Os requisitos do casamento civil variam conforme a conservatória e a situação dos nubentes. Confirma a lista aplicável directamente com o serviço.</small>}</section>}

    {canEdit && <form className="dash-panel documents-create-form" onSubmit={(event) => void createItem(event)}><div className="documents-section-title"><div><h3>Adicionar documento ou comprovativo</h3><p>Cria um item personalizado e, se quiseres, anexa o ficheiro depois.</p></div></div><div className="documents-form-grid"><label>Nome do item<input required maxLength={160} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Contrato do espaço"/></label><label>Categoria<input maxLength={80} value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}/></label><label>Responsável<input maxLength={120} value={draft.assigneeName} onChange={(event) => setDraft((current) => ({ ...current, assigneeName: event.target.value }))} placeholder="Opcional"/></label><label>Prazo<input type="date" value={draft.dueAt} onChange={(event) => setDraft((current) => ({ ...current, dueAt: event.target.value }))}/></label><label className="documents-notes-field">Notas<textarea maxLength={1500} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Notas privadas para a equipa do evento"/></label></div><button className="button button-primary" disabled={busy}>{busy ? "A guardar…" : "Adicionar à lista"}</button><p className="documents-privacy-note">Os ficheiros são privados e só ficam acessíveis a membros deste evento. Aceitamos PDF, JPG ou PNG até 10 MB.</p></form>}

    <section className="dash-panel documents-list-panel"><div className="documents-list-heading"><div><h3>Lista do evento</h3><p>{counts.total} {counts.total === 1 ? "item" : "itens"} guardados.</p></div><div className="documents-list-filters"><label><span className="visually-hidden">Pesquisar documentos</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar"/></label><label><span className="visually-hidden">Filtrar por estado</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">Todos os estados</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div></div>
      {loading ? <p className="documents-empty">A carregar a lista…</p> : visibleItems.length ? <div className="documents-list">{displayedItems.map((item) => { const values = editing[item.id] ?? editDraft(item); const isEditing = Boolean(editing[item.id]); return <article className="document-card" key={item.id}><div className="document-card-main"><div className="document-card-heading"><div><span className="document-category">{item.category}</span><h4>{item.title}</h4></div><span className={`document-status ${statusClasses[item.status]}`}>{statusLabels[item.status]}</span></div>{item.notes && !isEditing && <p className="document-notes">{item.notes}</p>}<div className="document-card-meta">{item.assigneeName && <span>Responsável: {item.assigneeName}</span>}{item.dueAt && <span>Prazo: {new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium" }).format(new Date(item.dueAt))}</span>}{item.fileUploadedAt && <span>Ficheiro carregado em {new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium" }).format(new Date(item.fileUploadedAt))}</span>}</div>
        {isEditing && canEdit && <div className="document-edit-grid"><label>Nome<input maxLength={160} value={values.title} onChange={(event) => setEditing((current) => ({ ...current, [item.id]: { ...values, title: event.target.value } }))}/></label><label>Categoria<input maxLength={80} value={values.category} onChange={(event) => setEditing((current) => ({ ...current, [item.id]: { ...values, category: event.target.value } }))}/></label><label>Estado<select value={values.status} onChange={(event) => setEditing((current) => ({ ...current, [item.id]: { ...values, status: event.target.value as DocumentStatus } }))}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Responsável<input maxLength={120} value={values.assigneeName} onChange={(event) => setEditing((current) => ({ ...current, [item.id]: { ...values, assigneeName: event.target.value } }))}/></label><label>Prazo<input type="date" value={values.dueAt} onChange={(event) => setEditing((current) => ({ ...current, [item.id]: { ...values, dueAt: event.target.value } }))}/></label><label className="document-edit-notes">Notas<textarea maxLength={1500} value={values.notes} onChange={(event) => setEditing((current) => ({ ...current, [item.id]: { ...values, notes: event.target.value } }))}/></label></div>}
        {item.mimeType && <div className="document-file-chip"><span aria-hidden="true">▧</span><span><strong>{item.mimeType === "application/pdf" ? "PDF" : item.mimeType === "image/png" ? "PNG" : "JPG"}</strong><small>{fileSize(item.byteSize)} · acesso privado</small></span><a href={`/api/v1/projects/${projectId}/documents/${item.id}/file`} download>Descarregar</a></div>}
        <footer className="document-card-actions">{canEdit && <><label className="button button-outline compact document-upload-button"><input type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy} onChange={(event) => { void upload(item, event.target.files?.[0]); event.currentTarget.value = ""; }}/>{item.mimeType ? "Substituir ficheiro" : "Anexar ficheiro"}</label>{isEditing ? <><button type="button" className="button button-primary compact" disabled={busy} onClick={() => void saveItem(item)}>Guardar alterações</button><button type="button" className="document-text-button" onClick={() => setEditing((current) => { const next = { ...current }; delete next[item.id]; return next; })}>Cancelar</button></> : <button type="button" className="document-text-button" onClick={() => setEditing((current) => ({ ...current, [item.id]: editDraft(item) }))}>Editar</button>}<button type="button" className="document-delete-button" disabled={busy} onClick={() => void remove(item)}>Remover</button></>}</footer>
      </div></article>; })}</div> : <div className="documents-empty"><span aria-hidden="true">▤</span><h4>{items.length ? "Nenhum item corresponde à pesquisa." : "Ainda não há documentos na lista."}</h4><p>{canEdit ? "Adiciona uma sugestão ou cria o primeiro item para este evento." : "A equipa ainda não adicionou documentos a este evento."}</p></div>}
      {!loading && visibleItems.length > 0 && <ListPagination page={page} pageSize={pageSize} total={visibleItems.length} label="documentos" onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
    </section>
  </section>;
}
