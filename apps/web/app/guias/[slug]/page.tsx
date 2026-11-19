'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { GUIDE_ACTIONS, GUIDE_COVERS } from '../guide-data';

type Guide = { id?: string; slug: string; title: string; summary: string; body: string; category: string; readingMinutes: number; coverImage: string | null; reviewedAt: string | null; isDemo: boolean };

function headingId(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-AO').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function renderInline(text: string, key: string) {
  const chunks = text.split(/(\[[^\]]+\]\(https?:\/\/[^)]+\)|https?:\/\/[^\s]+|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return chunks.map((chunk, index) => {
    const link = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(chunk);
    if (link) return <a key={`${key}-${index}`} href={link[2]} target="_blank" rel="noreferrer">{link[1]} ↗</a>;
    if (/^https?:\/\//.test(chunk)) {
      const url = chunk.replace(/[),.;]+$/, '');
      return <a key={`${key}-${index}`} href={url} target="_blank" rel="noreferrer">{url} ↗</a>;
    }
    if (chunk.startsWith('**') && chunk.endsWith('**')) return <strong key={`${key}-${index}`}>{chunk.slice(2, -2)}</strong>;
    if (chunk.startsWith('*') && chunk.endsWith('*')) return <em key={`${key}-${index}`}>{chunk.slice(1, -1)}</em>;
    return chunk;
  });
}

function ChecklistItems({ slug, items }: { slug: string; items: string[] }) {
  const storageKey = `nuvia-guide-checklist:${slug}`;
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false));

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
      if (Array.isArray(saved) && saved.length === items.length) setChecked(saved.map(Boolean));
    } catch { /* local checklist is optional */ }
  }, [items.length, storageKey]);

  function toggle(index: number, value: boolean) {
    setChecked((current) => {
      const next = current.map((item, itemIndex) => itemIndex === index ? value : item);
      try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* continue without persistence */ }
      return next;
    });
  }

  const completed = checked.filter(Boolean).length;
  return <div className="guide-checklist">
    <div className="guide-checklist-progress"><span>Checklist interactiva</span><strong>{completed} de {items.length}</strong></div>
    {items.map((item, index) => <label className={checked[index] ? 'is-checked' : ''} key={`${slug}-${index}`}>
      <input type="checkbox" checked={checked[index] ?? false} onChange={(event) => toggle(index, event.target.checked)} />
      <span>{renderInline(item, `check-${index}`)}</span>
    </label>)}
  </div>;
}

function renderBody(body: string, slug: string) {
  let checklistSection = false;
  return body.trim().split(/\n\s*\n/).map((block, index) => {
    const lines = block.split('\n').filter(Boolean);
    const first = lines[0] ?? '';
    const heading = /^(#{2,3})\s+(.+)$/.exec(first);
    if (heading) {
      checklistSection = /checklist/i.test(heading[2]);
      const id = headingId(heading[2]);
      return heading[1].length === 2
        ? <h2 id={id} key={`heading-${index}`}>{heading[2]}</h2>
        : <h3 id={id} key={`subheading-${index}`}>{heading[2]}</h3>;
    }
    if (lines.length === 1 && /^---+$/.test(first)) return <hr key={`rule-${index}`} />;

    const isTable = lines.length > 1 && lines.every((line) => /^\|.*\|$/.test(line.trim()));
    if (isTable) {
      const rows = lines.filter((line) => !/^\|\s*:?-{2,}/.test(line.trim())).map((line) => line.trim().slice(1, -1).split('|').map((cell) => cell.trim()));
      const [header, ...data] = rows;
      return <div className="guide-table-wrap" key={`table-${index}`}><table className="guide-table"><thead><tr>{header.map((cell, cellIndex) => <th key={cellIndex}>{renderInline(cell, `th-${cellIndex}`)}</th>)}</tr></thead><tbody>{data.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{renderInline(cell.replace(/\*\*/g, ''), `td-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody></table></div>;
    }

    const listLines = lines.every((line) => /^[-•]\s/.test(line) || /^\d+\.\s/.test(line));
    if (listLines) {
      const items = lines.map((line) => line.replace(/^(?:[-•]|\d+)\.??\s/, ''));
      const ordered = lines.every((line) => /^\d+\.\s/.test(line));
      if (checklistSection && !ordered) return <ChecklistItems key={`checklist-${slug}-${index}`} slug={slug} items={items} />;
      const List = ordered ? 'ol' : 'ul';
      return <List key={`list-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `item-${index}-${itemIndex}`)}</li>)}</List>;
    }

    if (first.startsWith('*') && first.endsWith('*') && lines.length === 1) return <p className="guide-editorial-note" key={`note-${index}`}>{renderInline(first, `note-${index}`)}</p>;
    return <p key={`paragraph-${index}`}>{renderInline(lines.join(' '), `paragraph-${index}`)}</p>;
  });
}

function ReviewDate({ value }: { value: string }) {
  return <time dateTime={value}>{new Intl.DateTimeFormat('pt-AO', { dateStyle: 'long', timeZone: 'Africa/Luanda' }).format(new Date(value))}</time>;
}

export default function GuidePage() {
  const { slug } = useParams<{ slug: string }>();
  const [guide, setGuide] = useState<Guide | null>(null);
  const [relatedGuides, setRelatedGuides] = useState<Guide[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Guide>(`/guides/${slug}`).then((loaded) => {
      setGuide(loaded);
      void api<Guide[]>('/guides').then((all) => setRelatedGuides(all.filter((item) => item.slug !== loaded.slug).sort((a, b) => Number(b.category === loaded.category) - Number(a.category === loaded.category)).slice(0, 3))).catch(() => setRelatedGuides([]));
    }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o guia.'));
  }, [slug]);

  const sections = useMemo(() => guide?.body.match(/^##\s+.+$/gm)?.map((line) => line.replace(/^##\s+/, '')) ?? [], [guide?.body]);
  const action = guide ? GUIDE_ACTIONS[guide.slug] : undefined;
  const mappedCover = guide ? GUIDE_COVERS[guide.slug] : undefined;
  const cover = guide?.coverImage ? { src: guide.coverImage, alt: mappedCover?.alt || guide.title } : mappedCover;

  return <main className="catalog-page guide-page">
    <Link className="planner-back" href="/guias">← Guias</Link>
    {guide ? <article className="guide-article">
      {cover && <div className="guide-article-cover"><Image src={cover.src} alt={cover.alt} width={1600} height={900} priority unoptimized={cover.src.startsWith('/api/v1/')} sizes="(max-width: 900px) 100vw, 850px" /></div>}
      <p className="eyebrow">{guide.category}{guide.isDemo ? ' · Conteúdo de demonstração' : ''}</p>
      <h1>{guide.title}</h1>
      <p className="guide-summary">{guide.summary}</p>
      <div className="guide-article-meta"><span>{guide.readingMinutes} min de leitura</span>{guide.reviewedAt && <span>Revisto em <ReviewDate value={guide.reviewedAt} /></span>}</div>
      {sections.length > 2 && <nav className="guide-toc" aria-label="Neste guia"><strong>Neste guia</strong><ol>{sections.map((section) => <li key={section}><a href={`#${headingId(section)}`}>{section}</a></li>)}</ol></nav>}
      <div className="guide-body">{renderBody(guide.body, guide.slug)}</div>
      {guide.slug === 'casamento-civil-documentos-angola' && <p className="guide-source-review">Requisitos e horários podem mudar. Confirma sempre a informação junto da conservatória ou do posto SIAC escolhido.</p>}
      {action && <aside className="guide-action"><div><p className="eyebrow">Continua a preparar o teu evento</p><h2>Leva este próximo passo para a prática.</h2></div><Link className="button button-primary" href={action.href}>{action.label} →</Link></aside>}
    </article> : <section className="catalog-empty">
      <h2>{error || 'A carregar guia…'}</h2>
      <Link className="button button-outline" href="/guias">Voltar aos guias</Link>
    </section>}
    {guide && relatedGuides.length > 0 && <section className="guide-related" aria-labelledby="guide-related-title">
      <p className="eyebrow">Biblioteca Nuvia</p><h2 id="guide-related-title">Continua a explorar</h2>
      <div>{relatedGuides.map((item) => <Link className="guide-related-card" href={`/guias/${item.slug}`} key={item.slug}>
        {GUIDE_COVERS[item.slug] && <Image src={GUIDE_COVERS[item.slug].src} alt="" width={600} height={338} sizes="(max-width: 600px) 100vw, 260px" />}
        <span>{item.category} · {item.readingMinutes} min</span><strong>{item.title}</strong>
      </Link>)}</div>
    </section>}
  </main>;
}
