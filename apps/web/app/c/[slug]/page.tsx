"use client";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../lib/api";
type Invitation = {
  slug: string;
  headline: string | null;
  message: string | null;
  theme: "CLASSIC" | "BOTANICAL" | "TERRACOTTA";
  recipient: {
    name: string;
    maxPartySize: number;
    rsvp: { status: string; partySize: number } | null;
  } | null;
  project: {
    title: string;
    date: string | null;
    province: string | null;
    events: { title: string; startsAt: string | null; venue: string | null }[];
  };
};
export default function InvitationPage() {
  const { slug } = useParams<{ slug: string }>();
  const [token, setToken] = useState("");
  const [invite, setInvite] = useState<Invitation | null>(null);
  const [status, setStatus] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [error, setError] = useState("");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") || "";
    setToken(t);
    api<Invitation>(
      `/invitations/${slug}${t ? `?token=${encodeURIComponent(t)}` : ""}`,
    )
      .then((item) => {
        setInvite(item);
        if (item.recipient?.rsvp) {
          setPartySize(item.recipient.rsvp.partySize);
          setStatus(
            item.recipient.rsvp.status === "DECLINED" ? "declined" : "accepted",
          );
        }
      })
      .catch((e) => setError(e.message));
  }, [slug]);
  async function rsvp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
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
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível registar a resposta.",
      );
    }
  }
  if (!invite)
    return (
      <main className="invitation-page">
        <a className="planner-back" href="/">
          ♡ Casar em Angola
        </a>
        <p>{error || "A preparar o convite…"}</p>
      </main>
    );
  return (
    <main className="invitation-page">
      <div className={`invitation-card theme-${invite.theme.toLowerCase()}`}>
        <span className="invitation-mark">♡</span>
        <p className="eyebrow">Com alegria convidamos-te</p>
        <h1>{invite.headline || invite.project.title}</h1>
        {invite.recipient && (
          <p className="recipient">Querido/a {invite.recipient.name}</p>
        )}
        <p className="invitation-message">
          {invite.message || "Será uma alegria celebrar este momento contigo."}
        </p>
        {invite.project.date && (
          <p className="invitation-date">
            {new Intl.DateTimeFormat("pt-AO", {
              dateStyle: "long",
              timeZone: "Africa/Luanda",
            }).format(new Date(invite.project.date))}
          </p>
        )}
        {invite.project.province && <p>{invite.project.province}</p>}
        {invite.project.events.map((event) => (
          <div className="invitation-event" key={event.title}>
            <strong>{event.title}</strong>
            <span>
              {event.startsAt
                ? new Intl.DateTimeFormat("pt-AO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Africa/Luanda",
                  }).format(new Date(event.startsAt))
                : "Horário por confirmar"}
            </span>
            {event.venue && <span>{event.venue}</span>}
          </div>
        ))}
        {token ? (
          <form className="rsvp-form" onSubmit={rsvp}>
            <h2>Confirmar presença</h2>
            <label>
              A tua resposta
              <select
                name="status"
                value={status === "declined" ? "DECLINED" : "ACCEPTED"}
                onChange={(e) =>
                  setStatus(
                    e.target.value === "DECLINED" ? "declined" : "accepted",
                  )
                }
              >
                <option value="ACCEPTED">Sim, estarei presente</option>
                <option value="DECLINED">Não poderei estar presente</option>
              </select>
            </label>
            <label>
              Número de pessoas
              <input
                name="partySize"
                type="number"
                min="1"
                max={invite.recipient?.maxPartySize ?? 1}
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
              />
            </label>
            <button className="button button-primary">Enviar resposta →</button>
            {status === "A tua resposta foi registada. Obrigado!" && (
              <p role="status">{status}</p>
            )}
          </form>
        ) : (
          <p className="rsvp-private">
            A confirmação de presença é feita através do link individual enviado
            pelos noivos.
          </p>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>
      <small className="invitation-footer">
        Convite digital · Casar em Angola
      </small>
    </main>
  );
}
