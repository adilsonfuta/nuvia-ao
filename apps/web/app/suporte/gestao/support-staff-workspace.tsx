'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';

type Ticket = {
  id: string; subject: string; message: string; status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  response: string | null; respondedAt: string | null; createdAt: string; updatedAt: string;
  user: { id: string; name: string | null; email: string } | null;
  requesterName: string | null; requesterEmail: string | null;
};
type TicketPage = { items: Ticket[]; total: number; page: number; pageSize: number };
type StatusFilter = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ALL';

const statusLabel: Record<Ticket['status'], string> = { OPEN: 'Por responder', IN_PROGRESS: 'Em acompanhamento', RESOLVED: 'Resolvido' };
const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: 'OPEN', label: 'Por responder' },
  { value: 'IN_PROGRESS', label: 'Em acompanhamento' },
  { value: 'RESOLVED', label: 'Resolvidos' },
  { value: 'ALL', label: 'Todos' },
];
const formatDate = (value: string) => new Intl.DateTimeFormat('pt-AO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Luanda' }).format(new Date(value));

export default function SupportStaffWorkspace() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;

  async function load(status = statusFilter, query = search, currentPage = page) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(currentPage) });
      if (status !== 'ALL') params.set('status', status);
      if (query.trim()) params.set('q', query.trim());
      const result = await api<TicketPage>(`/support/requests?${params.toString()}`);
      setTickets(result.items);
      setTotal(result.total);
      setPage(result.page);
      setSelectedId((current) => result.items.some((ticket) => ticket.id === current) ? current : result.items[0]?.id ?? '');
      setDraft('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os pedidos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function changeFilter(value: StatusFilter) {
    setStatusFilter(value);
    setNotice('');
    await load(value, search, 1);
  }

  async function update(ticket: Ticket, payload: { status?: Ticket['status']; response?: string }) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await api<{ emailSent: boolean }>(`/support/requests/${ticket.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setNotice(payload.response ? result.emailSent ? 'Resposta enviada por email e guardada no pedido.' : 'Resposta guardada no pedido. O envio de emails ainda não está configurado.' : 'Estado do pedido actualizado.');
      await load(statusFilter, search, page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível actualizar o pedido.');
    } finally {
      setSaving(false);
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load(statusFilter, search, 1);
  }

  const requesterName = selected?.user?.name || selected?.requesterName || 'Utilizador';
  const requesterEmail = selected?.user?.email || selected?.requesterEmail || '';
  const hasSelection = Boolean(selected);

  return (
    <section className={`support-page support-staff-page${hasSelection ? ' has-selection' : ''}`}>
      <a className="planner-back" href="/dashboard">← Voltar à dashboard</a>
      <header className="support-heading support-staff-heading">
        <div><p className="eyebrow">Backoffice · Equipa Nuvia</p><h1>Pedidos de suporte</h1><p>Organiza os pedidos, acompanha cada conversa e responde com clareza.</p></div>
        <div className="support-staff-total"><strong>{total}</strong><span>{total === 1 ? 'pedido nesta vista' : 'pedidos nesta vista'}</span></div>
      </header>

      <nav className="support-status-tabs" aria-label="Filtrar pedidos por estado">
        {statusFilters.map((filter) => <button type="button" key={filter.value} className={statusFilter === filter.value ? 'current' : ''} aria-pressed={statusFilter === filter.value} onClick={() => void changeFilter(filter.value)}>{filter.label}</button>)}
      </nav>

      {error && <p className="form-error support-staff-alert" role="alert">{error}</p>}
      {notice && <p className="support-staff-notice" role="status">{notice}</p>}

      <div className="support-inbox-layout">
        <section className="dash-panel support-inbox-list" aria-label="Lista de pedidos">
          <form className="support-inbox-search" onSubmit={submitSearch}>
            <label htmlFor="support-search">Pesquisar pedidos</label>
            <div><input id="support-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Assunto, nome ou email" /><button className="button button-outline compact" type="submit">Pesquisar</button></div>
          </form>
          {loading ? <p className="support-inbox-state" role="status">A carregar pedidos…</p> : tickets.length ? <>
            <div className="support-inbox-items">{tickets.map((ticket) => {
              const name = ticket.user?.name || ticket.requesterName || 'Utilizador';
              const email = ticket.user?.email || ticket.requesterEmail || 'Email não indicado';
              return <button type="button" className={`support-inbox-item${ticket.id === selectedId ? ' selected' : ''}`} key={ticket.id} onClick={() => { setSelectedId(ticket.id); setDraft(''); }} aria-pressed={ticket.id === selectedId}>
                <span className="support-inbox-item-top"><strong>{ticket.subject}</strong><span className={`support-status ${ticket.status.toLowerCase()}`}>{statusLabel[ticket.status]}</span></span>
                <span className="support-inbox-requester">{name} · {email}</span>
                <span className="support-inbox-preview">{ticket.message.replace(/\s+/g, ' ')}</span>
                <span className="support-inbox-date">{formatDate(ticket.updatedAt || ticket.createdAt)}</span>
              </button>;
            })}</div>
            {total > 25 && <div className="support-inbox-pagination"><button type="button" className="button button-outline compact" disabled={page <= 1 || loading} onClick={() => void load(statusFilter, search, page - 1)}>Anterior</button><span>{page} / {Math.ceil(total / 25)}</span><button type="button" className="button button-outline compact" disabled={page * 25 >= total || loading} onClick={() => void load(statusFilter, search, page + 1)}>Seguinte</button></div>}
          </> : <div className="support-inbox-state"><span aria-hidden="true">✓</span><strong>{search ? 'Nenhum pedido encontrado' : 'Caixa limpa'}</strong><p>{search ? 'Experimenta outro nome, email ou assunto.' : 'Não há pedidos neste estado.'}</p></div>}
        </section>

        <section className="dash-panel support-inbox-detail" aria-label="Detalhes do pedido seleccionado">
          {selected ? <>
            <div className="support-detail-heading"><div><p className="eyebrow">Pedido recebido em {formatDate(selected.createdAt)}</p><h2>{selected.subject}</h2></div><span className={`support-status ${selected.status.toLowerCase()}`}>{statusLabel[selected.status]}</span></div>
            <button type="button" className="support-mobile-back" onClick={() => setSelectedId('')}>← Voltar à lista</button>
            <div className="support-requester-card"><span className="support-requester-avatar" aria-hidden="true">{requesterName.slice(0, 1).toLocaleUpperCase('pt-AO')}</span><div><strong>{requesterName}</strong><span>{requesterEmail || 'Email não indicado'}</span></div>{requesterEmail && !selected.user && <a href={`mailto:${requesterEmail}`} aria-label={`Enviar email a ${requesterName}`}>Enviar email ↗</a>}</div>
            <article className="support-message-detail"><h3>Mensagem</h3><p>{selected.message}</p></article>
            {selected.response && <article className="support-response"><strong>Resposta guardada</strong><p>{selected.response}</p>{selected.respondedAt && <small>Registada em {formatDate(selected.respondedAt)}</small>}{!selected.user && requesterEmail && <a href={`mailto:${requesterEmail}?subject=${encodeURIComponent(`Nuvia: ${selected.subject}`)}&body=${encodeURIComponent(selected.response)}`}>Abrir email preparado para envio ↗</a>}</article>}
            <form className="support-reply-form" onSubmit={(event) => { event.preventDefault(); void update(selected, { response: draft.trim(), status: selected.status === 'OPEN' ? 'IN_PROGRESS' : selected.status }); }}>
              <label htmlFor="support-reply">{selected.response ? 'Escrever uma nova resposta' : 'Resposta para o utilizador'}</label>
              <textarea id="support-reply" rows={5} maxLength={4000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escreve uma resposta clara. Não incluas palavras-passe ou dados confidenciais." />
              <div className="support-reply-footer"><small>{draft.length}/4000 · Guardar não envia email automaticamente.</small><button className="button button-primary" type="submit" disabled={saving || draft.trim().length < 5}>{saving ? 'A guardar…' : 'Guardar resposta'}</button></div>
            </form>
            <footer className="support-detail-actions">
              {selected.status !== 'IN_PROGRESS' && <button type="button" className="button button-outline compact" disabled={saving} onClick={() => void update(selected, { status: 'IN_PROGRESS' })}>{selected.status === 'RESOLVED' ? 'Reabrir pedido' : 'Acompanhar pedido'}</button>}
              {selected.status !== 'RESOLVED' && <button type="button" className="button button-outline compact" disabled={saving} onClick={() => void update(selected, { status: 'RESOLVED' })}>Marcar resolvido</button>}
            </footer>
          </> : <div className="support-inbox-empty-detail"><span aria-hidden="true">✉</span><h2>Selecciona um pedido</h2><p>Os detalhes e as acções aparecem aqui, sem alongar a lista.</p></div>}
        </section>
      </div>
      <p className="support-staff-privacy">As respostas de contas ficam disponíveis na Nuvia. Nos pedidos públicos, prepara o email aqui e envia-o manualmente. Nunca peças palavras-passe ou documentos confidenciais.</p>
    </section>
  );
}
