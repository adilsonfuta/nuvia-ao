"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Range = "7d" | "28d" | "90d";
type Report = {
  configured: boolean;
  range: Range;
  updatedAt?: string;
  totals?: { activeUsers: number; sessions: number; pageViews: number; engagementRate: number };
  daily?: { date: string; activeUsers: number; sessions: number; pageViews: number }[];
  pages?: { path: string; pageViews: number; activeUsers: number }[];
  channels?: { name: string; sessions: number; activeUsers: number }[];
};

const number = new Intl.NumberFormat("pt-AO");
const dateLabel = (value: string) => {
  if (!/^\d{8}$/.test(value)) return value;
  return new Intl.DateTimeFormat("pt-AO", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T12:00:00Z`));
};

export default function AnalyticsPanel() {
  const [range, setRange] = useState<Range>("28d");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(nextRange: Range) {
    setLoading(true);
    setError("");
    try {
      setReport(await api<Report>(`/admin/analytics?range=${nextRange}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as métricas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(range); }, [range]);

  const daily = report?.daily ?? [];
  const maxViews = Math.max(1, ...daily.map((day) => day.pageViews));
  const updated = report?.updatedAt ? new Intl.DateTimeFormat("pt-AO", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Luanda" }).format(new Date(report.updatedAt)) : "";

  return (
    <section className="admin-analytics">
      <header className="admin-workbar">
        <div><p className="eyebrow">Aquisição e utilização</p><h2>Métricas do site</h2><p>Visitas, páginas consultadas e canais de origem, com dados agregados do Google Analytics.</p></div>
        <label className="admin-analytics-range">Período<select value={range} onChange={(event) => setRange(event.target.value as Range)}><option value="7d">Últimos 7 dias</option><option value="28d">Últimos 28 dias</option><option value="90d">Últimos 90 dias</option></select></label>
      </header>

      {loading ? <div className="dash-panel admin-analytics-message" role="status">A carregar métricas…</div> : error ? <div className="dash-panel admin-analytics-message"><strong>Não foi possível consultar o GA4</strong><p>{error}</p><button type="button" className="button button-outline compact" onClick={() => void load(range)}>Tentar novamente</button></div> : report && !report.configured ? (
        <div className="dash-panel admin-analytics-setup">
          <span className="admin-analytics-icon" aria-hidden="true">↗</span><div><h3>Liga o Google Analytics</h3><p>O site já carrega o Google Tag Manager. Para mostrar dados aqui, configura uma conta de serviço com acesso de leitura à propriedade GA4.</p><ol><li>Adiciona o email da conta de serviço como leitor na propriedade Google Analytics.</li><li>Activa a Google Analytics Data API no projecto Google Cloud dessa conta.</li><li>Define <code>GA4_PROPERTY_ID</code>, <code>GA4_SERVICE_ACCOUNT_EMAIL</code> e <code>GA4_SERVICE_ACCOUNT_PRIVATE_KEY</code> no Coolify e reinicia a API.</li></ol></div>
        </div>
      ) : report?.totals ? (
        <>
          <div className="admin-analytics-cards">
            <article className="dash-panel"><span>Visitantes activos</span><strong>{number.format(report.totals.activeUsers)}</strong><small>Pessoas no período seleccionado</small></article>
            <article className="dash-panel"><span>Sessões</span><strong>{number.format(report.totals.sessions)}</strong><small>Visitas iniciadas</small></article>
            <article className="dash-panel"><span>Páginas vistas</span><strong>{number.format(report.totals.pageViews)}</strong><small>Inclui visitas repetidas</small></article>
            <article className="dash-panel"><span>Taxa de envolvimento</span><strong>{new Intl.NumberFormat("pt-AO", { style: "percent", maximumFractionDigits: 1 }).format(report.totals.engagementRate)}</strong><small>Sessões com interacção significativa</small></article>
          </div>
          <div className="admin-analytics-grid">
            <section className="dash-panel admin-analytics-chart"><header><div><h3>Visitas ao longo do tempo</h3><p>Visualizações de página por dia</p></div><span>{range === "7d" ? "7 dias" : range === "90d" ? "90 dias" : "28 dias"}</span></header>
              {daily.length ? <div className="admin-analytics-bars" role="img" aria-label="Gráfico de páginas vistas por dia">{daily.map((day) => <div className="admin-analytics-bar-column" key={day.date} title={`${dateLabel(day.date)}: ${number.format(day.pageViews)} páginas vistas`}><div className="admin-analytics-bar" style={{ height: `${Math.max(3, (day.pageViews / maxViews) * 100)}%` }} /><small>{dateLabel(day.date)}</small></div>)}</div> : <p className="empty-copy">Ainda não há dados para este período.</p>}
            </section>
            <section className="dash-panel admin-analytics-list"><h3>Páginas mais vistas</h3><p>Conteúdo que recebe mais visitas</p>{report.pages?.length ? report.pages.map((page) => <article key={page.path}><span title={page.path}>{page.path}</span><strong>{number.format(page.pageViews)}</strong></article>) : <p className="empty-copy">Sem páginas registadas.</p>}</section>
            <section className="dash-panel admin-analytics-list"><h3>Origem das visitas</h3><p>Canais de aquisição no período</p>{report.channels?.length ? report.channels.map((channel) => <article key={channel.name}><span title={channel.name}>{channel.name}</span><strong>{number.format(channel.sessions)}</strong></article>) : <p className="empty-copy">Sem canais registados.</p>}</section>
          </div>
          <footer className="admin-analytics-footer">Dados agregados do GA4 · Actualizado {updated} · Os relatórios podem ter atraso no processamento.</footer>
        </>
      ) : null}
    </section>
  );
}
