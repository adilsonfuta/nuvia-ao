"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "../../lib/api";
import { formatAOA } from "../../lib/format";

type Vendor = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  services: string[];
  serviceAreas: string[];
  galleryUrls: string[];
  portfolio: { id: string; altText: string; sortOrder: number; isCover: boolean }[];
  websiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
  hasManager: boolean;
  province: string | null;
  municipality: string | null;
  capacityMin: number | null;
  capacityMax: number | null;
  priceFrom: string | null;
  priceTo: string | null;
  bookingTerms: string | null;
  paymentTerms: string | null;
  cancellationTerms: string | null;
  verifiedAt: string | null;
  isDemo: boolean;
  phone: string | null;
  email: string | null;
  reviewSummary: { average: number | null; count: number; items: { id: string; rating: number; communicationRating: number; punctualityRating: number; qualityRating: number; comment: string | null; reviewerName: string | null; createdAt: string; response: string | null }[] };
};
type Wedding = {
  id: string;
  title: string;
  date: string | null;
  province: string | null;
  guestEstimate: number | null;
};
const whatsAppNumber = (phone: string) => {
  const digits = phone.replace(/\D/g, "").replace(/^00/, "");
  return digits.startsWith("244") ? digits : `244${digits.replace(/^0/, "")}`;
};

export default function VendorPage() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const projectContext = searchParams.get("projectId") || "";
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const [weddingId, setWeddingId] = useState("");
  const [service, setService] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [guestEstimate, setGuestEstimate] = useState("");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preparedMessage, setPreparedMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [claimMessage, setClaimMessage] = useState("");
  const [claimPending, setClaimPending] = useState(false);
  const [claimNotice, setClaimNotice] = useState("");
  const [claimError, setClaimError] = useState("");

  useEffect(() => {
    api<Vendor>(`/vendors/${slug}`)
      .then(setVendor)
      .catch((err) => setError(err.message));
    api<{ user: unknown }>("/auth/me")
      .then(() => { setSignedIn(true); return api<Wedding[]>("/projects"); })
      .then((items) => {
        setWeddings(items);
        const selectedProject = items.find(
          (item) => item.id === projectContext,
        );
        if (selectedProject) {
          setWeddingId(selectedProject.id);
          setEventDate(
            selectedProject.date ? selectedProject.date.slice(0, 10) : "",
          );
          setGuestEstimate(
            selectedProject.guestEstimate
              ? String(selectedProject.guestEstimate)
              : "",
          );
          setLocation(selectedProject.province ?? "");
        }
      })
      .catch(() => setSignedIn(false));
  }, [slug, projectContext]);

  function selectWedding(id: string) {
    setWeddingId(id);
    const wedding = weddings.find((item) => item.id === id);
    if (!wedding) return;
    setEventDate(wedding.date ? wedding.date.slice(0, 10) : "");
    setGuestEstimate(
      wedding.guestEstimate ? String(wedding.guestEstimate) : "",
    );
    setLocation(wedding.province ?? "");
  }

  async function saveRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vendor || !weddingId) return;
    setSaving(true);
    setError("");
    setNotice("");
    const details = [
      `Serviço: ${service.trim() || "por definir"}`,
      `Data do evento: ${eventDate || "por definir"}`,
      `Convidados: ${guestEstimate || "por definir"}`,
      `Local: ${location.trim() || "por definir"}`,
      "",
      message.trim(),
    ].join("\n");
    try {
      await api("/quote-requests", {
        method: "POST",
        body: JSON.stringify({
          projectId: weddingId,
          vendorId: vendor.id,
          message: details,
        }),
      });
      setMessage("");
      setPreparedMessage(details);
      setNotice(
        vendor.isDemo
          ? "Pedido de demonstração guardado na tua conta. Nenhum prestador real foi contactado."
          : "Pedido guardado na tua conta. O envio ao prestador ainda não está disponível pela plataforma.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível guardar o pedido.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vendor) return;
    setClaimPending(true); setClaimError(""); setClaimNotice("");
    try {
      await api("/vendor-portal/claims", { method: "POST", body: JSON.stringify({ vendorId: vendor.id, message: claimMessage }) });
      setClaimNotice("Pedido enviado. A equipa vai confirmar a associação antes de conceder acesso ao perfil.");
      setClaimMessage("");
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "Não foi possível enviar o pedido.");
    } finally { setClaimPending(false); }
  }

  if (!vendor)
    return (
      <main className="catalog-page">
        <a
          className="planner-back"
          href={`/fornecedores${projectContext ? `?projectId=${encodeURIComponent(projectContext)}` : ""}`}
        >
          ← Directório de fornecedores
        </a>
        <section className="catalog-empty">
          <h2>{error || "A carregar perfil…"}</h2>
        </section>
      </main>
    );
  const capacity =
    vendor.capacityMin !== null && vendor.capacityMax !== null
      ? `${vendor.capacityMin.toLocaleString("pt-AO")}–${vendor.capacityMax.toLocaleString("pt-AO")} pessoas`
      : vendor.capacityMin !== null
        ? `A partir de ${vendor.capacityMin.toLocaleString("pt-AO")} pessoas`
        : vendor.capacityMax !== null
          ? `Até ${vendor.capacityMax.toLocaleString("pt-AO")} pessoas`
          : null;
  const socialLinks = [
    { label: "Site / portefólio", href: vendor.websiteUrl },
    { label: "Instagram", href: vendor.instagramUrl },
    { label: "Facebook", href: vendor.facebookUrl },
    { label: "TikTok", href: vendor.tiktokUrl },
  ].filter((item): item is { label: string; href: string } => Boolean(item.href));
  const portfolio = [
    ...vendor.portfolio.map((item) => ({ key: item.id, src: `/api/v1/vendor-portfolio/${item.id}/image`, alt: item.altText, cover: item.isCover })),
    ...vendor.galleryUrls.map((url, index) => ({ key: `${url}-${index}`, src: url, alt: `Trabalho ${index + 1} publicado por ${vendor.name}`, cover: false })),
  ];

  return (
    <main className="catalog-page vendor-profile-page">
      <a
        className="planner-back"
        href={`/fornecedores${projectContext ? `?projectId=${encodeURIComponent(projectContext)}` : ""}`}
      >
        ← Directório de fornecedores
      </a>
      <article className="vendor-detail">
        <header className="vendor-profile-header">
          <span className="vendor-profile-monogram" aria-hidden="true">
            {vendor.name.slice(0, 1)}
          </span>
          <div>
            <p className="eyebrow">{vendor.category}</p>
            <h1>{vendor.name}</h1>
            <p>
              {[vendor.municipality, vendor.province]
                .filter(Boolean)
                .join(", ") || "Localização por confirmar"}
            </p>
          </div>
          <div className="vendor-profile-badges">
            {vendor.isDemo ? (
              <span className="demo-badge">Perfil de demonstração</span>
            ) : vendor.verifiedAt ? (
              <span className="verified-badge">Perfil revisto</span>
            ) : (
              <span className="unverified-badge">Perfil por rever</span>
            )}
          </div>
        </header>

        {socialLinks.length > 0 && <nav className="vendor-social-links" aria-label={`Links oficiais de ${vendor.name}`}>{socialLinks.map((link) => <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer">{link.label}<span aria-hidden="true">↗</span></a>)}</nav>}
        {vendor.verifiedAt && <p className="vendor-review-disclaimer">A revisão confirma informações do perfil à data da verificação; não garante disponibilidade, qualidade ou execução do serviço.</p>}

        {!vendor.isDemo && !vendor.hasManager && <section className="vendor-claim-card"><div><p className="eyebrow">És o prestador?</p><h2>Gerencias este negócio?</h2><p>Pede para associar o perfil à tua conta. A equipa confirma o pedido antes de dar acesso para gerir imagens e informações.</p></div>{!signedIn ? <a className="button button-outline" href={`/entrar?next=${encodeURIComponent(`/fornecedores/${vendor.slug}`)}`}>Entrar para pedir acesso</a> : <form onSubmit={submitClaim}><label>Como podemos confirmar a tua relação com este negócio?<textarea required minLength={10} maxLength={600} value={claimMessage} onChange={e => setClaimMessage(e.target.value)} placeholder="Indica o teu papel e uma forma de confirmar que representas este prestador."/></label><button className="button button-primary" disabled={claimPending || claimMessage.trim().length < 10}>{claimPending ? "A enviar…" : "Pedir acesso ao perfil"}</button></form>}{claimNotice && <p className="vendor-claim-notice" role="status">{claimNotice}</p>}{claimError && <p className="form-error" role="alert">{claimError}</p>}</section>}

        {vendor.isDemo && (
          <p className="demo-disclosure">
            Este perfil é fictício. Serviços, capacidade e condições são
            exemplos de apresentação, não uma oferta real.
          </p>
        )}

        <section className="vendor-profile-section">
          <h2>Sobre o serviço</h2>
          <p>
            {vendor.description ||
              "O prestador ainda não publicou uma descrição."}
          </p>
        </section>

        <section className="vendor-profile-section">
          <h2>Serviços</h2>
          {vendor.services.length ? (
            <ul className="vendor-service-list">
              {vendor.services.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="profile-missing">
              O prestador ainda não detalhou os serviços incluídos. Confirma
              esses pontos antes de contratar.
            </p>
          )}
        </section>

        <section className="vendor-facts-grid">
          <article>
            <small>Localização</small>
            <strong>
              {[vendor.municipality, vendor.province]
                .filter(Boolean)
                .join(", ") || "Por confirmar"}
            </strong>
          </article>
          <article>
            <small>Zonas atendidas</small>
            <strong>
              {vendor.serviceAreas.length
                ? vendor.serviceAreas.join(", ")
                : "Por confirmar com o prestador"}
            </strong>
          </article>
          <article>
            <small>Capacidade informada</small>
            <strong>{capacity || "Não indicada"}</strong>
          </article>
          <article>
            <small>Preço publicado</small>
            <strong>
              {vendor.priceFrom && vendor.priceTo
                ? `${formatAOA(vendor.priceFrom)} – ${formatAOA(vendor.priceTo)}`
                : vendor.priceFrom
                  ? `A partir de ${formatAOA(vendor.priceFrom)}`
                  : vendor.priceTo
                    ? `Até ${formatAOA(vendor.priceTo)}`
                    : "Pedir informação"}
            </strong>
            {(vendor.priceFrom || vendor.priceTo) && (
              <small>
                Confirma o que está incluído e se o valor se aplica ao vosso
                evento.
              </small>
            )}
          </article>
        </section>

        <section className="vendor-profile-section">
          <div className="vendor-section-heading">
            <h2>Portefólio</h2>
            <span>
              {portfolio.length}{" "}
              {portfolio.length === 1 ? "imagem" : "imagens"}
            </span>
          </div>
          {portfolio.length ? (
            <div className="vendor-gallery">
              {portfolio.map((image) => (
                <a
                  className={image.cover ? "cover" : ""}
                  href={image.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  key={image.key}
                >
                  <img
                    src={image.src}
                    alt={image.alt}
                    loading="lazy"
                  />
                  {image.cover && <span>Capa do portefólio</span>}
                </a>
              ))}
            </div>
          ) : (
            <p className="profile-missing">
              Ainda não há fotografias de portefólio publicadas. Não usamos
              imagens de stock como se fossem trabalhos do prestador.
            </p>
          )}
        </section>

        <section className="vendor-profile-section vendor-terms">
          <h2>Condições a confirmar</h2>
          <dl>
            <div>
              <dt>Reserva</dt>
              <dd>{vendor.bookingTerms || "Não informada"}</dd>
            </div>
            <div>
              <dt>Pagamento</dt>
              <dd>{vendor.paymentTerms || "Não informado"}</dd>
            </div>
            <div>
              <dt>Cancelamento</dt>
              <dd>{vendor.cancellationTerms || "Não informado"}</dd>
            </div>
          </dl>
          <p className="profile-missing">
            A disponibilidade da data deve ser confirmada directamente antes de
            qualquer compromisso.
          </p>
        </section>

        <section className="vendor-profile-section">
          <h2>Avaliações</h2>
          {vendor.reviewSummary.count ? <>
            <div className="vendor-rating-summary"><strong>{vendor.reviewSummary.average?.toFixed(1)} <span aria-hidden="true">★</span></strong><span>{vendor.reviewSummary.count} {vendor.reviewSummary.count === 1 ? "avaliação" : "avaliações"} de serviços contratados</span></div>
            <div className="vendor-public-reviews">{vendor.reviewSummary.items.map(review => <article key={review.id}><header><strong>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</strong><span>Contratação registada no evento</span></header><p className="vendor-review-author">{review.reviewerName || "Membro do evento · anónimo"} · {new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeZone: "Africa/Luanda" }).format(new Date(review.createdAt))}</p>{review.comment && <p>{review.comment}</p>}<small>Qualidade {review.qualityRating}/5 · Comunicação {review.communicationRating}/5 · Pontualidade {review.punctualityRating}/5</small>{review.response && <blockquote><strong>Resposta do prestador</strong><br/>{review.response}</blockquote>}</article>)}</div>
          </> : <p className="profile-missing">Ainda não há avaliações de serviços contratados. Não apresentamos classificações demonstrativas.</p>}
        </section>

        <section className="dash-panel quote-panel" id="pedido">
          <h2>Pedir informação</h2>
          <p className="quote-disclosure">
            O pedido fica guardado na tua conta. Depois podes abrir o teu email
            ou WhatsApp com a mensagem preparada e enviá-la directamente ao
            prestador.
          </p>
          {vendor.isDemo && (
            <p className="demo-disclosure">
              Este perfil é fictício; o pedido será apenas demonstrativo e
              nenhum prestador real será contactado.
            </p>
          )}
          {weddings.length ? (
            <form className="quote-form" onSubmit={saveRequest}>
              {projectContext && (
                <p className="vendor-project-context-note">
                  Pedido associado ao evento seleccionado. Podes alterar o
                  evento abaixo.
                </p>
              )}
              <label>
                Associar a um plano
                <select
                  required
                  value={weddingId}
                  onChange={(event) => selectWedding(event.target.value)}
                >
                  <option value="">Escolher plano</option>
                  {weddings.map((wedding) => (
                    <option value={wedding.id} key={wedding.id}>
                      {wedding.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Que serviço procuram?
                <input
                  maxLength={120}
                  value={service}
                  onChange={(event) => setService(event.target.value)}
                  placeholder="Ex.: decoração da recepção"
                />
              </label>
              <div className="vendor-request-pair">
                <label>
                  Data prevista
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(event) => setEventDate(event.target.value)}
                  />
                </label>
                <label>
                  Número de convidados
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={guestEstimate}
                    onChange={(event) => setGuestEstimate(event.target.value)}
                    placeholder="Por definir"
                  />
                </label>
              </div>
              <label>
                Local do evento
                <input
                  maxLength={120}
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Província ou município"
                />
              </label>
              <label>
                Mensagem
                <textarea
                  required
                  minLength={10}
                  maxLength={1400}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Que informação gostariam de receber?"
                />
              </label>
              <button className="button button-primary" disabled={saving}>
                {saving ? "A guardar…" : "Guardar pedido na conta"}
              </button>
            </form>
          ) : (
            <p>
              Para guardar um pedido, <a href="/entrar">entra</a> ou{" "}
              <a href="/criar-conta">cria uma conta</a> e inicia um plano.
            </p>
          )}
          {preparedMessage &&
            !vendor.isDemo &&
            (vendor.phone || vendor.email) && (
              <div className="vendor-manual-send">
                <strong>Mensagem pronta para enviar</strong>
                <p>
                  Escolhe um canal. A mensagem só é enviada quando confirmares
                  no teu email ou WhatsApp.
                </p>
                <div>
                  {vendor.phone && (
                    <a
                      className="button button-primary"
                      href={`https://wa.me/${whatsAppNumber(vendor.phone)}?text=${encodeURIComponent(preparedMessage)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir WhatsApp
                    </a>
                  )}
                  {vendor.email && (
                    <a
                      className="button button-outline"
                      href={`mailto:${vendor.email}?subject=${encodeURIComponent(`Pedido de informação — ${vendor.name}`)}&body=${encodeURIComponent(preparedMessage)}`}
                    >
                      Abrir email
                    </a>
                  )}
                </div>
              </div>
            )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="quote-notice" role="status">
              {notice}
            </p>
          )}
        </section>
      </article>
    </main>
  );
}
