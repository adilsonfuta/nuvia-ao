'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { api } from '../lib/api';
import { ListPagination, useListPage } from '../lib/list-pagination';
import { GUIDE_COVERS } from './guide-data';

type Guide = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  readingMinutes: number;
  coverImage: string | null;
  reviewedAt: string | null;
  isDemo: boolean;
};

function formatReviewDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat('pt-AO', { month: 'short', year: 'numeric' }).format(new Date(value));
}

export default function GuidesPage() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  async function loadGuides() {
    setLoading(true);
    setError('');
    try {
      setGuides(await api<Guide[]>('/guides'));
    } catch {
      setError('Não foi possível carregar os guias. Verifica a ligação e tenta novamente.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadGuides(); }, []);

  const categories = useMemo(() => ['Todos', ...Array.from(new Set(guides.map((guide) => guide.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt'))], [guides]);
  const filteredGuides = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt');
    return guides.filter((guide) => {
      const matchesCategory = category === 'Todos' || guide.category === category;
      const matchesQuery = !normalizedQuery || `${guide.title} ${guide.summary} ${guide.category}`.toLocaleLowerCase('pt').includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, guides, query]);
  const { pageItems: displayedGuides } = useListPage(filteredGuides, page, pageSize);

  return (
    <main className="catalog-page guides-page">
      <a className="catalog-back" href="/"><span aria-hidden="true">←</span> Início</a>

      <header className="guides-heading">
        <div className="guides-heading-copy">
          <p className="eyebrow">Ideias práticas para o vosso evento</p>
          <h1>Planeiem com mais confiança.</h1>
          <p>Guias claros para ajudar a tomar decisões, organizar prioridades e preparar cada etapa ao vosso ritmo.</p>
        </div>
        <div className="guides-heading-note" aria-label="Conteúdo pensado para Angola">
          <span aria-hidden="true">✳</span>
          <div><strong>Feito para a realidade local</strong><small>Informação e inspiração para celebrar em Angola.</small></div>
        </div>
      </header>

      {error ? (
        <section className="guides-state guides-error" role="alert">
          <span className="guides-state-icon" aria-hidden="true">!</span>
          <h2>Os guias não estão disponíveis neste momento</h2>
          <p>{error}</p>
          <button className="button button-primary" onClick={() => void loadGuides()}>Tentar novamente</button>
        </section>
      ) : loading ? (
        <section className="guides-loading" aria-label="A carregar guias">
          {[0, 1, 2].map((item) => <div className="guide-skeleton" key={item}><span /><span /><span /><span /></div>)}
        </section>
      ) : guides.length === 0 ? (
        <section className="guides-state">
          <span className="guides-state-icon" aria-hidden="true">✳</span>
          <p className="eyebrow">Em preparação</p>
          <h2>Estamos a preparar os primeiros guias.</h2>
          <p>O conteúdo será revisto antes de ser publicado, sobretudo quando abordar documentação e procedimentos civis.</p>
          <a className="button button-outline" href="/casamento-civil">Consultar informação civil <span aria-hidden="true">→</span></a>
        </section>
      ) : (
        <>
          <section className="guides-discovery" aria-label="Pesquisar e filtrar guias">
            <label className="guides-search">
              <span aria-hidden="true">⌕</span>
              <span className="sr-only">Pesquisar nos guias</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="O que precisam de preparar?" />
              {query && <button type="button" aria-label="Limpar pesquisa" onClick={() => setQuery('')}>×</button>}
            </label>
            <div className="guides-categories" aria-label="Filtrar por tema">
              {categories.map((item) => <button key={item} type="button" className={category === item ? 'is-active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
            </div>
          </section>

          <div className="guides-results-heading">
            <div><p className="eyebrow">Biblioteca Nuvia</p><h2>{query || category !== 'Todos' ? 'Resultados da pesquisa' : 'Guias para cada etapa'}</h2></div>
            <span>{filteredGuides.length} {filteredGuides.length === 1 ? 'guia' : 'guias'}</span>
          </div>

          {filteredGuides.length ? (
            <><div className="guides-grid">
              {displayedGuides.map((guide, index) => {
                const cover = guide.coverImage || GUIDE_COVERS[guide.slug]?.src;
                return <a className={`guide-card guide-card-tone-${index % 3}`} href={`/guias/${guide.slug}`} key={guide.slug}>
                  {cover && <div className="guide-card-image"><Image src={cover} alt={GUIDE_COVERS[guide.slug]?.alt || guide.title} width={1200} height={675} unoptimized={cover.startsWith("/api/v1/")} sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw" /></div>}
                  <div className="guide-card-topline"><span>{guide.category}</span><span className="guide-card-arrow" aria-hidden="true">↗</span></div>
                  <div className="guide-card-content">
                    <h3>{guide.title}</h3>
                    <p>{guide.summary}</p>
                  </div>
                  <div className="guide-card-footer">
                    <span>{guide.readingMinutes} min de leitura{guide.reviewedAt ? ` · Revisto ${formatReviewDate(guide.reviewedAt)}` : ''}</span>
                    <strong>Ler guia <span aria-hidden="true">→</span></strong>
                  </div>
                </a>;
              })}
            </div>
            <ListPagination page={page} pageSize={pageSize} total={filteredGuides.length} label="guias" onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} /></>
          ) : (
            <section className="guides-no-results">
              <h3>Não encontrámos guias com esses critérios.</h3>
              <p>Tenta outra palavra ou remove o filtro de tema.</p>
              <button type="button" className="button button-outline" onClick={() => { setQuery(''); setCategory('Todos'); }}>Limpar pesquisa e filtros</button>
            </section>
          )}
        </>
      )}
    </main>
  );
}
