"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "../lib/api";

type Photo = { id: string; status: "PENDING" | "APPROVED" | "REJECTED"; uploaderName?: string | null; createdAt: string; imagePath: string };
type Album = { enabled: boolean; canManage: boolean; sharePath: string | null; photos: Photo[] };

export function EventAlbumPanel({ projectId }: { projectId: string }) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = async () => {
    const result = await api<Album>(`/projects/${projectId}/album`);
    setAlbum(result);
    setQr(result.sharePath ? await QRCode.toDataURL(`${window.location.origin}${result.sharePath}`, { width: 150, margin: 1 }) : "");
  };
  useEffect(() => { void load().catch(() => setMessage("Não foi possível carregar o álbum.")); }, [projectId]);

  async function setEnabled(enabled: boolean) {
    setBusy(true); setMessage("");
    try { await api(`/projects/${projectId}/album`, { method: "PUT", body: JSON.stringify({ enabled }) }); await load(); setMessage(enabled ? "Álbum activado. Já podes partilhar o link." : "Álbum desactivado e link anterior revogado."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível actualizar o álbum."); }
    finally { setBusy(false); }
  }
  async function moderate(photoId: string, status: "APPROVED" | "REJECTED") {
    await api(`/projects/${projectId}/album/photos/${photoId}`, { method: "PATCH", body: JSON.stringify({ status }) });
    await load();
  }
  async function remove(photoId: string) {
    await api(`/projects/${projectId}/album/photos/${photoId}`, { method: "DELETE" }); await load();
  }
  const pending = album?.photos.filter((photo) => photo.status === "PENDING") ?? [];
  return <section className="dash-panel event-album-panel">
    <div className="panel-title"><div><p className="eyebrow">Depois da celebração</p><h2>Álbum partilhado</h2><p className="empty-copy">Os convidados enviam fotografias sem criar conta. Só aparecem depois da tua aprovação.</p></div></div>
    {!album ? <p>A carregar álbum…</p> : <>
      <div className="event-album-controls">
        <div><strong>{album.enabled ? "Link activo" : "Álbum desactivado"}</strong><p>{album.enabled ? "As fotografias recebidas ficam privadas até serem aprovadas." : "Activa quando quiseres partilhar o link ou QR Code."}</p></div>
        {album.canManage && <button className="button button-primary compact" type="button" disabled={busy} onClick={() => void setEnabled(!album.enabled)}>{album.enabled ? "Desactivar e revogar link" : "Activar álbum"}</button>}
      </div>
      {album.enabled && album.sharePath && <div className="event-album-share"><a href={album.sharePath} target="_blank" rel="noreferrer">Pré-visualizar página de envio ↗</a><code>{`${typeof window !== "undefined" ? window.location.origin : ""}${album.sharePath}`}</code>{qr && <img src={qr} alt="QR Code do álbum" width="120" height="120" />}</div>}
      <p role="status" className="form-message">{message}</p>
      <div className="event-album-list-heading"><h3>Fotografias recebidas</h3><span>{pending.length} por rever</span></div>
      {!album.photos.length ? <p className="empty-copy">Ainda não foram enviadas fotografias.</p> : <div className="event-album-grid">{album.photos.map((photo) => <article key={photo.id} className="event-album-photo"><img src={`/api/v1/projects/${projectId}/album/photos/${photo.id}/image`} alt="Fotografia enviada ao álbum" /><div><strong>{photo.uploaderName || "Convidado"}</strong><small>{photo.status === "PENDING" ? "Por rever" : photo.status === "APPROVED" ? "Publicada" : "Recusada"}</small></div>{album.canManage && <div className="event-album-photo-actions">{photo.status !== "APPROVED" && <button type="button" className="button button-outline compact" onClick={() => void moderate(photo.id, "APPROVED")}>Aprovar</button>}{photo.status !== "REJECTED" && <button type="button" className="button button-outline compact" onClick={() => void moderate(photo.id, "REJECTED")}>Recusar</button>}<button type="button" className="button button-outline compact" onClick={() => void remove(photo.id)}>Apagar</button></div>}</article>)}</div>}
    </>}
  </section>;
}
