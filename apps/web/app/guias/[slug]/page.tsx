'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

type Guide = { title: string; summary: string; body: string; category: string; reviewedAt: string | null; isDemo: boolean };

function renderLine(line: string, key: string) {
  const parts = line.split(/(https?:\/\/\S+)/g);
  return <p key={key}>{parts.map((part, index) => /^https?:\/\//.test(part)
    ? <a key={`${key}-${index}`} href={part.replace(/[),.;]+$/, '')} target="_blank" rel="noreferrer">{part.replace(/[),.;]+$/, '')} ↗</a>
    : part)}</p>;
}

function renderBody(body: string) {
  return body.trim().split(/\n\s*\n/).map((block, index) => {
    const lines = block.split('\n').filter(Boolean);
    const first = lines[0] ?? '';
    if (lines.length === 1 && first.length < 90 && /^[\p{Lu}\sÁÀÃÂÉÊÍÓÔÕÚÇ0-9:()–-]+$/u.test(first) && /[A-ZÁÀÃÂÉÊÍÓÔÕÚÇ]/.test(first)) {
      return <h2 key={`heading-${index}`}>{first}</h2>;
    }
    if (lines.length > 1 && lines.every((line) => /^\d+\.\s/.test(line))) {
      return <ol key={`list-${index}`}>{lines.map((line, lineIndex) => <li key={lineIndex}>{line.replace(/^\d+\.\s/, '')}</li>)}</ol>;
    }
    if (lines.length > 1 && lines.every((line) => /^[-•]\s/.test(line))) {
      return <ul key={`list-${index}`}>{lines.map((line, lineIndex) => <li key={lineIndex}>{line.replace(/^[-•]\s/, '')}</li>)}</ul>;
    }
    return <div key={`paragraph-${index}`}>{lines.map((line, lineIndex) => renderLine(line, `${index}-${lineIndex}`))}</div>;
  });
}

export default function GuidePage() {
  const { slug } = useParams<{ slug: string }>();
  const [guide, setGuide] = useState<Guide | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Guide>(`/guides/${slug}`).then(setGuide).catch((cause) => setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o guia.'));
  }, [slug]);

  return <main className="catalog-page">
    <a className="planner-back" href="/guias">← Guias</a>
    {guide ? <article className="guide-article">
      <p className="eyebrow">{guide.category}{guide.isDemo ? ' · Conteúdo de demonstração' : ''}</p>
      <h1>{guide.title}</h1>
      <p className="guide-summary">{guide.summary}</p>
      {guide.reviewedAt && <small>Revisto em {new Intl.DateTimeFormat('pt-AO', { dateStyle: 'long' }).format(new Date(guide.reviewedAt))}</small>}
      <div className="guide-body">{renderBody(guide.body)}</div>
    </article> : <section className="catalog-empty">
      <h2>{error || 'A carregar guia…'}</h2>
      <a className="button button-outline" href="/guias">Voltar aos guias</a>
    </section>}
  </main>;
}
