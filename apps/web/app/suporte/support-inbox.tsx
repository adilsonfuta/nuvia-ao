'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiError, api } from '../lib/api';

type SupportRequest = {
  id: string; subject: string; message: string; status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  response: string | null; respondedAt: string | null; createdAt: string; updatedAt: string;
};

const statusLabel: Record<SupportRequest['status'], string> = {
  OPEN: 'Recebido', IN_PROGRESS: 'Em análise', RESOLVED: 'Resolvido',
};
const formatDate = (value: string) => new Intl.DateTimeFormat('pt-AO', {
  dateStyle: 'medium', timeZone: 'Africa/Luanda',
}).format(new Date(value));

export default function SupportInbox() {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showAllRequests, setShowAllRequests] = useState(false);

  async function load() {
    const result = await api<SupportRequest[]>('/support/my-requests');
    setRequests(result);
  }

  useEffect(() => {
    api('/auth/me').then(() => {
      setSignedIn(true);
      return load();
    }).catch((cause) => {
      if (!(cause instanceof ApiError) || cause.status !== 401) {
        setError('Não foi possível verificar a tua sessão. Tenta novamente dentro de instantes.');
        return;
      }
      setSignedIn(false);
      setRequests([]);
    }).finally(() => setLoading(false));
  }, []);

  const visibleRequests = useMemo(
    () => showAllRequests ? requests : requests.slice(0, 5),
    [requests, showAllRequests],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(''); setNotice('');
    try {
      if (signedIn) {
        const result = await api<{ emailSent: boolean }>('/support/requests', { method: 'POST', body: JSON.stringify({ subject, message }) });
        await load();
        setNotice(result.emailSent ? 'Pedido enviado. Também enviámos uma confirmação por email.' : 'Pedido enviado. A resposta ficará disponível nesta página.');
      } else {
        const result = await api<{ message: string }>('/support/public-requests', { method: 'POST', body: JSON.stringify({ name, email, subject, message }) });
        setNotice(result.message);
        setName(''); setEmail('');
      }
      setSubject(''); setMessage('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar o pedido.');
    } finally { setSaving(false); }
  }

  return (
    <main className={`support-page support-user-page${signedIn ? ' signed-in' : ''}`}>
      <Link className="support-back-link" href={signedIn ? '/dashboard' : '/'}>
        <span aria-hidden="true">←</span> {signedIn ? 'Voltar à dashboard' : 'Voltar ao início'}
      </Link>

      <header className="support-user-heading">
        <p className="eyebrow">Ajuda Nuvia</p>
        <h1>Como podemos ajudar?</h1>
        <p>Envia a tua dúvida à equipa. Vamos orientar-te no próximo passo.</p>
      </header>

      {error && <p className="form-error support-user-error" role="alert">{error}</p>}

      {loading ? <section className="dash-panel support-user-loading" role="status"><span className="support-user-spinner" aria-hidden="true" />A preparar o suporte…</section> : (
        <div className={`support-user-layout${signedIn ? ' with-history' : ' contact-only'}`}>
          <form className="dash-panel support-user-form" onSubmit={submit}>
            <div className="support-user-form-heading">
              <span className="support-user-form-icon" aria-hidden="true">✉</span>
              <div><h2>Novo pedido</h2><p>{signedIn ? 'A resposta ficará guardada na tua conta.' : 'Não precisas de criar uma conta.'}</p></div>
            </div>

            {!signedIn && <div className="support-user-contact-fields">
              <label>Nome<input required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Como te chamamos?" /></label>
              <label>Email<input required type="email" maxLength={180} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@email.com" /></label>
            </div>}

            <label>Assunto<input required minLength={4} maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Ex.: Preciso de ajuda com o meu evento" /></label>
            <label>Mensagem<textarea required minLength={10} maxLength={4000} rows={6} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Conta-nos o que aconteceu e o que estavas a tentar fazer." /><small>{message.length}/4000</small></label>

            {notice && <p className="support-user-notice" role="status"><span aria-hidden="true">✓</span>{notice}</p>}
            <button className="button button-primary support-user-submit" type="submit" disabled={saving}>
              {saving ? 'A enviar…' : 'Enviar pedido'} <span aria-hidden="true">→</span>
            </button>
            <p className="support-user-privacy">Por segurança, não envies palavras-passe, documentos ou dados bancários.</p>
          </form>

          {signedIn && <section className="dash-panel support-user-history">
            <div className="support-user-history-heading"><div><p className="eyebrow">A tua conta</p><h2>Os teus pedidos</h2></div><span>{requests.length}</span></div>
            {requests.length ? <div className="support-user-request-list">
              {visibleRequests.map((item) => <details className="support-user-request" key={item.id}>
                <summary>
                  <span className="support-user-request-info"><strong>{item.subject}</strong><small>{formatDate(item.updatedAt || item.createdAt)}</small></span>
                  <span className={`support-status ${item.status.toLowerCase()}`}>{statusLabel[item.status]}</span>
                </summary>
                <div className="support-user-request-details">
                  <p>{item.message}</p>
                  {item.response ? <div className="support-response"><strong>Resposta da equipa</strong><p>{item.response}</p>{item.respondedAt && <small>{formatDate(item.respondedAt)}</small>}</div> : <small>A equipa ainda não respondeu.</small>}
                </div>
              </details>)}
              {requests.length > 5 && <button className="support-user-more" type="button" onClick={() => setShowAllRequests((value) => !value)}>{showAllRequests ? 'Mostrar menos' : `Ver os ${requests.length} pedidos`}</button>}
            </div> : <div className="support-user-empty"><span aria-hidden="true">♡</span><strong>Ainda não tens pedidos</strong><p>Quando enviares uma dúvida, poderás acompanhar a resposta aqui.</p></div>}
          </section>}
        </div>
      )}
    </main>
  );
}
