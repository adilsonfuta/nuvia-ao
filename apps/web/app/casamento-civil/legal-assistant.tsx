'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';

type Item = { title: string; description: string; source: string; url: string | null; reviewedAt: string | null };
type Result = { status: string; confirmed: Item[]; conditional: Item[]; porConfirmar: Item[]; message: string; reviewedAt: string | null };
type Office = { name: string; province: string; municipality: string | null; address: string | null; phone: string | null; sourceUrl: string | null; reviewedAt: string | null };
type Source = { id: string; title: string; url: string | null; jurisdiction: string; reviewedAt: string | null; requirements: { id: string; title: string }[] };
type GuidanceStatus = { sourceCount: number; confirmedCount: number; conditionalCount: number; pendingCount: number; latestReviewedAt: string | null };
const provinces = ['Bengo', 'Benguela', 'Bié', 'Cabinda', 'Cuando', 'Cubango', 'Cuanza Norte', 'Cuanza Sul', 'Cunene', 'Huambo', 'Huíla', 'Icolo e Bengo', 'Luanda', 'Lunda Norte', 'Lunda Sul', 'Malanje', 'Moxico', 'Moxico Leste', 'Namibe', 'Uíge', 'Zaire'];
const previousOptions = ['Não', 'Sim', 'Por confirmar'];
const dateLabel = (date: string) => new Intl.DateTimeFormat('pt-AO', { dateStyle: 'long', timeZone: 'Africa/Luanda' }).format(new Date(date));

export default function LegalAssistant() {
  const [natA, setNatA] = useState('');
  const [natB, setNatB] = useState('');
  const [province, setProvince] = useState('');
  const [previousA, setPreviousA] = useState('Por confirmar');
  const [previousB, setPreviousB] = useState('Por confirmar');
  const [result, setResult] = useState<Result | null>(null);
  const [offices, setOffices] = useState<Office[] | null>(null);
  const [sources, setSources] = useState<Source[] | null>(null);
  const [guidanceStatus, setGuidanceStatus] = useState<GuidanceStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [officeLoading, setOfficeLoading] = useState(false);
  const [officeError, setOfficeError] = useState('');
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadGuidanceStatus() {
    setStatusLoading(true); setStatusError('');
    try { setGuidanceStatus(await api<GuidanceStatus>('/legal-guidance/status')); }
    catch (err) { setStatusError(err instanceof Error ? err.message : 'Não foi possível consultar o estado da informação.'); }
    finally { setStatusLoading(false); }
  }

  useEffect(() => { void loadGuidanceStatus(); }, []);

  async function evaluate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(''); setResult(null);
    try {
      setResult(await api<Result>('/legal-guidance/evaluate', { method: 'POST', body: JSON.stringify({ nationalityA: natA.trim(), nationalityB: natB.trim(), province, previousMarriageA: previousA, previousMarriageB: previousB }) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível avaliar a informação.');
    } finally { setLoading(false); }
  }

  async function toggleOffices() {
    if (offices !== null) { setOffices(null); return; }
    setOfficeLoading(true); setOfficeError('');
    try {
      const response = await api<{ items: Office[] }>('/registry-offices');
      setOffices(response.items);
    } catch (err) {
      setOfficeError(err instanceof Error ? err.message : 'Não foi possível carregar o directório.');
    } finally { setOfficeLoading(false); }
  }

  async function toggleSources() {
    if (sources !== null) { setSources(null); return; }
    setSourceLoading(true); setSourceError('');
    try { setSources(await api<Source[]>('/legal-sources')); }
    catch (err) { setSourceError(err instanceof Error ? err.message : 'Não foi possível carregar as fontes.'); }
    finally { setSourceLoading(false); }
  }

  function resultSection(title: string, items: Item[], empty?: string) {
    return <section className="legal-result-group"><h3>{title}</h3>{items.length ? items.map((item, index) => <article className="legal-requirement" key={`${item.title}-${index}`}><strong>{item.title}</strong><p>{item.description}</p><small>Fonte: {item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.source} ↗</a> : item.source}{item.reviewedAt ? ` · Revisto em ${dateLabel(item.reviewedAt)}` : ''}</small></article>) : empty ? <p className="empty-copy">{empty}</p> : null}</section>;
  }

  const applicableCount = guidanceStatus ? guidanceStatus.confirmedCount + guidanceStatus.conditionalCount + guidanceStatus.pendingCount : 0;
  const hasRequirements = applicableCount > 0;

  return <section className="legal-assistant">
    <section className="legal-path-card" aria-labelledby="sources-title">
      <div><p className="eyebrow">Consulta sem preencher o questionário</p><h2 id="sources-title">Fontes oficiais e Conservatórias</h2><p>Consulta fontes e contactos disponíveis, independentemente da avaliação do teu caso.</p></div>
      <div className="legal-path-actions"><button className="button button-outline" type="button" onClick={() => void toggleSources()} disabled={sourceLoading}>{sourceLoading ? 'A carregar fontes…' : sources !== null ? 'Ocultar fontes' : 'Ver fontes oficiais'}</button><button className="button button-outline" type="button" onClick={() => void toggleOffices()} disabled={officeLoading}>{officeLoading ? 'A carregar contactos…' : offices !== null ? 'Ocultar Conservatórias' : 'Ver Conservatórias'}</button></div>
      {sourceError && <p className="form-error" role="alert">{sourceError}</p>}
      {sources !== null && <div className="office-results">{sources.length ? sources.map(source => <article className="legal-requirement" key={source.id}><strong>{source.title}</strong><p>{source.jurisdiction} · {source.requirements.length} requisitos confirmados associados</p>{source.url && <small><a href={source.url} target="_blank" rel="noreferrer">Abrir fonte oficial ↗</a>{source.reviewedAt ? ` · Fonte revista em ${dateLabel(source.reviewedAt)}` : ''}</small>}</article>) : <p className="empty-copy">Ainda não há fontes oficiais revistas disponíveis para consulta.</p>}</div>}
      {officeError && <p className="form-error" role="alert">{officeError}</p>}
      {offices !== null && <div className="office-results">{offices.length ? offices.map((office, index) => <article className="legal-requirement" key={`${office.name}-${index}`}><strong>{office.name}</strong><p>{[office.municipality, office.province, office.address].filter(Boolean).join(' · ')}</p>{office.phone && <p>{office.phone}</p>}{office.sourceUrl && <small><a href={office.sourceUrl} target="_blank" rel="noreferrer">Fonte oficial ↗</a>{office.reviewedAt ? ` · Revisto em ${dateLabel(office.reviewedAt)}` : ''}</small>}</article>) : <p className="empty-copy">O directório ainda não tem contactos confirmados. Consulta as fontes abaixo ou contacta directamente a Conservatória da tua zona.</p>}</div>}
    </section>

    <section className="legal-check-card" aria-labelledby="case-check-title">
      <p className="eyebrow">Consulta contextual</p><h2 id="case-check-title">Ver informação para o vosso caso</h2>
      {statusLoading ? <p className="empty-copy">A verificar se há requisitos revistos disponíveis…</p> : statusError ? <div className="legal-status-error"><p>{statusError}</p><button className="button button-outline" type="button" onClick={() => void loadGuidanceStatus()}>Tentar novamente</button></div> : <div className={`verification-status ${hasRequirements ? 'status-available' : 'status-unavailable'}`}><span>{hasRequirements ? `${guidanceStatus?.sourceCount} fontes oficiais confirmadas` : 'Ainda não há requisitos revistos para apresentar'}</span><p>{hasRequirements ? `${guidanceStatus?.confirmedCount} confirmados · ${guidanceStatus?.conditionalCount} condicionais · ${guidanceStatus?.pendingCount} por confirmar. A indicação depende das respostas e deve ser validada junto da Conservatória.` : 'Para não te pedir dados sem utilidade, a avaliação está indisponível enquanto a equipa não registar requisitos com fonte oficial revista. Podes consultar Conservatórias ou fontes sem preencher o questionário.'}</p>{guidanceStatus?.latestReviewedAt && <small>Revisão mais recente: {dateLabel(guidanceStatus.latestReviewedAt)}</small>}</div>}

      {!statusLoading && !statusError && hasRequirements && <>
        <p>As respostas são usadas apenas para comparar com requisitos que têm uma fonte oficial registada. Não guardamos estas respostas no teu plano.</p>
        <form className="legal-form" onSubmit={evaluate}>
          <fieldset className="legal-person-fields"><legend>Pessoa A</legend><label>Nacionalidade<input required maxLength={120} value={natA} onChange={event => setNatA(event.target.value)} placeholder="Ex.: angolana"/><small>Se tiver dupla nacionalidade, indica ambas. Se não souberes, escreve “Por confirmar”.</small></label><label>Já foi casada?<select required value={previousA} onChange={event => setPreviousA(event.target.value)}>{previousOptions.map(option => <option key={option}>{option}</option>)}</select></label></fieldset>
          <fieldset className="legal-person-fields"><legend>Pessoa B</legend><label>Nacionalidade<input required maxLength={120} value={natB} onChange={event => setNatB(event.target.value)} placeholder="Ex.: angolana"/><small>Indica a nacionalidade ou escreve “Por confirmar”.</small></label><label>Já foi casada?<select required value={previousB} onChange={event => setPreviousB(event.target.value)}>{previousOptions.map(option => <option key={option}>{option}</option>)}</select></label></fieldset>
          <label className="legal-province-field">Província onde pretendem tratar do processo<select required value={province} onChange={event => setProvince(event.target.value)}><option value="">Escolher província</option>{provinces.map(item => <option key={item}>{item}</option>)}</select></label>
          <button className="button button-primary" disabled={loading}>{loading ? 'A comparar…' : 'Ver informação disponível →'}</button>
        </form>
      </>}

      {error && <p className="form-error" role="alert">{error}</p>}
      {result && <div className="legal-results" aria-live="polite"><div className="verification-status"><span>{result.confirmed.length ? 'Há requisitos confirmados para rever' : 'Não encontrámos requisitos confirmados para esta combinação'}</span><p>{result.message}</p></div>{!result.confirmed.length && !result.conditional.length && !result.porConfirmar.length && <p className="profile-missing">A ausência de resultados não significa que não sejam necessários documentos ou procedimentos. Confirma sempre com a Conservatória.</p>}{resultSection('Requisitos confirmados', result.confirmed)}{resultSection('Requisitos condicionais', result.conditional)}{resultSection('Informação por confirmar', result.porConfirmar)}</div>}
    </section>
  </section>;
}
