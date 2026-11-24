"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";

type ProjectOption = { id: string; title: string; date: string | null; guestEstimate: number | null; currentRole: string };
export function VenueInquiryBox({ venueId }: { venueId: string }) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api<ProjectOption[]>("/projects").then(items => { const writable = items.filter(item => item.currentRole !== "VIEWER"); setProjects(writable); setProjectId(writable[0]?.id ?? ""); }).catch(() => undefined); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setStatus("");
    try { const result = await api<{ message: string }>(`/venues/${venueId}/inquiries`, { method: "POST", body: JSON.stringify({ projectId, message }) }); setStatus(result.message); setMessage(""); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Entra na Nuvia para enviar um pedido."); }
    finally { setBusy(false); }
  }
  if (!projects.length) return <div className="venue-inquiry-box"><p>Para pedir disponibilidade, entra na tua conta e selecciona um evento.</p><a className="button button-primary" href={`/entrar?next=${encodeURIComponent(`/espacos`)}`}>Entrar para pedir informações</a></div>;
  return <form className="venue-inquiry-box" onSubmit={submit}><h3>Pedir disponibilidade e orçamento</h3><label>Evento<select value={projectId} onChange={event => setProjectId(event.target.value)}>{projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label><label>Mensagem<textarea required minLength={10} maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} placeholder="Indica o que precisas de saber sobre a data, capacidade e condições." /></label><button className="button button-primary" disabled={!projectId || busy}>{busy ? "A enviar…" : "Enviar pedido"}</button><p role="status">{status}</p></form>;
}
