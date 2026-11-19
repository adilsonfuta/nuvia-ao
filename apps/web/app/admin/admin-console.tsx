"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "../lib/api";
import { ListPagination, PaginatedList, slicePage } from "../lib/list-pagination";
import { formatAOA } from "../lib/format";
import { VendorModerationWorkspace } from "./vendor-moderation-workspace";
import SupportStaffWorkspace from "../suporte/gestao/support-staff-workspace";
import AnalyticsPanel from "./analytics-panel";

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
type Venue = {
  id: string; slug: string; name: string; venueType: string; description: string | null;
  province: string | null; municipality: string | null; address: string | null; mapsUrl: string | null;
  capacityMin: number | null; capacityMax: number | null; priceFrom: string | null; priceTo: string | null;
  amenities: string[]; eventTypes: string[]; galleryUrls: string[]; phone: string | null; email: string | null;
  websiteUrl: string | null; bookingTerms: string | null; paymentTerms: string | null; cancellationTerms: string | null;
  status: "DRAFT" | "PENDING" | "PUBLISHED" | "SUSPENDED"; verifiedAt: string | null; createdAt: string; updatedAt: string; vendorId: string | null;
};
type Guide = {
  id: string;
  title: string;
  slug: string;
  status: string;
  summary: string;
  category: string;
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
type AdminAuditPage = { items: AdminAudit[]; total: number; page: number; pageSize: number; totalPages: number };
type PlatformConfig = { vendorCategories: string[]; provinces: string[] };
type AdminAccount = { id: string; name: string | null; email: string; role: "USER" | "SUPPORT" | "MODERATOR" | "ADMIN"; accountStatus: "ACTIVE" | "SUSPENDED"; createdAt: string; lastLoginAt: string | null; suspendedAt: string | null; suspensionReason: string | null; _count: { projects: number; supportRequests: number } };
type AdminAccountPage = { items: AdminAccount[]; total: number; page: number; pageSize: number; activeCount: number; suspendedCount: number };
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
  const [adminListPage, setAdminListPage] = useState(1);
  const [adminListPageSize, setAdminListPageSize] = useState(10);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [applications, setApplications] = useState<VendorApplication[]>([]);
  const [audit, setAudit] = useState<AdminAudit[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(20);
  const [accounts, setAccounts] = useState<AdminAccountPage>({ items: [], total: 0, page: 1, pageSize: 20, activeCount: 0, suspendedCount: 0 });
  const [currentRole, setCurrentRole] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [accountStatusFilter, setAccountStatusFilter] = useState("ALL");
  const [accountRoleFilter, setAccountRoleFilter] = useState("ALL");
  const [accountCreatedFrom, setAccountCreatedFrom] = useState("");
  const [accountCreatedTo, setAccountCreatedTo] = useState("");
  const [accountRoleDrafts, setAccountRoleDrafts] = useState<Record<string, "USER" | "SUPPORT">>({});
  const [accountDecision, setAccountDecision] = useState<{ account: AdminAccount; reason: string } | null>(null);
  const [adminPromotion, setAdminPromotion] = useState<{ account: AdminAccount; confirmEmail: string; currentPassword: string; reason: string } | null>(null);
  const [openSupportCount, setOpenSupportCount] = useState(0);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>({ vendorCategories: [], provinces: [] });
  const [error, setError] = useState("A verificar o acesso…");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [successNotice, setSuccessNotice] = useState("");
  const [tab, setTab] = useState<
    "vendors" | "venues" | "applications" | "vendorReview" | "guides" | "legal" | "config" | "history" | "accounts" | "support" | "analytics"
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
  const [venueStatusFilter, setVenueStatusFilter] = useState("ALL");
  const [venueSearch, setVenueSearch] = useState("");
  const [editingVenueId, setEditingVenueId] = useState("");
  const [showVenueForm, setShowVenueForm] = useState(false);
  const [venueName, setVenueName] = useState("");
  const [venueSlug, setVenueSlug] = useState("");
  const [venueType, setVenueType] = useState("Quinta");
  const [venueDescription, setVenueDescription] = useState("");
  const [venueProvince, setVenueProvince] = useState("");
  const [venueMunicipality, setVenueMunicipality] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueMapsUrl, setVenueMapsUrl] = useState("");
  const [venueCapacityMin, setVenueCapacityMin] = useState("");
  const [venueCapacityMax, setVenueCapacityMax] = useState("");
  const [venuePriceFrom, setVenuePriceFrom] = useState("");
  const [venuePriceTo, setVenuePriceTo] = useState("");
  const [venueAmenities, setVenueAmenities] = useState("");
  const [venueEventTypes, setVenueEventTypes] = useState("");
  const [venueGalleryUrls, setVenueGalleryUrls] = useState("");
  const [venuePhone, setVenuePhone] = useState("");
  const [venueEmail, setVenueEmail] = useState("");
  const [venueWebsite, setVenueWebsite] = useState("");
  const [venueBookingTerms, setVenueBookingTerms] = useState("");
  const [venuePaymentTerms, setVenuePaymentTerms] = useState("");
  const [venueCancellationTerms, setVenueCancellationTerms] = useState("");
  const [venueVendorId, setVenueVendorId] = useState("");
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
  const [guideCategory, setGuideCategory] = useState("Planeamento");
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
    const auth = await api<{ user: { role: string } }>("/auth/me");
    setCurrentRole(auth.user.role);
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (auth.user.role === "SUPPORT") {
      setTab("support");
      setError("");
      setErrorStatus(null);
      return;
    }
    if (requestedTab === "support") setTab("support");
    const accountParams = new URLSearchParams({ page: "1", pageSize: String(accounts.pageSize) });
    if (accountSearch.trim()) accountParams.set("q", accountSearch.trim());
    if (accountStatusFilter !== "ALL") accountParams.set("status", accountStatusFilter);
    if (accountRoleFilter !== "ALL") accountParams.set("role", accountRoleFilter);
    if (accountCreatedFrom) accountParams.set("createdFrom", accountCreatedFrom);
    if (accountCreatedTo) accountParams.set("createdTo", accountCreatedTo);
    const [v, vn, g, s, o, a, h, c, accountPageResult, openSupport] = await Promise.all([
      api<Vendor[]>("/admin/vendors"),
      api<Venue[]>("/admin/venues"),
      api<Guide[]>("/admin/guides"),
      api<Source[]>("/admin/legal/sources"),
      api<Office[]>("/admin/registry-offices"),
      api<VendorApplication[]>("/admin/vendor-applications"),
      api<AdminAuditPage>(`/admin/audit?page=1&pageSize=${auditPageSize}`),
      api<PlatformConfig>("/admin/config"),
      auth.user.role === "ADMIN"
        ? api<AdminAccountPage>(`/admin/accounts?${accountParams.toString()}`)
        : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 20, activeCount: 0, suspendedCount: 0 }),
      api<{ total: number }>("/support/requests?status=OPEN&page=1"),
    ]);
    setVendors(v);
    setVenues(vn);
    setGuides(g);
    setSources(s);
    setOffices(o);
    setApplications(a);
    setAudit(h.items); setAuditTotal(h.total); setAuditPage(h.page); setAuditPageSize(h.pageSize);
    setAccounts(accountPageResult);
    setOpenSupportCount(openSupport.total);
    setPlatformConfig({ vendorCategories: c.vendorCategories ?? [], provinces: c.provinces ?? [] });
    setConfigCategoriesText((c.vendorCategories ?? []).join("\n"));
    setConfigProvincesText((c.provinces ?? []).join("\n"));
    setError("");
    setErrorStatus(null);
    if (!sourceId && s[0]) setSourceId(s[0].id);
  }
  useEffect(() => {
    refresh()
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Não foi possível carregar a administração.");
        setErrorStatus(e instanceof ApiError ? e.status : null);
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (showVendorForm) requestAnimationFrame(() => document.querySelector(".vendor-admin-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [showVendorForm, editingVendorId]);
  useEffect(() => {
    if (showVenueForm) requestAnimationFrame(() => document.querySelector(".venue-admin-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [showVenueForm, editingVenueId]);
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    if (savingAction) return false;
    setError("");
    setSuccessNotice("");
    setSavingAction(true);
    try {
      await action();
      await refresh();
      setSuccessNotice("Alterações guardadas com sucesso.");
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
  async function loadAccounts(page = 1, filters = {
    search: accountSearch,
    status: accountStatusFilter,
    role: accountRoleFilter,
    createdFrom: accountCreatedFrom,
    createdTo: accountCreatedTo,
  }) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(accounts.pageSize) });
    if (filters.search.trim()) params.set("q", filters.search.trim());
    if (filters.status !== "ALL") params.set("status", filters.status);
    if (filters.role !== "ALL") params.set("role", filters.role);
    if (filters.createdFrom) params.set("createdFrom", filters.createdFrom);
    if (filters.createdTo) params.set("createdTo", filters.createdTo);
    setError("");
    try {
      setAccounts(await api<AdminAccountPage>(`/admin/accounts?${params.toString()}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível pesquisar as contas.");
    }
  }
  async function loadAudit(page: number, pageSize = auditPageSize) {
    try {
      const result = await api<AdminAuditPage>(`/admin/audit?page=${page}&pageSize=${pageSize}`);
      setAudit(result.items); setAuditTotal(result.total); setAuditPage(result.page); setAuditPageSize(result.pageSize);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar o histórico administrativo."); }
  }
  async function saveAccountStatus() {
    if (!accountDecision || accountDecision.reason.trim().length < 8) return;
    const { account, reason } = accountDecision;
    const succeeded = await run(() => api(`/admin/accounts/${account.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "SUSPENDED", reason: reason.trim() }),
    }));
    if (succeeded) setAccountDecision(null);
  }
  async function changeAccountStatus(account: AdminAccount) {
    if (account.accountStatus === "SUSPENDED") {
      await run(() => api(`/admin/accounts/${account.id}/status`, {
        method: "PATCH", body: JSON.stringify({ status: "ACTIVE" }),
      }));
      return;
    }
    setAccountDecision({ account, reason: "" });
  }
  async function changeAccountRole(account: AdminAccount) {
    const role = accountRoleDrafts[account.id] ?? account.role;
    if (role === account.role) return;
    await run(() => api(`/admin/accounts/${account.id}/role`, {
      method: "PATCH", body: JSON.stringify({ role }),
    }));
  }
  async function promoteAccountToAdmin() {
    if (!adminPromotion || adminPromotion.confirmEmail.trim().toLocaleLowerCase("pt-AO") !== adminPromotion.account.email.toLocaleLowerCase("pt-AO") || adminPromotion.reason.trim().length < 8 || !adminPromotion.currentPassword) return;
    const { account, confirmEmail, currentPassword, reason } = adminPromotion;
    const succeeded = await run(() => api(`/admin/accounts/${account.id}/promote-admin`, {
      method: "PATCH",
      body: JSON.stringify({ confirmEmail: confirmEmail.trim(), currentPassword, reason: reason.trim() }),
    }));
    if (succeeded) setAdminPromotion(null);
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
  function resetVenueForm() {
    setShowVenueForm(false); setEditingVenueId(""); setVenueName(""); setVenueSlug(""); setVenueType("Quinta");
    setVenueDescription(""); setVenueProvince(""); setVenueMunicipality(""); setVenueAddress(""); setVenueMapsUrl("");
    setVenueCapacityMin(""); setVenueCapacityMax(""); setVenuePriceFrom(""); setVenuePriceTo(""); setVenueAmenities("");
    setVenueEventTypes(""); setVenueGalleryUrls(""); setVenuePhone(""); setVenueEmail(""); setVenueWebsite("");
    setVenueBookingTerms(""); setVenuePaymentTerms(""); setVenueCancellationTerms(""); setVenueVendorId("");
  }
  function editVenue(venue: Venue) {
    setEditingVenueId(venue.id); setShowVenueForm(true); setVenueName(venue.name); setVenueSlug(venue.slug); setVenueType(venue.venueType);
    setVenueDescription(venue.description ?? ""); setVenueProvince(venue.province ?? ""); setVenueMunicipality(venue.municipality ?? "");
    setVenueAddress(venue.address ?? ""); setVenueMapsUrl(venue.mapsUrl ?? ""); setVenueCapacityMin(venue.capacityMin == null ? "" : String(venue.capacityMin));
    setVenueCapacityMax(venue.capacityMax == null ? "" : String(venue.capacityMax)); setVenuePriceFrom(venue.priceFrom ?? ""); setVenuePriceTo(venue.priceTo ?? "");
    setVenueAmenities(venue.amenities.join("\n")); setVenueEventTypes(venue.eventTypes.join("\n")); setVenueGalleryUrls(venue.galleryUrls.join("\n"));
    setVenuePhone(venue.phone ?? ""); setVenueEmail(venue.email ?? ""); setVenueWebsite(venue.websiteUrl ?? ""); setVenueBookingTerms(venue.bookingTerms ?? "");
    setVenuePaymentTerms(venue.paymentTerms ?? ""); setVenueCancellationTerms(venue.cancellationTerms ?? ""); setVenueVendorId(venue.vendorId ?? "");
  }
  async function saveVenue(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const payload = {
        name: venueName.trim(),
        slug: editingVenueId ? venueSlug.trim() : venueName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString().slice(-4),
        venueType, description: venueDescription || null, province: venueProvince || null, municipality: venueMunicipality || null,
        address: venueAddress || null, mapsUrl: venueMapsUrl || null, capacityMin: venueCapacityMin ? Number(venueCapacityMin) : null,
        capacityMax: venueCapacityMax ? Number(venueCapacityMax) : null, priceFrom: venuePriceFrom ? Number(venuePriceFrom) : null,
        priceTo: venuePriceTo ? Number(venuePriceTo) : null, amenities: splitLines(venueAmenities), eventTypes: splitLines(venueEventTypes),
        galleryUrls: splitLines(venueGalleryUrls), phone: venuePhone || null, email: venueEmail || null, websiteUrl: venueWebsite || null,
        bookingTerms: venueBookingTerms || null, paymentTerms: venuePaymentTerms || null, cancellationTerms: venueCancellationTerms || null,
        vendorId: venueVendorId || null,
      };
      await api(editingVenueId ? `/admin/venues/${editingVenueId}` : "/admin/venues", { method: editingVenueId ? "PATCH" : "POST", body: JSON.stringify(payload) });
      resetVenueForm();
    });
  }
  async function updateVenueStatus(venue: Venue, status: Venue["status"]) {
    let body: Record<string, unknown> = { status };
    if (status === "PUBLISHED") {
      if (!window.confirm("Confirmas que a localização, a capacidade, o contacto e a fotografia foram verificados com o responsável do espaço?")) return;
      body.verifiedAt = new Date().toISOString();
    }
    if (status === "SUSPENDED") {
      const reason = window.prompt("Indica o motivo para suspender este espaço:");
      if (!reason || reason.trim().length < 8) return;
      body.reason = reason.trim();
    }
    await run(() => api(`/admin/venues/${venue.id}`, { method: "PATCH", body: JSON.stringify(body) }));
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
          category: guideCategory,
          status: "DRAFT",
        }),
      });
      setGuideTitle("");
      setGuideSlug("");
      setGuideSummary("");
      setGuideCategory("Planeamento");
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
  const pendingVenues = venues.filter((venue) => venue.status === "DRAFT" || venue.status === "PENDING");
  const openApplications = applications.filter((application) => ["NEW", "CONTACTED"].includes(application.status));
  const visibleVendors = vendors.filter((vendor) => {
    const matchesStatus = vendorStatusFilter === "ALL" || vendor.status === vendorStatusFilter;
    const query = vendorSearch.trim().toLocaleLowerCase("pt-AO");
    const matchesSearch = !query || [vendor.name, vendor.category, vendor.slug, vendor.province, vendor.municipality, vendor.email, vendor.phone].some((value) => value?.toLocaleLowerCase("pt-AO").includes(query));
    return matchesStatus && matchesSearch && (!vendorCategoryFilter || vendor.category === vendorCategoryFilter) && (!vendorProvinceFilter || vendor.province === vendorProvinceFilter);
  });
  const visibleApplications = applications.filter((application) => applicationFilter === "ALL" || (applicationFilter === "OPEN" ? ["NEW", "CONTACTED"].includes(application.status) : application.status === applicationFilter));
  const visibleVenues = venues.filter((venue) => {
    const query = venueSearch.trim().toLocaleLowerCase("pt-AO");
    const matchesSearch = !query || [venue.name, venue.venueType, venue.province, venue.municipality, venue.address].some((value) => value?.toLocaleLowerCase("pt-AO").includes(query));
    return matchesSearch && (venueStatusFilter === "ALL" || (venueStatusFilter === "PENDING" ? ["DRAFT", "PENDING"].includes(venue.status) : venue.status === venueStatusFilter));
  });
  const pagedVendors = slicePage(visibleVendors, adminListPage, adminListPageSize);
  const pagedVenues = slicePage(visibleVenues, adminListPage, adminListPageSize);
  const pagedApplications = slicePage(visibleApplications, adminListPage, adminListPageSize);
  const hasAccountFilters = Boolean(accountSearch.trim() || accountStatusFilter !== "ALL" || accountRoleFilter !== "ALL" || accountCreatedFrom || accountCreatedTo);
  function auditSummary(entry: AdminAudit) {
    const metadata = entry.metadata ?? {};
    if (entry.action === "VENDOR_STATUS_CHANGED" || entry.action === "VENDOR_REVIEWED") return `Estado: ${String(metadata.from ?? "—")} → ${String(metadata.to ?? "—")}${metadata.reason ? ` · Motivo: ${String(metadata.reason)}` : ""}`;
    if (entry.action === "VENDOR_PROFILE_UPDATED") return `Perfil actualizado · Campos: ${Array.isArray(metadata.changedFields) ? metadata.changedFields.map(String).join(", ") : "detalhes revistos"}`;
    if (entry.action === "VENDOR_APPLICATION_REVIEWED") return `Candidatura: ${String(metadata.from ?? "—")} → ${String(metadata.to ?? "—")}${metadata.reason ? ` · Motivo: ${String(metadata.reason)}` : ""}`;
    if (entry.action === "VENDOR_APPLICATION_CONVERTED") return `Candidatura convertida no perfil ${String(metadata.vendorId ?? "")}`;
    if (entry.action === "PLATFORM_CATALOG_CONFIG_UPDATED") return "Categorias e províncias do directório actualizadas.";
    if (entry.action === "VENDOR_CREATED") return "Perfil criado como pendente de revisão.";
    if (entry.action === "VENUE_CREATED") return "Espaço registado como rascunho.";
    if (entry.action === "VENUE_STATUS_CHANGED") return `Estado do espaço: ${String(metadata.from ?? "—")} → ${String(metadata.to ?? "—")}${metadata.reason ? ` · Motivo: ${String(metadata.reason)}` : ""}`;
    if (entry.action === "VENUE_PROFILE_UPDATED") return `Perfil do espaço actualizado · Campos: ${Array.isArray(metadata.changedFields) ? metadata.changedFields.map(String).join(", ") : "detalhes revistos"}`;
    if (entry.action === "ACCOUNT_SUSPENDED") return `Conta suspensa · Motivo: ${String(metadata.reason ?? "—")}`;
    if (entry.action === "ACCOUNT_REACTIVATED") return "Conta reactivada.";
    if (entry.action === "ACCOUNT_ROLE_CHANGED") return `Papel da conta: ${String(metadata.from ?? "—")} → ${String(metadata.to ?? "—")}`;
    if (entry.action === "ACCOUNT_ADMIN_PROMOTED") return `Conta promovida a administradora · Motivo: ${String(metadata.reason ?? "—")}`;
    if (entry.action === "SUPPORT_REQUEST_CREATED") return "Pedido de suporte recebido.";
    if (entry.action === "SUPPORT_REQUEST_ANSWERED") return "Resposta de suporte registada.";
    if (entry.action === "SUPPORT_REQUEST_STATUS_CHANGED") return `Estado do pedido: ${String(metadata.from ?? "—")} → ${String(metadata.to ?? "—")}`;
    return entry.action.replaceAll("_", " ").toLocaleLowerCase("pt-AO");
  }
  const adminTabs = [
    ["vendors", "Fornecedores"],
    ["venues", `Espaços${pendingVenues.length ? ` (${pendingVenues.length})` : ""}`],
    ["applications", `Candidaturas${openApplications.length ? ` (${openApplications.length})` : ""}`],
    ["vendorReview", "Confiança e revisão"],
    ["guides", "Guias"],
    ["legal", "Fontes e requisitos"],
    ["config", "Configurações"],
    ...(currentRole === "ADMIN" ? [["accounts", "Contas"]] as const : []),
    ...(currentRole === "ADMIN" ? [["analytics", "Métricas"]] as const : []),
    ["support", `Pedidos de suporte${openSupportCount ? ` (${openSupportCount})` : ""}`],
    ["history", "Histórico"],
  ] as const;
  return (
    <main className="admin-page">
      <Link className="planner-back" href="/dashboard">
        ← Voltar à dashboard
      </Link>
      <div className="admin-head">
        <div>
          <p className="eyebrow">Backoffice</p>
          <h1>{currentRole === "SUPPORT" ? "Pedidos de suporte" : "Administração"}</h1>
          <p>{currentRole === "SUPPORT" ? "Consulta e responde aos pedidos de ajuda dos utilizadores." : "Fornecedores, espaços, conteúdos e operações da plataforma."}</p>
        </div>
      </div>
      {successNotice && <div className="admin-success-notice" role="status"><span aria-hidden="true">✓</span><p>{successNotice}</p><button type="button" aria-label="Fechar confirmação" onClick={() => setSuccessNotice("")}>×</button></div>}
      {loading ? (
        <p>{error}</p>
      ) : error ? (
        <section className="catalog-empty">
          <h2>{errorStatus === 401 || errorStatus === 403 ? "Acesso não disponível" : "Não foi possível carregar o backoffice"}</h2>
          <p>{error}</p>
          {errorStatus === 401 ? (
            <a className="button button-primary" href="/entrar?next=%2Fadmin">Entrar</a>
          ) : errorStatus === 403 ? (
            <p>Esta conta não tem permissões de administração ou moderação.</p>
          ) : (
            <>
              <p>O serviço de administração encontrou um erro. Confirma se a API está activa e se as migrações da base de dados foram aplicadas.</p>
              <button className="button button-primary" type="button" onClick={() => { setLoading(true); refresh().catch((e) => { setError(e instanceof Error ? e.message : "Não foi possível carregar a administração."); setErrorStatus(e instanceof ApiError ? e.status : null); }).finally(() => setLoading(false)); }}>Tentar novamente</button>
            </>
          )}
        </section>
      ) : (
        <>
          {currentRole !== "SUPPORT" && <section className="admin-summary-grid" aria-label="Resumo da operação">
            <button className={tab === "vendors" && vendorStatusFilter === "PENDING" ? "selected" : ""} onClick={() => { setTab("vendors"); setVendorStatusFilter("PENDING"); }}><small>Fornecedores por rever</small><strong>{pendingVendors.length}</strong><span>Perfis que aguardam decisão</span></button>
            <button className={tab === "applications" ? "selected" : ""} onClick={() => setTab("applications")}><small>Candidaturas abertas</small><strong>{openApplications.length}</strong><span>Novas ou contactadas</span></button>
            <button className={tab === "support" ? "selected" : ""} onClick={() => setTab("support")}><small>Pedidos de suporte</small><strong>{openSupportCount}</strong><span>Aguardam resposta da equipa</span></button>
            <button className={tab === "venues" && venueStatusFilter === "PENDING" ? "selected" : ""} onClick={() => { setTab("venues"); setVenueStatusFilter("PENDING"); }}><small>Espaços por rever</small><strong>{pendingVenues.length}</strong><span>Rascunhos ou pendentes de validação</span></button>
          </section>}
          {currentRole !== "SUPPORT" && <nav className="admin-tabs">
            <div className="admin-tabs-links">
              {adminTabs.map(([key, label]) => (
              <button
                className={tab === key ? "current" : ""}
                onClick={() => setTab(key)}
                key={key}
              >
                {label}
              </button>
              ))}
            </div>
            <label className="admin-tabs-mobile"><span>Secção</span><select aria-label="Secção da administração" value={tab} onChange={(event) => setTab(event.target.value as typeof tab)}>{adminTabs.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          </nav>}
          {tab === "venues" && (
            <>
              <header className="admin-workbar"><div><p className="eyebrow">Catálogo público</p><h2>Gestão de espaços</h2><p>Publica apenas informação confirmada com o responsável. A Nuvia não apresenta disponibilidade ou preços como garantidos.</p></div><button className="button button-primary" onClick={() => { resetVenueForm(); setShowVenueForm(true); }}>+ Registar espaço</button></header>
              <div className={`admin-grid ${showVenueForm ? "with-form" : "list-only"}`}>
                <section className="dash-panel">
                  <div className="admin-filter-bar"><label className="admin-search">Pesquisar<input value={venueSearch} onChange={event => setVenueSearch(event.target.value)} placeholder="Nome, tipo ou localização" /></label><label>Estado<select value={venueStatusFilter} onChange={event => setVenueStatusFilter(event.target.value)}><option value="ALL">Todos</option><option value="PENDING">Por preparar/rever</option><option value="PUBLISHED">Publicados</option><option value="SUSPENDED">Suspensos</option></select></label><button type="button" className="button button-outline compact" onClick={() => { setVenueSearch(""); setVenueStatusFilter("ALL"); }}>Limpar</button></div>
                  {visibleVenues.length ? pagedVenues.map(venue => <article className="admin-row venue-admin-row" key={venue.id}>
                    <span><strong>{venue.name}</strong><small>{venue.venueType} · {[venue.municipality, venue.province].filter(Boolean).join(", ") || "Localização por preencher"}</small><small>{venue.capacityMax ? `${venue.capacityMin ?? 1}–${venue.capacityMax} pessoas` : "Capacidade por confirmar"} · {venue.priceFrom || venue.priceTo ? `${formatAOA(venue.priceFrom)} – ${formatAOA(venue.priceTo)}` : "Preço sob consulta"}</small><small>Estado: {venue.status === "DRAFT" ? "Rascunho" : venue.status === "PENDING" ? "Por rever" : venue.status === "PUBLISHED" ? "Publicado" : "Suspenso"}{venue.verifiedAt ? ` · Dados revistos em ${new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeZone: "Africa/Luanda" }).format(new Date(venue.verifiedAt))}` : ""}</small><small>{venue.phone || venue.email || venue.websiteUrl || "Contacto por preencher"}{venue.galleryUrls.length ? ` · ${venue.galleryUrls.length} fotografia(s)` : " · Sem fotografias"}</small></span>
                    <div>{venue.status === "PUBLISHED" && <a href={`/espacos/${venue.slug}`} target="_blank" rel="noreferrer">Pré-visualizar</a>}<button type="button" disabled={savingAction} onClick={() => editVenue(venue)}>Editar</button>{venue.status === "PUBLISHED" ? <button type="button" disabled={savingAction} onClick={() => void updateVenueStatus(venue, "SUSPENDED")}>Suspender</button> : venue.status === "SUSPENDED" ? <button type="button" disabled={savingAction} onClick={() => void updateVenueStatus(venue, "PENDING")}>Voltar para revisão</button> : <button type="button" disabled={savingAction} onClick={() => void updateVenueStatus(venue, "PUBLISHED")}>Confirmar e publicar</button>}</div>
                  </article>) : <p className="empty-copy">{venueSearch || venueStatusFilter !== "ALL" ? "Não encontrámos espaços com estes filtros." : "Ainda não há espaços registados. Adiciona os primeiros espaços reais para preparar o catálogo."}</p>}
                  <ListPagination page={adminListPage} pageSize={adminListPageSize} total={visibleVenues.length} label="espaços" onPageChange={setAdminListPage} onPageSizeChange={(size) => { setAdminListPageSize(size); setAdminListPage(1); }} />
                </section>
                {showVenueForm && <form className="dash-panel admin-form venue-admin-form" onSubmit={saveVenue}>
                  <h2>{editingVenueId ? "Editar espaço" : "Registar espaço"}</h2>
                  <p>O espaço começa como rascunho. Para publicar, confirma localização, lotação, contacto e pelo menos uma fotografia com o responsável.</p>
                  <label>Nome do espaço<input required minLength={2} maxLength={120} value={venueName} onChange={event => setVenueName(event.target.value)} placeholder="Ex.: Quinta das Acácias" /></label>
                  {editingVenueId && <label>Endereço do perfil<input required value={venueSlug} onChange={event => setVenueSlug(event.target.value)} /></label>}
                  <label>Tipo de espaço<select value={venueType} onChange={event => setVenueType(event.target.value)}><option>Quinta</option><option>Salão de festas</option><option>Hotel</option><option>Restaurante</option><option>Praia ou espaço ao ar livre</option><option>Outro</option></select></label>
                  <label>Descrição<textarea maxLength={2500} value={venueDescription} onChange={event => setVenueDescription(event.target.value)} /></label>
                  <div className="admin-form-pair"><label>Província<input value={venueProvince} onChange={event => setVenueProvince(event.target.value)} /></label><label>Município<input value={venueMunicipality} onChange={event => setVenueMunicipality(event.target.value)} /></label></div>
                  <label>Endereço<input maxLength={300} value={venueAddress} onChange={event => setVenueAddress(event.target.value)} placeholder="Bairro, rua ou referência" /></label>
                  <label>Link de localização (HTTPS)<input type="url" value={venueMapsUrl} onChange={event => setVenueMapsUrl(event.target.value)} placeholder="https://maps.google.com/…" /></label>
                  <div className="admin-form-pair"><label>Capacidade mínima<input type="number" min="0" value={venueCapacityMin} onChange={event => setVenueCapacityMin(event.target.value)} /></label><label>Capacidade máxima<input type="number" min="1" value={venueCapacityMax} onChange={event => setVenueCapacityMax(event.target.value)} /></label></div>
                  <div className="admin-form-pair"><label>Preço desde (Kz, opcional)<input type="number" min="0" step="any" value={venuePriceFrom} onChange={event => setVenuePriceFrom(event.target.value)} /></label><label>Preço até (Kz, opcional)<input type="number" min="0" step="any" value={venuePriceTo} onChange={event => setVenuePriceTo(event.target.value)} /></label></div>
                  <label>Características, uma por linha<textarea value={venueAmenities} onChange={event => setVenueAmenities(event.target.value)} placeholder={"Estacionamento\nJardim\nCozinha de apoio"} /></label>
                  <label>Tipos de evento, um por linha<textarea value={venueEventTypes} onChange={event => setVenueEventTypes(event.target.value)} placeholder={"Casamento\nAlambamento\nFesta"} /></label>
                  <label>Fotografias (URLs HTTPS, uma por linha)<textarea value={venueGalleryUrls} onChange={event => setVenueGalleryUrls(event.target.value)} placeholder="https://…" /><small>Usa imagens autorizadas pelo responsável do espaço. Não acrescentes disponibilidade ou preços por suposição.</small></label>
                  <div className="admin-form-pair"><label>Telefone<input value={venuePhone} onChange={event => setVenuePhone(event.target.value)} /></label><label>Email<input type="email" value={venueEmail} onChange={event => setVenueEmail(event.target.value)} /></label></div>
                  <label>Website (HTTPS)<input type="url" value={venueWebsite} onChange={event => setVenueWebsite(event.target.value)} /></label>
                  <label>Condições de reserva<textarea maxLength={1000} value={venueBookingTerms} onChange={event => setVenueBookingTerms(event.target.value)} /></label>
                  <label>Condições de pagamento<textarea maxLength={1000} value={venuePaymentTerms} onChange={event => setVenuePaymentTerms(event.target.value)} /></label>
                  <label>Política de cancelamento<textarea maxLength={1000} value={venueCancellationTerms} onChange={event => setVenueCancellationTerms(event.target.value)} /></label>
                  <label>Prestador associado (opcional)<select value={venueVendorId} onChange={event => setVenueVendorId(event.target.value)}><option value="">Sem associação</option>{vendors.filter(vendor => vendor.status === "ACTIVE").map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
                  <div className="admin-form-actions"><button className="button button-primary" disabled={savingAction}>{savingAction ? "A guardar…" : editingVenueId ? "Guardar alterações" : "Guardar rascunho"}</button><button type="button" className="button button-outline" onClick={resetVenueForm}>Cancelar</button></div>
                </form>}
              </div>
            </>
          )}
          {tab === "vendors" && (
            <>
            <header className="admin-workbar"><div><p className="eyebrow">Operação</p><h2>Fila de fornecedores</h2><p>Revê primeiro os perfis pendentes e acompanha os restantes pelo estado.</p></div><button className="button button-primary" onClick={() => { resetVendorForm(); setShowVendorForm(true); }}>+ Registar fornecedor</button></header>
            <div className={`admin-grid ${showVendorForm ? "with-form" : "list-only"}`}>
              <section className="dash-panel">
                <div className="admin-filter-bar"><label className="admin-search">Pesquisar<input value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} placeholder="Nome, categoria, local ou contacto"/></label><label>Estado<select value={vendorStatusFilter} onChange={e => setVendorStatusFilter(e.target.value)}><option value="PENDING">Por rever</option><option value="ALL">Todos</option><option value="ACTIVE">Activos</option><option value="SUSPENDED">Suspensos</option><option value="DRAFT">Rascunhos</option></select></label><label>Categoria<select value={vendorCategoryFilter} onChange={e => setVendorCategoryFilter(e.target.value)}><option value="">Todas</option>{platformConfig.vendorCategories.map(item => <option key={item}>{item}</option>)}</select></label><label>Província<select value={vendorProvinceFilter} onChange={e => setVendorProvinceFilter(e.target.value)}><option value="">Todas</option>{platformConfig.provinces.map(item => <option key={item}>{item}</option>)}</select></label><button type="button" className="button button-outline compact" onClick={() => { setVendorSearch(""); setVendorCategoryFilter(""); setVendorProvinceFilter(""); }}>Limpar</button></div>
                {visibleVendors.length ? (
                  pagedVendors.map((v) => (
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
                <ListPagination page={adminListPage} pageSize={adminListPageSize} total={visibleVendors.length} label="fornecedores" onPageChange={setAdminListPage} onPageSizeChange={(size) => { setAdminListPageSize(size); setAdminListPage(1); }} />
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
                pagedApplications.map((application) => (
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
              <ListPagination page={adminListPage} pageSize={adminListPageSize} total={visibleApplications.length} label="candidaturas" onPageChange={setAdminListPage} onPageSizeChange={(size) => { setAdminListPageSize(size); setAdminListPage(1); }} />
            </section>
          )}
          {tab === "guides" && (
            <div className="admin-grid">
              <section className="dash-panel">
                <h2>Guias</h2>
                <PaginatedList items={guides} label="guias">{(g) => (
                  <article className="admin-row" key={g.id}>
                    <span>
                      <strong>{g.title}</strong>
                    <small>{g.category} · {g.status}</small>
                    </span>
                    <button onClick={() => void publishGuide(g)}>
                      {g.status === "PUBLISHED" ? "Retirar" : "Publicar"}
                    </button>
                  </article>
                )}</PaginatedList>
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
                  Categoria
                  <input
                    required
                    value={guideCategory}
                    onChange={(e) => setGuideCategory(e.target.value)}
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
                <PaginatedList items={sources} label="fontes">{(s) => (
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
                )}</PaginatedList>
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
                <PaginatedList items={offices} label="conservatórias">{(o) => (
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
                )}</PaginatedList>
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
          {tab === "accounts" && currentRole === "ADMIN" && (
            <section className="admin-accounts-workspace">
              <header className="admin-workbar"><div><p className="eyebrow">Apoio e segurança</p><h2>Contas da plataforma</h2><p>Consulta o mínimo necessário para apoiar utilizadores. A Nuvia não permite entrar na conta de outra pessoa.</p></div></header>
              <div className="admin-account-stats" aria-label="Resumo das contas"><article><small>Activas · toda a plataforma</small><strong>{accounts.activeCount}</strong></article><article><small>Suspensas · toda a plataforma</small><strong>{accounts.suspendedCount}</strong></article><article><small>Resultados com filtros</small><strong>{accounts.total}</strong></article></div>
              <form className="admin-account-filters" onSubmit={(event) => { event.preventDefault(); void loadAccounts(1); }}>
                <label>Pesquisar por nome ou email<input value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} placeholder="Nome ou email" /></label>
                <label>Estado<select value={accountStatusFilter} onChange={(event) => setAccountStatusFilter(event.target.value)}><option value="ALL">Todas as contas</option><option value="ACTIVE">Activas</option><option value="SUSPENDED">Suspensas</option></select></label>
                <label>Papel<select value={accountRoleFilter} onChange={(event) => setAccountRoleFilter(event.target.value)}><option value="ALL">Todos os papéis</option><option value="USER">Utilizador</option><option value="SUPPORT">Suporte</option><option value="MODERATOR">Moderador</option><option value="ADMIN">Administrador</option></select></label>
                <label>Criada desde<input type="date" value={accountCreatedFrom} onChange={(event) => setAccountCreatedFrom(event.target.value)} /></label>
                <label>Criada até<input type="date" min={accountCreatedFrom || undefined} value={accountCreatedTo} onChange={(event) => setAccountCreatedTo(event.target.value)} /></label>
                <div className="admin-account-filter-actions"><button className="button button-primary">Pesquisar</button><button className="button button-outline" type="button" disabled={!hasAccountFilters} onClick={() => { setAccountSearch(""); setAccountStatusFilter("ALL"); setAccountRoleFilter("ALL"); setAccountCreatedFrom(""); setAccountCreatedTo(""); void loadAccounts(1, { search: "", status: "ALL", role: "ALL", createdFrom: "", createdTo: "" }); }}>Limpar</button></div>
              </form>
              <section className="dash-panel admin-account-list" aria-label="Contas encontradas">
                {accounts.items.length ? accounts.items.map((account) => <article className="admin-account-row" key={account.id}>
                  <div className="admin-account-identity"><strong>{account.name || "Nome por preencher"}</strong><span>{account.email}</span><small>Criada em {new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeZone: "Africa/Luanda" }).format(new Date(account.createdAt))} · {account._count.projects} evento(s) · Último início de sessão: {account.lastLoginAt ? new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeZone: "Africa/Luanda" }).format(new Date(account.lastLoginAt)) : "Ainda não iniciou sessão"}</small>{account._count.supportRequests > 0 && <button type="button" className="admin-account-ticket-link" onClick={() => setTab("support")}>{account._count.supportRequests} pedido(s) de suporte por resolver</button>}{account.suspensionReason && <small>Motivo da suspensão: {account.suspensionReason}</small>}</div>
                  <div className="admin-account-controls"><span className={`admin-account-status ${account.accountStatus.toLowerCase()}`}>{account.accountStatus === "ACTIVE" ? "Activa" : "Suspensa"}</span><small>Papel: {account.role === "SUPPORT" ? "Suporte" : account.role === "USER" ? "Utilizador" : account.role === "ADMIN" ? "Admin" : "Moderador"}</small>
                    {(account.role === "USER" || account.role === "SUPPORT") && <div className="admin-account-role"><select aria-label={`Papel de ${account.email}`} value={accountRoleDrafts[account.id] ?? account.role} onChange={(event) => setAccountRoleDrafts((drafts) => ({ ...drafts, [account.id]: event.target.value as "USER" | "SUPPORT" }))} disabled={account.accountStatus === "SUSPENDED"}><option value="USER">Utilizador</option><option value="SUPPORT">Suporte</option></select><button type="button" className="button button-outline compact" disabled={savingAction || account.accountStatus === "SUSPENDED" || (accountRoleDrafts[account.id] ?? account.role) === account.role} onClick={() => void changeAccountRole(account)}>Guardar papel</button></div>}
                    {(account.role === "USER" || account.role === "SUPPORT") && account.accountStatus === "ACTIVE" && <button type="button" className="button button-outline compact" disabled={savingAction} onClick={() => setAdminPromotion({ account, confirmEmail: "", currentPassword: "", reason: "" })}>Promover a administrador</button>}
                    {(account.role === "USER" || account.role === "SUPPORT") && <button type="button" className={account.accountStatus === "ACTIVE" ? "button button-outline compact danger" : "button button-outline compact"} disabled={savingAction} onClick={() => void changeAccountStatus(account)}>{account.accountStatus === "ACTIVE" ? "Suspender conta" : "Reactivar conta"}</button>}
                  </div>
                </article>) : <div className="admin-account-empty"><strong>{hasAccountFilters ? "Nenhuma conta corresponde aos filtros" : "Ainda não há contas para apresentar"}</strong><p>{hasAccountFilters ? "Altera os critérios ou limpa os filtros para ver outras contas." : "As contas criadas na plataforma aparecerão aqui."}</p>{hasAccountFilters && <button className="button button-outline compact" type="button" onClick={() => { setAccountSearch(""); setAccountStatusFilter("ALL"); setAccountRoleFilter("ALL"); setAccountCreatedFrom(""); setAccountCreatedTo(""); void loadAccounts(1, { search: "", status: "ALL", role: "ALL", createdFrom: "", createdTo: "" }); }}>Limpar filtros</button>}</div>}
                <ListPagination page={accounts.page} pageSize={accounts.pageSize} total={accounts.total} label="contas" onPageChange={(next) => void loadAccounts(next)} onPageSizeChange={(size) => { setAccounts((current) => ({ ...current, pageSize: size })); void (async () => { const params = new URLSearchParams({ page: "1", pageSize: String(size) }); if (accountSearch.trim()) params.set("q", accountSearch.trim()); if (accountStatusFilter !== "ALL") params.set("status", accountStatusFilter); if (accountRoleFilter !== "ALL") params.set("role", accountRoleFilter); if (accountCreatedFrom) params.set("createdFrom", accountCreatedFrom); if (accountCreatedTo) params.set("createdTo", accountCreatedTo); try { setAccounts(await api<AdminAccountPage>(`/admin/accounts?${params}`)); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível pesquisar as contas."); } })(); }} />
              </section>
              <p className="admin-account-footnote">Suspensões, reativações, alterações de papel e promoções administrativas ficam no histórico. A promoção exige a tua palavra-passe actual e confirmação do email da conta.</p>
            </section>
          )}
          {tab === "support" && <SupportStaffWorkspace />}
          {tab === "analytics" && currentRole === "ADMIN" && <AnalyticsPanel />}
          {tab === "history" && (
            <section className="dash-panel admin-history-panel">
              <h2>Histórico administrativo</h2>
              <p className="empty-copy">{auditTotal} alterações em contas, suporte, fornecedores, espaços e configurações.</p>
              {audit.length ? <>{audit.map(entry => <article className="admin-row" key={entry.id}><span><strong>{auditSummary(entry)}</strong><small>{entry.actor.name || entry.actor.email} · {new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}</small><small>{entry.resource} · {entry.resourceId}</small></span></article>)}<ListPagination page={auditPage} pageSize={auditPageSize} total={auditTotal} label="alterações" onPageChange={(next) => void loadAudit(next)} onPageSizeChange={(size) => void loadAudit(1, size)} /></> : <p className="empty-copy">Ainda não há acções registadas.</p>}
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
      {accountDecision && <div className="admin-dialog-backdrop"><section className="admin-reason-dialog" role="dialog" aria-modal="true" aria-labelledby="account-suspension-title"><button type="button" className="admin-dialog-close" aria-label="Fechar" onClick={() => setAccountDecision(null)}>×</button><p className="eyebrow">Registo de decisão</p><h2 id="account-suspension-title">Suspender conta</h2><p>Indica o motivo para <strong>{accountDecision.account.email}</strong>. As sessões activas serão terminadas e a pessoa terá de contactar o suporte.</p><label>Motivo<textarea autoFocus minLength={8} maxLength={500} required value={accountDecision.reason} onChange={(event) => setAccountDecision({ ...accountDecision, reason: event.target.value })} placeholder="Resume o motivo da suspensão…" /></label><small>{accountDecision.reason.trim().length}/500 caracteres · mínimo 8</small><div><button type="button" className="button button-outline" disabled={savingAction} onClick={() => setAccountDecision(null)}>Cancelar</button><button type="button" className="button button-primary" disabled={savingAction || accountDecision.reason.trim().length < 8} onClick={() => void saveAccountStatus()}>{savingAction ? "A guardar…" : "Suspender conta"}</button></div></section></div>}
      {adminPromotion && <div className="admin-dialog-backdrop"><section className="admin-reason-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-promotion-title"><button type="button" className="admin-dialog-close" aria-label="Fechar" onClick={() => setAdminPromotion(null)}>×</button><p className="eyebrow">Permissões administrativas</p><h2 id="admin-promotion-title">Promover a administrador</h2><p><strong>{adminPromotion.account.name || adminPromotion.account.email}</strong> passará a ter acesso completo ao backoffice, incluindo gestão de contas e configurações da plataforma.</p><label>Confirma o email da conta<input autoFocus type="email" autoComplete="off" required value={adminPromotion.confirmEmail} onChange={(event) => setAdminPromotion({ ...adminPromotion, confirmEmail: event.target.value })} placeholder={adminPromotion.account.email} /></label><label>A tua palavra-passe de administrador<input type="password" autoComplete="current-password" required value={adminPromotion.currentPassword} onChange={(event) => setAdminPromotion({ ...adminPromotion, currentPassword: event.target.value })} /></label><label>Motivo da promoção<textarea minLength={8} maxLength={500} required value={adminPromotion.reason} onChange={(event) => setAdminPromotion({ ...adminPromotion, reason: event.target.value })} placeholder="Indica por que motivo esta conta precisa de acesso administrativo…" /></label><small>{adminPromotion.reason.trim().length}/500 caracteres · mínimo 8</small><div><button type="button" className="button button-outline" disabled={savingAction} onClick={() => setAdminPromotion(null)}>Cancelar</button><button type="button" className="button button-primary" disabled={savingAction || adminPromotion.confirmEmail.trim().toLocaleLowerCase("pt-AO") !== adminPromotion.account.email.toLocaleLowerCase("pt-AO") || !adminPromotion.currentPassword || adminPromotion.reason.trim().length < 8} onClick={() => void promoteAccountToAdmin()}>{savingAction ? "A promover…" : "Confirmar promoção"}</button></div></section></div>}
    </main>
  );
}
