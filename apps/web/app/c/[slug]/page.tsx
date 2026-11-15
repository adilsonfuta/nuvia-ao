"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../lib/api";

type Invitation = {
  slug: string;
  headline: string | null;
  message: string | null;
  theme: "CLASSIC" | "BOTANICAL" | "TERRACOTTA";
  publicNotes: string | null;
  dressCode: string | null;
  supportContactName: string | null;
  supportContactPhone: string | null;
  recipient: {
    name: string;
    maxPartySize: number;
    tableName: string | null;
    rsvp: { status: string; partySize: number } | null;
  } | null;
  project: {
    title: string;
    kind: string;
    date: string | null;
    province: string | null;
    events: {
      id: string;
      title: string;
      type: string;
      startsAt: string | null;
      venue: string | null;
      address: string | null;
      mapsUrl: string | null;
      guestNotes: string | null;
    }[];
  };
};

const date = (value: string | null, withTime = false) =>
  value
    ? new Intl.DateTimeFormat("pt-AO", {
        dateStyle: withTime ? "medium" : "long",
        ...(withTime ? { timeStyle: "short" as const } : {}),
        timeZone: "Africa/Luanda",
      }).format(new Date(value))
    : withTime
      ? "Horário por confirmar"
      : "Data por confirmar";

export default function InvitationPage() {
  const { slug } = useParams<{ slug: string }>();
  const [token, setToken] = useState("");
  const [invite, setInvite] = useState<Invitation | null>(null);
  const [status, setStatus] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    const currentToken = new URLSearchParams(window.location.search).get("token") || "";
    setToken(currentToken);
    api<Invitation>(`/invitations/${slug}${currentToken ? `?token=${encodeURIComponent(currentToken)}` : ""}`)
      .then((item) => {
        setInvite(item);
        if (item.recipient?.rsvp) {
          setPartySize(item.recipient.rsvp.partySize);
          setStatus(item.recipient.rsvp.status === "DECLINED" ? "declined" : "accepted");
        }
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Não foi possível abrir esta página."));
  }, [slug]);

  async function rsvp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    try {
      await api(`/invitations/${slug}/rsvp`, {
        method: "POST",
        body: JSON.stringify({
          token,
          status: form.get("status"),
          partySize: Number(form.get("partySize") || 1),
        }),
      });
      setStatus("A tua resposta foi registada. Obrigado!");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível registar a resposta.");
    }
  }

  if (!invite) {
    return (
      <main className="invitation-page">
        <a className="planner-back" href="/">Nuvia</a>
        <p role={error ? "alert" : "status"}>{error || "A preparar o convite…"}</p>
      </main>
    );
  }

  const hasGuideDetails = Boolean(
    invite.publicNotes || invite.dressCode || invite.supportContactName || invite.supportContactPhone,
  );

  return (
    <main className="invitation-page guest-guide-page">
      <div className="guest-guide-shell">
        <section className={`invitation-card theme-${invite.theme.toLowerCase()} guest-guide-cover`}>
          <span className="invitation-mark" aria-hidden="true">♡</span>
          <p className="eyebrow">Com alegria convidamos-te</p>
          <h1>{invite.headline || invite.project.title}</h1>
          {invite.recipient && <p className="recipient">Querido/a {invite.recipient.name}</p>}
          <p className="invitation-message">{invite.message || "Será uma alegria celebrar este momento contigo."}</p>
          <p className="invitation-date">{date(invite.project.date)}</p>
          {invite.project.province && <p className="guest-guide-province">{invite.project.province}, Angola</p>}
        </section>

        <section className="guest-guide-program" aria-labelledby="guest-guide-program-title">
          <header className="guest-guide-section-heading">
            <p className="eyebrow">Guia do convidado</p>
            <h2 id="guest-guide-program-title">Programa e locais</h2>
            <p>Consulta os horários e as informações para chegares a cada momento.</p>
          </header>
          {invite.project.events.length ? (
            <div className="guest-guide-timeline">
              {invite.project.events.map((item) => (
                <article className="guest-guide-moment" key={item.id}>
                  <div className="guest-guide-moment-time">{date(item.startsAt, true)}</div>
                  <div className="guest-guide-moment-body">
                    <h3>{item.title}</h3>
                    {item.venue && <p className="guest-guide-venue">{item.venue}</p>}
                    {item.address && <p className="guest-guide-address">{item.address}</p>}
                    {item.mapsUrl && (
                      <a className="guest-guide-map-link" href={item.mapsUrl} target="_blank" rel="noreferrer">
                        Abrir localização no mapa <span aria-hidden="true">↗</span>
                      </a>
                    )}
                    {item.guestNotes && <p className="guest-guide-note">{item.guestNotes}</p>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="guest-guide-empty">O programa será actualizado quando os horários e locais estiverem definidos.</p>
          )}
        </section>

        {hasGuideDetails && (
          <section className="guest-guide-practical" aria-labelledby="guest-guide-practical-title">
            <header className="guest-guide-section-heading">
              <p className="eyebrow">Antes de sair</p>
              <h2 id="guest-guide-practical-title">Informações úteis</h2>
            </header>
            <div className="guest-guide-practical-grid">
              {invite.dressCode && <article><span aria-hidden="true">✦</span><div><h3>Traje</h3><p>{invite.dressCode}</p></div></article>}
              {invite.publicNotes && <article><span aria-hidden="true">i</span><div><h3>Nota dos anfitriões</h3><p>{invite.publicNotes}</p></div></article>}
              {(invite.supportContactName || invite.supportContactPhone) && (
                <article>
                  <span aria-hidden="true">☎</span>
                  <div>
                    <h3>Contacto no dia</h3>
                    {invite.supportContactName && <p>{invite.supportContactName}</p>}
                    {invite.supportContactPhone && <a href={`tel:${invite.supportContactPhone.replace(/[^\d+]/g, "")}`}>{invite.supportContactPhone}</a>}
                  </div>
                </article>
              )}
            </div>
          </section>
        )}

        {token ? (
          <section className="guest-guide-personal" aria-labelledby="guest-guide-personal-title">
            <div>
              <p className="eyebrow">A tua informação</p>
              <h2 id="guest-guide-personal-title">Confirma a tua presença</h2>
              {invite.recipient?.tableName && <p className="guest-guide-table">A tua mesa <strong>{invite.recipient.tableName}</strong></p>}
              {invite.recipient && <p className="guest-guide-party-limit">Este convite permite até {invite.recipient.maxPartySize} pessoa(s).</p>}
            </div>
            {invite.recipient ? (
              <form className="rsvp-form" onSubmit={(event) => void rsvp(event)}>
                <label>
                  A tua resposta
                  <select name="status" value={status === "declined" ? "DECLINED" : "ACCEPTED"} onChange={(event) => setStatus(event.target.value === "DECLINED" ? "declined" : "accepted")}>
                    <option value="ACCEPTED">Sim, estarei presente</option>
                    <option value="DECLINED">Não poderei estar presente</option>
                  </select>
                </label>
                {status !== "declined" && (
                  <label>
                    Número de pessoas
                    <input name="partySize" type="number" min="1" max={invite.recipient.maxPartySize} value={partySize} onChange={(event) => setPartySize(Number(event.target.value))} />
                  </label>
                )}
                <button className="button button-primary">Enviar resposta →</button>
                {status === "A tua resposta foi registada. Obrigado!" && <p role="status">{status}</p>}
              </form>
            ) : (
              <p className="guest-guide-private-note">Este link pessoal já não está válido. Pede aos anfitriões que te enviem um link actualizado.</p>
            )}
          </section>
        ) : (
          <p className="guest-guide-rsvp-note">Para confirmares presença e consultares a tua mesa, abre o link individual que recebeste.</p>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <small className="invitation-footer">Convite e guia do evento · Nuvia</small>
    </main>
  );
}
