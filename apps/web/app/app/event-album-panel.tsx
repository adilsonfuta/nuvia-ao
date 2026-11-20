"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { api } from "../lib/api";
import { ListPagination, useListPage } from "../lib/list-pagination";

type Photo = { id: string; status: "PENDING" | "APPROVED" | "REJECTED"; uploaderName?: string | null; createdAt: string; imagePath: string };
type Album = { enabled: boolean; canManage: boolean; sharePath: string | null; photos: Photo[] };
type PhotoFilter = "ALL" | Photo["status"];

const photoStatusLabel: Record<Photo["status"], string> = { PENDING: "Por rever", APPROVED: "Publicada", REJECTED: "Recusada" };
const formatPhotoDate = (value: string) => new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeZone: "Africa/Luanda" }).format(new Date(value));

export function EventAlbumPanel({ projectId }: { projectId: string }) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyPhotoId, setBusyPhotoId] = useState("");
  const [busyBulk, setBusyBulk] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error" | "">("");
  const [filter, setFilter] = useState<PhotoFilter>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [copied, setCopied] = useState(false);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);
  const filteredPhotos = useMemo(() => (album?.photos ?? []).filter(photo => filter === "ALL" || photo.status === filter), [album, filter]);
  const { pageItems } = useListPage(filteredPhotos, page, pageSize);
  const pending = album?.photos.filter(photo => photo.status === "PENDING").length ?? 0;
  const approved = album?.photos.filter(photo => photo.status === "APPROVED").length ?? 0;
  const rejected = album?.photos.filter(photo => photo.status === "REJECTED").length ?? 0;
  const allPendingSelected = pending > 0 && (album?.photos.filter(photo => photo.status === "PENDING") ?? []).every(photo => selectedPhotoIds.includes(photo.id));

  async function load() {
    const result = await api<Album>(`/projects/${projectId}/album`);
    setAlbum(result);
    const shareUrl = result.sharePath ? `${window.location.origin}${result.sharePath}` : "";
    setPublicUrl(shareUrl);
    setQr(shareUrl ? await QRCode.toDataURL(shareUrl, { width: 168, margin: 1, color: { dark: "#173b29", light: "#ffffff" } }) : "");
  }

  useEffect(() => {
    setAlbum(null); setFilter("ALL"); setPage(1); setSelectedPhotoIds([]); setActivePhotoId(null);
    void load().catch(() => { setMessage("Não foi possível carregar o álbum."); setMessageKind("error"); });
  }, [projectId]);

  useEffect(() => {
    if (!activePhotoId) return;
    const currentIndex = filteredPhotos.findIndex(photo => photo.id === activePhotoId);
    if (currentIndex < 0) { setActivePhotoId(null); return; }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePhotoId(null);
      if (filteredPhotos.length > 1 && event.key === "ArrowRight") setActivePhotoId(filteredPhotos[(currentIndex + 1) % filteredPhotos.length].id);
      if (filteredPhotos.length > 1 && event.key === "ArrowLeft") setActivePhotoId(filteredPhotos[(currentIndex - 1 + filteredPhotos.length) % filteredPhotos.length].id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePhotoId, filteredPhotos]);

  function movePhoto(direction: -1 | 1) {
    if (filteredPhotos.length < 2 || !activePhotoId) return;
    const index = filteredPhotos.findIndex(photo => photo.id === activePhotoId);
    setActivePhotoId(filteredPhotos[(index + direction + filteredPhotos.length) % filteredPhotos.length].id);
  }

  async function setEnabled(enabled: boolean) {
    setBusy(true); setMessage(""); setMessageKind("");
    try {
      await api(`/projects/${projectId}/album`, { method: "PUT", body: JSON.stringify({ enabled }) });
      await load();
      setMessage(enabled ? "Álbum activado. O link já pode ser partilhado." : "Álbum desactivado e link anterior revogado."); setMessageKind("success");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível actualizar o álbum."); setMessageKind("error"); }
    finally { setBusy(false); }
  }

  async function moderate(photoId: string, status: "APPROVED" | "REJECTED") {
    setBusyPhotoId(photoId); setMessage(""); setMessageKind("");
    try {
      await api(`/projects/${projectId}/album/photos/${photoId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load(); setSelectedPhotoIds(ids => ids.filter(id => id !== photoId)); setMessage(status === "APPROVED" ? "Fotografia aprovada e publicada." : "Fotografia recusada."); setMessageKind("success");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível actualizar a fotografia."); setMessageKind("error"); }
    finally { setBusyPhotoId(""); }
  }

  function selectAllPending() {
    const pendingIds = album?.photos.filter(photo => photo.status === "PENDING").map(photo => photo.id) ?? [];
    setSelectedPhotoIds(ids => ids.length === pendingIds.length && pendingIds.every(id => ids.includes(id)) ? [] : pendingIds);
  }

  function togglePhotoSelection(photoId: string) {
    setSelectedPhotoIds(ids => ids.includes(photoId) ? ids.filter(id => id !== photoId) : [...ids, photoId]);
  }

  async function moderateSelected(status: "APPROVED" | "REJECTED") {
    if (!selectedPhotoIds.length) return;
    const action = status === "APPROVED" ? "aprovar e publicar" : "recusar";
    if (!window.confirm(`Queres ${action} ${selectedPhotoIds.length} fotografias seleccionadas${status === "APPROVED" ? "? Estas ficarão visíveis no álbum público." : "?"}`)) return;
    setBusyBulk(true); setMessage(""); setMessageKind("");
    try {
      const result = await api<{ count: number }>(`/projects/${projectId}/album/moderation`, { method: "PATCH", body: JSON.stringify({ photoIds: selectedPhotoIds, status }) });
      setSelectedPhotoIds([]); await load();
      setMessage(`${result.count} ${result.count === 1 ? "fotografia actualizada" : "fotografias actualizadas"}${status === "APPROVED" ? " e publicadas." : "."}`); setMessageKind("success");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível actualizar as fotografias seleccionadas."); setMessageKind("error"); }
    finally { setBusyBulk(false); }
  }

  async function remove(photo: Photo) {
    if (!window.confirm(`Apagar definitivamente a fotografia enviada${photo.uploaderName ? ` por ${photo.uploaderName}` : ""}?`)) return;
    setBusyPhotoId(photo.id); setMessage(""); setMessageKind("");
    try {
      await api(`/projects/${projectId}/album/photos/${photo.id}`, { method: "DELETE" });
      await load(); setMessage("Fotografia apagada."); setMessageKind("success");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível apagar a fotografia."); setMessageKind("error"); }
    finally { setBusyPhotoId(""); }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(publicUrl); setCopied(true); setMessage("Link copiado. Já podes partilhá-lo com os convidados."); setMessageKind("success"); window.setTimeout(() => setCopied(false), 2200); }
    catch { setMessage("Não foi possível copiar automaticamente. Selecciona e copia o link apresentado."); setMessageKind("error"); }
  }

  function setPhotoFilter(next: PhotoFilter) { setFilter(next); setPage(1); }

  return <section className="dash-panel event-album-panel" aria-labelledby="event-album-title">
    <header className="event-album-panel-heading">
      <div><p className="eyebrow">Memórias depois do evento</p><h2 id="event-album-title">Álbum partilhado</h2><p>Os convidados enviam fotografias sem criar conta. Tu decides o que fica visível.</p></div>
      {album && <span className={`event-album-state ${album.enabled ? "active" : "inactive"}`}><i aria-hidden="true" />{album.enabled ? "Link activo" : "Desactivado"}</span>}
    </header>

    {!album ? <div className="event-album-loading" role="status"><span aria-hidden="true">◌</span><p>A carregar o álbum do evento…</p></div> : <>
      <div className="event-album-summary" aria-label="Resumo do álbum">
        <article className={pending ? "needs-review" : ""}><span>Por rever</span><strong>{pending}</strong><small>{pending ? "Precisam da tua atenção" : "Tudo em dia"}</small></article>
        <article><span>Publicadas</span><strong>{approved}</strong><small>Visíveis aos convidados</small></article>
        <article><span>Recusadas</span><strong>{rejected}</strong><small>Não aparecem no álbum público</small></article>
        <article><span>Total recebido</span><strong>{album.photos.length}</strong><small>Fotografias enviadas</small></article>
      </div>

      <div className={`event-album-activation ${album.enabled ? "enabled" : "disabled"}`}>
        <div className="event-album-activation-icon" aria-hidden="true">{album.enabled ? "✓" : "↑"}</div>
        <div className="event-album-activation-copy"><strong>{album.enabled ? "Os convidados já podem enviar fotografias" : "Cria um espaço para as memórias do evento"}</strong><p>{album.enabled ? "Cada fotografia fica privada até ser aprovada por um anfitrião." : "Activa o álbum para gerar um link e um QR Code partilháveis."}</p></div>
        {album.canManage && <button className={album.enabled ? "button button-outline compact" : "button button-primary compact"} type="button" disabled={busy} onClick={() => void setEnabled(!album.enabled)}>{busy ? "A actualizar…" : album.enabled ? "Desactivar álbum" : "Activar álbum"}</button>}
      </div>

      {album.enabled && album.sharePath && <section className="event-album-share-card" aria-label="Partilhar álbum">
        <div className="event-album-share-details"><p className="eyebrow">Partilha com os convidados</p><h3>O link está pronto</h3><p>Qualquer pessoa com este link pode enviar fotografias. Não precisa de criar conta.</p>
          <div className="event-album-link-copy"><input aria-label="Link público do álbum" readOnly value={publicUrl} onFocus={event => event.currentTarget.select()} /><button type="button" className="button button-primary compact" onClick={() => void copyLink()}>{copied ? "Copiado ✓" : "Copiar link"}</button></div>
          <a className="event-album-preview-link" href={album.sharePath} target="_blank" rel="noreferrer">Pré-visualizar página pública ↗</a>
        </div>
        {qr && <figure className="event-album-qr"><img src={qr} alt="QR Code para abrir o álbum partilhado" /><figcaption>QR Code do álbum</figcaption></figure>}
      </section>}

      {message && <p role={messageKind === "error" ? "alert" : "status"} className={`event-album-message ${messageKind}`}>{messageKind === "success" ? "✓" : "!"} {message}</p>}

      <section className="event-album-moderation" aria-labelledby="event-album-photos-title">
        <header className="event-album-moderation-heading"><div><p className="eyebrow">Revisão e publicação</p><h3 id="event-album-photos-title">Fotografias recebidas</h3><p>As novas fotografias só aparecem no link público depois da aprovação.</p></div>
          <div className="event-album-tools">
            {album.canManage && (approved > 0
              ? <a className="button button-outline compact event-album-download" href={`/api/v1/projects/${projectId}/album/download`} download>Descarregar aprovadas <span>ZIP · {approved}</span></a>
              : <button className="button button-outline compact event-album-download" type="button" disabled title="Aprova fotografias para poderes descarregá-las">Descarregar aprovadas <span>ZIP · 0</span></button>)}
            <div className="event-album-filters" role="group" aria-label="Filtrar fotografias">
              {(["ALL", "PENDING", "APPROVED", "REJECTED"] as PhotoFilter[]).map(option => <button type="button" key={option} className={filter === option ? "active" : ""} aria-pressed={filter === option} onClick={() => setPhotoFilter(option)}>{option === "ALL" ? "Todas" : photoStatusLabel[option]} <span>{option === "ALL" ? album.photos.length : album.photos.filter(photo => photo.status === option).length}</span></button>)}
            </div>
          </div>
        </header>
        {album.canManage && pending > 0 && <div className="event-album-select-all"><button type="button" onClick={selectAllPending} disabled={busyBulk}>{allPendingSelected ? "Limpar selecção" : `Seleccionar todas por rever (${pending})`}</button><span>Podes também seleccionar fotografias individualmente.</span></div>}
        {album.canManage && selectedPhotoIds.length > 0 && <div className="event-album-bulk-actions" role="toolbar" aria-label="Acções para fotografias seleccionadas"><strong>{selectedPhotoIds.length} {selectedPhotoIds.length === 1 ? "fotografia seleccionada" : "fotografias seleccionadas"}</strong><div><button type="button" className="button button-primary compact" disabled={busyBulk} onClick={() => void moderateSelected("APPROVED")}>{busyBulk ? "A actualizar…" : "Aprovar e publicar"}</button><button type="button" className="button button-outline compact" disabled={busyBulk} onClick={() => void moderateSelected("REJECTED")}>Recusar</button><button type="button" className="event-album-clear-selection" disabled={busyBulk} onClick={() => setSelectedPhotoIds([])}>Limpar</button></div></div>}
        {!filteredPhotos.length ? <div className="event-album-empty"><span aria-hidden="true">{filter === "PENDING" ? "✓" : "♡"}</span><strong>{filter === "PENDING" ? "Não há fotografias por rever" : filter === "ALL" ? "Ainda não recebeste fotografias" : `Ainda não há fotografias ${filter === "APPROVED" ? "publicadas" : "recusadas"}`}</strong><p>{filter === "PENDING" ? "Quando os convidados enviarem fotografias, elas aparecerão aqui para revisão." : album.enabled ? "Partilha o link ou o QR Code para começar a receber memórias." : "Activa o álbum para começar a receber fotografias dos convidados."}</p></div> : <div className="event-album-grid">{pageItems.map(photo => <article key={photo.id} className={`event-album-photo ${selectedPhotoIds.includes(photo.id) ? "selected" : ""}`}>
          <button type="button" className="event-album-photo-image" onClick={() => setActivePhotoId(photo.id)} aria-label={`Ampliar fotografia de ${photo.uploaderName || "convidado"}`}><img src={`/api/v1/projects/${projectId}/album/photos/${photo.id}/image`} alt={`Fotografia enviada por ${photo.uploaderName || "convidado"}`} loading="lazy" /><span aria-hidden="true">⌕</span></button>
          {album.canManage && photo.status === "PENDING" && <label className="event-album-photo-select"><input type="checkbox" checked={selectedPhotoIds.includes(photo.id)} onChange={() => togglePhotoSelection(photo.id)} disabled={busyBulk} /><span>Seleccionar</span></label>}
          <div className="event-album-photo-info"><strong>{photo.uploaderName || "Convidado"}</strong><span className={`event-album-photo-status ${photo.status.toLowerCase()}`}>{photoStatusLabel[photo.status]}</span><small>{formatPhotoDate(photo.createdAt)}</small></div>
          {album.canManage && <div className="event-album-photo-actions">
            {photo.status !== "APPROVED" && <button type="button" className="button button-primary compact" disabled={busyPhotoId === photo.id || busyBulk} onClick={() => void moderate(photo.id, "APPROVED")}>{busyPhotoId === photo.id ? "A guardar…" : "Aprovar"}</button>}
            {photo.status !== "REJECTED" && <button type="button" className="button button-outline compact" disabled={busyPhotoId === photo.id || busyBulk} onClick={() => void moderate(photo.id, "REJECTED")}>Recusar</button>}
            <button type="button" className="event-album-delete" disabled={busyPhotoId === photo.id || busyBulk} onClick={() => void remove(photo)} aria-label={`Apagar fotografia de ${photo.uploaderName || "convidado"}`}>Apagar</button>
          </div>}
        </article>)}</div>}
        {filteredPhotos.length > 0 && <ListPagination page={page} pageSize={pageSize} total={filteredPhotos.length} label="fotografias" onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} />}
      </section>
      {activePhotoId && filteredPhotos.find(photo => photo.id === activePhotoId) && (() => {
        const photo = filteredPhotos.find(item => item.id === activePhotoId)!;
        const index = filteredPhotos.findIndex(item => item.id === activePhotoId);
        return <div className="public-album-lightbox" role="dialog" aria-modal="true" aria-label="Pré-visualização das fotografias" onClick={() => setActivePhotoId(null)} onTouchStart={event => { touchStartX.current = event.changedTouches[0]?.screenX ?? null; }} onTouchEnd={event => {
          const endX = event.changedTouches[0]?.screenX;
          if (touchStartX.current !== null && endX !== undefined && Math.abs(endX - touchStartX.current) > 48) movePhoto(endX < touchStartX.current ? 1 : -1);
          touchStartX.current = null;
        }}>
          <button type="button" className="public-album-lightbox-close" aria-label="Fechar imagem" onClick={event => { event.stopPropagation(); setActivePhotoId(null); }}>×</button>
          {filteredPhotos.length > 1 && <button type="button" className="public-album-lightbox-nav previous" aria-label="Fotografia anterior" onClick={event => { event.stopPropagation(); movePhoto(-1); }}>‹</button>}
          <img src={`/api/v1/projects/${projectId}/album/photos/${photo.id}/image`} alt={`Fotografia de ${photo.uploaderName || "convidado"}`} onClick={event => event.stopPropagation()} />
          {filteredPhotos.length > 1 && <button type="button" className="public-album-lightbox-nav next" aria-label="Fotografia seguinte" onClick={event => { event.stopPropagation(); movePhoto(1); }}>›</button>}
          <span>{index + 1} / {filteredPhotos.length} · usa as setas ou desliza para navegar</span>
        </div>;
      })()}
    </>}
  </section>;
}
