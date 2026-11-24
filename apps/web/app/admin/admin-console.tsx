"use client";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "../lib/api";
import { ListPagination, PaginatedList, slicePage } from "../lib/list-pagination";
import { formatAOA } from "../lib/format";
import { VendorModerationWorkspace } from "./vendor-moderation-workspace";
import SupportStaffWorkspace from "../suporte/gestao/support-staff-workspace";
import AnalyticsPanel from "./analytics-panel";
import { GUIDE_COVERS } from "../guias/guide-data";
import { GuidePreview } from "./guide-preview";
import { BulkCatalogImport, BulkImportEntry, BulkKind } from "./bulk-catalog-import";
import { extractMapCoordinates, openStreetMapEmbedUrl, openStreetMapUrl } from "../lib/venue-map";

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
  province: string | null; municipality: string | null; address: string | null; mapsUrl: string | null; latitude: number | null; longitude: number | null;
  capacityMin: number | null; capacityMax: number | null; priceFrom: string | null; priceTo: string | null;
  amenities: string[]; eventTypes: string[]; galleryUrls: string[]; phone: string | null; email: string | null;
  websiteUrl: string | null; bookingTerms: string | null; paymentTerms: string | null; cancellationTerms: string | null;
  status: "DRAFT" | "PENDING" | "PUBLISHED" | "SUSPENDED"; isDemo: boolean; verifiedAt: string | null; createdAt: string; updatedAt: string; vendorId: string | null;
};
type Guide = {
  id: string;
  title: string;
  slug: string;
  status: string;
  summary: string;
  category: string;
  body: string;
  readingMinutes: number;
  sortOrder: number;
  coverImage: string | null;
  reviewedAt: string | null;
  createdAt: string;
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
const guideCoverOptions = Object.entries(GUIDE_COVERS).map(([slug, cover]) => ({ slug, ...cover }));

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
  const [showVendorBulkImport, setShowVendorBulkImport] = useState(false);
  const [reasonDecision, setReasonDecision] = useState<{ type: "vendor" | "application"; id: string; label: string; status: "SUSPENDED" | "DECLINED" } | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [savingAction, setSavingAction] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState("");
  const [venueStatusFilter, setVenueStatusFilter] = useState("ALL");
  const [venueSearch, setVenueSearch] = useState("");
  const [venueListProvinceFilter, setVenueListProvinceFilter] = useState("");
  const [venueListTypeFilter, setVenueListTypeFilter] = useState("");
  const [venueListDemoFilter, setVenueListDemoFilter] = useState("ALL");
  const [venueIsDemo, setVenueIsDemo] = useState(false);
  const [editingVenueId, setEditingVenueId] = useState("");
  const [showVenueForm, setShowVenueForm] = useState(false);
  const [showVenueBulkImport, setShowVenueBulkImport] = useState(false);
  const [venueName, setVenueName] = useState("");
  const [venueSlug, setVenueSlug] = useState("");
  const [venueType, setVenueType] = useState("Quinta");
  const [venueDescription, setVenueDescription] = useState("");
  const [venueProvince, setVenueProvince] = useState("");
  const [venueMunicipality, setVenueMunicipality] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueMapsUrl, setVenueMapsUrl] = useState("");
  const [venueLatitude, setVenueLatitude] = useState("");
  const [venueLongitude, setVenueLongitude] = useState("");
  const venueMapLinkCoordinates = extractMapCoordinates(venueMapsUrl);
  const [venueCapacityMin, setVenueCapacityMin] = useState("");
  const [venueCapacityMax, setVenueCapacityMax] = useState("");
  const [venuePriceFrom, setVenuePriceFrom] = useState("");
  const [venuePriceTo, setVenuePriceTo] = useState("");
  const [venueAmenities, setVenueAmenities] = useState("");
  const [venueEventTypes, setVenueEventTypes] = useState("");
  const [venueGalleryUrls, setVenueGalleryUrls] = useState("");
  const [venuePhotoUploading, setVenuePhotoUploading] = useState(false);
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
  const [guideReadingMinutes, setGuideReadingMinutes] = useState("5");
  const [guideSortOrder, setGuideSortOrder] = useState("100");
  const [guideCoverImage, setGuideCoverImage] = useState("");
  const [editingGuideId, setEditingGuideId] = useState("");
  const [guideSearch, setGuideSearch] = useState("");
  const [guideStatusFilter, setGuideStatusFilter] = useState("ALL");
  const [guideListPage, setGuideListPage] = useState(1);
  const [guideListPageSize, setGuideListPageSize] = useState(10);
  const [guideEditorView, setGuideEditorView] = useState<"edit" | "preview">("edit");
  const [guideCoverUploading, setGuideCoverUploading] = useState(false);
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
    setVenueDescription(""); setVenueProvince(""); setVenueMunicipality(""); setVenueAddress(""); setVenueMapsUrl(""); setVenueLatitude(""); setVenueLongitude("");
    setVenueCapacityMin(""); setVenueCapacityMax(""); setVenuePriceFrom(""); setVenuePriceTo(""); setVenueAmenities("");
    setVenueEventTypes(""); setVenueGalleryUrls(""); setVenuePhone(""); setVenueEmail(""); setVenueWebsite("");
    setVenueBookingTerms(""); setVenuePaymentTerms(""); setVenueCancellationTerms(""); setVenueVendorId("");
    setVenueIsDemo(false);
  }
  function editVenue(venue: Venue) {
    setEditingVenueId(venue.id); setShowVenueForm(true); setVenueName(venue.name); setVenueSlug(venue.slug); setVenueType(venue.venueType);
    setVenueDescription(venue.description ?? ""); setVenueProvince(venue.province ?? ""); setVenueMunicipality(venue.municipality ?? "");
    setVenueAddress(venue.address ?? ""); setVenueMapsUrl(venue.mapsUrl ?? ""); setVenueLatitude(venue.latitude == null ? "" : String(venue.latitude)); setVenueLongitude(venue.longitude == null ? "" : String(venue.longitude)); setVenueCapacityMin(venue.capacityMin == null ? "" : String(venue.capacityMin));
    setVenueCapacityMax(venue.capacityMax == null ? "" : String(venue.capacityMax)); setVenuePriceFrom(venue.priceFrom ?? ""); setVenuePriceTo(venue.priceTo ?? "");
    setVenueAmenities(venue.amenities.join("\n")); setVenueEventTypes(venue.eventTypes.join("\n")); setVenueGalleryUrls(venue.galleryUrls.join("\n"));
    setVenuePhone(venue.phone ?? ""); setVenueEmail(venue.email ?? ""); setVenueWebsite(venue.websiteUrl ?? ""); setVenueBookingTerms(venue.bookingTerms ?? "");
    setVenuePaymentTerms(venue.paymentTerms ?? ""); setVenueCancellationTerms(venue.cancellationTerms ?? ""); setVenueVendorId(venue.vendorId ?? "");
    setVenueIsDemo(venue.isDemo);
  }
  async function uploadVenuePhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const current = splitLines(venueGalleryUrls);
    if (current.length + files.length > 20) {
      setError("Cada espaço pode ter até 20 fotografias. Remove algumas antes de carregar mais.");
      event.target.value = "";
      return;
    }
    const invalidType = files.find((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type));
    const tooLarge = files.find((file) => file.size > 8 * 1024 * 1024);
    if (invalidType) { setError("Usa fotografias JPEG, PNG ou WebP."); event.target.value = ""; return; }
    if (tooLarge) { setError("Cada fotografia deve ter no máximo 8 MB."); event.target.value = ""; return; }
    setError(""); setVenuePhotoUploading(true);
    const uploaded = [...current];
    try {
      for (const file of files) {
        const form = new FormData(); form.append("image", file);
        const result = await api<{ imageUrl: string }>("/admin/venues/photos", { method: "POST", body: form });
        uploaded.push(result.imageUrl);
        setVenueGalleryUrls(uploaded.join("\n"));
      }
      setSuccessNotice(`${files.length === 1 ? "Fotografia carregada" : `${files.length} fotografias carregadas`} e optimizadas. Guarda o espaço para publicar a galeria.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as fotografias.");
    } finally {
      setVenuePhotoUploading(false); event.target.value = "";
    }
  }
  async function saveVenue(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const payload = {
        name: venueName.trim(),
        slug: editingVenueId ? venueSlug.trim() : venueName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString().slice(-4),
        venueType, description: venueDescription || null, province: venueProvince || null, municipality: venueMunicipality || null,
        address: venueAddress || null, mapsUrl: venueMapsUrl || null,
        latitude: venueLatitude !== "" ? Number(venueLatitude) : null, longitude: venueLongitude !== "" ? Number(venueLongitude) : null,
        capacityMin: venueCapacityMin ? Number(venueCapacityMin) : null,
        capacityMax: venueCapacityMax ? Number(venueCapacityMax) : null, priceFrom: venuePriceFrom ? Number(venuePriceFrom) : null,
        priceTo: venuePriceTo ? Number(venuePriceTo) : null, amenities: splitLines(venueAmenities), eventTypes: splitLines(venueEventTypes),
        galleryUrls: splitLines(venueGalleryUrls), phone: venuePhone || null, email: venueEmail || null, websiteUrl: venueWebsite || null,
        bookingTerms: venueBookingTerms || null, paymentTerms: venuePaymentTerms || null, cancellationTerms: venueCancellationTerms || null,
        vendorId: venueVendorId || null,
        isDemo: venueIsDemo,
      };
      await api(editingVenueId ? `/admin/venues/${editingVenueId}` : "/admin/venues", { method: editingVenueId ? "PATCH" : "POST", body: JSON.stringify(payload) });
      resetVenueForm();
    });
  }
  async function importCatalog(kind: BulkKind, entries: BulkImportEntry[]) {
    setSavingAction(true); setError(""); setSuccessNotice("");
    const photoErrors: string[] = [];
    let uploadedPhotos = 0;
    try {
      const records = entries.map(entry => entry.payload);
      const created = kind === "vendors"
        ? await api<{ id: string; galleryUrls?: string[] }[]>("/admin/vendors/import", { method: "POST", body: JSON.stringify({ rows: records }) })
        : await api<{ id: string; galleryUrls: string[] }[]>("/admin/venues/import", { method: "POST", body: JSON.stringify({ rows: records }) });
      for (const [index, entry] of entries.entries()) {
        if (!entry.photos.length) continue;
        if (kind === "vendors") {
          for (const photo of entry.photos) {
            try {
              const form = new FormData(); form.append("image", photo); form.append("altText", photo.name.replace(/\.[^.]+$/, "").slice(0, 160) || "Trabalho do fornecedor");
              await api(`/admin/vendors/${created[index].id}/portfolio`, { method: "POST", body: form });
              uploadedPhotos++;
            } catch (cause) { photoErrors.push(`Linha ${entry.rowNumber}, ${photo.name}: ${cause instanceof Error ? cause.message : "falha no envio"}`); }
          }
        } else {
          for (const photo of entry.photos) {
            try {
              const form = new FormData(); form.append("image", photo);
              await api(`/admin/venues/${created[index].id}/photos`, { method: "POST", body: form });
              uploadedPhotos++;
            } catch (cause) { photoErrors.push(`Linha ${entry.rowNumber}, ${photo.name}: ${cause instanceof Error ? cause.message : "falha no envio"}`); }
          }
        }
      }
      await refresh();
      return { imported: created.length, uploadedPhotos, photoErrors };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível importar os registos.";
      setError(message);
      throw new Error(message);
    } finally { setSavingAction(false); }
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
  function resetGuideEditor() {
    setEditingGuideId(""); setGuideTitle(""); setGuideSlug(""); setGuideSummary("");
    setGuideCategory("Planeamento"); setGuideBody(""); setGuideReadingMinutes("5");
    setGuideSortOrder(String((Math.max(0, ...guides.map((guide) => guide.sortOrder || 0)) + 10)));
    setGuideCoverImage(""); setGuideEditorView("edit");
    if (window.matchMedia("(max-width: 1050px)").matches) requestAnimationFrame(() => document.querySelector(".admin-guide-editor-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  function editGuide(guide: Guide, view: "edit" | "preview" = "edit") {
    setEditingGuideId(guide.id); setGuideTitle(guide.title); setGuideSlug(guide.slug);
    setGuideSummary(guide.summary); setGuideCategory(guide.category); setGuideBody(guide.body);
    setGuideReadingMinutes(String(guide.readingMinutes || 5)); setGuideSortOrder(String(guide.sortOrder ?? 1000));
    setGuideCoverImage(guide.coverImage || GUIDE_COVERS[guide.slug]?.src || ""); setGuideEditorView(view);
    if (window.matchMedia("(max-width: 1050px)").matches) requestAnimationFrame(() => document.querySelector(".admin-guide-editor-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  async function uploadGuideCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Escolhe uma imagem JPEG, PNG ou WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 8 MB.");
      event.target.value = "";
      return;
    }
    setError(""); setGuideCoverUploading(true);
    try {
      const form = new FormData(); form.append("image", file);
      const result = await api<{ coverImage: string }>("/admin/guides/covers", { method: "POST", body: form });
      setGuideCoverImage(result.coverImage);
      setSuccessNotice("Capa carregada e optimizada. Guarda o guia para a publicar.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar a capa.");
    } finally {
      setGuideCoverUploading(false); event.target.value = "";
    }
  }
  async function saveGuide(e: FormEvent) {
    e.preventDefault();
    const current = guides.find((guide) => guide.id === editingGuideId);
    const payload = {
      title: guideTitle.trim(), slug: guideSlug.trim(), summary: guideSummary.trim(),
      body: guideBody.trim(), category: guideCategory.trim(),
      readingMinutes: Number(guideReadingMinutes), sortOrder: Number(guideSortOrder),
      coverImage: guideCoverImage || null, status: current?.status || "DRAFT",
    };
    const ok = await run(() => api(editingGuideId ? `/admin/guides/${editingGuideId}` : "/admin/guides", {
      method: editingGuideId ? "PATCH" : "POST", body: JSON.stringify(payload),
    }));
    if (ok) { resetGuideEditor(); setGuideListPage(1); }
  }
  async function publishGuide(g: Guide) {
    const status = g.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    await run(() =>
      api(`/admin/guides/${g.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          ...(status === "PUBLISHED" ? { reviewedAt: new Date().toISOString() } : {}),
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
  const venueProvinces = Array.from(new Set(venues.map((venue) => venue.province).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, "pt"));
  const venueTypes = Array.from(new Set(venues.map((venue) => venue.venueType).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt"));
  const venueStats = {
    total: venues.length,
    published: venues.filter((venue) => venue.status === "PUBLISHED").length,
    pending: pendingVenues.length,
    missingPhotos: venues.filter((venue) => !venue.galleryUrls.length && !venue.isDemo).length,
  };
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
    return matchesSearch
      && (venueStatusFilter === "ALL" || (venueStatusFilter === "PENDING" ? ["DRAFT", "PENDING"].includes(venue.status) : venue.status === venueStatusFilter))
      && (!venueListProvinceFilter || venue.province === venueListProvinceFilter)
      && (!venueListTypeFilter || venue.venueType === venueListTypeFilter)
      && (venueListDemoFilter === "ALL" || venue.isDemo === (venueListDemoFilter === "DEMO"));
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
  const visibleGuides = guides.filter((guide) => {
    const query = guideSearch.trim().toLocaleLowerCase("pt-AO");
    const matchesQuery = !query || `${guide.title} ${guide.slug} ${guide.category}`.toLocaleLowerCase("pt-AO").includes(query);
    return matchesQuery && (guideStatusFilter === "ALL" || guide.status === guideStatusFilter);
  });
  const pagedGuides = slicePage(visibleGuides, guideListPage, guideListPageSize);
  const guideCounts = {
    total: guides.length,
    published: guides.filter((guide) => guide.status === "PUBLISHED").length,
    drafts: guides.filter((guide) => guide.status === "DRAFT").length,
  };
  const uploadedCoverPaths = Array.from(new Set([...guides.map((guide) => guide.coverImage), guideCoverImage].filter((value): value is string => Boolean(value && value.startsWith("/api/v1/guides/covers/")))));
  const availableGuideCovers = [
    ...guideCoverOptions,
    ...uploadedCoverPaths.filter((src) => !guideCoverOptions.some((cover) => cover.src === src)).map((src, index) => ({ slug: src, src, alt: `Capa carregada ${index + 1}` })),
  ];
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
              <header className="admin-workbar"><div><p className="eyebrow">Catálogo público</p><h2>Gestão de espaços</h2><p>Revê fotografias e informação antes de publicar. Os dados de demonstração estão identificados e não representam locais reais.</p></div><div className="admin-workbar-actions"><button className="button button-outline" type="button" onClick={() => { setShowVenueBulkImport(value => !value); setShowVenueForm(false); }}>Importar CSV</button><button className="button button-primary" type="button" onClick={() => { setShowVenueBulkImport(false); resetVenueForm(); setShowVenueForm(true); }}>+ Registar espaço</button></div></header>
              {showVenueBulkImport && <BulkCatalogImport kind="venues" busy={savingAction} onClose={() => setShowVenueBulkImport(false)} onImport={(entries) => importCatalog("venues", entries)} />}
              <section className="admin-venue-summary" aria-label="Resumo dos espaços">
                <article><small>Total</small><strong>{venueStats.total}</strong></article>
                <article><small>Publicados</small><strong>{venueStats.published}</strong></article>
                <article><small>Por preparar/rever</small><strong>{venueStats.pending}</strong></article>
                <article><small>Sem fotografia</small><strong>{venueStats.missingPhotos}</strong></article>
              </section>
              <div className={`admin-grid ${showVenueForm ? "with-form" : "list-only"}`}>
                <section className="dash-panel">
                  <div className="admin-filter-bar admin-venue-filter-bar"><label className="admin-search">Pesquisar<input value={venueSearch} onChange={event => { setVenueSearch(event.target.value); setAdminListPage(1); }} placeholder="Nome, tipo ou localização" /></label><label>Estado<select value={venueStatusFilter} onChange={event => { setVenueStatusFilter(event.target.value); setAdminListPage(1); }}><option value="ALL">Todos</option><option value="PENDING">Por preparar/rever</option><option value="PUBLISHED">Publicados</option><option value="SUSPENDED">Suspensos</option></select></label><label>Província<select value={venueListProvinceFilter} onChange={event => { setVenueListProvinceFilter(event.target.value); setAdminListPage(1); }}><option value="">Todas</option>{venueProvinces.map((item) => <option key={item}>{item}</option>)}</select></label><label>Tipo<select value={venueListTypeFilter} onChange={event => { setVenueListTypeFilter(event.target.value); setAdminListPage(1); }}><option value="">Todos os tipos</option>{venueTypes.map((item) => <option key={item}>{item}</option>)}</select></label><label>Perfil<select value={venueListDemoFilter} onChange={event => { setVenueListDemoFilter(event.target.value); setAdminListPage(1); }}><option value="ALL">Todos</option><option value="REAL">Reais</option><option value="DEMO">Demonstração</option></select></label><button type="button" className="button button-outline compact" onClick={() => { setVenueSearch(""); setVenueStatusFilter("ALL"); setVenueListProvinceFilter(""); setVenueListTypeFilter(""); setVenueListDemoFilter("ALL"); setAdminListPage(1); }}>Limpar</button></div>
                  {visibleVenues.length ? pagedVenues.map(venue => {
                    const missing = venue.isDemo ? [] : [!venue.province && !venue.municipality ? "localização" : "", !venue.galleryUrls.length ? "fotografia" : "", !venue.phone && !venue.email && !venue.websiteUrl ? "contacto" : ""].filter(Boolean);
                    return <article className={`admin-row venue-admin-row ${venue.isDemo ? "is-demo" : ""}`} key={venue.id}>
                      {venue.galleryUrls[0] ? <img className="admin-venue-thumb" src={venue.galleryUrls[0]} alt="" loading="lazy" referrerPolicy={venue.galleryUrls[0].startsWith("http") ? "no-referrer" : undefined} /> : <span className="admin-venue-thumb-empty" aria-hidden="true">⌂</span>}
                      <span><strong>{venue.name}</strong><small>{venue.venueType} · {[venue.municipality, venue.province].filter(Boolean).join(", ") || "Localização por preencher"}</small><small>{venue.capacityMax ? `${venue.capacityMin ?? 1}–${venue.capacityMax} pessoas` : "Capacidade por confirmar"} · {venue.priceFrom || venue.priceTo ? `${formatAOA(venue.priceFrom)} – ${formatAOA(venue.priceTo)}` : "Preço sob consulta"}</small><small className="admin-venue-status-line"><em className={`admin-venue-status status-${venue.status.toLowerCase()}`}>{venue.status === "DRAFT" ? "Rascunho" : venue.status === "PENDING" ? "Por rever" : venue.status === "PUBLISHED" ? "Publicado" : "Suspenso"}</em>{venue.isDemo && <em className="admin-venue-demo-badge">Demonstração</em>}{venue.verifiedAt ? ` · Revisto ${new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeZone: "Africa/Luanda" }).format(new Date(venue.verifiedAt))}` : ""}</small><small>{missing.length ? `Por completar: ${missing.join(" · ")}` : "Dados essenciais preenchidos"} · {venue.galleryUrls.length} fotografia(s)</small></span>
                      <div>{venue.status === "PUBLISHED" && <a href={`/espacos/${venue.slug}`} target="_blank" rel="noreferrer">Pré-visualizar</a>}<button type="button" disabled={savingAction} onClick={() => editVenue(venue)}>Editar</button>{venue.status === "PUBLISHED" ? <button type="button" disabled={savingAction} onClick={() => void updateVenueStatus(venue, "SUSPENDED")}>Suspender</button> : venue.status === "SUSPENDED" ? <button type="button" disabled={savingAction} onClick={() => void updateVenueStatus(venue, "PENDING")}>Voltar para revisão</button> : <button type="button" disabled={savingAction} onClick={() => void updateVenueStatus(venue, "PUBLISHED")}>Confirmar e publicar</button>}</div>
                    </article>;
                  }) : <p className="empty-copy">{venueSearch || venueStatusFilter !== "ALL" || venueListProvinceFilter || venueListTypeFilter || venueListDemoFilter !== "ALL" ? "Não encontrámos espaços com estes filtros." : "Ainda não há espaços registados. Adiciona os primeiros espaços reais para preparar o catálogo."}</p>}
                  <ListPagination page={adminListPage} pageSize={adminListPageSize} total={visibleVenues.length} label="espaços" onPageChange={setAdminListPage} onPageSizeChange={(size) => { setAdminListPageSize(size); setAdminListPage(1); }} />
                </section>
                {showVenueForm && <form className="dash-panel admin-form venue-admin-form" onSubmit={saveVenue}>
                  <h2>{editingVenueId ? "Editar espaço" : "Registar espaço"}</h2>
                  <p>Organiza o perfil por secções. Antes de publicar, confirma os dados e as fotografias com o responsável.</p>
                  <details className="admin-venue-form-section" open><summary><span>Perfil e localização</span><small>Nome, tipo e onde fica</small></summary>
                    <label>Nome do espaço<input required minLength={2} maxLength={120} value={venueName} onChange={event => setVenueName(event.target.value)} placeholder="Ex.: Quinta das Acácias" /></label>
                    {editingVenueId && <label>Endereço do perfil<input required value={venueSlug} onChange={event => setVenueSlug(event.target.value)} /></label>}
                    <label>Tipo de espaço<select value={venueType} onChange={event => setVenueType(event.target.value)}><option>Quinta</option><option>Salão de festas</option><option>Hotel</option><option>Restaurante</option><option>Praia ou espaço ao ar livre</option><option>Outro</option></select></label>
                    <label>Descrição<textarea maxLength={2500} value={venueDescription} onChange={event => setVenueDescription(event.target.value)} /></label>
                    <div className="admin-form-pair"><label>Província<input value={venueProvince} onChange={event => setVenueProvince(event.target.value)} /></label><label>Município<input value={venueMunicipality} onChange={event => setVenueMunicipality(event.target.value)} /></label></div>
                    <label>Endereço<input maxLength={300} value={venueAddress} onChange={event => setVenueAddress(event.target.value)} placeholder="Bairro, rua ou referência" /></label>
                    <label>Link do mapa (opcional)<input type="url" value={venueMapsUrl} onChange={event => setVenueMapsUrl(event.target.value)} placeholder="Google Maps, Apple Maps ou OpenStreetMap" /><small>O link fica no perfil para abrir no serviço de mapas que o espaço usa.</small></label>
                    {venueMapLinkCoordinates ? <button className="button button-outline compact admin-map-import-link" type="button" onClick={() => { setVenueLatitude(String(venueMapLinkCoordinates.latitude)); setVenueLongitude(String(venueMapLinkCoordinates.longitude)); }}>Usar ponto encontrado no link ({venueMapLinkCoordinates.latitude}, {venueMapLinkCoordinates.longitude})</button> : venueMapsUrl && <small className="admin-map-link-note">Não foi possível ler um ponto deste link. Links curtos continuam válidos para abrir o mapa; podes marcar o ponto manualmente abaixo.</small>}
                    <div className="admin-map-coordinate-help"><strong>Mapa incorporado no perfil</strong><span>Se o link não incluir as coordenadas, podes marcá-las aqui. O mapa do perfil usa OpenStreetMap e o link partilhado continua disponível como alternativa.</span></div>
                    <div className="admin-form-pair"><label>Latitude<input type="number" min="-90" max="90" step="any" inputMode="decimal" value={venueLatitude} onChange={event => setVenueLatitude(event.target.value)} placeholder="Ex.: -8.83833" /></label><label>Longitude<input type="number" min="-180" max="180" step="any" inputMode="decimal" value={venueLongitude} onChange={event => setVenueLongitude(event.target.value)} placeholder="Ex.: 13.23440" /></label></div>
                    {(venueLatitude === "") !== (venueLongitude === "") && <small className="admin-map-coordinate-error" role="alert">Preenche os dois campos ou deixa ambos vazios.</small>}
                    {venueLatitude !== "" && venueLongitude !== "" && Number.isFinite(Number(venueLatitude)) && Number.isFinite(Number(venueLongitude)) && Math.abs(Number(venueLatitude)) <= 90 && Math.abs(Number(venueLongitude)) <= 180 && <div className="admin-map-preview"><iframe src={openStreetMapEmbedUrl(Number(venueLatitude), Number(venueLongitude))} title="Pré-visualização do ponto no mapa" loading="lazy" referrerPolicy="no-referrer" /><a href={openStreetMapUrl(Number(venueLatitude), Number(venueLongitude))} target="_blank" rel="noreferrer">Abrir pré-visualização ↗</a></div>}
                    <label className="admin-venue-demo-control"><input type="checkbox" checked={venueIsDemo} onChange={event => setVenueIsDemo(event.target.checked)} /><span>Perfil de demonstração</span></label>
                    {venueIsDemo && <small className="admin-venue-demo-help">Será identificado como demonstração e não deve sugerir um espaço real ou disponível para reserva.</small>}
                  </details>
                  <details className="admin-venue-form-section"><summary><span>Lotação e preços</span><small>Valores indicativos confirmados</small></summary>
                    <div className="admin-form-pair"><label>Capacidade mínima<input type="number" min="0" value={venueCapacityMin} onChange={event => setVenueCapacityMin(event.target.value)} /></label><label>Capacidade máxima<input type="number" min="1" value={venueCapacityMax} onChange={event => setVenueCapacityMax(event.target.value)} /></label></div>
                    <div className="admin-form-pair"><label>Preço desde (Kz, opcional)<input type="number" min="0" step="any" value={venuePriceFrom} onChange={event => setVenuePriceFrom(event.target.value)} /></label><label>Preço até (Kz, opcional)<input type="number" min="0" step="any" value={venuePriceTo} onChange={event => setVenuePriceTo(event.target.value)} /></label></div>
                  </details>
                  <details className="admin-venue-form-section"><summary><span>Características</span><small>Comodidades e eventos aceites</small></summary>
                    <label>Características, uma por linha<textarea value={venueAmenities} onChange={event => setVenueAmenities(event.target.value)} placeholder={"Estacionamento\nJardim\nCozinha de apoio"} /></label>
                    <label>Tipos de evento, um por linha<textarea value={venueEventTypes} onChange={event => setVenueEventTypes(event.target.value)} placeholder={"Casamento\nAlambamento\nFesta"} /></label>
                  </details>
                  <details className="admin-venue-form-section" open><summary><span>Fotografias</span><small>{splitLines(venueGalleryUrls).length} carregada(s) · escolhe a capa abaixo</small></summary>
                  <label className="admin-venue-upload-label">Fotografias do espaço<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => void uploadVenuePhotos(event)} disabled={venuePhotoUploading} /><small>{venuePhotoUploading ? "A optimizar fotografias…" : "Anexa até 20 imagens JPEG, PNG ou WebP, com no máximo 8 MB cada. As imagens são optimizadas para WebP."}</small></label>
                  {splitLines(venueGalleryUrls).length > 0 && <div className="admin-venue-photo-grid" aria-label="Pré-visualização das fotografias"><strong>{splitLines(venueGalleryUrls).length} fotografia(s) · a primeira é a capa</strong>{splitLines(venueGalleryUrls).map((src, index) => <figure className={index === 0 ? "is-cover" : ""} key={`${src}-${index}`}><img src={src} alt={`Fotografia ${index + 1} do espaço`} loading="lazy" referrerPolicy={src.startsWith("http") ? "no-referrer" : undefined} />{index === 0 && <em>Capa</em>}<div><button type="button" aria-label={`Mover fotografia ${index + 1} para a esquerda`} disabled={index === 0} onClick={() => { const photos = splitLines(venueGalleryUrls); [photos[index - 1], photos[index]] = [photos[index], photos[index - 1]]; setVenueGalleryUrls(photos.join("\n")); }}>←</button><button type="button" aria-label={`Mover fotografia ${index + 1} para a direita`} disabled={index === splitLines(venueGalleryUrls).length - 1} onClick={() => { const photos = splitLines(venueGalleryUrls); [photos[index + 1], photos[index]] = [photos[index], photos[index + 1]]; setVenueGalleryUrls(photos.join("\n")); }}>→</button><button type="button" aria-label={`Remover fotografia ${index + 1}`} onClick={() => setVenueGalleryUrls(splitLines(venueGalleryUrls).filter((_, itemIndex) => itemIndex !== index).join("\n"))}>×</button></div></figure>)}</div>}
                  <label>Ou adicionar URLs de fotografias HTTPS, uma por linha<textarea value={venueGalleryUrls} onChange={event => setVenueGalleryUrls(event.target.value)} placeholder="https://…" /><small>Usa imagens autorizadas pelo responsável do espaço. Não acrescentes disponibilidade ou preços por suposição.</small></label>
                  </details>
                  <details className="admin-venue-form-section"><summary><span>Contactos</span><small>Como chegar ao responsável</small></summary>
                    <div className="admin-form-pair"><label>Telefone<input value={venuePhone} onChange={event => setVenuePhone(event.target.value)} /></label><label>Email<input type="email" value={venueEmail} onChange={event => setVenueEmail(event.target.value)} /></label></div>
                    <label>Website (HTTPS)<input type="url" value={venueWebsite} onChange={event => setVenueWebsite(event.target.value)} /></label>
                    <label>Prestador associado (opcional)<select value={venueVendorId} onChange={event => setVenueVendorId(event.target.value)}><option value="">Sem associação</option>{vendors.filter(vendor => vendor.status === "ACTIVE").map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
                  </details>
                  <details className="admin-venue-form-section"><summary><span>Condições</span><small>Reserva, pagamentos e cancelamentos</small></summary>
                    <label>Condições de reserva<textarea maxLength={1000} value={venueBookingTerms} onChange={event => setVenueBookingTerms(event.target.value)} /></label>
                    <label>Condições de pagamento<textarea maxLength={1000} value={venuePaymentTerms} onChange={event => setVenuePaymentTerms(event.target.value)} /></label>
                    <label>Política de cancelamento<textarea maxLength={1000} value={venueCancellationTerms} onChange={event => setVenueCancellationTerms(event.target.value)} /></label>
                  </details>
                  <div className="admin-form-actions"><button className="button button-primary" disabled={savingAction}>{savingAction ? "A guardar…" : editingVenueId ? "Guardar alterações" : "Guardar rascunho"}</button><button type="button" className="button button-outline" onClick={resetVenueForm}>Cancelar</button></div>
                </form>}
              </div>
            </>
          )}
          {tab === "vendors" && (
            <>
            <header className="admin-workbar"><div><p className="eyebrow">Operação</p><h2>Fila de fornecedores</h2><p>Revê primeiro os perfis pendentes e acompanha os restantes pelo estado.</p></div><div className="admin-workbar-actions"><button className="button button-outline" type="button" onClick={() => { setShowVendorBulkImport(value => !value); setShowVendorForm(false); }}>Importar CSV</button><button className="button button-primary" type="button" onClick={() => { setShowVendorBulkImport(false); resetVendorForm(); setShowVendorForm(true); }}>+ Registar fornecedor</button></div></header>
            {showVendorBulkImport && <BulkCatalogImport kind="vendors" busy={savingAction} onClose={() => setShowVendorBulkImport(false)} onImport={(entries) => importCatalog("vendors", entries)} />}
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
            <section className="admin-guides-workspace">
              <div className="admin-guide-summary" aria-label="Resumo da Biblioteca">
                <article><span>Total de guias</span><strong>{guideCounts.total}</strong></article>
                <article><span>Publicados</span><strong>{guideCounts.published}</strong></article>
                <article><span>Rascunhos</span><strong>{guideCounts.drafts}</strong></article>
                <button className="button button-primary" type="button" onClick={resetGuideEditor}>+ Novo guia</button>
              </div>
              <div className="admin-guide-columns">
                <section className="dash-panel admin-guide-list-panel">
                  <header className="admin-guide-list-heading"><div><h2>Biblioteca</h2><p>Pesquisa, revê e publica os conteúdos.</p></div><span>{visibleGuides.length} {visibleGuides.length === 1 ? "guia" : "guias"}</span></header>
                  <div className="admin-guide-filters">
                    <label className="sr-only" htmlFor="admin-guide-search">Pesquisar guias</label>
                    <input id="admin-guide-search" value={guideSearch} onChange={(event) => { setGuideSearch(event.target.value); setGuideListPage(1); }} placeholder="Pesquisar por título ou tema" />
                    <label className="sr-only" htmlFor="admin-guide-status">Estado do guia</label>
                    <select id="admin-guide-status" value={guideStatusFilter} onChange={(event) => { setGuideStatusFilter(event.target.value); setGuideListPage(1); }}><option value="ALL">Todos os estados</option><option value="PUBLISHED">Publicados</option><option value="DRAFT">Rascunhos</option><option value="ARCHIVED">Arquivados</option></select>
                  </div>
                  <div className="admin-guide-list">
                    {visibleGuides.length ? pagedGuides.map((guide) => {
                      const cover = guide.coverImage || GUIDE_COVERS[guide.slug]?.src;
                      return <article className={`admin-guide-item ${editingGuideId === guide.id ? "is-selected" : ""}`} key={guide.id}>
                        <button className="admin-guide-item-main" type="button" onClick={() => editGuide(guide)} aria-label={`Editar ${guide.title}`}>
                          {cover ? <img src={cover} alt="" loading="lazy" /> : <span className="admin-guide-no-cover">N</span>}
                          <span className="admin-guide-item-copy"><strong>{guide.title}</strong><small>{guide.category} · {guide.readingMinutes || 5} min · Ordem {guide.sortOrder}</small><em className={guide.status === "PUBLISHED" ? "is-published" : "is-draft"}>{guide.status === "PUBLISHED" ? "Publicado" : guide.status === "ARCHIVED" ? "Arquivado" : "Rascunho"}</em></span>
                        </button>
                        <div className="admin-guide-item-actions"><button type="button" onClick={() => editGuide(guide, "preview")}>Pré-visualizar</button><button type="button" onClick={() => editGuide(guide)}>Editar</button><button type="button" disabled={savingAction} onClick={() => void publishGuide(guide)}>{guide.status === "PUBLISHED" ? "Retirar" : "Publicar"}</button></div>
                      </article>;
                    }) : <p className="admin-guide-empty">Não há guias com estes filtros.</p>}
                  </div>
                  <ListPagination page={guideListPage} pageSize={guideListPageSize} total={visibleGuides.length} label="guias" onPageChange={setGuideListPage} onPageSizeChange={(size) => { setGuideListPageSize(size); setGuideListPage(1); }} />
                </section>
                <section className="dash-panel admin-guide-editor-panel">
                  <div className="admin-guide-editor-heading"><div><p className="eyebrow">Editor editorial</p><h2>{editingGuideId ? "Editar guia" : "Novo guia"}</h2></div>{editingGuideId && <button className="admin-guide-clear" type="button" onClick={resetGuideEditor}>Novo</button>}</div>
                  <div className="admin-guide-editor-tabs" role="tablist" aria-label="Editor de guias"><button type="button" role="tab" aria-selected={guideEditorView === "edit"} className={guideEditorView === "edit" ? "current" : ""} onClick={() => setGuideEditorView("edit")}>Conteúdo</button><button type="button" role="tab" aria-selected={guideEditorView === "preview"} className={guideEditorView === "preview" ? "current" : ""} onClick={() => setGuideEditorView("preview")}>Pré-visualização</button></div>
                  {guideEditorView === "preview" ? <div className="admin-guide-preview-wrap"><GuidePreview guide={{ title: guideTitle, slug: guideSlug, summary: guideSummary, category: guideCategory, body: guideBody, readingMinutes: Number(guideReadingMinutes) || 5, coverImage: guideCoverImage || null }} /></div> : <form className="admin-form admin-guide-form" onSubmit={saveGuide}>
                    <label>Título<input required maxLength={180} value={guideTitle} onChange={(event) => { const value = event.target.value; setGuideTitle(value); if (!editingGuideId) setGuideSlug(value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-AO").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} /></label>
                    <label>Endereço do guia (slug)<input required maxLength={180} value={guideSlug} onChange={(event) => setGuideSlug(event.target.value)} /><small>Usado no link público. Evita alterá-lo depois de partilhar o guia.</small></label>
                    <div className="admin-guide-field-row"><label>Categoria<input required maxLength={80} value={guideCategory} onChange={(event) => setGuideCategory(event.target.value)} /></label><label>Leitura (minutos)<input required type="number" min={1} max={60} value={guideReadingMinutes} onChange={(event) => setGuideReadingMinutes(event.target.value)} /></label><label>Ordem na Biblioteca<input required type="number" min={0} max={10000} value={guideSortOrder} onChange={(event) => setGuideSortOrder(event.target.value)} /></label></div>
                    <label>Resumo<input required minLength={10} maxLength={500} value={guideSummary} onChange={(event) => setGuideSummary(event.target.value)} /></label>
                    <label>Capa<select value={guideCoverImage} onChange={(event) => setGuideCoverImage(event.target.value)}><option value="">Sem capa</option>{availableGuideCovers.map((cover) => <option key={cover.slug} value={cover.src}>{cover.alt}</option>)}</select></label>
                    <label className="admin-guide-upload-label">Ou carregar uma capa<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadGuideCover(event)} disabled={guideCoverUploading} /><small>{guideCoverUploading ? "A optimizar imagem…" : "JPEG, PNG ou WebP · máximo 8 MB. A imagem é optimizada para WebP e proporção horizontal."}</small></label>
                    {guideCoverImage && <div className="admin-guide-cover-preview"><img src={guideCoverImage} alt="Pré-visualização da capa seleccionada" /><span>Pré-visualização da capa · formato 16:9</span></div>}
                    <label>Conteúdo <small>Suporta Markdown: títulos ##, listas, tabelas, negrito e links.</small><textarea required minLength={20} maxLength={30000} rows={14} value={guideBody} onChange={(event) => setGuideBody(event.target.value)} /></label>
                    <div className="admin-guide-form-actions"><button className="button button-primary" disabled={savingAction}>{savingAction ? "A guardar…" : editingGuideId ? "Guardar alterações" : "Guardar rascunho"}</button><button className="button button-outline" type="button" onClick={() => setGuideEditorView("preview")}>Pré-visualizar</button></div>
                  </form>}
                  {guideEditorView === "preview" && <div className="admin-guide-preview-actions"><button className="button button-outline" type="button" onClick={() => setGuideEditorView("edit")}>Voltar ao conteúdo</button>{editingGuideId && <a className="button button-outline" href={`/guias/${guideSlug}`} target="_blank" rel="noreferrer">Abrir publicado ↗</a>}</div>}
                </section>
              </div>
            </section>
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
