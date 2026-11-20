"use client";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { API_URL, ApiError, api } from "../../lib/api";

type PublicAlbum = {
  title: string;
  date: string | null;
  province: string | null;
  photos: { id: string; imagePath: string }[];
};
type UploadResult = { count: number; message: string };

function uploadPhotos(token: string, form: FormData, onProgress: (value: number) => void) {
  return new Promise<UploadResult>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${API_URL}/albums/${encodeURIComponent(token)}/photos`);
    request.withCredentials = true;
    request.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error("Não foi possível ligar ao servidor. Verifica a ligação e tenta novamente."));
    request.onload = () => {
      if (request.status === 0) {
        reject(new Error("A ligação foi interrompida. Verifica a internet e tenta novamente."));
        return;
      }
      let result: { count?: number; message?: string } | null = null;
      try { result = JSON.parse(request.responseText); } catch { /* The server may return a proxy error page. */ }
      if (request.status >= 200 && request.status < 300 && result?.message) {
        resolve({ count: result.count ?? 0, message: result.message });
        return;
      }
      const message = result?.message || "Não foi possível concluir o pedido.";
      reject(new ApiError(message, request.status));
    };
    request.send(form);
  });
}

const formatSize = (bytes: number) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export default function PublicAlbumPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [album, setAlbum] = useState<PublicAlbum | null>(null);
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<"success" | "error" | "">("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [activePhoto, setActivePhoto] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const totalSize = useMemo(() => files.reduce((total, file) => total + file.size, 0), [files]);

  useEffect(() => {
    void api<PublicAlbum>(`/albums/${encodeURIComponent(token)}`)
      .then(setAlbum)
      .catch(() => { setStatus("Este álbum não está disponível."); setStatusKind("error"); });
  }, [token]);

  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);

  useEffect(() => {
    if (activePhoto === null) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePhoto(null);
      if (album && album.photos.length > 1 && event.key === "ArrowRight") setActivePhoto(index => index === null ? null : (index + 1) % album.photos.length);
      if (album && album.photos.length > 1 && event.key === "ArrowLeft") setActivePhoto(index => index === null ? null : (index - 1 + album.photos.length) % album.photos.length);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [activePhoto, album]);

  function movePhoto(direction: -1 | 1) {
    if (!album || album.photos.length < 2) return;
    setActivePhoto(index => index === null ? null : (index + direction + album.photos.length) % album.photos.length);
  }

  function addFiles(selected: File[]) {
    setStatus(""); setStatusKind("");
    if (files.length + selected.length > 10) {
      setStatus("Podes seleccionar até 10 fotografias por envio."); setStatusKind("error"); return;
    }
    const invalid = selected.find(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024);
    if (invalid) {
      setStatus("Cada fotografia deve ser JPG, PNG ou WebP e ter no máximo 8 MB."); setStatusKind("error"); return;
    }
    const unique = new Map(files.map(file => [`${file.name}:${file.size}:${file.lastModified}`, file]));
    selected.forEach(file => unique.set(`${file.name}:${file.size}:${file.lastModified}`, file));
    const merged = [...unique.values()];
    if (merged.length > 10) {
      setStatus("Podes seleccionar até 10 fotografias por envio."); setStatusKind("error"); return;
    }
    setFiles(merged);
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault(); setDragOver(false);
    if (!busy) addFiles(Array.from(event.dataTransfer.files));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!files.length || busy) return;
    setBusy(true); setProgress(0); setStatus(""); setStatusKind("");
    try {
      const form = new FormData();
      files.forEach(file => form.append("images", file));
      form.append("uploaderName", name.trim());
      const result = await uploadPhotos(token, form, setProgress);
      setStatus(result.message); setStatusKind("success"); setFiles([]); setProgress(100);
    } catch (error) {
      setStatus(error instanceof ApiError ? `${error.message} (HTTP ${error.status})` : error instanceof Error ? error.message : "Não foi possível enviar as fotografias.");
      setStatusKind("error");
    } finally { setBusy(false); }
  }

  const eventDate = album?.date
    ? new Intl.DateTimeFormat("pt-AO", { dateStyle: "long", timeZone: "Africa/Luanda" }).format(new Date(album.date))
    : null;

  return <main className="public-album-page">
    <header className="public-album-header">
      <a href="/" className="brand-wordmark" aria-label="Nuvia — início">nuvia.</a>
      <span><i aria-hidden="true">✦</i> Álbum partilhado</span>
    </header>

    {album ? <>
      <section className="public-album-hero">
        <span className="public-album-hero-mark" aria-hidden="true">♡</span>
        <p className="eyebrow">Memórias do evento</p>
        <h1>{album.title}</h1>
        {(eventDate || album.province) && <p className="public-album-event-meta">{[eventDate, album.province].filter(Boolean).join(" · ")}</p>}
        <p className="public-album-lead">Partilha os momentos que captaste. Os anfitriões irão revê-los antes de os publicar.</p>
        <a className="public-album-jump" href="#enviar-fotografias">Enviar fotografias <span aria-hidden="true">↓</span></a>
      </section>

      <div className="public-album-content">
        <form id="enviar-fotografias" className="public-album-upload" onSubmit={submit}>
          <div className="public-album-form-heading">
            <span>1</span>
            <div><p className="eyebrow">Partilha a tua perspectiva</p><h2>Envia as tuas fotografias</h2><p>Escolhe várias imagens e envia-as juntas.</p></div>
          </div>

          <label className="public-album-name-label">O teu nome <span>opcional</span>
            <input value={name} onChange={event => setName(event.target.value)} maxLength={80} placeholder="Como te devemos identificar?" disabled={busy} />
          </label>

          <label className={`public-album-dropzone${dragOver ? " is-dragging" : ""}${busy ? " is-disabled" : ""}`}
            htmlFor="album-photo"
            onDragOver={event => { event.preventDefault(); if (!busy) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}>
            <input id="album-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} multiple disabled={busy || files.length >= 10} />
            <span className="public-album-upload-icon" aria-hidden="true">↑</span>
            <strong>{dragOver ? "Larga as fotografias aqui" : "Escolhe ou arrasta fotografias"}</strong>
            <span>JPG, PNG ou WebP · até 10 fotografias</span>
            <span className="public-album-select-link">Procurar no dispositivo</span>
          </label>

          <div className="public-album-upload-rules">
            <span><i aria-hidden="true">✓</i> Até 8 MB por imagem</span>
            <span><i aria-hidden="true">✓</i> 10 fotografias por hora</span>
            <span><i aria-hidden="true">◇</i> Privadas até à aprovação</span>
          </div>

          {files.length > 0 && <section className="public-album-selection" aria-label="Fotografias seleccionadas">
            <header><div><strong>{files.length} {files.length === 1 ? "fotografia seleccionada" : "fotografias seleccionadas"}</strong><span>{formatSize(totalSize)} no total</span></div>
              <button type="button" onClick={() => setFiles([])} disabled={busy}>Limpar</button>
            </header>
            <div className="public-album-preview-grid">{files.map((file, index) => <article className="public-album-preview" key={`${file.name}:${file.size}:${file.lastModified}`}>
              {previews[index] && <img src={previews[index]} alt={`Pré-visualização de ${file.name}`} />}
              <div><strong title={file.name}>{file.name}</strong><small>{formatSize(file.size)}</small></div>
              <button type="button" aria-label={`Remover ${file.name}`} onClick={() => setFiles(current => current.filter((_, fileIndex) => fileIndex !== index))} disabled={busy}>×</button>
            </article>)}</div>
          </section>}

          {busy && <div className="public-album-progress">
            <div><span>{progress >= 100 ? "A guardar e preparar as imagens…" : "A enviar fotografias…"}</span><strong>{progress}%</strong></div>
            <div className="public-album-progress-track" role="progressbar" aria-label="Progresso do envio" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
          </div>}

          {status && <p className={`public-album-status ${statusKind}`} role={statusKind === "error" ? "alert" : "status"}><span aria-hidden="true">{statusKind === "success" ? "✓" : "!"}</span>{status}</p>}
          <button className="button button-primary public-album-submit" disabled={!files.length || busy}>
            {busy ? "A enviar…" : files.length ? `Enviar ${files.length} ${files.length === 1 ? "fotografia" : "fotografias"}` : "Selecciona fotografias para começar"}
            {!busy && files.length > 0 && <span aria-hidden="true">→</span>}
          </button>
          <p className="public-album-privacy">Ao enviar, confirmas que tens autorização para partilhar estas imagens com os anfitriões.</p>
        </form>

        <section className="public-album-gallery" aria-labelledby="approved-photos-title">
          <header><div><p className="eyebrow">Memórias partilhadas</p><h2 id="approved-photos-title">Fotografias aprovadas</h2></div><span>{album.photos.length}</span></header>
          {album.photos.length ? <div className="public-album-gallery-grid">{album.photos.map((photo, index) => <button type="button" className="public-album-gallery-item" key={photo.id} onClick={() => setActivePhoto(index)} aria-label={`Ampliar fotografia ${index + 1}`}>
            <img src={photo.imagePath} alt={`Memória partilhada do evento ${index + 1}`} loading="lazy" />
            <span aria-hidden="true">⌕</span>
          </button>)}</div> : <div className="public-album-empty"><span aria-hidden="true">♡</span><strong>As primeiras memórias estão a caminho</strong><p>As fotografias aprovadas pelos anfitriões aparecerão aqui.</p></div>}
        </section>
      </div>

      {activePhoto !== null && album.photos[activePhoto] && <div className="public-album-lightbox" role="presentation" onClick={() => setActivePhoto(null)} onTouchStart={event => { touchStartX.current = event.changedTouches[0]?.screenX ?? null; }} onTouchEnd={event => {
        const endX = event.changedTouches[0]?.screenX;
        if (touchStartX.current !== null && endX !== undefined && Math.abs(endX - touchStartX.current) > 48) movePhoto(endX < touchStartX.current ? 1 : -1);
        touchStartX.current = null;
      }}>
        <button type="button" className="public-album-lightbox-close" aria-label="Fechar imagem" onClick={event => { event.stopPropagation(); setActivePhoto(null); }}>×</button>
        {album.photos.length > 1 && <button type="button" className="public-album-lightbox-nav previous" aria-label="Fotografia anterior" onClick={event => { event.stopPropagation(); movePhoto(-1); }}>‹</button>}
        <img src={album.photos[activePhoto].imagePath} alt={`Fotografia ${activePhoto + 1} do evento`} onClick={event => event.stopPropagation()} />
        {album.photos.length > 1 && <button type="button" className="public-album-lightbox-nav next" aria-label="Fotografia seguinte" onClick={event => { event.stopPropagation(); movePhoto(1); }}>›</button>}
        <span>{activePhoto + 1} / {album.photos.length} · usa as setas ou desliza para navegar</span>
      </div>}
    </> : <section className="public-album-unavailable" role="status"><span aria-hidden="true">♡</span><h1>{status || "A preparar o álbum…"}</h1>{status && <p>Confirma se o link está correcto ou pede aos anfitriões um novo acesso.</p>}</section>}

    <footer className="public-album-footer"><span className="brand-wordmark">nuvia.</span><p>Partilha com cuidado e respeita a privacidade de quem aparece nas fotografias.</p></footer>
  </main>;
}
