"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { api } from "../lib/api";
import { formatAOA } from "../lib/format";
import {
  luandaDateInput,
  luandaDateTimeInput,
  luandaDateTimeToIso,
  luandaDateToIso,
  luandaTodayDateInput,
} from "../lib/time";
import QRCode from "qrcode";
import { TaskBoard, TaskUpdate } from "./task-board";
import { BudgetPanel, BudgetExpense } from "./budget-panel";
import {
  ProjectVendorFavorite,
  VendorRequest,
  VendorWorkspace,
} from "./vendor-workspace";
import { EventManager } from "./event-manager";
import { GuestsWorkspace } from "./guests-workspace";
import { ReportsPanel } from "./reports-panel";
import { NotificationCenter } from "./notification-center";
import type { ProjectKind, ProjectSummary } from "@casar/contracts";

type User = { id: string; email: string; name: string | null; role?: "USER" | "MODERATOR" | "ADMIN" };
type Project = ProjectSummary & {
  budgetLimit: number | string | null;
  guestEstimate: number | null;
};
type Task = {
  id: string;
  title: string;
  category: string;
  priority: "LOW" | "NORMAL" | "HIGH";
  dueAt: string | null;
  assigneeName: string | null;
  assigneeUserId: string | null;
  assignedTo: { id: string; name: string | null; email: string } | null;
  status: "TODO" | "IN_PROGRESS" | "WAITING" | "DONE";
};
type Guest = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  groupName: string | null;
  maxPartySize: number;
  seatingTableId: string | null;
  rsvpToken: string;
  rsvps: { status: string; partySize: number }[];
};
type Expense = BudgetExpense;
type Invite = {
  slug: string;
  headline: string | null;
  message: string | null;
  theme: "CLASSIC" | "BOTANICAL" | "TERRACOTTA";
  publicNotes: string | null;
  dressCode: string | null;
  supportContactName: string | null;
  supportContactPhone: string | null;
};
type InvitationTheme = Invite["theme"];
const INVITATION_MESSAGE = "Será uma alegria celebrar este momento contigo.";
const INVITATION_THEMES: {
  value: InvitationTheme;
  label: string;
  description: string;
}[] = [
  { value: "CLASSIC", label: "Clássico", description: "Creme e dourado" },
  {
    value: "BOTANICAL",
    label: "Botânico",
    description: "Verde e natural",
  },
  {
    value: "TERRACOTTA",
    label: "Terracota",
    description: "Quente e contemporâneo",
  },
];
type Table = {
  id: string;
  name: string;
  capacity: number | null;
  capacityUsed: number;
  _count: { guests: number };
};
type Detail = Project & {
  tasks: Task[];
  guests: Guest[];
  expenses: Expense[];
  events: {
    id: string;
    title: string;
    type: string;
    startsAt: string | null;
    venue: string | null;
    address: string | null;
    mapsUrl: string | null;
    guestNotes: string | null;
    showToGuests: boolean;
  }[];
  members: {
    role: string;
    user: { id: string; name: string | null; email: string };
  }[];
  invitations: Invite[];
  quoteRequests: VendorRequest[];
  metrics: {
    tasksDone: number;
    tasksTotal: number;
    guests: number;
    rsvpsAccepted: number;
    rsvpsPending: number;
    totalCommitted: number;
    totalPaid: number;
  };
};
type Tab =
  | "events"
  | "overview"
  | "planning"
  | "budget"
  | "vendors"
  | "guests"
  | "invitation"
  | "program"
  | "team"
  | "reports"
  | "settings";
const ANGOLA_PROVINCES = [
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
const DASHBOARD_TABS: { key: Tab; label: string }[] = [
  { key: "events", label: "Os meus eventos" },
  { key: "overview", label: "Visão geral" },
  { key: "planning", label: "Planeamento" },
  { key: "budget", label: "Orçamento" },
  { key: "vendors", label: "Fornecedores" },
  { key: "guests", label: "Convidados" },
  { key: "invitation", label: "Convites digitais" },
  { key: "program", label: "Programa" },
  { key: "team", label: "Colaboração" },
  { key: "reports", label: "Relatórios" },
  { key: "settings", label: "Definições" },
];
const DASHBOARD_TAB_URL: Record<Tab, string> = {
  events: "eventos",
  overview: "resumo",
  planning: "planeamento",
  budget: "orcamento",
  vendors: "fornecedores",
  guests: "convidados",
  invitation: "convites",
  program: "programa",
  team: "colaboracao",
  reports: "relatorios",
  settings: "definicoes",
};
function tabFromUrl(value: string | null): Tab | undefined {
  if (!value) return undefined;
  return (Object.keys(DASHBOARD_TAB_URL) as Tab[]).find(
    (tab) => tab === value || DASHBOARD_TAB_URL[tab] === value,
  );
}
const PROJECT_KINDS: {
  value: Project["kind"];
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: "WEDDING",
    label: "Casamento",
    description:
      "Um plano para organizar o casamento e os seus vários momentos.",
    icon: "♡",
  },
  {
    value: "ALAMBAMENTO",
    label: "Alambamento",
    description:
      "Preparativos, responsabilidades e celebração do pedido tradicional.",
    icon: "✦",
  },
  {
    value: "PARTY",
    label: "Festa",
    description:
      "Uma festa ou celebração com convidados, programa e orçamento próprios.",
    icon: "✧",
  },
  {
    value: "OTHER",
    label: "Outro evento",
    description:
      "Um projecto personalizado para qualquer outro tipo de evento.",
    icon: "◈",
  },
];
const MOMENT_TYPES = [
  { value: "CIVIL", label: "Cerimónia civil" },
  { value: "RELIGIOUS", label: "Cerimónia religiosa" },
  { value: "ALAMBAMENTO", label: "Alambamento ou pedido tradicional" },
  { value: "RECEPTION", label: "Festa ou recepção" },
  { value: "CUSTOM", label: "Outro momento" },
];
const EXPENSE_CATEGORIES = [
  "Espaço",
  "Catering",
  "Decoração",
  "Fotografia e vídeo",
  "Música",
  "Roupa e beleza",
  "Transporte",
  "Convites",
  "Documentação",
  "Outros",
];
const TASK_CATEGORIES = Array.from(
  new Set([
    "Planeamento",
    "Convidados",
    "Fornecedores",
    "Programa",
    "Convites",
    ...EXPENSE_CATEGORIES,
    "Outro",
  ]),
);
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-AO", {
        dateStyle: "long",
        timeZone: "Africa/Luanda",
      }).format(new Date(value))
    : "Data por definir";
const eventDateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-AO", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Luanda",
      }).format(new Date(value))
    : "Horário por confirmar";
const projectKindLabel = (kind: Project["kind"]) =>
  PROJECT_KINDS.find((item) => item.value === kind)?.label ?? "Outro evento";
const projectKindIcon = (kind: Project["kind"]) =>
  PROJECT_KINDS.find((item) => item.value === kind)?.icon ?? "◈";
function draftProjectKind(value: unknown): Project["kind"] {
  if (
    value === "WEDDING" ||
    value === "ALAMBAMENTO" ||
    value === "PARTY" ||
    value === "OTHER"
  )
    return value;
  if (value === "ALAMBAMENTO") return "ALAMBAMENTO";
  if (value === "RECEPTION") return "PARTY";
  if (value === "CUSTOM") return "OTHER";
  return "WEDDING";
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState("");
  const [restoringProjectId, setRestoringProjectId] = useState("");
  const [archivingProject, setArchivingProject] = useState(false);
  const [data, setData] = useState<Detail | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [navigationReady, setNavigationReady] = useState(false);
  const [settingsView, setSettingsView] = useState<"event" | "account">(
    "event",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [newProjectKind, setNewProjectKind] =
    useState<Project["kind"]>("WEDDING");
  const [editProjectTitle, setEditProjectTitle] = useState("");
  const [editProjectKind, setEditProjectKind] =
    useState<Project["kind"]>("WEDDING");
  const [editProjectDate, setEditProjectDate] = useState("");
  const [editProjectProvince, setEditProjectProvince] = useState("");
  const [editProjectBudget, setEditProjectBudget] = useState("");
  const [editProjectGuests, setEditProjectGuests] = useState("");
  const [province, setProvince] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [eventType, setEventType] = useState("CIVIL");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [guestEstimate, setGuestEstimate] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [editingTaskId, setEditingTaskId] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskAssigneeUserId, setTaskAssigneeUserId] = useState("");
  const [taskCategory, setTaskCategory] = useState("Planeamento");
  const [taskPriority, setTaskPriority] = useState<Task["priority"]>("NORMAL");
  const [taskView, setTaskView] = useState<"board" | "list">("board");
  const [eventTitle, setEventTitle] = useState("");
  const [editingEventId, setEditingEventId] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventVenue, setEventVenue] = useState("");
  const [eventAddress, setEventAddress] = useState("");
  const [eventMapsUrl, setEventMapsUrl] = useState("");
  const [eventGuestNotes, setEventGuestNotes] = useState("");
  const [eventShowToGuests, setEventShowToGuests] = useState(true);
  const [programView, setProgramView] = useState<"moments" | "deadlines">(
    "moments",
  );
  const [showEventForm, setShowEventForm] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("VIEWER");
  const [memberActionId, setMemberActionId] = useState("");
  const [expenseTitle, setExpenseTitle] = useState("");
  const [editingExpenseId, setEditingExpenseId] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Outros");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseStatus, setExpenseStatus] =
    useState<Expense["status"]>("ESTIMATED");
  const [expenseDueAt, setExpenseDueAt] = useState("");
  const [expenseTaskId, setExpenseTaskId] = useState("");
  const [tables, setTables] = useState<Table[]>([]);
  const [favorites, setFavorites] = useState<ProjectVendorFavorite[]>([]);
  const [inviteHeadline, setInviteHeadline] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteTheme, setInviteTheme] = useState<InvitationTheme>("CLASSIC");
  const [invitePublicNotes, setInvitePublicNotes] = useState("");
  const [inviteDressCode, setInviteDressCode] = useState("");
  const [inviteSupportName, setInviteSupportName] = useState("");
  const [inviteSupportPhone, setInviteSupportPhone] = useState("");
  const [publishingInvite, setPublishingInvite] = useState(false);
  const invitationDraftProject = useRef("");
  const skipUrlSync = useRef(false);
  const firstUrlSync = useRef(true);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [savingProjectSettings, setSavingProjectSettings] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const loadDetail = useCallback(async (id: string) => {
    setError("");
    const detail = await api<Detail>(`/projects/${id}`);
    if (invitationDraftProject.current !== id) {
      const savedInvite = detail.invitations[0];
      setInviteHeadline(savedInvite?.headline || detail.title);
      setInviteMessage(savedInvite?.message || INVITATION_MESSAGE);
      setInviteTheme(savedInvite?.theme || "CLASSIC");
      setInvitePublicNotes(savedInvite?.publicNotes || "");
      setInviteDressCode(savedInvite?.dressCode || "");
      setInviteSupportName(savedInvite?.supportContactName || "");
      setInviteSupportPhone(savedInvite?.supportContactPhone || "");
      invitationDraftProject.current = id;
    }
    setData(detail);
    setSelected(id);
    setProjects((items) =>
      items.map((item) => (item.id === id ? { ...item, ...detail } : item)),
    );
    setEditProjectTitle(detail.title);
    setEditProjectKind(detail.kind);
    setEditProjectDate(luandaDateInput(detail.date));
    setEditProjectProvince(detail.province || "");
    setEditProjectBudget(
      detail.budgetLimit === null ? "" : String(detail.budgetLimit),
    );
    setEditProjectGuests(
      detail.guestEstimate ? String(detail.guestEstimate) : "",
    );
    setTables(await api<Table[]>(`/projects/${id}/tables`).catch(() => []));
    setFavorites(
      await api<ProjectVendorFavorite[]>(
        `/projects/${id}/vendors/favorites`,
      ).catch(() => []),
    );
  }, []);
  const applyPlanningDraft = useCallback(() => {
    setTitle("O nosso evento");
    setNewProjectKind("WEDDING");
    setProvince("");
    setWeddingDate("");
    setGuestEstimate("");
    setBudgetLimit("");
    const raw = sessionStorage.getItem("casar:planning-draft");
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      setProvince(draft.province || "");
      setWeddingDate(draft.date || "");
      setGuestEstimate(draft.guestEstimate ? String(draft.guestEstimate) : "");
      setBudgetLimit(
        draft.budgetLimit !== undefined ? String(draft.budgetLimit) : "",
      );
      setNewProjectKind(draftProjectKind(draft.kind ?? draft.eventType));
    } catch {
      sessionStorage.removeItem("casar:planning-draft");
    }
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const initialUrl = new URL(window.location.href);
        const requestedTab = tabFromUrl(initialUrl.searchParams.get("tab"));
        const requestedProjectId =
          initialUrl.searchParams.get("event") ||
          initialUrl.searchParams.get("projectId") ||
          "";
        if (requestedTab) setTab(requestedTab);
        const session = await api<{ user: User }>("/auth/me");
        setUser(session.user);
        const list = await api<Project[]>("/projects");
        setProjects(list);
        const requestedProject = list.find(
          (item) => item.id === requestedProjectId && !item.archivedAt,
        );
        const activeProject = list.find((item) => !item.archivedAt);
        const planningDraft = sessionStorage.getItem("casar:planning-draft");
        if (planningDraft) {
          setSelected("");
          setData(null);
          setTab("overview");
          applyPlanningDraft();
          setNotice("O teu roteiro está pronto. Confirma os dados e cria o evento para o guardar.");
        } else if (requestedProject || activeProject) {
          await loadDetail((requestedProject || activeProject)!.id);
        } else if (list.length) {
          setSelected("");
          setData(null);
          setTab("events");
        } else applyPlanningDraft();
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
        setNavigationReady(true);
      }
    })();
  }, [loadDetail, applyPlanningDraft]);

  useEffect(() => {
    if (!navigationReady) return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", DASHBOARD_TAB_URL[tab]);
    url.searchParams.delete("projectId");
    if (selected) url.searchParams.set("event", selected);
    else url.searchParams.delete("event");
    const target = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (firstUrlSync.current) {
      firstUrlSync.current = false;
      if (target !== current) window.history.replaceState(null, "", target);
      return;
    }
    if (target === current) return;
    if (skipUrlSync.current) return;
    window.history.pushState(null, "", target);
  }, [navigationReady, selected, tab]);

  useEffect(() => {
    function restoreDashboardLocation() {
      const url = new URL(window.location.href);
      const nextTab = tabFromUrl(url.searchParams.get("tab"));
      const nextProjectId =
        url.searchParams.get("event") || url.searchParams.get("projectId") || "";
      skipUrlSync.current = true;
      if (nextTab) setTab(nextTab);
      if (nextProjectId && nextProjectId !== selectedRef.current) {
        void loadDetail(nextProjectId).then(
          () => { skipUrlSync.current = false; },
          () => {
            skipUrlSync.current = false;
            setError("Não foi possível abrir o evento deste link.");
            setTab("events");
          },
        );
      } else if (!nextProjectId && selectedRef.current) {
        setSelected("");
        setData(null);
        queueMicrotask(() => { skipUrlSync.current = false; });
      } else {
        queueMicrotask(() => { skipUrlSync.current = false; });
      }
    }
    window.addEventListener("popstate", restoreDashboardLocation);
    return () => window.removeEventListener("popstate", restoreDashboardLocation);
  }, [loadDetail]);
  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const project = await api<Project>("/projects", {
        method: "POST",
        body: JSON.stringify({
          title,
          kind: newProjectKind,
          province: province || undefined,
          date: weddingDate ? luandaDateToIso(weddingDate) : undefined,
          budgetLimit: budgetLimit !== "" ? Number(budgetLimit) : undefined,
          guestEstimate: guestEstimate ? Number(guestEstimate) : undefined,
        }),
      });
      sessionStorage.removeItem("casar:planning-draft");
      setProjects((items) => [project, ...items]);
      await loadDetail(project.id);
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      if (returnTo) {
        const destination = new URL(returnTo, window.location.origin);
        if (
          destination.origin === window.location.origin &&
          destination.pathname.startsWith("/fornecedores/")
        ) {
          destination.searchParams.set("projectId", project.id);
          router.push(`${destination.pathname}${destination.search}${destination.hash}`);
          return;
        }
      }
      setTab("overview");
      setNotice("Evento criado. Agora podem organizar os próximos passos.");
    } catch (e) {
      setNotice("");
      setError(
        e instanceof Error ? e.message : "Não foi possível criar o evento.",
      );
    } finally {
      setBusy(false);
    }
  }
  function startNewProject() {
    applyPlanningDraft();
    setData(null);
    setTab("overview");
  }
  async function openProject(projectId: string) {
    if (projects.find((project) => project.id === projectId)?.archivedAt) {
      setTab("events");
      return;
    }
    await loadDetail(projectId);
    setTab("overview");
  }
  async function changeTask(
    task: Task,
    status: Task["status"] = task.status === "DONE" ? "TODO" : "DONE",
  ) {
    try {
      await api(`/projects/${selected}/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadDetail(selected);
      setNotice("Estado da tarefa actualizado.");
    } catch (e) {
      setNotice("");
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível actualizar a tarefa.",
      );
    }
  }
  async function createBoardTask(taskTitle: string, status: Task["status"]) {
    try {
      await api(`/projects/${selected}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: taskTitle,
          status,
          category: "Planeamento",
          priority: "NORMAL",
        }),
      });
      await loadDetail(selected);
      setNotice("Tarefa adicionada à coluna.");
      return true;
    } catch (e) {
      setNotice("");
      setError(
        e instanceof Error ? e.message : "Não foi possível criar a tarefa.",
      );
      return false;
    }
  }
  async function saveBoardTask(taskId: string, update: TaskUpdate) {
    try {
      await api(`/projects/${selected}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(update),
      });
      await loadDetail(selected);
      setNotice("Tarefa actualizada no quadro.");
      return true;
    } catch (e) {
      setNotice("");
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível actualizar a tarefa.",
      );
      return false;
    }
  }
  async function addTask(event: FormEvent) {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    try {
      const payload = {
        title: taskTitle.trim(),
        category: taskCategory,
        priority: taskPriority,
        dueAt: taskDue ? luandaDateToIso(taskDue) : null,
        assigneeName: taskAssignee || null,
        assigneeUserId: taskAssigneeUserId || null,
      };
      await api(
        `/projects/${selected}/tasks${editingTaskId ? `/${editingTaskId}` : ""}`,
        {
          method: editingTaskId ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );
      setTaskTitle("");
      setTaskDue("");
      setTaskAssignee("");
      setTaskAssigneeUserId("");
      setTaskCategory("Planeamento");
      setTaskPriority("NORMAL");
      setEditingTaskId("");
      await loadDetail(selected);
      setNotice("Tarefa guardada.");
    } catch (e) {
      setNotice("");
      setError(
        e instanceof Error ? e.message : "Não foi possível guardar a tarefa.",
      );
    }
  }
  function editTask(task: Task) {
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    setTaskDue(luandaDateInput(task.dueAt));
    setTaskAssignee(task.assigneeUserId ? "" : task.assigneeName || "");
    setTaskAssigneeUserId(task.assigneeUserId || "");
    setTaskCategory(task.category || "Planeamento");
    setTaskPriority(task.priority || "NORMAL");
  }
  function prepareTaskExpense(task: Task) {
    setExpenseTitle(`Despesa: ${task.title}`);
    setExpenseCategory(
      EXPENSE_CATEGORIES.includes(task.category) ? task.category : "Outros",
    );
    setExpenseTaskId(task.id);
    setExpenseDueAt("");
    setEditingExpenseId("");
    setTab("budget");
  }
  function resetEventForm() {
    setEditingEventId("");
    setEventTitle("");
    setEventType("CIVIL");
    setEventDate("");
    setEventVenue("");
    setEventAddress("");
    setEventMapsUrl("");
    setEventGuestNotes("");
    setEventShowToGuests(true);
    setShowEventForm(false);
  }
  async function deleteTask(taskId: string) {
    if (!window.confirm("Eliminar esta tarefa?")) return;
    try {
      await api(`/projects/${selected}/tasks/${taskId}`, { method: "DELETE" });
      await loadDetail(selected);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível eliminar a tarefa.",
      );
    }
  }
  async function addEvent(event: FormEvent) {
    event.preventDefault();
    try {
      const payload = {
        type: eventType,
        title: eventTitle,
        startsAt: eventDate ? luandaDateTimeToIso(eventDate) : null,
        venue: eventVenue || null,
        address: eventAddress || null,
        mapsUrl: eventMapsUrl || null,
        guestNotes: eventGuestNotes || null,
        showToGuests: eventShowToGuests,
      };
      await api(
        `/projects/${selected}/events${editingEventId ? `/${editingEventId}` : ""}`,
        {
          method: editingEventId ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );
      resetEventForm();
      await loadDetail(selected);
      setNotice("Momento guardado no programa.");
    } catch (e) {
      setNotice("");
      setError(
        e instanceof Error ? e.message : "Não foi possível guardar o momento.",
      );
    }
  }
  function editEvent(item: Detail["events"][number]) {
    setProgramView("moments");
    setShowEventForm(true);
    setEditingEventId(item.id);
    setEventTitle(item.title);
    setEventType(item.type);
    setEventDate(luandaDateTimeInput(item.startsAt));
    setEventVenue(item.venue || "");
    setEventAddress(item.address || "");
    setEventMapsUrl(item.mapsUrl || "");
    setEventGuestNotes(item.guestNotes || "");
    setEventShowToGuests(item.showToGuests);
  }
  async function deleteEvent(eventId: string) {
    if (!window.confirm("Eliminar este momento do programa?")) return;
    try {
      await api(`/projects/${selected}/events/${eventId}`, {
        method: "DELETE",
      });
      await loadDetail(selected);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível eliminar o momento.",
      );
    }
  }
  async function addMember(event: FormEvent) {
    event.preventDefault();
    const isExisting = data?.members.some(
      (member) =>
        member.user.email.toLowerCase() === memberEmail.trim().toLowerCase(),
    );
    setMemberActionId("new");
    try {
      await api(`/projects/${selected}/members`, {
        method: "POST",
        body: JSON.stringify({ email: memberEmail, role: memberRole }),
      });
      setMemberEmail("");
      await loadDetail(selected);
      setNotice(
        isExisting
          ? "Nível de acesso actualizado."
          : "Acesso concedido imediatamente. A pessoa pode entrar na própria conta; não foi enviado email.",
      );
    } catch (e) {
      setNotice("");
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível adicionar esta pessoa.",
      );
    } finally {
      setMemberActionId("");
    }
  }
  async function changeMemberRole(
    member: Detail["members"][number],
    role: string,
  ) {
    setMemberActionId(member.user.id);
    try {
      await api(`/projects/${selected}/members`, {
        method: "POST",
        body: JSON.stringify({ email: member.user.email, role }),
      });
      await loadDetail(selected);
      setNotice(
        `Acesso de ${member.user.name || member.user.email} actualizado.`,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível alterar o acesso.",
      );
    } finally {
      setMemberActionId("");
    }
  }
  async function removeMember(member: Detail["members"][number]) {
    const label = member.user.name || member.user.email;
    if (!window.confirm(`Remover o acesso de ${label} a este evento?`)) return;
    setMemberActionId(member.user.id);
    try {
      await api(`/projects/${selected}/members/${member.user.id}`, {
        method: "DELETE",
      });
      await loadDetail(selected);
      setNotice(`O acesso de ${label} foi removido.`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível remover o acesso.",
      );
    } finally {
      setMemberActionId("");
    }
  }
  function resetExpenseForm() {
    setExpenseTitle("");
    setExpenseAmount("");
    setExpenseCategory("Outros");
    setExpenseStatus("ESTIMATED");
    setExpenseDueAt("");
    setExpenseTaskId("");
    setEditingExpenseId("");
  }
  async function addExpense(event: FormEvent) {
    event.preventDefault();
    try {
      const payload = {
        title: expenseTitle,
        category: expenseCategory,
        amount: Number(expenseAmount),
        status: expenseStatus,
        dueAt: expenseDueAt ? luandaDateToIso(expenseDueAt) : null,
        taskId: expenseTaskId || null,
      };
      await api(
        `/projects/${selected}/budget/expenses${editingExpenseId ? `/${editingExpenseId}` : ""}`,
        {
          method: editingExpenseId ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );
      resetExpenseForm();
      await loadDetail(selected);
      setNotice("Despesa guardada.");
    } catch (e) {
      setNotice("");
      setError(
        e instanceof Error ? e.message : "Não foi possível guardar a despesa.",
      );
    }
  }
  function editExpense(expense: Expense) {
    setEditingExpenseId(expense.id);
    setExpenseTitle(expense.title);
    setExpenseAmount(String(expense.amount));
    setExpenseCategory(expense.category);
    setExpenseStatus(expense.status);
    setExpenseDueAt(luandaDateInput(expense.dueAt));
    setExpenseTaskId(expense.taskId || "");
  }
  function openExpenseTask(taskId: string) {
    const task = data?.tasks.find((item) => item.id === taskId);
    if (!task) return;
    setTaskView("list");
    editTask(task);
    setTab("planning");
  }
  async function deleteExpense(expenseId: string) {
    if (!window.confirm("Eliminar esta despesa?")) return;
    try {
      await api(`/projects/${selected}/budget/expenses/${expenseId}`, {
        method: "DELETE",
      });
      await loadDetail(selected);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível eliminar a despesa.",
      );
    }
  }
  async function saveProject(event: FormEvent) {
    event.preventDefault();
    if (savingProjectSettings) return;
    setSavingProjectSettings(true);
    try {
      await api(`/projects/${selected}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editProjectTitle,
          kind: editProjectKind,
          date: editProjectDate ? luandaDateToIso(editProjectDate) : null,
          province: editProjectProvince || null,
          budgetLimit:
            editProjectBudget === "" ? null : Number(editProjectBudget),
          guestEstimate:
            editProjectGuests === "" ? null : Number(editProjectGuests),
        }),
      });
      await loadDetail(selected);
      setNotice("Dados do projecto actualizados.");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível actualizar o projecto.",
      );
    } finally {
      setSavingProjectSettings(false);
    }
  }
  async function archiveProject() {
    if (!data || !canManageTeam || archivingProject) return;
    const confirmed = window.confirm(
      `Arquivar “${data.title}”? O evento deixa de aparecer entre os activos. Os dados ficam guardados e podes restaurá-lo em Os meus eventos.`,
    );
    if (!confirmed) return;
    setArchivingProject(true);
    try {
      await api(`/projects/${selected}/archive`, {
        method: "PATCH",
        body: JSON.stringify({ archived: true }),
      });
      setProjects(await api<Project[]>("/projects"));
      setData(null);
      setSelected("");
      setTab("events");
      setNotice("Evento arquivado. Podes restaurá-lo em Os meus eventos.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível arquivar o evento.",
      );
    } finally {
      setArchivingProject(false);
    }
  }
  async function restoreProject(projectId: string) {
    setRestoringProjectId(projectId);
    try {
      await api(`/projects/${projectId}/archive`, {
        method: "PATCH",
        body: JSON.stringify({ archived: false }),
      });
      setProjects(await api<Project[]>("/projects"));
      setNotice("Evento restaurado. Já podes voltar a gerir o plano.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível restaurar o evento.",
      );
    } finally {
      setRestoringProjectId("");
    }
  }
  async function removeFavorite(vendorId: string) {
    try {
      await api(`/projects/${selected}/vendors/favorites/${vendorId}`, {
        method: "DELETE",
      });
      setFavorites((items) =>
        items.filter((item) => item.vendor.id !== vendorId),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível actualizar favoritos.",
      );
    }
  }
  async function downloadQr(value: string, fileName: string) {
    try {
      const image = await QRCode.toDataURL(value, {
        width: 560,
        margin: 2,
        color: { dark: "#173b29", light: "#ffffff" },
      });
      const link = document.createElement("a");
      link.href = image;
      link.download = fileName;
      link.click();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível gerar o QR Code.",
      );
    }
  }
  async function publish() {
    if (!data) return;
    setPublishingInvite(true);
    try {
      await api(`/projects/${selected}/invitations`, {
        method: "POST",
        body: JSON.stringify({
          headline: inviteHeadline.trim() || data?.title,
          message: inviteMessage.trim() || INVITATION_MESSAGE,
          theme: inviteTheme,
          publicNotes: invitePublicNotes.trim() || null,
          dressCode: inviteDressCode.trim() || null,
          supportContactName: inviteSupportName.trim() || null,
          supportContactPhone: inviteSupportPhone.trim() || null,
        }),
      });
      await loadDetail(selected);
      setNotice("Convite publicado ou actualizado.");
    } catch (e) {
      setNotice("");
      setError(
        e instanceof Error ? e.message : "Não foi possível publicar o convite.",
      );
    } finally {
      setPublishingInvite(false);
    }
  }
  async function copyInvitationLink(slug: string) {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/c/${slug}`,
      );
      setNotice(
        "Link geral copiado. Partilha-o manualmente com os convidados.",
      );
    } catch {
      setError(
        "Não foi possível copiar o link. Abre a pré-visualização e copia o endereço.",
      );
    }
  }
  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/entrar");
  }
  function openNotification(href: string) {
    const destination = new URL(href, window.location.origin);
    if (destination.origin !== window.location.origin || destination.pathname !== "/dashboard") return;
    const nextTab = tabFromUrl(destination.searchParams.get("tab"));
    const nextProjectId = destination.searchParams.get("event") || "";
    window.history.pushState(null, "", `${destination.pathname}${destination.search}${destination.hash}`);
    if (nextTab) setTab(nextTab);
    if (nextProjectId && nextProjectId !== selectedRef.current) {
      void loadDetail(nextProjectId).catch(() => setError("Não foi possível abrir o evento desta notificação."));
    } else if (!nextProjectId && selectedRef.current) {
      setSelected("");
      setData(null);
    }
  }
  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (changingPassword) return;
    setChangingPassword(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: oldPassword, newPassword }),
      });
      setOldPassword("");
      setNewPassword("");
      setError("");
      setNotice(
        "Palavra-passe actualizada. As outras sessões foram terminadas.",
      );
    } catch (e) {
      setNotice("");
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível alterar a palavra-passe.",
      );
    } finally {
      setChangingPassword(false);
    }
  }
  async function exportData() {
    if (exportingData) return;
    setExportingData(true);
    try {
      const content = await api<unknown>("/auth/export");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(content, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "nuvia-dados.json";
      link.click();
      URL.revokeObjectURL(url);
      setError("");
      setNotice("A exportação dos teus dados foi descarregada.");
    } catch (e) {
      setNotice("");
      setError(
        e instanceof Error ? e.message : "Não foi possível exportar os dados.",
      );
    } finally {
      setExportingData(false);
    }
  }
  async function deleteAccount(event: FormEvent) {
    event.preventDefault();
    if (deletingAccount || deleteConfirmation !== "ELIMINAR" || !deletePassword) return;
    setDeletingAccount(true);
    try {
      await api("/auth/me", {
        method: "DELETE",
        body: JSON.stringify({
          password: deletePassword,
          confirmation: deleteConfirmation,
        }),
      });
      router.push("/");
    } catch (e) {
      setNotice("");
      setError(
        e instanceof Error ? e.message : "Não foi possível eliminar a conta.",
      );
    } finally {
      setDeletingAccount(false);
    }
  }
  const nextStep = data
    ? (() => {
        if (!data.date)
          return {
            title: "Escolhe uma data para o evento",
            description:
              "Se ainda não houver uma data certa, regista uma previsão ou deixa por decidir.",
            action: "Completar dados",
            tab: "settings" as Tab,
          };
        if (data.budgetLimit === null)
          return {
            title: "Define um limite de orçamento",
            description:
              "Podes alterar esta estimativa quando tiverem mais informação.",
            action: "Definir orçamento",
            tab: "settings" as Tab,
          };
        if (data.guests.length === 0)
          return {
            title: "Começa a lista de participantes",
            description:
              "Regista pessoas, famílias e acompanhantes para estimar lugares.",
            action: "Adicionar pessoas",
            tab: "guests" as Tab,
          };
        if (!data.events.length)
          return {
            title: "Adiciona os momentos do evento",
            description:
              "Cerimónia, alambamento, festa ou outros momentos podem ter horário e local próprios.",
            action: "Montar programa",
            tab: "program" as Tab,
          };
        if (!data.invitations.length)
          return {
            title: "Prepara a página do convite",
            description:
              "Personaliza a mensagem e partilha links individuais de confirmação.",
            action: "Criar convite",
            tab: "invitation" as Tab,
          };
        const task = data.tasks.find((item) => item.status !== "DONE");
        if (task)
          return {
            title: task.title,
            description: "Uma tarefa pendente do teu roteiro.",
            action: "Abrir planeamento",
            tab: "planning" as Tab,
          };
        return {
          title: "O plano está em dia",
          description:
            "Revejam as confirmações, despesas e próximos momentos quando houver novidades.",
          action: "Ver relatório",
          tab: "reports" as Tab,
        };
      })()
    : null;
  const confirmedGuests =
    data?.guests.reduce(
      (total, guest) =>
        total +
        guest.rsvps
          .filter((rsvp) => rsvp.status === "ACCEPTED")
          .reduce((sum, rsvp) => sum + rsvp.partySize, 0),
      0,
    ) ?? 0;
  const declinedGuests =
    data?.guests.filter((guest) =>
      guest.rsvps.some((rsvp) => rsvp.status === "DECLINED"),
    ).length ?? 0;
  const guestsWithoutReply =
    data?.guests.filter(
      (guest) =>
        !guest.rsvps.some(
          (rsvp) => rsvp.status === "ACCEPTED" || rsvp.status === "DECLINED",
        ),
    ).length ?? 0;
  const todayInLuanda = luandaTodayDateInput();
  const currentMemberRole = data?.members.find(
    (member) => member.user.id === user?.id,
  )?.role;
  const canManageTeam = currentMemberRole === "OWNER";
  const projectSettingsChanged = Boolean(
    data &&
      (editProjectTitle !== data.title ||
        editProjectKind !== data.kind ||
        editProjectDate !== luandaDateInput(data.date) ||
        editProjectProvince !== (data.province || "") ||
        editProjectBudget !==
          (data.budgetLimit === null ? "" : String(data.budgetLimit)) ||
        editProjectGuests !==
          (data.guestEstimate ? String(data.guestEstimate) : "")),
  );
  const tasksWithDeadlines = (data?.tasks || []).filter(
    (task) => task.dueAt && task.status !== "DONE",
  );
  const overdueTasks = tasksWithDeadlines
    .filter((task) => luandaDateInput(task.dueAt) < todayInLuanda)
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
  const upcomingTasks = tasksWithDeadlines
    .filter((task) => luandaDateInput(task.dueAt) >= todayInLuanda)
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
  const savedInvitation = data?.invitations[0];
  const displayedInvitationHeadline =
    inviteHeadline.trim() || data?.title || "O nosso evento";
  const displayedInvitationMessage = inviteMessage.trim() || INVITATION_MESSAGE;
  const signInReturnPath = `/dashboard?tab=${DASHBOARD_TAB_URL[tab]}${selected ? `&event=${encodeURIComponent(selected)}` : ""}`;
  const invitationHasChanges = savedInvitation
    ? displayedInvitationHeadline !==
        (savedInvitation.headline || data?.title) ||
      displayedInvitationMessage !==
        (savedInvitation.message || INVITATION_MESSAGE) ||
      inviteTheme !== (savedInvitation.theme || "CLASSIC")
      || invitePublicNotes.trim() !== (savedInvitation.publicNotes || "")
      || inviteDressCode.trim() !== (savedInvitation.dressCode || "")
      || inviteSupportName.trim() !== (savedInvitation.supportContactName || "")
      || inviteSupportPhone.trim() !== (savedInvitation.supportContactPhone || "")
    : false;
  if (loading)
    return <main className="dashboard-loading">A preparar o teu espaço…</main>;
  if (!user)
    return (
      <main className="dashboard-loading">
        <section className="auth-card">
          <p className="eyebrow">O teu espaço</p>
          <h1>Entra para continuar</h1>
          <p className="auth-copy">
            Acede ao painel ou cria uma conta gratuita para guardar o teu plano.
          </p>
          <a className="button button-primary" href={`/entrar?next=${encodeURIComponent(signInReturnPath)}`}>
            Entrar
          </a>
          <a className="button button-outline" href={`/criar-conta?next=${encodeURIComponent(signInReturnPath)}`}>
            Criar conta
          </a>
          <a className="planner-back" href="/">
            ← Voltar ao início
          </a>
        </section>
      </main>
    );
  return (
    <main className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <a className="brand dashboard-brand" href="/dashboard" aria-label="Nuvia — voltar à dashboard">
          <Image className="nuvia-dashboard-logo" src="/brand/nuvia-logo.png" alt="Nuvia" width={240} height={75} priority />
        </a>
        <NotificationCenter onOpen={openNotification} />
        <nav aria-label="Navegação do projecto">
          {DASHBOARD_TABS.filter(
            (item) => item.key !== "events" || projects.length > 0,
          ).map((item) => (
            <button
              className={tab === item.key ? "current" : ""}
              aria-current={tab === item.key ? "page" : undefined}
              onClick={() => setTab(item.key)}
              key={item.key}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        {(user.role === "ADMIN" || user.role === "MODERATOR") && (
          <a className="sidebar-admin-link" href="/admin">
            <span aria-hidden="true">⚙</span>
            Administração
            <span aria-hidden="true">↗</span>
          </a>
        )}
        <a className="sidebar-vendor-link" href="/fornecedor/gestao">
          Sou fornecedor · Gerir perfil <span aria-hidden="true">↗</span>
        </a>
        <a className="sidebar-public-link" href="/" target="_blank" rel="noreferrer">
          Ver site público <span aria-hidden="true">↗</span>
        </a>
        <div className="sidebar-user">
          <span className="user-avatar" aria-hidden="true">
            {(user.name || user.email).slice(0, 1).toUpperCase()}
          </span>
          <div className="sidebar-user-info">
            <strong>{user.name || user.email}</strong>
            <button onClick={() => void logout()}>Terminar sessão</button>
          </div>
        </div>
      </aside>
      <section className="dashboard-main">
        {error && (
          <div className="dashboard-error" role="alert">
            {error}
            <button
              onClick={() => {
                setError("");
                setNotice("");
              }}
            >
              ×
            </button>
          </div>
        )}
        {!error && notice && (
          <div className="dashboard-notice" role="status">
            {notice}
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}
        {!data ? (
          tab === "events" && projects.length > 0 ? (
            <EventManager
              projects={projects}
              activeId={selected}
              onOpen={(id) => void openProject(id)}
              onCreate={startNewProject}
              onRestore={(id) => void restoreProject(id)}
              restoringId={restoringProjectId}
            />
          ) : (
            <form className="create-wedding-card" onSubmit={submitCreate}>
              <p className="eyebrow">Um primeiro passo simples</p>
              <h1>Vamos organizar o teu evento.</h1>
              <p>
                O tipo identifica o projecto completo. Depois podes acrescentar
                cerimónia civil, alambamento, recepção ou outros momentos no
                programa.
              </p>
              <label>
                Nome do projecto
                <input
                  required
                  minLength={2}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Casamento da Ana e do Miguel"
                />
              </label>
              <fieldset className="project-kind-fieldset">
                <legend>Tipo de projecto</legend>
                <div className="project-kind-options">
                  {PROJECT_KINDS.map((item) => (
                    <label
                      className={`project-kind-option ${newProjectKind === item.value ? "selected" : ""}`}
                      key={item.value}
                    >
                      <input
                        type="radio"
                        name="newProjectKind"
                        value={item.value}
                        checked={newProjectKind === item.value}
                        onChange={() => setNewProjectKind(item.value)}
                      />
                      <span
                        className="project-kind-option-icon"
                        aria-hidden="true"
                      >
                        {item.icon}
                      </span>
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="planner-fields">
                <label>
                  Província
                  <select
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                  >
                    <option value="">Por decidir</option>
                    {ANGOLA_PROVINCES.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Data, se já souberem
                  <input
                    type="date"
                    value={weddingDate}
                    onChange={(e) => setWeddingDate(e.target.value)}
                  />
                </label>
              </div>
              <div className="planner-fields">
                <label>
                  Orçamento máximo (opcional, Kz)
                  <input
                    type="number"
                    min="0"
                    value={budgetLimit}
                    onChange={(e) => setBudgetLimit(e.target.value)}
                    placeholder="Não definido"
                  />
                </label>
                <label>
                  Participantes estimados (opcional)
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={guestEstimate}
                    onChange={(e) => setGuestEstimate(e.target.value)}
                    placeholder="Ainda não sabemos"
                  />
                </label>
              </div>
              <div className="create-project-actions">
                <button className="button button-primary" disabled={busy}>
                  {busy ? "A criar…" : "Criar projecto →"}
                </button>
                {projects.length > 0 && (
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => {
                      sessionStorage.removeItem("casar:planning-draft");
                      const activeProject = projects.find(
                        (project) => !project.archivedAt,
                      );
                      if (activeProject) {
                        void loadDetail(activeProject.id).then(() =>
                          setTab("events"),
                        );
                      } else {
                        setTab("events");
                      }
                    }}
                  >
                    Cancelar e voltar aos eventos
                  </button>
                )}
              </div>
            </form>
          )
        ) : (
          <>
            {tab === "events" ? (
              <EventManager
                projects={projects}
                activeId={selected}
                onOpen={(id) => void openProject(id)}
                onCreate={startNewProject}
                onRestore={(id) => void restoreProject(id)}
                restoringId={restoringProjectId}
              />
            ) : (
              <header className="dashboard-top">
                <div>
                  <p className="eyebrow">O vosso evento</p>
                  <span className={`project-kind-badge ${data.kind}`}>
                    <i aria-hidden="true">{projectKindIcon(data.kind)}</i>
                    {projectKindLabel(data.kind)}
                  </span>
                  <h1>{data.title}</h1>
                  <p>
                    {date(data.date)}
                    {data.province ? ` · ${data.province}` : ""}
                  </p>
                </div>
                <div className="dashboard-top-actions">
                  <button
                    className="button button-outline compact"
                    onClick={() => setTab("events")}
                  >
                    Mudar de evento
                  </button>
                  <button
                    className="button button-primary compact"
                    onClick={startNewProject}
                  >
                    + Novo evento
                  </button>
                </div>
              </header>
            )}
            {tab === "events" ? null : (
              <>
                {tab === "overview" && (
                  <>
                    <section className="next-step-card">
                      <div>
                        <p className="eyebrow">Próximo passo</p>
                        <h2>{nextStep?.title}</h2>
                        <p>{nextStep?.description}</p>
                      </div>
                      <button
                        className="button button-primary"
                        onClick={() => setTab(nextStep?.tab ?? "planning")}
                      >
                        {nextStep?.action} →
                      </button>
                    </section>
                    <section className="metrics-grid">
                      <article className="metric-card metric-budget">
                        <div className="metric-card-label">
                          <small>Orçamento máximo</small>
                        </div>
                        <strong>
                          {data.budgetLimit !== null
                            ? formatAOA(data.budgetLimit)
                            : "Por definir"}
                        </strong>
                        <span>{formatAOA(data.metrics.totalPaid)} pagos</span>
                      </article>
                      <article className="metric-card metric-guests">
                        <div className="metric-card-label">
                          <small>Convidados</small>
                        </div>
                        <strong>
                          {data.metrics.guests}
                          {data.guestEstimate
                            ? ` / ~${data.guestEstimate}`
                            : ""}
                        </strong>
                        <span>
                          {confirmedGuests} confirmados · {guestsWithoutReply}{" "}
                          sem resposta
                        </span>
                      </article>
                      <article className="metric-card metric-tasks">
                        <div className="metric-card-label">
                          <small>Tarefas concluídas</small>
                        </div>
                        <strong>
                          {data.metrics.tasksDone} / {data.metrics.tasksTotal}
                        </strong>
                        <div
                          className="dashboard-progress"
                          role="progressbar"
                          aria-label="Tarefas concluídas"
                          aria-valuemin={0}
                          aria-valuemax={data.metrics.tasksTotal || 1}
                          aria-valuenow={data.metrics.tasksDone}
                        >
                          <span
                            style={{
                              width: `${data.metrics.tasksTotal ? Math.round((data.metrics.tasksDone / data.metrics.tasksTotal) * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <span>
                          {data.metrics.tasksTotal
                            ? Math.round(
                                (data.metrics.tasksDone /
                                  data.metrics.tasksTotal) *
                                  100,
                              )
                            : 0}
                          % concluído
                        </span>
                      </article>
                      <article className="metric-card metric-expenses">
                        <div className="metric-card-label">
                          <small>Despesas contratadas ou pagas</small>
                        </div>
                        <strong>{formatAOA(data.metrics.totalCommitted)}</strong>
                        <span>
                          {formatAOA(data.metrics.totalPaid)} pagos ·{" "}
                          {formatAOA(
                            data.metrics.totalCommitted -
                              data.metrics.totalPaid,
                          )}{" "}
                          por pagar
                        </span>
                      </article>
                    </section>
                    <div className="dashboard-panels">
                      <section className="dash-panel">
                        <div className="panel-title">
                          <h2>Próximas tarefas</h2>
                          <button onClick={() => setTab("planning")}>
                            Ver planeamento →
                          </button>
                        </div>
                        {data.tasks
                          .filter((t) => t.status !== "DONE")
                          .slice(0, 5)
                          .map((t) => (
                            <label className="task-row" key={t.id}>
                              <input
                                type="checkbox"
                                checked={t.status === "DONE"}
                                onChange={() => void changeTask(t)}
                              />
                              <span>{t.title}</span>
                            </label>
                          ))}
                        {!data.tasks.length && (
                          <div className="dashboard-empty">
                            <p>Ainda não há tarefas no plano.</p>
                            <button
                              className="button button-outline"
                              onClick={() => setTab("planning")}
                            >
                              Criar primeira tarefa
                            </button>
                          </div>
                        )}
                      </section>
                      <section className="dash-panel">
                        <div className="panel-title">
                          <h2>Próximos momentos</h2>
                          <button onClick={() => setTab("planning")}>
                            Gerir →
                          </button>
                        </div>
                        {data.events.length ? (
                          data.events.map((e) => (
                            <p className="event-row" key={e.id}>
                              {e.title}
                              <small>{date(e.startsAt)}</small>
                            </p>
                          ))
                        ) : (
                          <div className="dashboard-empty">
                            <p>Ainda não adicionaram momentos.</p>
                            <button
                              className="button button-outline"
                              onClick={() => setTab("planning")}
                            >
                              Adicionar momento
                            </button>
                          </div>
                        )}
                      </section>
                    </div>
                  </>
                )}
                {tab === "team" && (
                  <section className="dash-panel wide-panel team-panel">
                    <div className="panel-title">
                      <div>
                        <p className="eyebrow">Acesso ao evento</p>
                        <h2>Colaboração e acessos</h2>
                        <p className="empty-copy">
                          {data.members.length}{" "}
                          {data.members.length === 1
                            ? "pessoa tem"
                            : "pessoas têm"}{" "}
                          acesso a este evento.
                        </p>
                      </div>
                    </div>
                    {!canManageTeam && (
                      <div className="team-access-note">
                        <strong>
                          O teu acesso:{" "}
                          {currentMemberRole === "EDITOR"
                            ? "podes editar"
                            : "só consulta"}
                          .
                        </strong>
                        <span>
                          Apenas a pessoa responsável pelo evento pode
                          adicionar, alterar ou remover acessos.
                        </span>
                      </div>
                    )}
                    <div className="team-member-list">
                      {data.members.map((member) => (
                        <article
                          className="team-member-row"
                          key={member.user.id}
                        >
                          <div className="team-member-identity">
                            <span
                              className="team-member-avatar"
                              aria-hidden="true"
                            >
                              {(member.user.name || member.user.email)
                                .slice(0, 1)
                                .toUpperCase()}
                            </span>
                            <div>
                              <strong>
                                {member.user.name || member.user.email}
                              </strong>
                              {member.user.name && (
                                <small>{member.user.email}</small>
                              )}
                            </div>
                            {member.user.id === user?.id && (
                              <span className="team-you-badge">Tu</span>
                            )}
                          </div>
                          {canManageTeam && member.role !== "OWNER" ? (
                            <div className="team-member-controls">
                              <label>
                                <span className="sr-only">
                                  Nível de acesso de{" "}
                                  {member.user.name || member.user.email}
                                </span>
                                <select
                                  aria-label={`Nível de acesso de ${member.user.name || member.user.email}`}
                                  value={member.role}
                                  disabled={memberActionId === member.user.id}
                                  onChange={(event) =>
                                    void changeMemberRole(
                                      member,
                                      event.target.value,
                                    )
                                  }
                                >
                                  <option value="VIEWER">Só consulta</option>
                                  <option value="EDITOR">Pode editar</option>
                                </select>
                              </label>
                              <button
                                className="team-remove-button"
                                disabled={memberActionId === member.user.id}
                                onClick={() => void removeMember(member)}
                              >
                                {memberActionId === member.user.id
                                  ? "A guardar…"
                                  : "Remover"}
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`team-role-badge ${member.role.toLowerCase()}`}
                            >
                              {member.role === "OWNER"
                                ? "Responsável pelo evento"
                                : member.role === "EDITOR"
                                  ? "Pode editar"
                                  : "Só consulta"}
                            </span>
                          )}
                        </article>
                      ))}
                    </div>
                    {canManageTeam && (
                      <div className="team-manage-section">
                        <div>
                          <h3>Adicionar ou actualizar acesso</h3>
                          <p>
                            Adiciona uma pessoa que já tenha conta. Se já fizer
                            parte da equipa, podes actualizar o nível de acesso
                            aqui.
                          </p>
                        </div>
                        <div className="team-permission-guide">
                          <div>
                            <strong>Só consulta</strong>
                            <span>
                              Vê o evento e os seus dados, sem poder alterar
                              registos.
                            </span>
                          </div>
                          <div>
                            <strong>Pode editar</strong>
                            <span>Altera o plano e os registos do evento.</span>
                          </div>
                        </div>
                        <form className="team-add-form" onSubmit={addMember}>
                          <label>
                            Email da pessoa
                            <input
                              type="email"
                              required
                              value={memberEmail}
                              onChange={(e) => setMemberEmail(e.target.value)}
                              placeholder="nome@exemplo.com"
                            />
                          </label>
                          <label>
                            Nível de acesso
                            <select
                              value={memberRole}
                              onChange={(e) => setMemberRole(e.target.value)}
                            >
                              <option value="VIEWER">Só consulta</option>
                              <option value="EDITOR">Pode editar</option>
                            </select>
                          </label>
                          <button
                            className="button button-primary compact"
                            disabled={memberActionId === "new"}
                          >
                            {memberActionId === "new"
                              ? "A guardar…"
                              : data.members.some(
                                    (member) =>
                                      member.user.email.toLowerCase() ===
                                      memberEmail.trim().toLowerCase(),
                                  )
                                ? "Actualizar acesso"
                                : "Conceder acesso"}
                          </button>
                        </form>
                        <small className="private-note">
                          A pessoa tem de ter conta antes de ser adicionada. O
                          acesso fica activo assim que guardares. A plataforma
                          não envia email ou convite; avisa a pessoa por outro
                          canal para entrar.
                        </small>
                      </div>
                    )}
                  </section>
                )}
                {tab === "planning" && (
                  <section className="dash-panel wide-panel task-planning-panel">
                    <div className="panel-title">
                      <div>
                        <p className="eyebrow">Organização do evento</p>
                        <h2>Quadro de tarefas</h2>
                        <p className="empty-copy">
                          Atribui responsáveis e prazos. Quando houver um custo,
                          cria a despesa a partir do cartão para manter a
                          categoria alinhada.
                        </p>
                      </div>
                      <span>
                        {data.metrics.tasksDone}/{data.metrics.tasksTotal}{" "}
                        concluídas
                      </span>
                    </div>
                    <form
                      className="inline-form task-form task-create-form"
                      onSubmit={addTask}
                    >
                      <input
                        className="task-title-input"
                        value={taskTitle}
                        onChange={(e) => setTaskTitle(e.target.value)}
                        placeholder="Ex.: Reservar o espaço"
                        required
                      />
                      <select
                        aria-label="Categoria da tarefa"
                        value={taskCategory}
                        onChange={(e) => setTaskCategory(e.target.value)}
                      >
                        {TASK_CATEGORIES.map((category) => (
                          <option key={category}>{category}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Prioridade"
                        value={taskPriority}
                        onChange={(e) =>
                          setTaskPriority(e.target.value as Task["priority"])
                        }
                      >
                        <option value="LOW">Prioridade baixa</option>
                        <option value="NORMAL">Prioridade normal</option>
                        <option value="HIGH">Prioridade alta</option>
                      </select>
                      <input
                        type="date"
                        aria-label="Prazo"
                        value={taskDue}
                        onChange={(e) => setTaskDue(e.target.value)}
                      />
                      <select
                        aria-label="Atribuir a membro"
                        value={taskAssigneeUserId}
                        onChange={(e) => {
                          setTaskAssigneeUserId(e.target.value);
                          if (e.target.value) setTaskAssignee("");
                        }}
                      >
                        <option value="">Sem membro atribuído</option>
                        {data.members.map((member) => (
                          <option key={member.user.id} value={member.user.id}>
                            {member.user.name || member.user.email}
                          </option>
                        ))}
                      </select>
                      <input
                        value={taskAssignee}
                        onChange={(e) => {
                          setTaskAssignee(e.target.value);
                          if (e.target.value) setTaskAssigneeUserId("");
                        }}
                        placeholder="Outro responsável (opcional)"
                      />
                      <button className="button button-primary compact">
                        {editingTaskId
                          ? "Guardar alterações"
                          : "Adicionar tarefa"}
                      </button>
                      {editingTaskId && (
                        <button
                          type="button"
                          className="button button-outline compact"
                          onClick={() => {
                            setEditingTaskId("");
                            setTaskTitle("");
                            setTaskDue("");
                            setTaskAssignee("");
                            setTaskAssigneeUserId("");
                            setTaskCategory("Planeamento");
                            setTaskPriority("NORMAL");
                          }}
                        >
                          Cancelar
                        </button>
                      )}
                    </form>
                    <div
                      className="task-view-controls"
                      role="group"
                      aria-label="Modo de visualização"
                    >
                      <button
                        type="button"
                        className={taskView === "board" ? "selected" : ""}
                        aria-pressed={taskView === "board"}
                        onClick={() => setTaskView("board")}
                      >
                        Quadro
                      </button>
                      <button
                        type="button"
                        className={taskView === "list" ? "selected" : ""}
                        aria-pressed={taskView === "list"}
                        onClick={() => setTaskView("list")}
                      >
                        Lista
                      </button>
                    </div>
                    {taskView === "board" ? (
                      <TaskBoard
                        tasks={data.tasks}
                        members={data.members.map((member) => member.user)}
                        onMove={(task, status) => void changeTask(task, status)}
                        onCreate={createBoardTask}
                        onSave={saveBoardTask}
                        onDelete={(id) => void deleteTask(id)}
                        onExpense={prepareTaskExpense}
                      />
                    ) : (
                      <div className="task-list-view">
                        {data.tasks.map((t) => (
                          <div className="task-row task-row-actions" key={t.id}>
                            <span
                              className="task-list-priority"
                              data-priority={t.priority}
                            >
                              {t.priority === "HIGH"
                                ? "Alta"
                                : t.priority === "LOW"
                                  ? "Baixa"
                                  : "Normal"}
                            </span>
                            <span className={t.status === "DONE" ? "done" : ""}>
                              {t.title}
                              <small className="task-meta">
                                {t.category} ·{" "}
                                {t.dueAt
                                  ? `Prazo: ${date(t.dueAt)}`
                                  : "Sem prazo"}
                                {t.assigneeName ? ` · ${t.assigneeName}` : ""}
                              </small>
                            </span>
                            <select
                              aria-label={`Estado de ${t.title}`}
                              value={t.status}
                              onChange={(e) =>
                                void changeTask(
                                  t,
                                  e.target.value as Task["status"],
                                )
                              }
                            >
                              <option value="TODO">Por organizar</option>
                              <option value="IN_PROGRESS">Em andamento</option>
                              <option value="WAITING">A aguardar</option>
                              <option value="DONE">Concluído</option>
                            </select>
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => editTask(t)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => void deleteTask(t.id)}
                            >
                              Remover
                            </button>
                          </div>
                        ))}
                        {!data.tasks.length && (
                          <p className="empty-copy">
                            Ainda não há tarefas. Adicionem a primeira tarefa
                            acima.
                          </p>
                        )}
                      </div>
                    )}
                  </section>
                )}
                {tab === "budget" && (
                  <BudgetPanel
                    limit={data.budgetLimit}
                    expenses={data.expenses}
                    tasks={data.tasks.map((task) => ({
                      id: task.id,
                      title: task.title,
                    }))}
                    title={expenseTitle}
                    setTitle={setExpenseTitle}
                    category={expenseCategory}
                    setCategory={setExpenseCategory}
                    amount={expenseAmount}
                    setAmount={setExpenseAmount}
                    status={expenseStatus}
                    setStatus={setExpenseStatus}
                    dueAt={expenseDueAt}
                    setDueAt={setExpenseDueAt}
                    taskId={expenseTaskId}
                    setTaskId={setExpenseTaskId}
                    editingId={editingExpenseId}
                    onSubmit={addExpense}
                    onCancel={resetExpenseForm}
                    onEdit={editExpense}
                    onDelete={deleteExpense}
                    onOpenTask={openExpenseTask}
                    onSetLimit={() => setTab("settings")}
                  />
                )}
                {tab === "guests" && (
                  <GuestsWorkspace
                    projectId={selected}
                    guests={data.guests}
                    tables={tables}
                    invitationSlug={data.invitations[0]?.slug}
                    onRefresh={() => loadDetail(selected)}
                    onNotice={setNotice}
                    onError={(message) => {
                      setNotice("");
                      setError(message);
                    }}
                  />
                )}
                {tab === "vendors" && (
                  <VendorWorkspace
                    projectId={selected}
                    projectTitle={data.title}
                    projectDate={data.date}
                    province={data.province}
                    guestEstimate={data.guestEstimate}
                    favorites={favorites}
                    requests={data.quoteRequests}
                    onRefresh={() => loadDetail(selected)}
                    onOpenBudget={() => setTab("budget")}
                  />
                )}
                {tab === "invitation" && (
                  <section className="dash-panel wide-panel invitation-editor">
                    <div className="panel-title">
                      <div>
                        <p className="eyebrow">Partilha com quem importa</p>
                        <h2>Convite e Guia do Convidado</h2>
                        <p className="empty-copy">
                          Prepara a página partilhável com o convite, o programa, os locais e as informações úteis.
                        </p>
                      </div>
                    </div>
                    <div className="invitation-editor-grid">
                      <div className="invitation-controls">
                        <div
                          className={`invitation-publish-state ${savedInvitation ? (invitationHasChanges ? "has-changes" : "is-published") : "is-draft"}`}
                        >
                          <span aria-hidden="true">
                            {savedInvitation
                              ? invitationHasChanges
                                ? "●"
                                : "✓"
                              : "○"}
                          </span>
                          <div>
                            <strong>
                              {savedInvitation
                                ? invitationHasChanges
                                  ? "Alterações por publicar"
                                  : "Convite publicado"
                                : "Ainda não publicado"}
                            </strong>
                            <small>
                              {savedInvitation
                                ? invitationHasChanges
                                  ? "O link actual continua a mostrar a última versão publicada."
                                  : "O link está activo e pronto para partilhar."
                                : "Publica para criar um link acessível aos convidados."}
                            </small>
                          </div>
                        </div>
                        <div className="invite-customization">
                          <label>
                            Título do convite
                            <input
                              maxLength={140}
                              value={inviteHeadline}
                              onChange={(e) =>
                                setInviteHeadline(e.target.value)
                              }
                              placeholder={data.title}
                            />
                          </label>
                          <label>
                            Mensagem
                            <textarea
                              rows={4}
                              maxLength={2000}
                              value={inviteMessage}
                              onChange={(e) => setInviteMessage(e.target.value)}
                              placeholder={INVITATION_MESSAGE}
                            />
                          </label>
                        </div>
                        <fieldset className="guest-guide-fields">
                          <legend>Informações para os convidados</legend>
                          <p>Estas informações aparecem no link geral. Não coloques aqui notas privadas da equipa.</p>
                          <label>
                            Traje recomendado
                            <input
                              maxLength={120}
                              value={inviteDressCode}
                              onChange={(e) => setInviteDressCode(e.target.value)}
                              placeholder="Ex.: traje formal em tons claros"
                            />
                          </label>
                          <label>
                            Nota dos anfitriões
                            <textarea
                              rows={3}
                              maxLength={1200}
                              value={invitePublicNotes}
                              onChange={(e) => setInvitePublicNotes(e.target.value)}
                              placeholder="Informações úteis sobre chegada, estacionamento ou detalhes da celebração."
                            />
                          </label>
                          <div className="guest-guide-contact-fields">
                            <label>
                              Contacto de apoio no dia
                              <input
                                maxLength={120}
                                value={inviteSupportName}
                                onChange={(e) => setInviteSupportName(e.target.value)}
                                placeholder="Nome da pessoa de apoio"
                              />
                            </label>
                            <label>
                              Telefone de apoio
                              <input
                                type="tel"
                                maxLength={40}
                                value={inviteSupportPhone}
                                onChange={(e) => setInviteSupportPhone(e.target.value)}
                                placeholder="+244 ..."
                              />
                            </label>
                          </div>
                          <small className="guest-guide-privacy-hint">O contacto só será partilhado depois de publicares as alterações.</small>
                        </fieldset>
                        <fieldset className="invite-theme-picker">
                          <legend>Estilo do convite</legend>
                          <div>
                            {INVITATION_THEMES.map((theme) => (
                              <button
                                type="button"
                                key={theme.value}
                                className={`invite-theme-option theme-${theme.value.toLowerCase()} ${inviteTheme === theme.value ? "selected" : ""}`}
                                aria-pressed={inviteTheme === theme.value}
                                onClick={() => setInviteTheme(theme.value)}
                              >
                                <span
                                  className="invite-theme-swatch"
                                  aria-hidden="true"
                                />
                                <strong>{theme.label}</strong>
                                <small>{theme.description}</small>
                              </button>
                            ))}
                          </div>
                        </fieldset>
                        <button
                          className="button button-primary"
                          onClick={() => void publish()}
                          disabled={
                            publishingInvite ||
                            (!!savedInvitation && !invitationHasChanges)
                          }
                        >
                          {publishingInvite
                            ? "A publicar…"
                            : savedInvitation
                              ? invitationHasChanges
                                ? "Guardar e actualizar convite →"
                                : "Convite actualizado"
                              : "Publicar convite →"}
                        </button>
                        {savedInvitation && (
                          <div className="published-invite invitation-share-actions">
                            <strong>Partilha geral</strong>
                            <a
                              href={`/c/${savedInvitation.slug}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Abrir página pública ↗
                            </a>
                            <button
                              onClick={() =>
                                void copyInvitationLink(savedInvitation.slug)
                              }
                            >
                              Copiar link
                            </button>
                            <button
                              onClick={() =>
                                void downloadQr(
                                  `${window.location.origin}/c/${savedInvitation.slug}`,
                                  `convite-geral-${data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`,
                                )
                              }
                            >
                              Descarregar QR
                            </button>
                          </div>
                        )}
                        <div className="invitation-share-guide">
                          <strong>Como enviar aos convidados</strong>
                          <p>
                            O link geral apresenta o evento. Para recolher
                            confirmações, usa o link individual de cada pessoa.
                          </p>
                          <button
                            className="link-button"
                            onClick={() => setTab("guests")}
                          >
                            Abrir convidados e partilhar RSVP individuais →
                          </button>
                          <small>
                            A plataforma não envia mensagens automaticamente.
                            Copia o link e envia pelo canal que preferires.
                          </small>
                        </div>
                      </div>
                      <aside className="invitation-live-preview">
                        <div className="invitation-preview-heading">
                          <strong>Pré-visualização</strong>
                          <span>Actualiza enquanto editas</span>
                        </div>
                        <div
                          className={`invitation-card theme-${inviteTheme.toLowerCase()}`}
                        >
                          <span className="invitation-mark">♡</span>
                          <p className="eyebrow">Com alegria convidamos-te</p>
                          <h1>{displayedInvitationHeadline}</h1>
                          <p className="invitation-message">
                            {displayedInvitationMessage}
                          </p>
                          {data.date && (
                            <p className="invitation-date">{date(data.date)}</p>
                          )}
                          {data.province && <p>{data.province}</p>}
                          {data.events.filter((event) => event.showToGuests).slice(0, 3).map((event) => (
                            <div className="invitation-event" key={event.id}>
                              <strong>{event.title}</strong>
                              <span>{eventDateTime(event.startsAt)}</span>
                              {event.venue && <span>{event.venue}</span>}
                              {event.address && <span>{event.address}</span>}
                              {event.mapsUrl && <span>Localização no mapa</span>}
                              {event.guestNotes && <small>{event.guestNotes}</small>}
                            </div>
                          ))}
                          {(inviteDressCode || invitePublicNotes || inviteSupportName || inviteSupportPhone) && (
                            <div className="invitation-preview-guide">
                              <strong>Informações úteis</strong>
                              {inviteDressCode && <span>Traje: {inviteDressCode}</span>}
                              {invitePublicNotes && <span>{invitePublicNotes}</span>}
                              {(inviteSupportName || inviteSupportPhone) && <span>Contacto: {[inviteSupportName, inviteSupportPhone].filter(Boolean).join(" · ")}</span>}
                            </div>
                          )}
                          <div className="invitation-preview-rsvp">
                            O link individual inclui RSVP e, quando atribuída, a tua mesa.
                          </div>
                        </div>
                      </aside>
                    </div>
                  </section>
                )}
                {tab === "program" && (
                  <div className="program-workspace">
                    <section className="dash-panel wide-panel program-switcher-panel">
                      <div>
                        <p className="eyebrow">Datas e horários</p>
                        <h2>Programa e prazos</h2>
                        <p className="empty-copy">
                          Consulta a sequência do evento ou acompanha o que
                          falta preparar.
                        </p>
                      </div>
                      <div
                        className="program-section-switch"
                        aria-label="Vistas do programa"
                      >
                        <button
                          type="button"
                          aria-pressed={programView === "moments"}
                          className={
                            programView === "moments" ? "selected" : ""
                          }
                          onClick={() => setProgramView("moments")}
                        >
                          Programa do evento <span>{data.events.length}</span>
                        </button>
                        <button
                          type="button"
                          aria-pressed={programView === "deadlines"}
                          className={
                            programView === "deadlines" ? "selected" : ""
                          }
                          onClick={() => setProgramView("deadlines")}
                        >
                          Prazos de preparação{" "}
                          <span>
                            {
                              data.tasks.filter(
                                (task) => task.dueAt && task.status !== "DONE",
                              ).length
                            }
                          </span>
                        </button>
                      </div>
                    </section>
                    {programView === "moments" ? (
                      <section className="dash-panel wide-panel">
                        <div className="panel-title">
                          <div>
                            <p className="eyebrow">Horários e locais</p>
                            <h2>Sequência do evento</h2>
                            <p className="empty-copy">
                              Organiza os momentos pela hora prevista. A hora é
                              apresentada no fuso de Luanda.
                            </p>
                          </div>
                          <button
                            className="button button-primary compact"
                            onClick={() => {
                              resetEventForm();
                              setShowEventForm(true);
                            }}
                          >
                            + Adicionar momento
                          </button>
                        </div>
                        {showEventForm && (
                          <form
                            className="event-editor-form"
                            onSubmit={addEvent}
                          >
                            <div className="event-editor-heading">
                              <strong>
                                {editingEventId
                                  ? "Editar momento"
                                  : "Novo momento"}
                              </strong>
                              <span>
                                As horas são guardadas e apresentadas no fuso de
                                Luanda.
                              </span>
                            </div>
                            <label>
                              Nome do momento
                              <input
                                required
                                value={eventTitle}
                                onChange={(e) => setEventTitle(e.target.value)}
                                placeholder="Ex.: Cerimónia civil"
                              />
                            </label>
                            <label>
                              Tipo
                              <select
                                value={eventType}
                                onChange={(e) => setEventType(e.target.value)}
                              >
                                {MOMENT_TYPES.map((item) => (
                                  <option key={item.value} value={item.value}>
                                    {item.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Data e hora em Luanda
                              <input
                                type="datetime-local"
                                value={eventDate}
                                onChange={(e) => setEventDate(e.target.value)}
                              />
                            </label>
                            <label>
                              Local
                              <input
                                value={eventVenue}
                                onChange={(e) => setEventVenue(e.target.value)}
                                placeholder="Ex.: Conservatória de Luanda"
                              />
                            </label>
                            <label>
                              Morada completa
                              <input
                                value={eventAddress}
                                onChange={(e) => setEventAddress(e.target.value)}
                                placeholder="Rua, bairro, município e província"
                              />
                            </label>
                            <label>
                              Link do mapa
                              <input
                                type="url"
                                value={eventMapsUrl}
                                onChange={(e) => setEventMapsUrl(e.target.value)}
                                placeholder="https://maps.google.com/..."
                              />
                            </label>
                            <label className="event-editor-notes">
                              Orientações para os convidados
                              <textarea
                                rows={2}
                                maxLength={800}
                                value={eventGuestNotes}
                                onChange={(e) => setEventGuestNotes(e.target.value)}
                                placeholder="Ex.: entrada pelo portão lateral; chegar 15 minutos antes."
                              />
                            </label>
                            <label className="event-guest-visibility">
                              <input
                                type="checkbox"
                                checked={eventShowToGuests}
                                onChange={(e) => setEventShowToGuests(e.target.checked)}
                              />
                              Mostrar este momento no Guia do Convidado
                            </label>
                            <div className="event-editor-actions">
                              <button className="button button-primary compact">
                                {editingEventId
                                  ? "Guardar alterações"
                                  : "Guardar momento"}
                              </button>
                              <button
                                type="button"
                                className="button button-outline compact"
                                onClick={resetEventForm}
                              >
                                Cancelar
                              </button>
                            </div>
                          </form>
                        )}
                        {data.events.length ? (
                          data.events
                            .slice()
                            .sort((a, b) => {
                              if (!a.startsAt) return b.startsAt ? 1 : 0;
                              if (!b.startsAt) return -1;
                              return a.startsAt.localeCompare(b.startsAt);
                            })
                            .map((item) => (
                              <article className="program-row" key={item.id}>
                                <span className="program-row-type">
                                  {MOMENT_TYPES.find(
                                    (type) => type.value === item.type,
                                  )?.label || "Outro momento"}
                                </span>
                                <strong>{item.title}</strong>
                                <span>{eventDateTime(item.startsAt)}</span>
                                <small>
                                  {item.showToGuests ? "Visível aos convidados · " : "Só para a equipa · "}
                                  {item.venue || "Local por definir"}
                                </small>
                                <div>
                                  <button
                                    className="link-button"
                                    onClick={() => editEvent(item)}
                                  >
                                    Editar
                                  </button>{" "}
                                  <button
                                    className="link-button"
                                    onClick={() => void deleteEvent(item.id)}
                                  >
                                    Remover
                                  </button>
                                </div>
                              </article>
                            ))
                        ) : (
                          <div className="program-empty-state">
                            <span aria-hidden="true">◷</span>
                            <strong>O programa ainda está vazio</strong>
                            <p>
                              Adiciona os momentos principais para saberem a que
                              horas e onde acontece cada parte do evento.
                            </p>
                            <button
                              className="button button-outline compact"
                              onClick={() => setShowEventForm(true)}
                            >
                              Adicionar o primeiro momento
                            </button>
                          </div>
                        )}
                      </section>
                    ) : (
                      <section className="dash-panel wide-panel deadline-workspace">
                        <div className="panel-title">
                          <div>
                            <p className="eyebrow">Planeamento</p>
                            <h2>Prazos de preparação</h2>
                            <p className="empty-copy">
                              Tarefas por concluir com data limite, ordenadas da
                              mais próxima para a mais distante.
                            </p>
                          </div>
                          <button
                            className="button button-outline compact"
                            onClick={() => setTab("planning")}
                          >
                            Abrir planeamento →
                          </button>
                        </div>
                        {tasksWithDeadlines.length ? (
                          <>
                            {overdueTasks.length > 0 && (
                              <div className="deadline-group">
                                <h3>
                                  Atrasados <span>{overdueTasks.length}</span>
                                </h3>
                                {overdueTasks.map((task) => (
                                  <article
                                    className="deadline-row overdue"
                                    key={task.id}
                                  >
                                    <time dateTime={task.dueAt!}>
                                      {new Intl.DateTimeFormat("pt-AO", {
                                        dateStyle: "medium",
                                        timeZone: "Africa/Luanda",
                                      }).format(new Date(task.dueAt!))}
                                    </time>
                                    <span className="deadline-state">
                                      Em atraso
                                    </span>
                                    <strong>{task.title}</strong>
                                    <small>
                                      {task.assigneeName
                                        ? `Responsável: ${task.assigneeName}`
                                        : "Sem responsável"}
                                    </small>
                                    <button
                                      className="link-button"
                                      onClick={() => {
                                        editTask(task);
                                        setTab("planning");
                                      }}
                                    >
                                      Abrir tarefa
                                    </button>
                                  </article>
                                ))}
                              </div>
                            )}
                            {upcomingTasks.length > 0 && (
                              <div className="deadline-group">
                                <h3>Próximos prazos</h3>
                                {upcomingTasks.map((task) => (
                                  <article
                                    className="deadline-row"
                                    key={task.id}
                                  >
                                    <time dateTime={task.dueAt!}>
                                      {new Intl.DateTimeFormat("pt-AO", {
                                        dateStyle: "medium",
                                        timeZone: "Africa/Luanda",
                                      }).format(new Date(task.dueAt!))}
                                    </time>
                                    <span className="deadline-state">
                                      {task.status === "WAITING"
                                        ? "A aguardar"
                                        : task.status === "IN_PROGRESS"
                                          ? "Em andamento"
                                          : "Por organizar"}
                                    </span>
                                    <strong>{task.title}</strong>
                                    <small>
                                      {task.assigneeName
                                        ? `Responsável: ${task.assigneeName}`
                                        : "Sem responsável"}
                                    </small>
                                    <button
                                      className="link-button"
                                      onClick={() => {
                                        editTask(task);
                                        setTab("planning");
                                      }}
                                    >
                                      Abrir tarefa
                                    </button>
                                  </article>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="program-empty-state">
                            <span aria-hidden="true">✓</span>
                            <strong>Sem prazos pendentes</strong>
                            <p>
                              As tarefas concluídas ficam no Planeamento. Define
                              datas nas tarefas por fazer para acompanhar os
                              prazos aqui.
                            </p>
                            <button
                              className="button button-outline compact"
                              onClick={() => setTab("planning")}
                            >
                              Ver tarefas
                            </button>
                          </div>
                        )}
                      </section>
                    )}
                  </div>
                )}
                {tab === "reports" && (
                  <ReportsPanel
                    budgetLimit={data.budgetLimit}
                    expenses={data.expenses}
                    tasks={data.tasks}
                    guests={data.guests}
                    onOpenBudget={() => setTab("budget")}
                    onOpenGuests={() => setTab("guests")}
                    onOpenTask={(task) => {
                      editTask(task);
                      setTab("planning");
                    }}
                    onOpenExpense={(expense) => {
                      editExpense(expense);
                      setTab("budget");
                    }}
                  />
                )}
                {tab === "settings" && (
                  <div className="settings-stack">
                    <header className="settings-page-heading">
                      <p className="eyebrow">Preferências e dados</p>
                      <h1>Definições</h1>
                      <p>Ajusta os dados do evento ou gere a tua conta e os teus dados pessoais.</p>
                      <div className="settings-view-switch" role="group" aria-label="Escolher definições">
                        <button type="button" aria-pressed={settingsView === "event"} className={settingsView === "event" ? "selected" : ""} onClick={() => setSettingsView("event")}><span aria-hidden="true">◈</span> Este evento</button>
                        <button type="button" aria-pressed={settingsView === "account"} className={settingsView === "account" ? "selected" : ""} onClick={() => setSettingsView("account")}><span aria-hidden="true">♙</span> Conta e privacidade</button>
                      </div>
                    </header>
                    {settingsView === "event" ? (
                      <>
                        <section className="dash-panel wide-panel settings-panel">
                          <p className="eyebrow">Informação principal</p>
                          <h2>Dados do evento</h2>
                          <p className="empty-copy">
                            O tipo identifica o evento completo. Cerimónia civil, alambamento e recepção são momentos separados no Programa.
                          </p>
                          {projectSettingsChanged ? (
                            <p className="settings-save-state unsaved" role="status">Tens alterações por guardar.</p>
                          ) : (
                            <p className="settings-save-state saved" role="status">Os dados estão actualizados.</p>
                          )}
                          <form className="settings-form event-settings-form" onSubmit={saveProject}>
                            <label>
                              Nome do evento
                              <input required minLength={2} value={editProjectTitle} onChange={(e) => setEditProjectTitle(e.target.value)} />
                            </label>
                            <label>
                              Tipo de evento
                              <select value={editProjectKind} onChange={(e) => setEditProjectKind(e.target.value as Project["kind"])}>
                                {PROJECT_KINDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                              </select>
                            </label>
                            <label>
                              Data do evento <small>Fuso horário de Luanda</small>
                              <input type="date" value={editProjectDate} onChange={(e) => setEditProjectDate(e.target.value)} />
                            </label>
                            <label>
                              Província
                              <select value={editProjectProvince} onChange={(e) => setEditProjectProvince(e.target.value)}>
                                <option value="">Por definir</option>
                                {ANGOLA_PROVINCES.map((item) => <option key={item}>{item}</option>)}
                              </select>
                            </label>
                            <label>
                              Orçamento máximo (Kz)
                              <input type="number" min="0" value={editProjectBudget} onChange={(e) => setEditProjectBudget(e.target.value)} />
                            </label>
                            <label>
                              Estimativa de participantes
                              <input type="number" min="1" max="10000" value={editProjectGuests} onChange={(e) => setEditProjectGuests(e.target.value)} />
                            </label>
                            <button className="button button-primary" disabled={!projectSettingsChanged || savingProjectSettings}>
                              {savingProjectSettings ? "A guardar…" : projectSettingsChanged ? "Guardar alterações" : "Tudo guardado"}
                            </button>
                          </form>
                        </section>
                        {canManageTeam && (
                        <section className="dash-panel wide-panel archive-event-panel">
                            <p className="eyebrow">Organização dos eventos</p>
                            <h2>Arquivar evento</h2>
                            <p className="empty-copy">
                              O evento sai da lista de activos, mas os dados ficam guardados. Podes restaurá-lo em “Os meus eventos”. Isto não elimina convidados, despesas ou histórico.
                            </p>
                            <button type="button" className="button archive-event-button" disabled={archivingProject} onClick={() => void archiveProject()}>
                              {archivingProject ? "A arquivar…" : "Arquivar este evento"}
                            </button>
                          </section>
                        )}
                      </>
                    ) : (
                      <>
                        <section className="dash-panel wide-panel settings-panel">
                          <p className="eyebrow">Segurança da conta</p>
                          <h2>Alterar palavra-passe</h2>
                          <form className="settings-form account-password-form" onSubmit={changePassword}>
                            <label>
                              Palavra-passe actual
                              <input type="password" minLength={8} required value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
                            </label>
                            <label>
                              Nova palavra-passe
                              <input type="password" minLength={8} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                            </label>
                            <button className="button button-primary" disabled={changingPassword}>
                              {changingPassword ? "A actualizar…" : "Actualizar palavra-passe"}
                            </button>
                          </form>
                        </section>
                        <section className="dash-panel wide-panel settings-panel settings-export-panel">
                          <p className="eyebrow">Os teus dados</p>
                          <h2>Exportação e privacidade</h2>
                          <p className="empty-copy">
                            Descarrega uma cópia JSON dos teus eventos, tarefas, despesas, convidados e confirmações de presença.
                          </p>
                          <button type="button" className="button button-outline" disabled={exportingData} onClick={() => void exportData()}>
                            {exportingData ? "A preparar ficheiro…" : "Descarregar os meus dados"}
                          </button>
                        </section>
                        <section className="dash-panel wide-panel danger-panel">
                          <p className="eyebrow">Zona de segurança</p>
                          <details className="danger-details">
                            <summary>Eliminar a conta permanentemente</summary>
                            <p className="empty-copy">
                              Esta acção não pode ser anulada. Eventos em que és a única pessoa responsável também serão removidos; os restantes passam para outra pessoa da equipa.
                            </p>
                            <form className="settings-form delete-account-form" onSubmit={deleteAccount}>
                              <label>
                                Palavra-passe actual
                                <input type="password" minLength={8} required value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
                              </label>
                              <label>
                                Escreve ELIMINAR para confirmar
                                <input required value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} />
                              </label>
                              <button className="button danger-button" disabled={deletingAccount || deleteConfirmation !== "ELIMINAR" || !deletePassword}>
                                {deletingAccount ? "A eliminar…" : "Eliminar a minha conta"}
                              </button>
                            </form>
                          </details>
                        </section>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
