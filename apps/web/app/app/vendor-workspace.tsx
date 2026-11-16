'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { formatAOA } from '../lib/format';

export type ProjectVendorFavorite = { vendor: { id: string; slug: string; name: string; category: string; province: string | null; municipality: string | null; priceFrom: string | null; priceTo: string | null; isDemo: boolean } };
export type VendorReview = { id: string; rating: number; communicationRating: number; punctualityRating: number; qualityRating: number; comment: string | null; isAnonymous: boolean; status: 'PENDING'|'APPROVED'|'REJECTED'; rejectionReason: string | null; response: string | null; responseStatus: 'PENDING'|'APPROVED'|'REJECTED'|null; responseReason: string | null; createdAt: string };
export type VendorRequest = { id: string; message: string; status: 'NEW'|'SENT'|'RESPONDED'|'HIRED'|'CLOSED'; createdAt: string; quotedAmount: string | number | null; responseNote: string | null; respondedAt: string | null; expense: { id: string; title: string; amount: string | number } | null; review: VendorReview | null; vendor: { id: string; slug: string; name: string; category: string; province: string | null; isDemo: boolean } };
type DirectoryVendor = { id:string;slug:string;name:string;category:string;description:string|null;province:string|null;municipality:string|null;priceFrom:string|null;priceTo:string|null;verifiedAt:string|null;isDemo:boolean };
type VendorProfile = DirectoryVendor & { services:string[];serviceAreas:string[];galleryUrls:string[];capacityMin:number|null;capacityMax:number|null;bookingTerms:string|null;paymentTerms:string|null;cancellationTerms:string|null;phone:string|null;email:string|null;hasManager:boolean };

const statusLabel: Record<VendorRequest['status'], string> = { NEW: 'Guardado · ainda não enviado', SENT: 'Enviado manualmente', RESPONDED: 'Resposta recebida', HIRED: 'Contratado', CLOSED: 'Fechado' };
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('pt-AO', { dateStyle: 'medium', timeZone: 'Africa/Luanda' }).format(new Date(value)) : 'Por definir';
const quoteLink = (projectId: string, slug: string) => `/fornecedores/${slug}?projectId=${encodeURIComponent(projectId)}`;
const vendorCategories = ['Catering','Decoração','Fotografia e vídeo','Música e DJ','Beleza','Transportes','Bolos e doces','Organização','Espaços'];
const vendorProvinces = ['Bengo','Benguela','Bié','Cabinda','Cuando','Cubango','Cuanza Norte','Cuanza Sul','Cunene','Huambo','Huíla','Icolo e Bengo','Luanda','Lunda Norte','Lunda Sul','Malanje','Moxico','Moxico Leste','Namibe','Uíge','Zaire'];
type ReviewDraft = { requestId: string; rating: number; communicationRating: number; punctualityRating: number; qualityRating: number; comment: string; isAnonymous: boolean };
const luandaDateKey = (value: Date) => Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'Africa/Luanda', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value).map(part => [part.type, part.value]));
const isPastEventDate = (value: string | null) => { if (!value) return false; const event = luandaDateKey(new Date(value)); const today = luandaDateKey(new Date()); return `${event.year}-${event.month}-${event.day}` < `${today.year}-${today.month}-${today.day}`; };

export function VendorWorkspace({ projectId, projectTitle, projectDate, province, guestEstimate, favorites, requests, onRefresh, onOpenBudget }: {
  projectId: string; projectTitle: string; projectDate: string | null; province: string | null; guestEstimate: number | null;
  favorites: ProjectVendorFavorite[]; requests: VendorRequest[]; onRefresh: () => Promise<void>; onOpenBudget: () => void;
}) {
  const [filter, setFilter] = useState('ALL');
  const [responseId, setResponseId] = useState('');
  const [responseAmount, setResponseAmount] = useState('');
  const [responseNote, setResponseNote] = useState('');
  const [hireId, setHireId] = useState('');
  const [hireAmount, setHireAmount] = useState('');
  const [hireDueAt, setHireDueAt] = useState('');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorCategory, setVendorCategory] = useState('');
  const [vendorProvince, setVendorProvince] = useState('');
  const [vendorResults, setVendorResults] = useState<DirectoryVendor[]>([]);
  const [vendorSearchBusy, setVendorSearchBusy] = useState(false);
  const [vendorSearchError, setVendorSearchError] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<VendorProfile|null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [quoteMessage, setQuoteMessage] = useState('');
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteNotice, setQuoteNotice] = useState('');
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const filteredRequests = useMemo(() => filter === 'ALL' ? requests : requests.filter((request) => request.status === filter), [filter, requests]);

  useEffect(() => { void searchVendors(); }, []);
  useEffect(() => {
    if (!selectedVendor) return;
    const closeOnEscape = (event:KeyboardEvent) => { if (event.key === 'Escape') setSelectedVendor(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedVendor]);

  async function searchVendors(event?:FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setVendorSearchBusy(true); setVendorSearchError('');
    const params = new URLSearchParams();
    if (vendorSearch.trim()) params.set('search', vendorSearch.trim());
    if (vendorCategory) params.set('category', vendorCategory);
    if (vendorProvince) params.set('province', vendorProvince);
    try { setVendorResults(await api<DirectoryVendor[]>(`/vendors?${params.toString()}`)); }
    catch (err) { setVendorSearchError(err instanceof Error ? err.message : 'Não foi possível pesquisar fornecedores.'); }
    finally { setVendorSearchBusy(false); }
  }

  async function openVendor(slug:string) {
    setSelectedVendor(null); setProfileError(''); setQuoteNotice(''); setQuoteMessage(''); setProfileLoading(true);
    try { setSelectedVendor(await api<VendorProfile>(`/vendors/${slug}`)); }
    catch (err) { setProfileError(err instanceof Error ? err.message : 'Não foi possível carregar o perfil.'); }
    finally { setProfileLoading(false); }
  }

  async function toggleProjectFavorite(vendorId:string) {
    const saved = favorites.some(item => item.vendor.id === vendorId);
    try {
      await api(`/projects/${projectId}/vendors/favorites${saved ? `/${vendorId}` : ''}`, { method:saved ? 'DELETE' : 'POST', ...(saved ? {} : { body:JSON.stringify({vendorId}) }) });
      await onRefresh();
    } catch (err) { setVendorSearchError(err instanceof Error ? err.message : 'Não foi possível actualizar a lista do evento.'); }
  }

  async function createQuoteRequest(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedVendor) return;
    setQuoteBusy(true); setQuoteNotice(''); setProfileError('');
    const context = [`Evento: ${projectTitle}`,`Data: ${formatDate(projectDate)}`,`Local: ${province || 'Por definir'}`,`Participantes: ${guestEstimate || 'Por definir'}`].join('\n');
    try {
      const result = await api<{ deliveredToPortal: boolean; vendorName: string }>('/quote-requests',{method:'POST',body:JSON.stringify({projectId,vendorId:selectedVendor.id,message:`${context}\n\n${quoteMessage.trim()}`})});
      setQuoteMessage(''); setQuoteNotice(result.deliveredToPortal ? `Pedido enviado para a área Nuvia de ${result.vendorName}. A resposta aparecerá aqui.` : 'Pedido guardado no acompanhamento deste evento. Este perfil ainda não recebe pedidos dentro da Nuvia; contacta o prestador pelos dados do perfil.'); await onRefresh();
    } catch (err) { setProfileError(err instanceof Error ? err.message : 'Não foi possível guardar o pedido.'); }
    finally { setQuoteBusy(false); }
  }

  async function removeFavorite(vendorId: string) {
    try { await api(`/projects/${projectId}/vendors/favorites/${vendorId}`, { method: 'DELETE' }); await onRefresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível remover o favorito.'); }
  }
  async function updateRequest(requestId: string, patch: Record<string, unknown>) {
    setBusyId(requestId); setError('');
    try { await api(`/projects/${projectId}/quote-requests/${requestId}`, { method: 'PATCH', body: JSON.stringify(patch) }); await onRefresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível actualizar o pedido.'); }
    finally { setBusyId(''); }
  }
  async function saveResponse(event: FormEvent<HTMLFormElement>, requestId: string) {
    event.preventDefault();
    await updateRequest(requestId, { status: 'RESPONDED', quotedAmount: responseAmount === '' ? null : Number(responseAmount), responseNote: responseNote.trim() || null });
    setResponseId('');
  }
  async function hire(event: FormEvent<HTMLFormElement>, requestId: string) {
    event.preventDefault(); setBusyId(requestId); setError('');
    try { await api(`/projects/${projectId}/quote-requests/${requestId}/hire`, { method: 'POST', body: JSON.stringify({ amount: Number(hireAmount), dueAt: hireDueAt ? new Date(`${hireDueAt}T12:00:00`).toISOString() : undefined }) }); await onRefresh(); setHireId(''); setHireAmount(''); setHireDueAt(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível registar a contratação.'); }
    finally { setBusyId(''); }
  }
  function openReview(request: VendorRequest) {
    const review = request.review;
    setReviewDraft({ requestId: request.id, rating: review?.rating ?? 5, communicationRating: review?.communicationRating ?? 5, punctualityRating: review?.punctualityRating ?? 5, qualityRating: review?.qualityRating ?? 5, comment: review?.comment ?? '', isAnonymous: review?.isAnonymous ?? true });
  }
  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!reviewDraft) return;
    setReviewBusy(true); setError('');
    try {
      await api(`/projects/${projectId}/quote-requests/${reviewDraft.requestId}/review`, { method: 'POST', body: JSON.stringify({ ...reviewDraft, comment: reviewDraft.comment.trim() || undefined }) });
      setReviewDraft(null); await onRefresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível enviar a avaliação.'); }
    finally { setReviewBusy(false); }
  }

  return <div className="vendor-workspace">
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="vendor-catalog-panel" id="vendor-catalog" aria-labelledby="vendor-catalog-title">
      <header className="vendor-workspace-heading"><div><p className="eyebrow">Pesquisa sem sair do evento</p><h3 id="vendor-catalog-title">Encontrar fornecedores</h3></div><span>{vendorResults.length} {vendorResults.length === 1 ? 'perfil' : 'perfis'}</span></header>
      <form className="vendor-dashboard-filters" onSubmit={(event)=>void searchVendors(event)}>
        <label>Nome ou serviço<input value={vendorSearch} onChange={event=>setVendorSearch(event.target.value)} placeholder="Ex.: fotografia, catering…"/></label>
        <label>Categoria<select value={vendorCategory} onChange={event=>setVendorCategory(event.target.value)}><option value="">Todas</option>{vendorCategories.map(item=><option key={item}>{item}</option>)}</select></label>
        <label>Província<select value={vendorProvince} onChange={event=>setVendorProvince(event.target.value)}><option value="">Todas</option>{vendorProvinces.map(item=><option key={item}>{item}</option>)}</select></label>
        <button className="button button-primary compact" disabled={vendorSearchBusy}>{vendorSearchBusy?'A pesquisar…':'Pesquisar'}</button>
      </form>
      {vendorSearchError && <p className="form-error" role="alert">{vendorSearchError}</p>}
      {vendorSearchBusy ? <p className="vendor-catalog-empty">A carregar perfis…</p> : vendorResults.length ? <div className="vendor-dashboard-grid">{vendorResults.map(vendor=>{
        const saved=favorites.some(item=>item.vendor.id===vendor.id);
        return <article className="vendor-dashboard-card" key={vendor.id}>
          <div className="vendor-dashboard-card-top"><span className="vendor-monogram" aria-hidden="true">{vendor.name.slice(0,1)}</span><span className="vendor-dashboard-category">{vendor.category}</span>{vendor.isDemo&&<span className="demo-badge">Demonstração</span>}</div>
          <h4>{vendor.name}</h4><p className="vendor-dashboard-description">{vendor.description||'Descrição ainda não disponível.'}</p>
          <div className="vendor-dashboard-facts"><span>{[vendor.municipality,vendor.province].filter(Boolean).join(', ')||'Local por confirmar'}</span><span>{vendor.priceFrom?`A partir de ${formatAOA(vendor.priceFrom)}${vendor.priceTo?` · até ${formatAOA(vendor.priceTo)}`:''}`:'Preço por consultar'}</span></div>
          <footer><button type="button" className="vendor-dashboard-details" onClick={()=>void openVendor(vendor.slug)}>Ver detalhes</button><button type="button" className={saved?'favorite-button saved':'favorite-button'} aria-pressed={saved} onClick={()=>void toggleProjectFavorite(vendor.id)}>{saved?'Guardado':'Guardar no evento'}</button></footer>
        </article>;
      })}</div> : <div className="vendor-catalog-empty"><strong>{vendorSearch||vendorCategory||vendorProvince?'Não encontrámos perfis com estes filtros.':'Ainda não há perfis publicados.'}</strong><span>{vendorSearch||vendorCategory||vendorProvince?'Tenta outra pesquisa ou categoria.':'Quando houver perfis activos, aparecerão aqui para comparar.'}</span></div>}
      <p className="vendor-request-disclosure">Os perfis demonstrativos são fictícios. Os pedidos ficam registados para acompanhamento e ainda não são enviados pela plataforma.</p>
    </section>

    <section className="vendor-shortlist" aria-labelledby="vendor-shortlist-title"><header className="vendor-workspace-heading"><div><p className="eyebrow">Comparar opções</p><h3 id="vendor-shortlist-title">Lista curta <span>{favorites.length}</span></h3></div><p>Os favoritos ficam associados a este evento.</p></header>
      {favorites.length ? <div className="vendor-compare-grid">{favorites.map(({ vendor }) => <article className="vendor-compare-card" key={vendor.id}>
        <div className="vendor-compare-card-heading"><div><small>{vendor.category}</small><h4>{vendor.name}</h4></div>{vendor.isDemo && <span className="demo-badge">Demonstração</span>}</div>
        <dl><div><dt>Localização</dt><dd>{[vendor.municipality, vendor.province].filter(Boolean).join(', ') || 'Por confirmar'}</dd></div><div><dt>Faixa de preço publicada</dt><dd>{vendor.priceFrom ? `${formatAOA(vendor.priceFrom)}${vendor.priceTo ? ` – ${formatAOA(vendor.priceTo)}` : ' +'}` : 'Sem preço publicado'}</dd></div></dl>
        <footer><button type="button" onClick={() => void openVendor(vendor.slug)}>Ver detalhes</button><button type="button" onClick={() => void removeFavorite(vendor.id)}>Remover</button></footer>
      </article>)}</div> : <div className="vendor-shortlist-empty"><p>Ainda não guardaste fornecedores para este evento.</p><a href={`/fornecedores?projectId=${encodeURIComponent(projectId)}`}>Explorar o directório →</a></div>}
    </section>

    <section className="vendor-requests" aria-labelledby="vendor-requests-title"><header className="vendor-workspace-heading"><div><p className="eyebrow">Acompanhamento</p><h3 id="vendor-requests-title">Pedidos de informação <span>{requests.length}</span></h3></div><label>Mostrar<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ALL">Todos os estados</option><option value="NEW">Guardados</option><option value="SENT">Enviados manualmente</option><option value="RESPONDED">Com resposta</option><option value="HIRED">Contratados</option><option value="CLOSED">Fechados</option></select></label></header>
      <p className="vendor-request-disclosure">Os pedidos para perfis com gestão activa são entregues na área Nuvia do prestador. Nos restantes perfis, usa os contactos publicados e regista o acompanhamento aqui. Perfis demonstrativos são fictícios.</p>
      {filteredRequests.length ? <div className="vendor-request-list">{filteredRequests.map((request) => <article className="vendor-request-card" key={request.id}>
        <header><div><small>{request.vendor.category} · Criado em {formatDate(request.createdAt)}</small><h4><button type="button" className="vendor-request-vendor-link" onClick={()=>void openVendor(request.vendor.slug)}>{request.vendor.name}</button></h4></div><span className={`vendor-request-status ${request.status.toLowerCase()}`}>{statusLabel[request.status]}</span></header>
        {request.vendor.isDemo && <p className="vendor-demo-note">Perfil demonstrativo: nenhum prestador real será contactado.</p>}
        <p className="vendor-request-message">{request.message}</p>
        {request.status === 'NEW' && <small className="vendor-next-action">Próximo passo: contactar o fornecedor directamente; depois actualiza o estado aqui.</small>}
        {request.status === 'SENT' && <button type="button" className="vendor-inline-action" onClick={() => { setResponseId(responseId === request.id ? '' : request.id); setResponseAmount(request.quotedAmount ? String(request.quotedAmount) : ''); setResponseNote(request.responseNote || ''); }}>Registar resposta recebida</button>}
        {(request.status === 'RESPONDED' || responseId === request.id) && <form className="vendor-response-form" onSubmit={(event) => void saveResponse(event, request.id)}><label>Valor recebido (Kz)<input type="number" min="0" step="any" value={responseAmount} onChange={(event) => setResponseAmount(event.target.value)} placeholder="Ainda não informado"/></label><label>Notas da resposta<textarea rows={2} maxLength={2000} value={responseNote} onChange={(event) => setResponseNote(event.target.value)} placeholder="Disponibilidade, condições ou detalhes recebidos"/></label><button className="button button-outline compact" disabled={busyId === request.id}>{busyId === request.id ? 'A guardar…' : 'Guardar resposta'}</button></form>}
        {request.status !== 'HIRED' && request.status !== 'CLOSED' && <div className="vendor-request-actions"><label>Estado<select value={request.status} onChange={(event) => void updateRequest(request.id, { status: event.target.value })} disabled={busyId === request.id}><option value="NEW">Guardado · ainda não enviado</option><option value="SENT">Enviado manualmente</option><option value="RESPONDED">Resposta recebida</option><option value="CLOSED">Fechado</option></select></label><button type="button" className="button button-primary compact" onClick={() => { setHireId(hireId === request.id ? '' : request.id); setHireAmount(request.quotedAmount ? String(request.quotedAmount) : ''); }} disabled={busyId === request.id}>Marcar contratado</button></div>}
        {request.status === 'HIRED' && request.expense && <button type="button" className="vendor-inline-action" onClick={onOpenBudget}>Despesa criada: {request.expense.title} · {formatAOA(request.expense.amount)} → Ver orçamento</button>}
        {request.status === 'HIRED' && <section className="vendor-review-prompt"><h5>Avaliação do serviço</h5>{!isPastEventDate(projectDate) ? <p>A avaliação fica disponível depois da data do evento.</p> : request.review?.status === 'APPROVED' ? <p className="vendor-review-state">Avaliação publicada · {request.review.rating}/5{request.review.responseStatus === 'PENDING' ? ' · resposta do fornecedor em revisão' : ''}</p> : request.review?.status === 'PENDING' ? <p className="vendor-review-state">A tua avaliação está em revisão antes de ser publicada.</p> : <><p>{request.review?.status === 'REJECTED' ? `A avaliação precisa de alterações: ${request.review.rejectionReason || 'revê o comentário e volta a enviar.'}` : 'Partilha como correu o serviço. A equipa revê a avaliação antes da publicação.'}</p><button type="button" className="vendor-inline-action" onClick={() => openReview(request)}>{request.review?.status === 'REJECTED' ? 'Editar e reenviar' : 'Avaliar serviço'}</button></>}{reviewDraft?.requestId === request.id && <form className="vendor-review-form" onSubmit={event => void submitReview(event)}><RatingScale label="Avaliação geral" value={reviewDraft.rating} onChange={rating => setReviewDraft(current => current ? { ...current, rating } : current)}/><RatingScale label="Qualidade do serviço" value={reviewDraft.qualityRating} onChange={qualityRating => setReviewDraft(current => current ? { ...current, qualityRating } : current)}/><RatingScale label="Comunicação" value={reviewDraft.communicationRating} onChange={communicationRating => setReviewDraft(current => current ? { ...current, communicationRating } : current)}/><RatingScale label="Pontualidade" value={reviewDraft.punctualityRating} onChange={punctualityRating => setReviewDraft(current => current ? { ...current, punctualityRating } : current)}/><label>Comentário opcional<textarea maxLength={1500} value={reviewDraft.comment} onChange={e => setReviewDraft(current => current ? { ...current, comment: e.target.value } : current)} placeholder="Descreve a tua experiência com este serviço."/></label><label className="vendor-review-anonymous"><input type="checkbox" checked={reviewDraft.isAnonymous} onChange={e => setReviewDraft(current => current ? { ...current, isAnonymous: e.target.checked } : current)}/> Publicar sem o meu nome (recomendado)</label><small>Apenas serviços marcados como contratados podem ser avaliados. A plataforma associa a avaliação ao pedido e à despesa marcados como contratados; não confirma a contratação junto do prestador.</small><div><button type="button" className="button button-outline compact" onClick={() => setReviewDraft(null)}>Cancelar</button><button className="button button-primary compact" disabled={reviewBusy}>{reviewBusy ? 'A enviar…' : 'Enviar para revisão'}</button></div></form>}</section>}
        {hireId === request.id && request.status !== 'HIRED' && <form className="vendor-hire-form" onSubmit={(event) => void hire(event, request.id)}><p>Ao confirmar, o pedido passa a contratado e uma despesa “Contratada” é criada no orçamento deste evento.</p><label>Valor acordado (Kz)<input required type="number" min="0" step="any" value={hireAmount} onChange={(event) => setHireAmount(event.target.value)} placeholder="Valor confirmado"/></label><label>Prazo de pagamento (opcional)<input type="date" value={hireDueAt} onChange={(event) => setHireDueAt(event.target.value)}/></label><div><button type="button" className="button button-outline compact" onClick={() => setHireId('')}>Cancelar</button><button className="button button-primary compact" disabled={busyId === request.id}>{busyId === request.id ? 'A guardar…' : 'Confirmar contratação'}</button></div></form>}
        {request.status === 'CLOSED' && <button type="button" className="vendor-inline-action" onClick={() => void updateRequest(request.id, { status: 'SENT' })}>Reabrir acompanhamento</button>}
      </article>)}</div> : <p className="vendor-shortlist-empty">{requests.length ? 'Não há pedidos neste estado.' : 'Ainda não há pedidos. Abre os detalhes de um fornecedor acima para guardar um pedido para este evento.'}</p>}
    </section>

    {(profileLoading||selectedVendor||profileError)&&<div className="vendor-profile-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget){setSelectedVendor(null);setProfileError('');}}}>
      <section className="vendor-profile-drawer" role="dialog" aria-modal="true" aria-labelledby="vendor-drawer-title">
        <header className="vendor-drawer-header"><div><p className="eyebrow">Perfil do fornecedor</p><h2 id="vendor-drawer-title">{selectedVendor?.name||'Detalhes'}</h2></div><button type="button" aria-label="Fechar perfil" onClick={()=>{setSelectedVendor(null);setProfileError('');}}>×</button></header>
        {profileLoading?<p className="vendor-catalog-empty">A carregar informação…</p>:selectedVendor&&<div className="vendor-drawer-content">
          {selectedVendor.isDemo&&<p className="demo-disclosure">Perfil de demonstração: estes dados são exemplos e não representam uma oferta real.</p>}
          <div className="vendor-drawer-summary"><span>{selectedVendor.category}</span><span>{[selectedVendor.municipality,selectedVendor.province].filter(Boolean).join(', ')||'Localização por confirmar'}</span><strong>{selectedVendor.priceFrom?`${formatAOA(selectedVendor.priceFrom)}${selectedVendor.priceTo?` – ${formatAOA(selectedVendor.priceTo)}`:' +'}`:'Preço sob consulta'}</strong></div>
          <section><h3>Sobre</h3><p>{selectedVendor.description||'O prestador ainda não publicou uma descrição.'}</p></section>
          {selectedVendor.services.length>0&&<section><h3>Serviços</h3><ul>{selectedVendor.services.map(service=><li key={service}>{service}</li>)}</ul></section>}
          <section className="vendor-drawer-terms"><h3>Informação prática</h3><dl><div><dt>Zonas atendidas</dt><dd>{selectedVendor.serviceAreas.length?selectedVendor.serviceAreas.join(', '):'Por confirmar'}</dd></div><div><dt>Capacidade</dt><dd>{selectedVendor.capacityMin&&selectedVendor.capacityMax?`${selectedVendor.capacityMin}–${selectedVendor.capacityMax} pessoas`:selectedVendor.capacityMin?`A partir de ${selectedVendor.capacityMin} pessoas`:selectedVendor.capacityMax?`Até ${selectedVendor.capacityMax} pessoas`:'Não indicada'}</dd></div><div><dt>Reserva</dt><dd>{selectedVendor.bookingTerms||'Por confirmar'}</dd></div><div><dt>Pagamento</dt><dd>{selectedVendor.paymentTerms||'Por confirmar'}</dd></div></dl></section>
          {selectedVendor.galleryUrls.length>0&&<section><h3>Portefólio</h3><div className="vendor-drawer-gallery">{selectedVendor.galleryUrls.slice(0,6).map((url,index)=><img src={url} alt={`Trabalho ${index+1} de ${selectedVendor.name}`} key={`${url}-${index}`} loading="lazy"/>)}</div></section>}
          {!selectedVendor.isDemo&&(selectedVendor.phone||selectedVendor.email)&&<section className="vendor-drawer-contact"><h3>Contacto publicado</h3><div>{selectedVendor.phone&&<a href={`tel:${selectedVendor.phone}`}>{selectedVendor.phone}</a>}{selectedVendor.email&&<a href={`mailto:${selectedVendor.email}`}>{selectedVendor.email}</a>}</div></section>}
          {profileError&&<p className="form-error" role="alert">{profileError}</p>}{quoteNotice&&<p className="quote-notice" role="status">{quoteNotice}</p>}
          <form className="vendor-drawer-request" onSubmit={event=>void createQuoteRequest(event)}><h3>Pedir informação para este evento</h3><p>{selectedVendor.hasManager && !selectedVendor.isDemo ? 'O pedido será entregue na área Nuvia deste prestador.' : 'O pedido fica guardado no teu acompanhamento. Para obter resposta, contacta o prestador através dos dados publicados.'}</p><label>Mensagem<textarea required minLength={10} maxLength={1400} value={quoteMessage} onChange={event=>setQuoteMessage(event.target.value)} placeholder="Que informação ou orçamento queres pedir?"/></label><button className="button button-primary compact" disabled={quoteBusy}>{quoteBusy?'A enviar…':'Enviar pedido'}</button></form>
          <div className="vendor-drawer-footer"><button type="button" className="favorite-button" onClick={()=>void toggleProjectFavorite(selectedVendor.id)}>{favorites.some(item=>item.vendor.id===selectedVendor.id)?'Remover dos favoritos':'Guardar nos favoritos'}</button><a href={quoteLink(projectId,selectedVendor.slug)}>Abrir perfil completo ↗</a></div>
        </div>}
      </section>
    </div>}
  </div>;
}

function RatingScale({ label, value, onChange }: { label: string; value: number; onChange: (rating: number) => void }) {
  return <fieldset className="vendor-rating-scale"><legend>{label}</legend><div>{[1, 2, 3, 4, 5].map(rating => <button key={rating} type="button" aria-label={`${rating} de 5`} aria-pressed={value === rating} onClick={() => onChange(rating)}>{rating} ★</button>)}</div></fieldset>;
}
