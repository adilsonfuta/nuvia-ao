"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../lib/api";
import { formatAOA } from "../../lib/format";
import "../../app/summary-share.css";

type Summary = {
  title: string; kind: "WEDDING" | "ALAMBAMENTO" | "PARTY" | "OTHER"; date: string | null; province: string | null; updatedAt: string;
  progress: { completed: number; total: number; percent: number; tasks: string[] };
  guests: { confirmedPeople: number; pendingPeople: number; pendingInvitations: number; declinedInvitations: number } | null;
  finance: { expensesPaid: number; contributionsConfirmed: number; net: number } | null;
  vendors: { name: string; category: string; status: string }[] | null;
  program: { id: string; title: string; type: string; startsAt: string | null; venue: string | null; address: string | null; mapsUrl: string | null }[] | null;
};
const kindText = { WEDDING: "Casamento", ALAMBAMENTO: "Alambamento", PARTY: "Festa", OTHER: "Evento" };
const vendorStatus: Record<string, string> = { SENT: "Pedido enviado", RESPONDED: "Respondeu", HIRED: "Contratado", CLOSED: "Concluído" };
const dateText = (value: string | null, dateStyle: "long" | "medium" = "long") => value ? new Intl.DateTimeFormat("pt-AO", { dateStyle, timeZone: "Africa/Luanda" }).format(new Date(value)) : "Data por definir";
const timeText = (value: string | null) => value ? new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Luanda" }).format(new Date(value)) : "Horário por confirmar";

export default function SharedEventSummaryPage() {
  const { token } = useParams<{ token: string }>();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void api<Summary>(`/event-summaries/${encodeURIComponent(token)}`).then(setSummary).catch(error => setError(error instanceof Error ? error.message : "Este resumo não está disponível.")); }, [token]);
  if (!summary) return <main className="public-summary-page"><p className="public-summary-loading" role={error ? "alert" : "status"}>{error || "A preparar o resumo do evento…"}</p><a href="/">Nuvia</a></main>;
  const updated = new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Luanda" }).format(new Date(summary.updatedAt));
  return <main className="public-summary-page"><div className="public-summary-shell">
    <header className="public-summary-brand"><a href="/" aria-label="Nuvia, página inicial">nuvia<span>.</span></a><small>Resumo do evento · Apenas consulta</small></header>
    <section className="public-summary-hero"><p className="eyebrow">{kindText[summary.kind]}</p><h1>{summary.title}</h1><p>{dateText(summary.date)}{summary.province ? ` · ${summary.province}, Angola` : ""}</p><div className="public-summary-progress"><div><span>Preparativos concluídos</span><strong>{summary.progress.percent}%</strong></div><div className="public-summary-progress-track"><span style={{ width: `${summary.progress.percent}%` }}/></div><small>{summary.progress.completed} de {summary.progress.total} tarefas concluídas</small></div></section>
    {summary.guests && <section className="public-summary-section"><header><p className="eyebrow">Presenças</p><h2>Convidados</h2></header><div className="public-summary-stat-grid"><article><small>Presenças confirmadas</small><strong>{summary.guests.confirmedPeople}</strong><span>pessoas</span></article><article><small>Previsão pendente</small><strong>{summary.guests.pendingPeople}</strong><span>pessoas em {summary.guests.pendingInvitations} {summary.guests.pendingInvitations === 1 ? "convite" : "convites"}</span></article><article><small>Convites recusados</small><strong>{summary.guests.declinedInvitations}</strong><span>{summary.guests.declinedInvitations === 1 ? "convite" : "convites"}</span></article></div></section>}
    {summary.finance && <section className="public-summary-section"><header><p className="eyebrow">Valores agregados</p><h2>Resumo financeiro</h2><p>São apresentados apenas totais confirmados e registados.</p></header><div className="public-summary-stat-grid"><article><small>Despesas pagas</small><strong>{formatAOA(summary.finance.expensesPaid)}</strong></article><article><small>Contribuições confirmadas</small><strong>{formatAOA(summary.finance.contributionsConfirmed)}</strong></article><article><small>Saldo líquido</small><strong>{formatAOA(summary.finance.net)}</strong><span>contribuições confirmadas menos despesas pagas</span></article></div></section>}
    {summary.vendors && <section className="public-summary-section"><header><p className="eyebrow">Pedidos de serviço</p><h2>Fornecedores contactados</h2></header>{summary.vendors.length ? <div className="public-summary-vendors">{summary.vendors.map((vendor, index) => <article key={`${vendor.name}-${index}`}><div><strong>{vendor.name}</strong><small>{vendor.category}</small></div><span>{vendorStatus[vendor.status] || "Em contacto"}</span></article>)}</div> : <p className="public-summary-empty">Ainda não há pedidos de fornecedor para mostrar.</p>}</section>}
    {summary.progress.tasks.length > 0 && <section className="public-summary-section"><header><p className="eyebrow">Etapas concluídas</p><h2>O que já está tratado</h2></header><ul className="public-summary-tasks">{summary.progress.tasks.map((task, index) => <li key={`${task}-${index}`}><span aria-hidden="true">✓</span>{task}</li>)}</ul></section>}
    {summary.program && <section className="public-summary-section"><header><p className="eyebrow">Horários e locais</p><h2>Programa</h2></header>{summary.program.length ? <div className="public-summary-program">{summary.program.map(moment => <article key={moment.id}><time>{timeText(moment.startsAt)}</time><div><h3>{moment.title}</h3>{moment.venue && <p>{moment.venue}</p>}{moment.address && <small>{moment.address}</small>}{moment.mapsUrl && <a href={moment.mapsUrl} target="_blank" rel="noreferrer">Ver localização ↗</a>}</div></article>)}</div> : <p className="public-summary-empty">O programa será actualizado quando estiver definido.</p>}</section>}
    <footer className="public-summary-footer"><span>Consulta actualizada a {updated}</span><span>Partilhado através da Nuvia</span></footer>
  </div></main>;
}
