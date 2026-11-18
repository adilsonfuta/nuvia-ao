"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";

type ActivityCategory = "all" | "event" | "planning" | "budget" | "guests" | "program" | "team" | "sharing" | "vendors" | "contributions";
type ActivityItem = {
  id: string;
  category: Exclude<ActivityCategory, "all"> | "all";
  categoryLabel: string;
  title: string;
  detail: string | null;
  createdAt: string;
  actor: string;
};
type ActivityResult = {
  items: ActivityItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  categories: { id: ActivityCategory; label: string }[];
  actors: { id: string; name: string }[];
};

const timeText = (value: string) => new Intl.DateTimeFormat("pt-AO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Luanda",
}).format(new Date(value));
const dateKey = (value: string) => new Intl.DateTimeFormat("en-CA", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Africa/Luanda",
}).formatToParts(new Date(value)).filter((part) => part.type !== "literal").map((part) => part.value).join("-");
const dayLabel = (value: string) => {
  const today = dateKey(new Date().toISOString());
  const yesterday = dateKey(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const key = dateKey(value);
  if (key === today) return "Hoje";
  if (key === yesterday) return "Ontem";
  return new Intl.DateTimeFormat("pt-AO", { dateStyle: "full", timeZone: "Africa/Luanda" }).format(new Date(value));
};

export function ActivityLogPanel({
  projectId,
  compact = false,
  onViewAll,
}: {
  projectId: string;
  compact?: boolean;
  onViewAll?: () => void;
}) {
  const [category, setCategory] = useState<ActivityCategory>("all");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ActivityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(compact ? 1 : page),
      limit: compact ? "5" : "20",
      category: compact ? "all" : category,
    });
    if (!compact && actor) params.set("actor", actor);
    if (!compact && from) params.set("from", from);
    if (!compact && to) params.set("to", to);
    void api<ActivityResult>(`/projects/${projectId}/activity?${params}`)
      .then((result) => {
        if (!active) return;
        setData(result);
        setError("");
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Não foi possível carregar o histórico.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [actor, category, compact, from, page, projectId, to]);

  const groupedItems = (data?.items ?? []).reduce<Array<{ label: string; items: ActivityItem[] }>>((groups, item) => {
    const label = dayLabel(item.createdAt);
    const group = groups[groups.length - 1];
    if (group?.label === label) group.items.push(item);
    else groups.push({ label, items: [item] });
    return groups;
  }, []);
  const hasFilters = Boolean(category !== "all" || actor || from || to);
  const clearFilters = () => { setPage(1); setCategory("all"); setActor(""); setFrom(""); setTo(""); };

  return (
    <section className={`dash-panel activity-panel${compact ? " compact" : ""}`}>
      <header className="activity-heading">
        <div>
          <p className="eyebrow">Histórico do evento</p>
          <h2>{compact ? "Actividade recente" : "Actividade da equipa"}</h2>
          {!compact && <p>Alterações feitas pelas pessoas com acesso ao evento.</p>}
        </div>
        {compact ? (
          onViewAll && <button type="button" className="link-button" onClick={onViewAll}>Ver histórico →</button>
        ) : (
          <div className="activity-toolbar">
            <span className="activity-total">{data?.pagination.total ?? 0} {data?.pagination.total === 1 ? "registo" : "registos"}</span>
            <button type="button" className={`activity-filter-toggle${hasFilters ? " has-filters" : ""}`} aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M5.5 10h9M8 15h4" /></svg>
              Filtrar{hasFilters ? " · activo" : ""}
              <span aria-hidden="true">{filtersOpen ? "−" : "+"}</span>
            </button>
            {filtersOpen && <div className="activity-filters">
            <label className="activity-filter">Área
              <select value={category} onChange={(event) => { setPage(1); setCategory(event.target.value as ActivityCategory); }}>
                {(data?.categories ?? [{ id: "all" as const, label: "Tudo" }]).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <label className="activity-filter">Pessoa
              <select value={actor} onChange={(event) => { setPage(1); setActor(event.target.value); }}>
                <option value="">Todas</option>
                {(data?.actors ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="activity-filter">Desde
              <input type="date" value={from} max={to || undefined} onChange={(event) => { setPage(1); setFrom(event.target.value); }} />
            </label>
            <label className="activity-filter">Até
              <input type="date" value={to} min={from || undefined} onChange={(event) => { setPage(1); setTo(event.target.value); }} />
            </label>
            {hasFilters && <button type="button" className="activity-clear-filters" onClick={clearFilters}>Limpar filtros</button>}
            </div>}
          </div>
        )}
      </header>
      {error ? <p className="activity-error" role="alert">{error}</p> : loading && !data ? <p className="empty-copy">A carregar actividade…</p> : data?.items.length ? (
        <div className={`activity-results${loading ? " is-loading" : ""}`} aria-busy={loading}>
          {groupedItems.map((group) => <section className="activity-day" key={group.label}>
            <h3>{group.label}</h3>
            <ol className="activity-list">
              {group.items.map((item) => (
                <li key={item.id}>
                  <span className={`activity-dot ${item.category}`} aria-hidden="true" />
                  <div>
                    <strong>{item.title}</strong>
                    {item.detail && <p>{item.detail}</p>}
                    <small><span className="activity-person">{item.actor}</span><span>{timeText(item.createdAt)}</span><span className="activity-category">{item.categoryLabel}</span></small>
                  </div>
                </li>
              ))}
            </ol>
          </section>)}
          {loading && <span className="activity-refreshing" role="status">A actualizar…</span>}
        </div>
      ) : (
        <p className="activity-empty">{hasFilters ? <>Nenhuma actividade corresponde a estes filtros. <button type="button" onClick={clearFilters}>Limpar filtros</button></> : "Ainda não há alterações registadas. As próximas mudanças feitas pela equipa aparecem aqui."}</p>
      )}
      {!compact && data && data.pagination.totalPages > 1 && (
        <nav className="activity-pagination" aria-label="Paginação do histórico">
          <button type="button" className="button button-outline compact" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>← Anterior</button>
          <span>Página {page} de {data.pagination.totalPages} · {data.pagination.total} registos</span>
          <button type="button" className="button button-outline compact" disabled={page >= data.pagination.totalPages || loading} onClick={() => setPage((current) => current + 1)}>Seguinte →</button>
        </nav>
      )}
    </section>
  );
}
