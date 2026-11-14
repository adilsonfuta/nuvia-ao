'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';

type Vendor = { id: string; slug: string; name: string; category: string; description: string | null; province: string | null; municipality: string | null; priceFrom: string | null; priceTo: string | null; verifiedAt: string | null; isDemo: boolean };
const defaultCategories = ['Catering', 'Decoração', 'Fotografia e vídeo', 'Música e DJ', 'Beleza', 'Transportes', 'Bolos e doces', 'Organização', 'Espaços'];
const defaultProvinces = ['Bengo', 'Benguela', 'Bié', 'Cabinda', 'Cuando', 'Cubango', 'Cuanza Norte', 'Cuanza Sul', 'Cunene', 'Huambo', 'Huíla', 'Icolo e Bengo', 'Luanda', 'Lunda Norte', 'Lunda Sul', 'Malanje', 'Moxico', 'Moxico Leste', 'Namibe', 'Uíge', 'Zaire'];

export default function VendorDirectory() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [term, setTerm] = useState('');
  const [category, setCategory] = useState('');
  const [province, setProvince] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [signedIn, setSignedIn] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [categories, setCategories] = useState(defaultCategories);
  const [provinces, setProvinces] = useState(defaultProvinces);

  async function runSearch(values: { term: string; category: string; province: string }) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (values.term.trim()) params.set('search', values.term.trim());
      if (values.category) params.set('category', values.category);
      if (values.province) params.set('province', values.province);
      setVendors(await api<Vendor[]>(`/vendors?${params.toString()}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar fornecedores.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void runSearch({ term: '', category: '', province: '' }); void api<{vendorCategories:string[];provinces:string[]}>('/catalog-config').then(config => { if(config.vendorCategories.length)setCategories(config.vendorCategories); if(config.provinces.length)setProvinces(config.provinces); }).catch(()=>undefined); const context = new URLSearchParams(window.location.search).get('projectId') || ''; setProjectId(context); void (async () => { try { await api('/auth/me'); setSignedIn(true); const saved = context ? await api<{vendor:{id:string}}[]>(`/projects/${context}/vendors/favorites`) : await api<{vendor:{id:string}}[]>('/favorites'); setFavoriteIds(new Set(saved.map(item => item.vendor.id))); } catch { setSignedIn(false); } })(); }, []);

  async function toggleFavorite(vendorId: string) {
    if (!signedIn) { window.location.href = '/entrar'; return; }
    try { const base = projectId ? `/projects/${projectId}/vendors/favorites` : '/favorites'; if (favoriteIds.has(vendorId)) { await api(`${base}/${vendorId}`, { method: 'DELETE' }); setFavoriteIds(current => { const next = new Set(current); next.delete(vendorId); return next; }); } else { await api(base, { method: 'POST', body: JSON.stringify({ vendorId }) }); setFavoriteIds(current => new Set(current).add(vendorId)); } }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível actualizar favoritos.'); }
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch({ term, category, province });
  }

  function clearFilters() {
    setTerm(''); setCategory(''); setProvince('');
    void runSearch({ term: '', category: '', province: '' });
  }

  return <>
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
      <div className="directory-results-heading"><h2>Resultados</h2>{!loading && <span>{vendors.length} {vendors.length === 1 ? 'perfil' : 'perfis'}</span>}</div>
      {projectId && <p className="vendor-project-context-note">Estás a explorar fornecedores para um evento específico. Os favoritos guardados aqui ficam associados a esse evento.</p>}
      {loading ? <p className="empty-copy">A pesquisar perfis…</p> : vendors.length ? <div className="catalog-grid">{vendors.map(vendor => <article className="vendor-card" key={vendor.id}>
        <span className="vendor-monogram" aria-hidden="true">{vendor.name.slice(0, 1)}</span>
        <small>{vendor.category}</small>
        {vendor.isDemo && <span className="demo-badge">Demonstração</span>}
        {!vendor.isDemo && vendor.verifiedAt && <span className="verified-badge">Perfil revisto</span>}
        <h3>{vendor.name}</h3>
        <p>{vendor.description}</p>
        <span className="vendor-location">{[vendor.municipality, vendor.province].filter(Boolean).join(', ') || 'Localização por confirmar'}</span>
        {vendor.priceFrom && <span className="vendor-price">A partir de {vendor.priceFrom}{vendor.priceTo ? ` – ${vendor.priceTo}` : ''} Kz</span>}
        <div className="vendor-card-actions"><a href={`/fornecedores/${vendor.slug}${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`}>Ver perfil <span aria-hidden="true">→</span></a><button type="button" className={favoriteIds.has(vendor.id) ? 'favorite-button saved' : 'favorite-button'} aria-pressed={favoriteIds.has(vendor.id)} onClick={() => void toggleFavorite(vendor.id)}>{favoriteIds.has(vendor.id) ? 'Guardado' : 'Guardar'}</button></div>
      </article>)}</div> : <section className="catalog-empty"><span aria-hidden="true">⌕</span><h2>{term || category || province ? 'Não encontrámos perfis com estes filtros.' : 'Ainda não há perfis publicados.'}</h2><p>{term || category || province ? 'Experimenta outra categoria, província ou pesquisa.' : 'Estamos a preparar o directório. Quando houver perfis publicados, poderás consultá-los aqui.'}</p>{(term || category || province) && <button className="button button-outline" type="button" onClick={clearFilters}>Limpar pesquisa</button>}</section>}
    </div>
    <aside className="directory-disclosure"><strong>Sobre os pedidos de informação</strong><p>Os pedidos ficam guardados na tua conta. Ainda não são enviados ao fornecedor pela plataforma. Perfis identificados como demonstração são fictícios e não representam negócios reais.</p></aside>
  </>;
}
