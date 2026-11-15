"use client";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatAOA } from "../lib/format";
import { VendorModerationWorkspace } from "./vendor-moderation-workspace";

type Vendor = {
  id: string;
  slug: string;
  name: string;
  category: string;
  province: string | null;
  municipality: string | null;
  status: string;
  isDemo: boolean;
  ownerUserId?: string | null;
  description: string | null;
  services: string[];
  serviceAreas: string[];
  capacityMin: number | null;
  capacityMax: number | null;
  priceFrom: string | null;
  priceTo: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  bookingTerms: string | null;
  paymentTerms: string | null;
  cancellationTerms: string | null;
  galleryUrls: string[];
};
type Guide = {
  id: string;
  title: string;
  slug: string;
  status: string;
  summary: string;
};
type Source = {
  id: string;
  title: string;
  url: string | null;
  status: string;
  reviewedAt: string | null;
};
type Office = {
  id: string;
  name: string;
  province: string;
  municipality: string | null;
  sourceUrl: string | null;
  status: string;
};
type VendorApplication = {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  category: string;
  province: string;
  municipality: string | null;
  website: string | null;
  message: string;
  status: "NEW" | "CONTACTED" | "DECLINED" | "CONVERTED";
  createdAt: string;
  vendorId: string | null;
};
type AdminAudit = { id: string; action: string; resource: string; resourceId: string; metadata: Record<string, unknown> | null; createdAt: string; actor: { name: string | null; email: string } };
type PlatformConfig = { vendorCategories: string[]; provinces: string[] };
const splitLines = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
const angolaProvinces = [
  "Bengo",
  "Benguela",
  "Bié",
  "Cabinda",
  "Cuando",
  "Cubango",
  "Cuanza Norte",
  "Cuanza Sul",
  "Cunene",
  "Huambo",
  "Huíla",
  "Icolo e Bengo",
  "Luanda",
  "Lunda Norte",
  "Lunda Sul",
  "Malanje",
  "Moxico",
  "Moxico Leste",
  "Namibe",
  "Uíge",
  "Zaire",
];

export default function AdminConsole() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [applications, setApplications] = useState<VendorApplication[]>([]);
  const [audit, setAudit] = useState<AdminAudit[]>([]);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>({ vendorCategories: [], provinces: [] });
  const [error, setError] = useState("A verificar o acesso…");
  const [tab, setTab] = useState<
    "vendors" | "applications" | "vendorReview" | "guides" | "legal" | "config" | "history"
  >("vendors");
  const [vendorStatusFilter, setVendorStatusFilter] = useState("PENDING");
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorCategoryFilter, setVendorCategoryFilter] = useState("");
  const [vendorProvinceFilter, setVendorProvinceFilter] = useState("");
  const [applicationFilter, setApplicationFilter] = useState("OPEN");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [reasonDecision, setReasonDecision] = useState<{ type: "vendor" | "application"; id: string; label: string; status: "SUSPENDED" | "DECLINED" } | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [savingAction, setSavingAction] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState("");
  const [vendorSlug, setVendorSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [province, setProvince] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [description, setDescription] = useState("");
  const [services, setServices] = useState("");
  const [serviceAreas, setServiceAreas] = useState("");
  const [galleryUrls, setGalleryUrls] = useState("");
  const [capacityMin, setCapacityMin] = useState("");
  const [capacityMax, setCapacityMax] = useState("");
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");
  const [bookingTerms, setBookingTerms] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [cancellationTerms, setCancellationTerms] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [configCategoriesText, setConfigCategoriesText] = useState("");
  const [configProvincesText, setConfigProvincesText] = useState("");
  const [guideTitle, setGuideTitle] = useState("");
  const [guideSlug, setGuideSlug] = useState("");
  const [guideSummary, setGuideSummary] = useState("");
  const [guideBody, setGuideBody] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [reqTitle, setReqTitle] = useState("");
  const [reqBody, setReqBody] = useState("");
  const [reqStatus, setReqStatus] = useState("UNCONFIRMED");
  const [natA, setNatA] = useState("");
  const [natB, setNatB] = useState("");
  const [reqProvince, setReqProvince] = useState("");
  const [previousMarriageA, setPreviousMarriageA] = useState("");
  const [previousMarriageB, setPreviousMarriageB] = useState("");
  const [officeName, setOfficeName] = useState("");
  const [officeProvince, setOfficeProvince] = useState("");
  const [officeMunicipality, setOfficeMunicipality] = useState("");
  const [officeUrl, setOfficeUrl] = useState("");
  async function refresh() {
    const [v, g, s, o, a, h, c] = await Promise.all([
      api<Vendor[]>("/admin/vendors"),
      api<Guide[]>("/admin/guides"),
      api<Source[]>("/admin/legal/sources"),
      api<Office[]>("/admin/registry-offices"),
      api<VendorApplication[]>("/admin/vendor-applications"),
      api<AdminAudit[]>("/admin/audit"),
      api<PlatformConfig>("/admin/config"),
    ]);
    setVendors(v);
    setGuides(g);
    setSources(s);
    setOffices(o);
    setApplications(a);
    setAudit(h);
    setPlatformConfig({ vendorCategories: c.vendorCategories ?? [], provinces: c.provinces ?? [] });
    setConfigCategoriesText((c.vendorCategories ?? []).join("\n"));
    setConfigProvincesText((c.provinces ?? []).join("\n"));
    setError("");
    if (!sourceId && s[0]) setSourceId(s[0].id);
  }
  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (showVendorForm) requestAnimationFrame(() => document.querySelector(".vendor-admin-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [showVendorForm, editingVendorId]);
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    if (savingAction) return false;
    setError("");
    setSavingAction(true);
    try {
      await action();
      await refresh();
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível concluir a acção.",
      );
      return false;
    } finally {
      setSavingAction(false);
    }
  }
  async function reviewVendor(v: Vendor, status: "ACTIVE" | "SUSPENDED") {
    if (status === "SUSPENDED") {
      setReasonDecision({ type: "vendor", id: v.id, label: v.name, status });
      setDecisionReason("");
      return;
    }
    await run(() =>
      api(`/admin/vendors/${v.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    );
  }
  function editVendor(v: Vendor) {
    setEditingVendorId(v.id);
    setShowVendorForm(true);
    setVendorSlug(v.slug);
    setName(v.name); setCategory(v.category); setProvince(v.province ?? ""); setMunicipality(v.municipality ?? "");
    setDescription(v.description ?? ""); setServices(v.services.join("\n")); setServiceAreas(v.serviceAreas.join("\n"));
    setGalleryUrls(v.galleryUrls.join("\n"));
    setCapacityMin(v.capacityMin === null ? "" : String(v.capacityMin)); setCapacityMax(v.capacityMax === null ? "" : String(v.capacityMax));
    setPriceFrom(v.priceFrom ?? ""); setPriceTo(v.priceTo ?? ""); setVendorPhone(v.phone ?? ""); setVendorEmail(v.email ?? "");
    setBookingTerms(v.bookingTerms ?? ""); setPaymentTerms(v.paymentTerms ?? ""); setCancellationTerms(v.cancellationTerms ?? "");
  }
  function resetVendorForm() {
    setShowVendorForm(false);
    setEditingVendorId(""); setVendorSlug(""); setName(""); setCategory(""); setProvince(""); setMunicipality(""); setDescription(""); setServices(""); setServiceAreas(""); setGalleryUrls(""); setCapacityMin(""); setCapacityMax(""); setPriceFrom(""); setPriceTo(""); setBookingTerms(""); setPaymentTerms(""); setCancellationTerms(""); setVendorPhone(""); setVendorEmail("");
  }
  async function reviewApplication(
    application: VendorApplication,
    status: "CONTACTED" | "DECLINED",
  ) {
    if (status === "DECLINED") {
      setReasonDecision({ type: "application", id: application.id, label: application.businessName, status });
      setDecisionReason("");
      return;
    }
    await run(() =>
      api(`/admin/vendor-applications/${application.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    );
  }
  async function saveDecisionReason() {
    if (!reasonDecision || decisionReason.trim().length < 8) return;
    const target = reasonDecision;
    const succeeded = await run(() => api(
      target.type === "vendor" ? `/admin/vendors/${target.id}` : `/admin/vendor-applications/${target.id}`,
      { method: "PATCH", body: JSON.stringify({ status: target.status, reason: decisionReason.trim() }) },
    ));
    if (succeeded) {
      setReasonDecision(null);
      setDecisionReason("");
    }
  }
  async function convertApplication(application: VendorApplication) {
    await run(() =>
      api(`/admin/vendor-applications/${application.id}/convert`, {
        method: "POST",
      }),
    );
  }
  async function createVendor(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      const payload = {
          name,
          slug: editingVendorId ? vendorSlug :
            name
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "") +
            "-" +
            Date.now().toString().slice(-4),
          category,
          province: editingVendorId ? province || null : province || undefined,
          municipality: editingVendorId ? municipality || null : municipality || undefined,
          description: editingVendorId ? description || null : description || undefined,
          services: splitLines(services),
          serviceAreas: splitLines(serviceAreas),
          galleryUrls: splitLines(galleryUrls),
          capacityMin: capacityMin ? Number(capacityMin) : editingVendorId ? null : undefined,
          capacityMax: capacityMax ? Number(capacityMax) : editingVendorId ? null : undefined,
          priceFrom: priceFrom ? Number(priceFrom) : editingVendorId ? null : undefined,
          priceTo: priceTo ? Number(priceTo) : editingVendorId ? null : undefined,
          bookingTerms: editingVendorId ? bookingTerms || null : bookingTerms || undefined,
          paymentTerms: editingVendorId ? paymentTerms || null : paymentTerms || undefined,
          cancellationTerms: editingVendorId ? cancellationTerms || null : cancellationTerms || undefined,
          phone: editingVendorId ? vendorPhone || null : vendorPhone || undefined,
          email: editingVendorId ? vendorEmail || null : vendorEmail || undefined,
      };
      await api(editingVendorId ? `/admin/vendors/${editingVendorId}` : "/admin/vendors", {
        method: editingVendorId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      resetVendorForm();
    });
  }
  async function savePlatformConfig(e: FormEvent) {
    e.preventDefault();
    const vendorCategories = splitLines(configCategoriesText);
    const provinces = splitLines(configProvincesText);
    await run(async () => {
      const saved = await api<PlatformConfig>("/admin/config", { method: "PATCH", body: JSON.stringify({ vendorCategories, provinces }) });
      setPlatformConfig(saved);
      setConfigCategoriesText(saved.vendorCategories.join("\n"));
      setConfigProvincesText(saved.provinces.join("\n"));
    });
  }
  async function createGuide(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      await api("/admin/guides", {
        method: "POST",
        body: JSON.stringify({
          title: guideTitle,
          slug: guideSlug,
          summary: guideSummary,
          body: guideBody,
          category: "Planeamento",
          status: "DRAFT",
        }),
      });
      setGuideTitle("");
      setGuideSlug("");
      setGuideSummary("");
      setGuideBody("");
    });
  }
  async function publishGuide(g: Guide) {
    await run(() =>
      api(`/admin/guides/${g.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: g.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
          reviewedAt: new Date().toISOString(),
        }),
      }),
    );
  }
  async function addSource(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      await api("/admin/legal/sources", {
        method: "POST",
        body: JSON.stringify({
          title: sourceTitle,
          url: sourceUrl || undefined,
          status: "UNCONFIRMED",
        }),
      });
      setSourceTitle("");
      setSourceUrl("");
    });
  }
  async function reviewSource(source: Source) {
    const status = source.status === "CONFIRMED" ? "OUTDATED" : "CONFIRMED";
    await run(() =>
      api(`/admin/legal/sources/${source.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, reviewedAt: new Date().toISOString() }),
      }),
    );
  }
  async function addRequirement(e: FormEvent) {
    e.preventDefault();
    if (!sourceId) {
      setError("Regista uma fonte antes de adicionar um requisito.");
      return;
    }
    await run(async () => {
      await api("/admin/legal/requirements", {
        method: "POST",
        body: JSON.stringify({
          sourceId,
          title: reqTitle,
          description: reqBody,
          applicability: reqStatus,
          nationalityA: natA || undefined,
          nationalityB: natB || undefined,
          province: reqProvince || undefined,
          previousMarriageA: previousMarriageA || undefined,
          previousMarriageB: previousMarriageB || undefined,
          reviewedAt:
            reqStatus === "CONFIRMED" ? new Date().toISOString() : undefined,
        }),
      });
      setReqTitle("");
      setReqBody("");
      setNatA("");
      setNatB("");
      setReqProvince("");
      setPreviousMarriageA("");
      setPreviousMarriageB("");
    });
  }
  async function addOffice(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      await api("/admin/registry-offices", {
        method: "POST",
        body: JSON.stringify({
          name: officeName,
          province: officeProvince,
          municipality: officeMunicipality || undefined,
          sourceUrl: officeUrl || undefined,
        }),
      });
      setOfficeName("");
      setOfficeProvince("");
      setOfficeMunicipality("");
      setOfficeUrl("");
    });
  }
  async function reviewOffice(office: Office) {
    await run(() =>
      api(`/admin/registry-offices/${office.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "CONFIRMED",
          reviewedAt: new Date().toISOString(),
        }),
      }),
    );
  }
  const pendingVendors = vendors.filter((vendor) => vendor.status === "PENDING");
  const activeVendors = vendors.filter((vendor) => vendor.status === "ACTIVE");
  const suspendedVendors = vendors.filter((vendor) => vendor.status === "SUSPENDED");
  const openApplications = applications.filter((application) => ["NEW", "CONTACTED"].includes(application.status));
  const visibleVendors = vendors.filter((vendor) => {
    const matchesStatus = vendorStatusFilter === "ALL" || vendor.status === vendorStatusFilter;
    const query = vendorSearch.trim().toLocaleLowerCase("pt-AO");
    const matchesSearch = !query || [vendor.name, vendor.category, vendor.slug, vendor.province, vendor.municipality, vendor.email, vendor.phone].some((value) => value?.toLocaleLowerCase("pt-AO").includes(query));
    return matchesStatus && matchesSearch && (!vendorCategoryFilter || vendor.category === vendorCategoryFilter) && (!vendorProvinceFilter || vendor.province === vendorProvinceFilter);
  });
  const visibleApplications = applications.filter((application) => applicationFilter === "ALL" || (applicationFilter === "OPEN" ? ["NEW", "CONTACTED"].includes(application.status) : application.status === applicationFilter));
  function auditSummary(entry: AdminAudit) {
    const metadata = entry.metadata ?? {};
    if (entry.action === "VENDOR_STATUS_CHANGED" || entry.action === "VENDOR_REVIEWED") return `Estado: ${String(metadata.from ?? "—")} → ${String(metadata.to ?? "—")}${metadata.reason ? ` · Motivo: ${String(metadata.reason)}` : ""}`;
    if (entry.action === "VENDOR_PROFILE_UPDATED") return `Perfil actualizado · Campos: ${Array.isArray(metadata.changedFields) ? metadata.changedFields.map(String).join(", ") : "detalhes revistos"}`;
    if (entry.action === "VENDOR_APPLICATION_REVIEWED") return `Candidatura: ${String(metadata.from ?? "—")} → ${String(metadata.to ?? "—")}${metadata.reason ? ` · Motivo: ${String(metadata.reason)}` : ""}`;
    if (entry.action === "VENDOR_APPLICATION_CONVERTED") return `Candidatura convertida no perfil ${String(metadata.vendorId ?? "")}`;
    if (entry.action === "PLATFORM_CATALOG_CONFIG_UPDATED") return "Categorias e províncias do directório actualizadas.";
    if (entry.action === "VENDOR_CREATED") return "Perfil criado como pendente de revisão.";
    return entry.action.replaceAll("_", " ").toLocaleLowerCase("pt-AO");
  }
  return (
    <main className="admin-page">
      <a className="planner-back" href="/">
        ← Nuvia
      </a>
      <div className="admin-head">
        <div>
          <p className="eyebrow">Backoffice</p>
          <h1>Administração</h1>
          <p>Fila de fornecedores, conteúdos e operações da plataforma.</p>
        </div>
        <a className="button button-outline" href="/dashboard">
          Ir para o painel
        </a>
      </div>
      {loading ? (
        <p>{error}</p>
      ) : error ? (
        <section className="catalog-empty">
          <h2>Acesso não disponível</h2>
          <p>{error}</p>
          <p>
            É necessário entrar com uma conta de administração ou moderação.
          </p>
          <a className="button button-primary" href="/entrar?next=%2Fadmin">
            Entrar
          </a>
        </section>
      ) : (
        <>
          <section className="admin-summary-grid" aria-label="Resumo da operação">
            <button className={tab === "vendors" && vendorStatusFilter === "PENDING" ? "selected" : ""} onClick={() => { setTab("vendors"); setVendorStatusFilter("PENDING"); }}><small>Fornecedores por rever</small><strong>{pendingVendors.length}</strong><span>Perfis que aguardam decisão</span></button>
            <button className={tab === "applications" ? "selected" : ""} onClick={() => setTab("applications")}><small>Candidaturas abertas</small><strong>{openApplications.length}</strong><span>Novas ou contactadas</span></button>
            <button className={tab === "vendors" && vendorStatusFilter === "ACTIVE" ? "selected" : ""} onClick={() => { setTab("vendors"); setVendorStatusFilter("ACTIVE"); }}><small>Fornecedores activos</small><strong>{activeVendors.length}</strong><span>Visíveis no directório</span></button>
            <button className={tab === "vendors" && vendorStatusFilter === "SUSPENDED" ? "selected" : ""} onClick={() => { setTab("vendors"); setVendorStatusFilter("SUSPENDED"); }}><small>Fornecedores suspensos</small><strong>{suspendedVendors.length}</strong><span>Fora dos resultados públicos</span></button>
          </section>
          <nav className="admin-tabs">
            {(
              [
                ["vendors", "Fornecedores"],
                [
                  "applications",
                    `Candidaturas${openApplications.length ? ` (${openApplications.length})` : ""}`,
                ],
                ["vendorReview", "Confiança e revisão"],
                ["guides", "Guias"],
                ["legal", "Fontes e requisitos"],
                ["config", "Configurações"],
                ["history", "Histórico"],
              ] as const
            ).map(([key, label]) => (
              <button
                className={tab === key ? "current" : ""}
                onClick={() => setTab(key)}
                key={key}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === "vendors" && (
            <>
            <header className="admin-workbar"><div><p className="eyebrow">Operação</p><h2>Fila de fornecedores</h2><p>Revê primeiro os perfis pendentes e acompanha os restantes pelo estado.</p></div><button className="button button-primary" onClick={() => { resetVendorForm(); setShowVendorForm(true); }}>+ Registar fornecedor</button></header>
            <div className={`admin-grid ${showVendorForm ? "with-form" : "list-only"}`}>
              <section className="dash-panel">
                <div className="admin-filter-bar"><label className="admin-search">Pesquisar<input value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} placeholder="Nome, categoria, local ou contacto"/></label><label>Estado<select value={vendorStatusFilter} onChange={e => setVendorStatusFilter(e.target.value)}><option value="PENDING">Por rever</option><option value="ALL">Todos</option><option value="ACTIVE">Activos</option><option value="SUSPENDED">Suspensos</option><option value="DRAFT">Rascunhos</option></select></label><label>Categoria<select value={vendorCategoryFilter} onChange={e => setVendorCategoryFilter(e.target.value)}><option value="">Todas</option>{platformConfig.vendorCategories.map(item => <option key={item}>{item}</option>)}</select></label><label>Província<select value={vendorProvinceFilter} onChange={e => setVendorProvinceFilter(e.target.value)}><option value="">Todas</option>{platformConfig.provinces.map(item => <option key={item}>{item}</option>)}</select></label><button type="button" className="button button-outline compact" onClick={() => { setVendorSearch(""); setVendorCategoryFilter(""); setVendorProvinceFilter(""); }}>Limpar</button></div>
                {visibleVendors.length ? (
                  visibleVendors.map((v) => (
                    <div className="admin-vendor-item" key={v.id}>
                    <article className="admin-row">
                      <span>
                        <strong>{v.name}</strong>
                        <small>
                          {v.category} ·{" "}
                          {[v.municipality, v.province]
                            .filter(Boolean)
                            .join(", ") || "Localização por confirmar"}
                          {v.isDemo ? " · demonstração" : ""}
                          {v.ownerUserId ? " · conta do prestador associada" : ""}
                        </small>
                        <small>
                          {v.description || "Sem descrição"}
                          {v.services.length
                            ? ` · Serviços: ${v.services.join(", ")}`
                            : ""}
                        </small>
                        <small>
                          Estado: {v.status === "PENDING" ? "Por rever" : v.status === "ACTIVE" ? "Activo" : v.status === "SUSPENDED" ? "Suspenso" : "Rascunho"} · Perfil criado em {new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium" }).format(new Date(v.createdAt))}
                        </small>
                        <small>
                          {v.serviceAreas.length
                            ? `Zonas: ${v.serviceAreas.join(", ")}`
                            : "Zonas não indicadas"}
                          {v.capacityMin !== null || v.capacityMax !== null
                            ? ` · Capacidade: ${v.capacityMin ?? "—"}–${v.capacityMax ?? "—"}`
                            : ""}
                          {v.priceFrom || v.priceTo
                            ? ` · Preço: ${formatAOA(v.priceFrom)} – ${formatAOA(v.priceTo)}`
                            : ""}
                        </small>
                      </span>
                      <div>
                        <button type="button" onClick={() => setSelectedVendorId(selectedVendorId === v.id ? "" : v.id)}>{selectedVendorId === v.id ? "Fechar ficha" : "Ficha"}</button>
                        <a href={`/fornecedores/${v.slug}`} target="_blank" rel="noreferrer">Ver perfil</a>
                        <button disabled={savingAction} onClick={() => editVendor(v)}>Editar</button>
                        {v.status !== "ACTIVE" && !v.isDemo && <button disabled={savingAction} onClick={() => void reviewVendor(v, "ACTIVE")}>Aprovar / activar</button>}
                        {v.status === "ACTIVE" && <button disabled={savingAction} onClick={() => void reviewVendor(v, "SUSPENDED")}>Suspender</button>}
                        {v.status === "SUSPENDED" && <button disabled={savingAction} onClick={() => void reviewVendor(v, "ACTIVE")}>Reactivar</button>}
                      </div>
                    </article>
                    {selectedVendorId === v.id && <section className="admin-vendor-detail"><div><small>Contacto</small><strong>{v.phone || "Telefone não indicado"} · {v.email || "Email não indicado"}</strong></div><div><small>Serviços</small><strong>{v.services.length ? v.services.join(" · ") : "Por preencher"}</strong></div><div><small>Zonas atendidas</small><strong>{v.serviceAreas.length ? v.serviceAreas.join(" · ") : "Por preencher"}</strong></div><div><small>Capacidade e valores</small><strong>{v.capacityMin ?? "—"}–{v.capacityMax ?? "—"} pessoas · {formatAOA(v.priceFrom)} – {formatAOA(v.priceTo)}</strong></div><div><small>Condições</small><strong>Reserva: {v.bookingTerms || "não indicadas"} · Pagamento: {v.paymentTerms || "não indicadas"} · Cancelamento: {v.cancellationTerms || "não indicado"}</strong></div></section>}
                    </div>
                  ))
                ) : (
                  <p className="empty-copy">{vendorStatusFilter === "PENDING" && !vendorSearch && !vendorCategoryFilter && !vendorProvinceFilter ? "A fila de revisão está limpa. Ainda não há perfis pendentes." : "Não encontrámos fornecedores com estes filtros."}</p>
                )}
              </section>
              {showVendorForm && (
              <form
                className="dash-panel admin-form vendor-admin-form"
                onSubmit={createVendor}
              >
                <h2>{editingVendorId ? "Editar perfil do fornecedor" : "Registar fornecedor"}</h2>
                <p>
                  O perfil fica pendente até ser revisto. Só publica informação
                  fornecida pelo prestador; não acrescentes preços, fotos ou
                  condições por suposição.
                </p>
                <label>
                  Nome
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                {editingVendorId && <label>Endereço do perfil<input required minLength={2} value={vendorSlug} onChange={e => setVendorSlug(e.target.value)}/></label>}
                <label>
                  Categoria
                  <input
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    list="admin-vendor-categories"
                  />
                  <datalist id="admin-vendor-categories">{platformConfig.vendorCategories.map(item => <option key={item} value={item}/>)}</datalist>
                </label>
                <div className="admin-form-pair">
                  <label>
                    Província
                    <input
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                    />
                  </label>
                  <label>
                    Município
                    <input
                      value={municipality}
                      onChange={(e) => setMunicipality(e.target.value)}
                    />
                  </label>
                </div>
                <div className="admin-form-pair"><label>Telefone<input value={vendorPhone} onChange={e => setVendorPhone(e.target.value)}/></label><label>Email<input type="email" value={vendorEmail} onChange={e => setVendorEmail(e.target.value)}/></label></div>
                <label>
                  Descrição do serviço
                  <textarea
                    maxLength={2000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
                <label>
                  Serviços, um por linha
                  <textarea
                    value={services}
                    onChange={(e) => setServices(e.target.value)}
                    placeholder="Ex.: fotografia da cerimónia"
                  />
                </label>
                <label>
                  Zonas atendidas, uma por linha
                  <textarea
                    value={serviceAreas}
                    onChange={(e) => setServiceAreas(e.target.value)}
                    placeholder="Ex.: Luanda"
                  />
                </label>
                <div className="admin-form-pair">
                  <label>
                    Capacidade mínima
                    <input
                      type="number"
                      min="0"
                      value={capacityMin}
                      onChange={(e) => setCapacityMin(e.target.value)}
                    />
                  </label>
                  <label>
                    Capacidade máxima
                    <input
                      type="number"
                      min="1"
                      value={capacityMax}
                      onChange={(e) => setCapacityMax(e.target.value)}
                    />
                  </label>
                </div>
                <div className="admin-form-pair">
                  <label>
                    Preço mínimo (Kz)
                    <input
                      type="number"
                      min="0"
                      value={priceFrom}
                      onChange={(e) => setPriceFrom(e.target.value)}
                    />
                  </label>
                  <label>
                    Preço máximo (Kz)
                    <input
                      type="number"
                      min="0"
                      value={priceTo}
                      onChange={(e) => setPriceTo(e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  URLs do portefólio, uma por linha
                  <textarea
                    value={galleryUrls}
                    onChange={(e) => setGalleryUrls(e.target.value)}
                    placeholder="https://…"
                  />
                </label>
                <label>
                  Condições de reserva
                  <textarea
                    maxLength={1000}
                    value={bookingTerms}
                    onChange={(e) => setBookingTerms(e.target.value)}
                  />
                </label>
                <label>
                  Condições de pagamento
                  <textarea
                    maxLength={1000}
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                  />
                </label>
                <label>
                  Política de cancelamento
                  <textarea
                    maxLength={1000}
                    value={cancellationTerms}
                    onChange={(e) => setCancellationTerms(e.target.value)}
                  />
                </label>
                <button disabled={savingAction} className="button button-primary">
                  {savingAction ? "A guardar…" : editingVendorId ? "Guardar alterações" : "Guardar perfil para revisão"}
                </button>
                {editingVendorId && <button type="button" className="button button-outline" onClick={resetVendorForm}>Cancelar edição</button>}
              </form>
              )}
            </div>
            </>
          )}
          {tab === "vendorReview" && <VendorModerationWorkspace />}
          {tab === "applications" && (
            <section className="dash-panel admin-applications-panel">
              <h2>Candidaturas de fornecedores</h2>
              <p className="empty-copy">
                Revê o negócio e contacta a pessoa antes de criar um perfil. A
                conversão cria um perfil pendente que ainda precisa de
                aprovação.
              </p>
              <div className="admin-filter-bar application-filter-bar"><label>Fila<select value={applicationFilter} onChange={e => setApplicationFilter(e.target.value)}><option value="OPEN">Em análise ({openApplications.length})</option><option value="ALL">Todas</option><option value="NEW">Novas</option><option value="CONTACTED">Contactadas</option><option value="CONVERTED">Convertidas</option><option value="DECLINED">Recusadas</option></select></label></div>
              {visibleApplications.length ? (
                visibleApplications.map((application) => (
                  <article
                    className="admin-row vendor-application-row"
                    key={application.id}
                  >
                    <span>
                      <strong>
                        {application.businessName}{" "}
                        <small>· {application.category}</small>
                      </strong>
                      <small>
                        {application.contactName} ·{" "}
                        {application.status === "NEW" ? "Nova" : application.status === "CONTACTED" ? "Contactada" : application.status === "DECLINED" ? "Recusada" : "Convertida em perfil"}
                      </small>
                      <small>
                        {[application.municipality, application.province]
                          .filter(Boolean)
                          .join(", ")}
                      </small>
                      <small>
                        <a href={`mailto:${application.email}`}>
                          {application.email}
                        </a>{" "}
                        ·{" "}
                        <a href={`tel:${application.phone}`}>
                          {application.phone}
                        </a>
                        {application.website ? (
                          <>
                            {" "}
                            ·{" "}
                            <a
                              href={application.website}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Website
                            </a>
                          </>
                        ) : null}
                      </small>
                      <small>{application.message}</small>
                    </span>
                    <div>
                      {!application.vendorId && application.status !== "DECLINED" && <button disabled={savingAction} onClick={() => void convertApplication(application)}>Criar perfil pendente</button>}
                      {application.status === "NEW" && (
                        <button disabled={savingAction}
                          onClick={() =>
                            void reviewApplication(application, "CONTACTED")
                          }
                        >
                          Marcar contactada
                        </button>
                      )}
                      {application.status !== "DECLINED" && application.status !== "CONVERTED" && <button disabled={savingAction} onClick={() => void reviewApplication(application, "DECLINED")}>Recusar</button>}
                    </div>
                  </article>
                ))
              ) : (
                <p className="empty-copy">
                  Ainda não há candidaturas para rever.
                </p>
              )}
            </section>
          )}
          {tab === "guides" && (
            <div className="admin-grid">
              <section className="dash-panel">
                <h2>Guias</h2>
                {guides.map((g) => (
                  <article className="admin-row" key={g.id}>
                    <span>
                      <strong>{g.title}</strong>
                      <small>{g.status}</small>
                    </span>
                    <button onClick={() => void publishGuide(g)}>
                      {g.status === "PUBLISHED" ? "Retirar" : "Publicar"}
                    </button>
                  </article>
                ))}
              </section>
              <form className="dash-panel admin-form" onSubmit={createGuide}>
                <h2>Escrever guia</h2>
                <label>
                  Título
                  <input
                    required
                    value={guideTitle}
                    onChange={(e) => setGuideTitle(e.target.value)}
                  />
                </label>
                <label>
                  Slug
                  <input
                    required
                    value={guideSlug}
                    onChange={(e) => setGuideSlug(e.target.value)}
                  />
                </label>
                <label>
                  Resumo
                  <input
                    required
                    value={guideSummary}
                    onChange={(e) => setGuideSummary(e.target.value)}
                  />
                </label>
                <label>
                  Conteúdo
                  <textarea
                    required
                    minLength={20}
                    value={guideBody}
                    onChange={(e) => setGuideBody(e.target.value)}
                  />
                </label>
                <button className="button button-primary">
                  Guardar rascunho
                </button>
              </form>
            </div>
          )}
          {tab === "legal" && (
            <div className="admin-legal-grid">
              <section className="dash-panel">
                <h2>Fontes legais registadas</h2>
                {sources.map((s) => (
                  <article className="admin-row" key={s.id}>
                    <span>
                      <strong>{s.title}</strong>
                      <small>
                        {s.status}
                        {s.url ? ` · ${s.url}` : ""}
                        {s.reviewedAt
                          ? ` · revisto ${new Date(s.reviewedAt).toLocaleDateString("pt-AO")}`
                          : ""}
                      </small>
                    </span>
                    {s.url && (
                      <button onClick={() => void reviewSource(s)}>
                        {s.status === "CONFIRMED"
                          ? "Marcar desactualizada"
                          : "Confirmar fonte"}
                      </button>
                    )}
                  </article>
                ))}
                {!sources.length && (
                  <p className="empty-copy">
                    Nenhuma fonte registada; os requisitos mantêm-se por
                    confirmar.
                  </p>
                )}
                <form className="admin-form subform" onSubmit={addSource}>
                  <h3>Adicionar fonte oficial</h3>
                  <label>
                    Título
                    <input
                      required
                      value={sourceTitle}
                      onChange={(e) => setSourceTitle(e.target.value)}
                    />
                  </label>
                  <label>
                    URL oficial
                    <input
                      required
                      type="url"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                    />
                  </label>
                  <button className="button button-outline">
                    Registar como não confirmada
                  </button>
                </form>
              </section>
              <form className="dash-panel admin-form" onSubmit={addRequirement}>
                <h2>Nova versão de requisito</h2>
                <p>
                  Requisitos só ficam confirmados se a fonte estiver confirmada,
                  houver data de revisão e o âmbito do caso for registado.
                </p>
                <label>
                  Fonte
                  <select
                    required
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                  >
                    <option value="">Escolher fonte</option>
                    {sources.map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.title} · {s.status}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Título
                  <input
                    required
                    minLength={3}
                    value={reqTitle}
                    onChange={(e) => setReqTitle(e.target.value)}
                  />
                </label>
                <label>
                  Descrição
                  <textarea
                    required
                    minLength={10}
                    maxLength={3000}
                    value={reqBody}
                    onChange={(e) => setReqBody(e.target.value)}
                  />
                </label>
                <label>
                  Estado
                  <select
                    value={reqStatus}
                    onChange={(e) => setReqStatus(e.target.value)}
                  >
                    <option value="UNCONFIRMED">Por confirmar</option>
                    <option value="CONDITIONAL">Condicional</option>
                    <option value="CONFIRMED">Confirmado</option>
                  </select>
                </label>
                <h3>Âmbito opcional do requisito</h3>
                <label>
                  Nacionalidade da primeira pessoa
                  <input
                    value={natA}
                    onChange={(e) => setNatA(e.target.value)}
                    placeholder="Qualquer nacionalidade se vazio"
                  />
                </label>
                <label>
                  Nacionalidade da segunda pessoa
                  <input
                    value={natB}
                    onChange={(e) => setNatB(e.target.value)}
                    placeholder="Qualquer nacionalidade se vazio"
                  />
                </label>
                <label>
                  Província
                  <select
                    value={reqProvince}
                    onChange={(e) => setReqProvince(e.target.value)}
                  >
                    <option value="">Qualquer província</option>
                    {angolaProvinces.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Casamento anterior — pessoa A
                  <select
                    value={previousMarriageA}
                    onChange={(e) => setPreviousMarriageA(e.target.value)}
                  >
                    <option value="">Qualquer estado</option>
                    <option>Não</option>
                    <option>Sim</option>
                    <option>Por confirmar</option>
                  </select>
                </label>
                <label>
                  Casamento anterior — pessoa B
                  <select
                    value={previousMarriageB}
                    onChange={(e) => setPreviousMarriageB(e.target.value)}
                  >
                    <option value="">Qualquer estado</option>
                    <option>Não</option>
                    <option>Sim</option>
                    <option>Por confirmar</option>
                  </select>
                </label>
                <button className="button button-primary">
                  Guardar nova versão
                </button>
              </form>
              <section className="dash-panel">
                <h2>Conservatórias</h2>
                {offices.map((o) => (
                  <article className="admin-row" key={o.id}>
                    <span>
                      <strong>{o.name}</strong>
                      <small>
                        {o.municipality ? `${o.municipality} · ` : ""}
                        {o.province} · {o.status}
                        {o.sourceUrl ? ` · fonte registada` : ""}
                      </small>
                    </span>
                    {o.sourceUrl && o.status !== "CONFIRMED" && (
                      <button onClick={() => void reviewOffice(o)}>
                        Confirmar contacto
                      </button>
                    )}
                  </article>
                ))}
                {!offices.length && (
                  <p className="empty-copy">
                    Nenhum contacto registado. Não há dados publicados no
                    directório.
                  </p>
                )}
                <form className="admin-form subform" onSubmit={addOffice}>
                  <h3>Registar contacto para revisão</h3>
                  <label>
                    Nome
                    <input
                      required
                      value={officeName}
                      onChange={(e) => setOfficeName(e.target.value)}
                    />
                  </label>
                  <label>
                    Província
                    <input
                      required
                      value={officeProvince}
                      onChange={(e) => setOfficeProvince(e.target.value)}
                    />
                  </label>
                  <label>
                    Município
                    <input
                      value={officeMunicipality}
                      onChange={(e) => setOfficeMunicipality(e.target.value)}
                    />
                  </label>
                  <label>
                    URL da fonte oficial
                    <input
                      type="url"
                      value={officeUrl}
                      onChange={(e) => setOfficeUrl(e.target.value)}
                    />
                  </label>
                  <button className="button button-outline">
                    Guardar para revisão
                  </button>
                </form>
              </section>
            </div>
          )}
          {tab === "config" && (
            <form className="dash-panel admin-form admin-config-form" onSubmit={savePlatformConfig}>
              <p className="eyebrow">Catálogo público</p>
              <h2>Configurações do directório</h2>
              <p>As alterações actualizam as opções de pesquisa e os formulários públicos. Mantém os nomes consistentes com os perfis existentes.</p>
              <label>Categorias de fornecedores, uma por linha<textarea required value={configCategoriesText} onChange={e => setConfigCategoriesText(e.target.value)}/></label>
              <label>Províncias, uma por linha<textarea required value={configProvincesText} onChange={e => setConfigProvincesText(e.target.value)}/></label>
              <p className="empty-copy">Actualmente: {platformConfig.vendorCategories.length} categorias e {platformConfig.provinces.length} províncias.</p>
              <button disabled={savingAction} className="button button-primary">{savingAction ? "A guardar…" : "Guardar configurações"}</button>
            </form>
          )}
          {tab === "history" && (
            <section className="dash-panel admin-history-panel">
              <h2>Histórico administrativo</h2>
              <p className="empty-copy">Últimas 100 alterações em fornecedores, candidaturas e configurações.</p>
              {audit.length ? audit.map(entry => <article className="admin-row" key={entry.id}><span><strong>{auditSummary(entry)}</strong><small>{entry.actor.name || entry.actor.email} · {new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}</small><small>{entry.resource} · {entry.resourceId}</small></span></article>) : <p className="empty-copy">Ainda não há acções registadas.</p>}
            </section>
          )}
        </>
      )}
      {error && !loading && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {reasonDecision && <div className="admin-dialog-backdrop"><section className="admin-reason-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-reason-title"><button type="button" className="admin-dialog-close" aria-label="Fechar" onClick={() => setReasonDecision(null)}>×</button><p className="eyebrow">Registo de decisão</p><h2 id="admin-reason-title">{reasonDecision.status === "SUSPENDED" ? "Suspender fornecedor" : "Recusar candidatura"}</h2><p>Indica o motivo para <strong>{reasonDecision.label}</strong>. Esta informação fica no histórico da equipa.</p><label>Motivo<textarea autoFocus minLength={8} maxLength={500} required value={decisionReason} onChange={e => setDecisionReason(e.target.value)} placeholder="Resume os elementos que justificam a decisão…"/></label><small>{decisionReason.trim().length}/500 caracteres · mínimo 8</small><div><button type="button" className="button button-outline" disabled={savingAction} onClick={() => setReasonDecision(null)}>Cancelar</button><button type="button" className="button button-primary" disabled={savingAction || decisionReason.trim().length < 8} onClick={() => void saveDecisionReason()}>{savingAction ? "A guardar…" : "Confirmar decisão"}</button></div></section></div>}
    </main>
  );
}
