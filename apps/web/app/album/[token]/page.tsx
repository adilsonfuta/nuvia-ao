"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../lib/api";

type PublicAlbum = { title: string; date: string | null; province: string | null; photos: { id: string; imagePath: string }[] };
export default function PublicAlbumPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [album, setAlbum] = useState<PublicAlbum | null>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api<PublicAlbum>(`/albums/${encodeURIComponent(token)}`).then(setAlbum).catch(() => setStatus("Este álbum não está disponível.")); }, [token]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!file) return;
    setBusy(true); setStatus("");
    try { const form = new FormData(); form.append("image", file); form.append("uploaderName", name); const result = await api<{ message: string }>(`/albums/${encodeURIComponent(token)}/photos`, { method: "POST", body: form }); setStatus(result.message); setFile(null); const input = document.getElementById("album-photo") as HTMLInputElement | null; if (input) input.value = ""; }
    catch (error) { setStatus(error instanceof Error ? error.message : "Não foi possível enviar a fotografia."); }
    finally { setBusy(false); }
  }
  const onFile = (event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] ?? null);
  return <main className="public-album-page"><header><a href="/" className="brand-wordmark">nuvia.</a><p>Álbum partilhado</p></header>{album ? <><section className="public-album-intro"><p className="eyebrow">Memórias do evento</p><h1>{album.title}</h1><p>{[album.date ? new Intl.DateTimeFormat("pt-AO", { dateStyle: "long" }).format(new Date(album.date)) : null, album.province].filter(Boolean).join(" · ")}</p><p>Partilha as fotografias que captaste. Os anfitriões irão revê-las antes de as publicar.</p></section><form className="public-album-upload" onSubmit={submit}><label>O teu nome (opcional)<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} /></label><label>Escolhe uma fotografia<input id="album-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} required /></label><small>JPG, PNG ou WebP · máximo 8 MB. A imagem fica privada até ser aprovada.</small><button className="button button-primary" disabled={!file || busy}>{busy ? "A enviar…" : "Enviar fotografia"}</button><p role="status">{status}</p></form><section className="public-album-gallery"><h2>Fotografias aprovadas</h2>{album.photos.length ? album.photos.map((photo) => <img key={photo.id} src={photo.imagePath} alt="Memória partilhada do evento" />) : <p>As fotografias aprovadas aparecerão aqui.</p>}</section></> : <p role="status">{status || "A carregar álbum…"}</p>}<footer>Partilha com cuidado e respeita a privacidade das outras pessoas.</footer></main>;
}
