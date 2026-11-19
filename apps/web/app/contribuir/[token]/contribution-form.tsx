"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../lib/api";
import { formatAOA } from "../../lib/format";
import "../../app/contributions.css";

type PublicData = { title: string; eventKind: string; eventDate: string | null; purpose: string; instructions: string; proofRequired: boolean; allowExpenseSelection: boolean; expenses: { id: string; title: string }[]; progress: { confirmedAmount: number; confirmedCount: number; goalAmount: number | null } | null };
const eventKindText: Record<string, string> = { WEDDING: "Casamento", ALAMBAMENTO: "Alambamento", PARTY: "Festa", OTHER: "Evento" };

export default function ContributionForm() {
  const { token } = useParams<{ token: string }>();
  const [event, setEvent] = useState<PublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => { void api<PublicData>(`/contributions/${encodeURIComponent(token)}`).then(setEvent).catch(e => setError(e instanceof Error ? e.message : "Este link não está disponível.")).finally(() => setLoading(false)); }, [token]);

  async function submit(eventObject: FormEvent<HTMLFormElement>) {
    eventObject.preventDefault();
    if (!event) return;
    setBusy(true); setError("");
    const form = new FormData(eventObject.currentTarget);
    form.set("isAnonymous", String(anonymous));
    if (file) form.set("proof", file);
    try {
      await api(`/contributions/${encodeURIComponent(token)}`, { method: "POST", body: form });
      setSent(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível registar a contribuição."); }
    finally { setBusy(false); }
  }

  if (loading) return <main className="public-contribution-page"><section className="public-contribution-card"><span className="app-loading-mark"/><p>A abrir o link…</p></section></main>;
  if (!event) return <main className="public-contribution-page"><section className="public-contribution-card public-contribution-error"><a className="public-contribution-brand" href="/">nuvia<span>.</span></a><span aria-hidden="true">↗</span><h1>Este link não está disponível</h1><p>{error || "Confirma com a organização do evento se o link ainda está activo."}</p></section></main>;

  return <main className="public-contribution-page"><section className="public-contribution-card">
    <a className="public-contribution-brand" href="/" aria-label="Nuvia, início">nuvia<span>.</span></a>
    <p className="eyebrow">{eventKindText[event.eventKind] || "Celebração"}</p><h1>{event.title}</h1>
    <div className="public-contribution-purpose"><span aria-hidden="true">✦</span><div><small>Finalidade</small><strong>{event.purpose}</strong></div></div>
    {event.instructions && <section className="public-contribution-instructions"><h2>Como contribuir</h2><p>{event.instructions}</p></section>}
    {event.progress && <section className="public-contribution-progress" aria-label="Progresso agregado das contribuições"><div><span>Total confirmado</span><strong>{formatAOA(event.progress.confirmedAmount)}</strong></div>{event.progress.goalAmount && <><div className="public-contribution-progress-track"><span style={{ width: `${Math.min(100, event.progress.confirmedAmount / event.progress.goalAmount * 100)}%` }}/></div><small>Meta: {formatAOA(event.progress.goalAmount)}</small></>}{!event.progress.goalAmount && <small>{event.progress.confirmedCount} contribuições confirmadas</small>}</section>}
    {sent ? <div className="public-contribution-success" role="status"><span aria-hidden="true">✓</span><h2>Registo enviado</h2><p>A organização do evento vai verificar a contribuição. O envio deste formulário não confirma a recepção do dinheiro.</p><small>Obrigado pelo teu apoio.</small></div> : <form className="public-contribution-form" onSubmit={submit}>
      <h2>Registar contribuição</h2>
      <label>Valor (Kz)<input required type="number" name="amount" min="1" max="999999999999.99" step="any"/></label>
      <label>Método utilizado<select name="paymentMethod" required defaultValue=""><option value="" disabled>Escolhe o método</option><option value="BANK_TRANSFER">Transferência bancária</option><option value="MOBILE_MONEY">Pagamento móvel</option><option value="CASH">Numerário</option><option value="OTHER">Outro</option></select></label>
      {event.allowExpenseSelection && event.expenses.length > 0 && <label>Despesa que pretendes apoiar (opcional)<select name="expenseId" defaultValue=""><option value="">Apoio geral ao evento</option>{event.expenses.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
      <label>Nome<input name="contributorName" maxLength={120} required={!anonymous} disabled={anonymous} placeholder={anonymous ? "A tua contribuição será anónima" : "Como queres ser identificado?"}/></label>
      <label>Email (opcional)<input type="email" name="contributorEmail" maxLength={180} autoComplete="email" placeholder="Para receber confirmação do estado"/><small>Usaremos este email apenas para avisar quando a organização confirmar ou recusar o registo.</small></label>
      <label className="public-contribution-anonymous"><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)}/> Quero contribuir anonimamente</label>
      <label>Mensagem (opcional)<textarea name="message" maxLength={1000} placeholder="Deixa uma mensagem para a família ou organização."/></label>
      <label>Comprovativo {event.proofRequired ? <span className="required-label">obrigatório</span> : <span className="optional-label">opcional</span>}<input type="file" accept="image/jpeg,image/png,application/pdf" required={event.proofRequired} onChange={e => setFile(e.target.files?.[0] ?? null)}/><small>JPG, PNG ou PDF · máximo 5 MB. O comprovativo fica privado e só é visível aos membros do evento.</small></label>
      <label className="public-contribution-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary" disabled={busy}>{busy ? "A enviar…" : "Enviar para confirmação"}</button>
      <p className="public-contribution-disclaimer">A Nuvia não recebe nem processa o dinheiro. O organizador confirma o registo após verificar o pagamento.</p>
    </form>}
    <footer>Contribuições geridas com Nuvia</footer>
  </section></main>;
}
