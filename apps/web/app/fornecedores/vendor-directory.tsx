'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatAOA } from '../lib/format';
import { ListPagination } from '../lib/list-pagination';

type Vendor = { id: string; slug: string; name: string; category: string; description: string | null; galleryUrls: string[]; portfolio: { id: string; altText: string; isCover: boolean }[]; province: string | null; municipality: string | null; priceFrom: string | null; priceTo: string | null; verifiedAt: string | null; isDemo: boolean };
const defaultCategories = ['Catering', 'Decoração', 'Fotografia e vídeo', 'Música e DJ', 'Beleza', 'Transportes', 'Bolos e doces', 'Organização', 'Espaços'];
const defaultProvinces = ['Bengo', 'Benguela', 'Bié', 'Cabinda', 'Cuando', 'Cubango', 'Cuanza Norte', 'Cuanza Sul', 'Cunene', 'Huambo', 'Huíla', 'Icolo e Bengo', 'Luanda', 'Lunda Norte', 'Lunda Sul', 'Malanje', 'Moxico', 'Moxico Leste', 'Namibe', 'Uíge', 'Zaire'];

export default function VendorDirectory() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [term, setTerm] = useState('');
  const [category, setCategory] = useState('');
  const [province, setProvince] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [favoriteNotice, setFavoriteNotice] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [signedIn, setSignedIn] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [categories, setCategories] = useState(defaultCategories);
  const [provinces, setProvinces] = useState(defaultProvinces);

  async function runSearch(values: { term: string; category: string; province: string }, nextPage = 1, nextPageSize = pageSize) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (values.term.trim()) params.set('search', values.term.trim());
      if (values.category) params.set('category', values.category);
      if (values.province) params.set('province', values.province);
      params.set('page', String(nextPage)); params.set('pageSize', String(nextPageSize));
      const result = await api<{ items: Vendor[]; total: number }>(`/vendors?${params.toString()}`);
      setVendors(result.items); setTotal(result.total); setPage(nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar fornecedores.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    const initial = {
      term: url.searchParams.get('q') || '',
      category: url.searchParams.get('category') || '',
      province: url.searchParams.get('province') || '',
    };
    const context = url.searchParams.get('projectId') || '';
    setTerm(initial.term);
    setCategory(initial.category);
    setProvince(initial.province);
    setProjectId(context);
      void runSearch(initial, 1);
    void api<{vendorCategories:string[];provinces:string[]}>('/catalog-config').then(config => { if(config.vendorCategories.length)setCategories(config.vendorCategories); if(config.provinces.length)setProvinces(config.provinces); }).catch(()=>undefined);
    void (async () => {
      try {
        await api('/auth/me');
      } catch {
        setSignedIn(false);
        setSessionChecked(true);
        return;
      }
      setSignedIn(true);
      setSessionChecked(true);
      const base = context ? `/projects/${context}/vendors/favorites` : '/favorites';
      let saved: {vendor:{id:string}}[];
      try {
        saved = await api<{vendor:{id:string}}[]>(base);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível carregar os favoritos.');
        return;
      }
      const savedIds = new Set(saved.map(item => item.vendor.id));
      const pendingId = url.searchParams.get('favorite');
      if (pendingId && !savedIds.has(pendingId)) {
        try {
          await api(base, { method: 'POST', body: JSON.stringify({ vendorId: pendingId }) });
          savedIds.add(pendingId);
          setFavoriteNotice('Fornecedor guardado nos favoritos.');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Não foi possível guardar o fornecedor.');
        }
      }
      if (pendingId && savedIds.has(pendingId)) {
        url.searchParams.delete('favorite');
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      }
      setFavoriteIds(savedIds);
    })();
  }, []);

  async function toggleFavorite(vendorId: string) {
    if (!signedIn) {
      const next = new URL(window.location.href);
      next.searchParams.set('favorite', vendorId);
      window.location.href = `/entrar?next=${encodeURIComponent(`${next.pathname}${next.search}${next.hash}`)}`;
      return;
    }
    try { const base = projectId ? `/projects/${projectId}/vendors/favorites` : '/favorites'; if (favoriteIds.has(vendorId)) { await api(`${base}/${vendorId}`, { method: 'DELETE' }); setFavoriteIds(current => { const next = new Set(current); next.delete(vendorId); return next; }); } else { await api(base, { method: 'POST', body: JSON.stringify({ vendorId }) }); setFavoriteIds(current => new Set(current).add(vendorId)); } }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível actualizar favoritos.'); }
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch({ term, category, province }, 1);
    const url = new URL(window.location.href);
    for (const [key, value] of [['q', term], ['category', category], ['province', province]]) {
      if (value.trim()) url.searchParams.set(key, value.trim());
      else url.searchParams.delete(key);
    }
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function clearFilters() {
    setTerm(''); setCategory(''); setProvince('');
    void runSearch({ term: '', category: '', province: '' }, 1);
    const url = new URL(window.location.href);
    ['q', 'category', 'province'].forEach(key => url.searchParams.delete(key));
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  const directoryParams = new URLSearchParams();
  if (projectId) directoryParams.set('projectId', projectId);
  if (term.trim()) directoryParams.set('q', term.trim());
  if (category) directoryParams.set('category', category);
  if (province) directoryParams.set('province', province);
  const directoryQuery = directoryParams.toString();
  const directoryReturnPath = `/fornecedores${directoryQuery ? `?${directoryQuery}` : ''}`;
  const dashboardHref = projectId
    ? `/dashboard?tab=fornecedores&event=${encodeURIComponent(projectId)}`
    : '/dashboard';

  return <>
    {sessionChecked && <a className="catalog-back" href={projectId || signedIn ? dashboardHref : '/'}>
      <span aria-hidden="true">←</span> {projectId ? 'Voltar ao evento' : signedIn ? 'Voltar à dashboard' : 'Início'}
    </a>}
    <form className="catalog-filters" onSubmit={search} aria-label="Pesquisar fornecedores">
      <label className="sr-only" htmlFor="vendor-search">Serviço ou nome do fornecedor</label>
      <input id="vendor-search" value={term} onChange={event => setTerm(event.target.value)} placeholder="Ex.: fotografia, catering…"/>
      <label className="sr-only" htmlFor="vendor-category">Categoria</label>
      <select id="vendor-category" value={category} onChange={event => setCategory(event.target.value)}><option value="">Todas as categorias</option>{categories.map(item => <option key={item}>{item}</option>)}</select>
      <label className="sr-only" htmlFor="vendor-province">Província</label>
      <select id="vendor-province" value={province} onChange={event => setProvince(event.target.value)}><option value="">Todas as províncias</option>{provinces.map(item => <option key={item}>{item}</option>)}</select>
      <button className="button button-primary" disabled={loading}>{loading ? 'A pesquisar…' : 'Pesquisar'}</button>
      <button className="filter-reset" type="button" onClick={clearFilters} disabled={loading}>Limpar filtros</button>
    </form>

    <div className="directory-results" aria-live="polite">
      {error && <p className="form-error" role="alert">{error}</p>}
      {favoriteNotice && <p className="quote-notice" role="status">{favoriteNotice}</p>}
      <div className="directory-results-heading"><h2>Resultados</h2>{!loading && <span>{total} {total === 1 ? 'perfil' : 'perfis'}</span>}</div>
      {projectId && <p className="vendor-project-context-note">Estás a explorar fornecedores para um evento específico. Os favoritos guardados aqui ficam associados a esse evento.</p>}
      {loading ? <p className="empty-copy">A pesquisar perfis…</p> : vendors.length ? <><div className="catalog-grid">{vendors.map(vendor => {
        const cover = vendor.portfolio?.[0]
          ? { src: `/api/v1/vendor-portfolio/${vendor.portfolio[0].id}/image`, alt: vendor.portfolio[0].altText }
          : vendor.galleryUrls?.[0]
            ? { src: vendor.galleryUrls[0], alt: `Trabalho de ${vendor.name}` }
            : null;
        const profileHref = `/fornecedores/${vendor.slug}?${new URLSearchParams({ ...(projectId ? { projectId } : {}), returnTo: directoryReturnPath }).toString()}`;
        return <article className="vendor-card" key={vendor.id}>
          <div className="vendor-card-media">
            <a className="vendor-card-image" href={profileHref} aria-label={`Ver perfil de ${vendor.name}`}>
              {cover ? <img src={cover.src} alt={cover.alt} loading="lazy" referrerPolicy={cover.src.startsWith('http') ? 'no-referrer' : undefined} /> : <span className="vendor-card-placeholder" aria-hidden="true">{vendor.name.slice(0, 1)}</span>}
              {vendor.isDemo ? <span className="demo-badge">Demonstração</span> : vendor.verifiedAt ? <span className="verified-badge">Perfil revisto</span> : null}
            </a>
            <button type="button" className={favoriteIds.has(vendor.id) ? 'favorite-button saved' : 'favorite-button'} aria-label={favoriteIds.has(vendor.id) ? `Remover ${vendor.name} dos favoritos` : `Guardar ${vendor.name} nos favoritos`} aria-pressed={favoriteIds.has(vendor.id)} onClick={() => void toggleFavorite(vendor.id)}>{favoriteIds.has(vendor.id) ? '♥' : '♡'}</button>
          </div>
          <div className="vendor-card-body">
            <p className="vendor-card-category">{vendor.category}</p>
            <h3><a href={profileHref}>{vendor.name}</a></h3>
            {vendor.description && <p className="vendor-card-description">{vendor.description}</p>}
            <div className="vendor-card-meta"><span className="vendor-location">{[vendor.municipality, vendor.province].filter(Boolean).join(', ') || 'Localização por confirmar'}</span>{vendor.priceFrom && <span className="vendor-price">Desde {formatAOA(vendor.priceFrom)}{vendor.priceTo ? ` – ${formatAOA(vendor.priceTo)}` : ''}</span>}</div>
            <div className="vendor-card-actions"><a href={profileHref}>Ver perfil <span aria-hidden="true">→</span></a></div>
          </div>
        </article>;
      })}</div><ListPagination page={page} pageSize={pageSize} total={total} label="fornecedores" onPageChange={(next) => { setPage(next); void runSearch({ term, category, province }, next); }} onPageSizeChange={(size) => { setPageSize(size); setPage(1); void runSearch({ term, category, province }, 1, size); }} /></> : <section className="catalog-empty"><span aria-hidden="true">⌕</span><h2>{term || category || province ? 'Não encontrámos perfis com estes filtros.' : 'Ainda não há perfis publicados.'}</h2><p>{term || category || province ? 'Experimenta outra categoria, província ou pesquisa.' : 'Estamos a preparar o directório. Quando houver perfis publicados, poderás consultá-los aqui.'}</p>{(term || category || province) && <button className="button button-outline" type="button" onClick={clearFilters}>Limpar pesquisa</button>}</section>}
    </div>
    <aside className="directory-disclosure"><strong>Sobre os pedidos de informação</strong><p>Os pedidos ficam guardados na tua conta. Ainda não são enviados ao fornecedor pela plataforma. Perfis identificados como demonstração são fictícios e não representam negócios reais.</p></aside>
  </>;
}
