'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { formatAOA } from '../lib/format';

const projectKinds = [
  { value: 'WEDDING', label: 'Casamento', description: 'Planeamento do casamento e dos momentos ligados à celebração.', icon: '♡' },
  { value: 'ALAMBAMENTO', label: 'Alambamento', description: 'Preparativos, responsabilidades e celebração tradicional.', icon: '✦' },
  { value: 'PARTY', label: 'Festa', description: 'Uma festa ou celebração com programa e convidados próprios.', icon: '✧' },
  { value: 'OTHER', label: 'Outro evento', description: 'Um plano para qualquer outro tipo de evento.', icon: '◈' }
];
const provinces = ['Bengo', 'Benguela', 'Bié', 'Cabinda', 'Cuando', 'Cubango', 'Cuanza Norte', 'Cuanza Sul', 'Cunene', 'Huambo', 'Huíla', 'Icolo e Bengo', 'Luanda', 'Lunda Norte', 'Lunda Sul', 'Malanje', 'Moxico', 'Moxico Leste', 'Namibe', 'Uíge', 'Zaire'];
type ProjectKind = 'WEDDING'|'ALAMBAMENTO'|'PARTY'|'OTHER';
type Draft = { province: string; date: string; guestEstimate: number | undefined; budgetLimit: number | undefined; kind: ProjectKind };
const kindFromDraft = (draft: Partial<Draft> & {eventType?:string}):ProjectKind => {
  if (draft.kind && projectKinds.some(item=>item.value===draft.kind)) return draft.kind;
  if (draft.eventType==='ALAMBAMENTO') return 'ALAMBAMENTO';
  if (draft.eventType==='RECEPTION') return 'PARTY';
  if (draft.eventType==='CUSTOM') return 'OTHER';
  return 'WEDDING';
};

export default function Planner() {
  const [kind, setKind] = useState<ProjectKind>('WEDDING');
  const [province, setProvince] = useState('');
  const [date, setDate] = useState('');
  const [guests, setGuests] = useState('');
  const [budget, setBudget] = useState('');
  const [step, setStep] = useState<1 | 2 | 'result'>(1);

  useEffect(() => {
    const raw = sessionStorage.getItem('casar:planning-draft');
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as Partial<Draft> & { completed?: boolean; eventType?: string };
      setKind(kindFromDraft(draft));
      setProvince(draft.province ?? '');
      setDate(draft.date ?? '');
      setGuests(draft.guestEstimate ? String(draft.guestEstimate) : '');
      setBudget(draft.budgetLimit !== undefined ? String(draft.budgetLimit) : '');
      if (draft.completed) setStep('result');
    } catch {
      sessionStorage.removeItem('casar:planning-draft');
    }
  }, []);

  const draft = useMemo<Draft>(() => ({
    province,
    date,
    guestEstimate: guests ? Number(guests) : undefined,
    budgetLimit: budget !== '' ? Number(budget) : undefined,
    kind
  }), [province, date, guests, budget, kind]);

  function showResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sessionStorage.setItem('casar:planning-draft', JSON.stringify({ ...draft, completed: true }));
    setStep('result');
  }

  const suggestions = [
    ...(kind === 'WEDDING' ? ['Organizar documentos e decisões sobre cerimónia e celebração'] : []),
    ...(kind === 'ALAMBAMENTO' ? ['Conversar em família sobre preparativos, itens e responsabilidades'] : []),
    ...(kind === 'PARTY' ? ['Definir formato, prioridades e programa da festa'] : []),
    ...(kind === 'OTHER' ? ['Definir o objectivo, formato e pessoas envolvidas'] : []),
    province ? `Pesquisar espaços e serviços em ${province}` : 'Escolher a província onde querem celebrar',
    date ? `Confirmar disponibilidade dos serviços para ${new Intl.DateTimeFormat('pt-AO', { dateStyle: 'long', timeZone: 'Africa/Luanda' }).format(new Date(`${date}T12:00:00`))}` : 'Escolher uma data ou período que funcione para vocês',
    guests ? `Preparar uma primeira lista para cerca de ${Number(guests).toLocaleString('pt-AO')} convidados` : 'Estimar quantas pessoas gostariam de convidar',
    budget ? `Registar o limite de orçamento de ${formatAOA(budget)}` : 'Conversar sobre o orçamento disponível'
  ];

  if (step === 'result') return <section className="plan-result" aria-live="polite">
    <div className="result-mark">✓</div><p className="eyebrow">Roteiro inicial</p><h2>Um ponto de partida para vocês.</h2><p>Estas sugestões usam as respostas que deram. Podem ajustá-las mais tarde e acrescentar momentos diferentes ao mesmo projecto.</p><div className="draft-summary"><span>{projectKinds.find((item) => item.value === kind)?.label}</span>{province&&<span>{province}</span>}{date&&<span>{new Intl.DateTimeFormat('pt-AO',{dateStyle:'medium',timeZone:'Africa/Luanda'}).format(new Date(`${date}T12:00:00`))}</span>}</div>
    <ul>{suggestions.map((suggestion) => <li key={suggestion}><span>○</span>{suggestion}</li>)}</ul>
    <div className="result-actions"><button className="button button-outline" onClick={() => setStep(1)}>Rever respostas</button><a className="button button-primary" href="/criar-conta">Criar conta e continuar →</a><a className="button button-outline" href="/entrar">Já tenho conta</a></div>
    <small>As respostas ficam neste navegador até criares o projecto no painel. Ao criares conta ou entrares neste navegador, pré-preenchem o formulário do teu plano. Se já tens um projecto na conta, escolhe “Novo evento” para usar este roteiro.</small>
  </section>;

  return <>
    <div><div className="planner-progress-label"><span>Passo {step} de 2</span><span>{step === 1 ? 'Momento e local' : 'Data e convidados'}</span></div><div className="planner-progress-track" role="progressbar" aria-label="Progresso do roteiro" aria-valuemin={1} aria-valuemax={2} aria-valuenow={step}><span style={{ width: step === 1 ? '50%' : '100%' }}/></div></div>
    <form className="planner-form" onSubmit={showResult}>
      {step === 1 ? <>
      <fieldset><legend>Que tipo de projecto vais organizar?</legend><p className="planner-help">Esta categoria identifica o projecto. Podes incluir alambamento, cerimónia, recepção e outros momentos no mesmo plano.</p><div className="choice-grid project-kind-choice-grid">{projectKinds.map((item) => <label className={`choice project-kind-choice ${kind === item.value ? 'selected' : ''}`} key={item.value}><input type="radio" name="projectKind" value={item.value} checked={kind === item.value} onChange={() => setKind(item.value as ProjectKind)}/><span className="project-kind-choice-icon" aria-hidden="true">{item.icon}</span><span className="project-kind-choice-copy"><strong>{item.label}</strong><small>{item.description}</small></span></label>)}</div></fieldset>
        <label className="field-label">Em que província estão a pensar celebrar?<select value={province} onChange={(event) => setProvince(event.target.value)}><option value="">Ainda não decidimos</option>{provinces.map((item) => <option key={item}>{item}</option>)}</select></label>
        <button className="button button-primary planner-submit" type="button" onClick={() => setStep(2)}>Continuar <span aria-hidden="true">→</span></button>
      </> : <>
        <div><h2 className="planner-step-title">O que já sabem sobre a data?</h2><p className="planner-help">Tudo neste passo é opcional. Se ainda não decidiram, podem continuar.</p></div>
        <label className="field-label">Data prevista (opcional)<input type="date" value={date} onChange={(event) => setDate(event.target.value)}/></label>
        <div className="planner-fields"><label className="field-label">Convidados (estimativa)<input type="number" min="1" max="10000" inputMode="numeric" placeholder="Ainda não sabemos" value={guests} onChange={(event) => setGuests(event.target.value)}/><small className="field-hint">Podes alterar este número mais tarde.</small></label><label className="field-label">Orçamento aproximado (Kz)<input type="number" min="0" inputMode="numeric" placeholder="Opcional" value={budget} onChange={(event) => setBudget(event.target.value)}/><small className="field-hint">Não usamos médias de preço inventadas.</small></label></div>
        <div className="planner-step-actions"><button className="button button-outline" type="button" onClick={() => setStep(1)}>Voltar</button><button className="button button-primary planner-submit" type="submit">Ver sugestões <span aria-hidden="true">→</span></button></div>
      </>}
    </form>
  </>;
}
