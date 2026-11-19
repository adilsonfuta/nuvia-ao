import { Controller, Get, NotFoundException, Param, Query, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, SessionGuard, SessionUser } from "./auth";
import { DatabaseService } from "./database";

const categories = ["all", "event", "planning", "documents", "budget", "guests", "program", "team", "sharing", "vendors", "contributions"] as const;
type ActivityCategory = typeof categories[number];

const prefixes: Record<Exclude<ActivityCategory, "all">, string[]> = {
  event: ["PROJECT_CREATED", "PROJECT_UPDATED", "PROJECT_ARCHIVED", "PROJECT_RESTORED"],
  planning: ["TASK_"],
  documents: ["PROJECT_DOCUMENT_"],
  budget: ["EXPENSE_"],
  guests: ["GUEST_", "GUESTS_"],
  program: ["PROGRAM_"],
  team: ["PROJECT_MEMBER_"],
  sharing: ["INVITATION_", "SUMMARY_"],
  vendors: ["QUOTE_", "VENDOR_REVIEW_"],
  contributions: ["PROJECT_CONTRIBUTION_"],
};

const categoryLabel: Record<ActivityCategory, string> = {
  all: "Tudo",
  event: "Evento",
  planning: "Planeamento",
  documents: "Documentos",
  budget: "Orçamento",
  guests: "Convidados",
  program: "Programa",
  team: "Colaboração",
  sharing: "Partilha",
  vendors: "Fornecedores",
  contributions: "Contribuições",
};

function categoryFor(action: string): ActivityCategory {
  const activityCategories: Exclude<ActivityCategory, "all">[] = ["event", "planning", "documents", "budget", "guests", "program", "team", "sharing", "vendors", "contributions"];
  for (const category of activityCategories) {
    if (prefixes[category].some((prefix) => action.startsWith(prefix))) return category;
  }
  return "all";
}

function describe(action: string, metadata: unknown): { title: string; detail: string | null; category: ActivityCategory } {
  const value = metadata && typeof metadata === "object" ? metadata as Record<string, unknown> : {};
  const subject = typeof value.subject === "string" ? value.subject.slice(0, 120) : "";
  const changedFields = Array.isArray(value.changedFields)
    ? value.changedFields.filter((field): field is string => typeof field === "string").slice(0, 8)
    : [];
  const category = categoryFor(action);
  const fieldNames: Record<string, string> = {
    title: "nome", date: "data", province: "província", budgetLimit: "limite do orçamento",
    guestEstimate: "estimativa de convidados", status: "estado", priority: "prioridade",
    category: "categoria", dueAt: "prazo", assigneeUserId: "responsável", amount: "valor",
    taskId: "tarefa associada", startsAt: "data e hora", venue: "local", address: "endereço",
    mapsUrl: "localização", showToGuests: "visibilidade para convidados", theme: "tema",
  };
  const fields = changedFields.map((field) => fieldNames[field] ?? field).join(", ");
  const count = typeof value.count === "number" ? value.count : 0;
  const role = value.role === "EDITOR" ? "pode editar" : value.role === "VIEWER" ? "só consulta" : "";

  switch (action) {
    case "PROJECT_CREATED": return { title: "Evento criado", detail: subject || null, category: "event" };
    case "PROJECT_UPDATED": return { title: "Dados do evento actualizados", detail: fields ? `Alterações: ${fields}.` : null, category };
    case "PROJECT_ARCHIVED": return { title: "Evento arquivado", detail: null, category };
    case "PROJECT_RESTORED": return { title: "Evento restaurado", detail: null, category };
    case "PROGRAM_MOMENT_CREATED": return { title: "Momento adicionado ao programa", detail: subject || null, category };
    case "PROGRAM_MOMENT_UPDATED": return { title: "Momento do programa actualizado", detail: subject || (fields ? `Alterações: ${fields}.` : null), category };
    case "PROGRAM_MOMENT_DELETED": return { title: "Momento removido do programa", detail: subject || null, category };
    case "TASK_CREATED": return { title: "Tarefa criada", detail: subject || null, category };
    case "TASK_UPDATED": return { title: "Tarefa actualizada", detail: subject ? `${subject}${fields ? ` · ${fields}` : ""}` : (fields ? `Alterações: ${fields}.` : null), category };
    case "TASK_DELETED": return { title: "Tarefa removida", detail: subject || null, category };
    case "PROJECT_DOCUMENT_CREATED": return { title: "Documento adicionado à lista", detail: subject || null, category };
    case "PROJECT_DOCUMENT_UPDATED": return { title: "Item de documentação actualizado", detail: subject || null, category };
    case "PROJECT_DOCUMENT_FILE_UPLOADED": return { title: "Ficheiro anexado à documentação", detail: subject || null, category };
    case "PROJECT_DOCUMENT_FILE_DOWNLOADED": return { title: "Ficheiro da documentação consultado", detail: subject || null, category };
    case "PROJECT_DOCUMENT_DELETED": return { title: "Item de documentação removido", detail: subject || null, category };
    case "GUEST_ADDED": return { title: "Convidado adicionado à lista", detail: null, category };
    case "GUESTS_IMPORTED": return { title: "Lista de convidados importada", detail: `${count} ${count === 1 ? "registo" : "registos"} adicionados.`, category };
    case "GUEST_UPDATED": return { title: "Dados de um convidado actualizados", detail: null, category };
    case "GUEST_DELETED": return { title: "Convidado removido da lista", detail: null, category };
    case "GUEST_RSVP_RECORDED_MANUALLY": return { title: "Resposta de presença registada manualmente", detail: subject ? `${subject}${value.status === "ACCEPTED" ? ` · presença confirmada${typeof value.partySize === "number" && value.partySize > 1 ? ` para ${value.partySize} pessoas` : ""}` : " · não poderá estar presente"}` : null, category };
    case "GUEST_TABLE_CREATED": return { title: "Mesa criada", detail: subject || null, category };
    case "GUEST_TABLE_DELETED": return { title: "Mesa removida", detail: subject || null, category };
    case "EXPENSE_CREATED": return { title: "Despesa registada", detail: subject || null, category };
    case "EXPENSE_UPDATED": return { title: "Despesa actualizada", detail: subject ? `${subject}${fields ? ` · ${fields}` : ""}` : (fields ? `Alterações: ${fields}.` : null), category };
    case "EXPENSE_DELETED": return { title: "Despesa removida", detail: subject || null, category };
    case "EXPENSE_PAYMENT_CREATED": return { title: "Prestação de pagamento adicionada", detail: subject || null, category };
    case "EXPENSE_PAYMENT_UPDATED": return { title: "Prestação de pagamento actualizada", detail: subject || null, category };
    case "EXPENSE_PAYMENT_DELETED": return { title: "Prestação pendente removida", detail: subject || null, category };
    case "PROJECT_MEMBER_ADDED": return { title: "Acesso ao evento concedido", detail: role ? `${subject || "Membro da equipa"} · ${role}.` : subject || null, category };
    case "PROJECT_MEMBER_ROLE_UPDATED": return { title: "Permissão de acesso actualizada", detail: role ? `${subject || "Membro da equipa"} · ${role}.` : subject || null, category };
    case "PROJECT_MEMBER_REMOVED": return { title: "Acesso ao evento removido", detail: subject || null, category };
    case "INVITATION_PUBLISHED": return { title: "Convite digital publicado ou actualizado", detail: null, category };
    case "SUMMARY_SHARE_UPDATED": return { title: "Resumo partilhável actualizado", detail: null, category };
    case "SUMMARY_SHARE_LINK_ROTATED": return { title: "Link do resumo renovado", detail: null, category };
    case "PROJECT_CONTRIBUTION_CONFIRMED": return { title: "Contribuição confirmada", detail: null, category };
    case "PROJECT_CONTRIBUTION_REJECTED": return { title: "Contribuição recusada", detail: null, category };
    case "PROJECT_CONTRIBUTION_DELETED": return { title: "Registo de contribuição removido", detail: null, category };
    case "PROJECT_CONTRIBUTION_CAMPAIGN_UPDATED": return { title: "Definições das contribuições actualizadas", detail: null, category };
    case "PROJECT_CONTRIBUTION_LINK_ROTATED": return { title: "Link de contribuições renovado", detail: null, category };
    case "VENDOR_REVIEW_SUBMITTED": return { title: "Avaliação de fornecedor enviada", detail: null, category };
    case "VENDOR_REVIEW_RESUBMITTED": return { title: "Avaliação de fornecedor actualizada", detail: null, category };
    case "QUOTE_REQUEST_HIRED": return { title: "Fornecedor contratado", detail: subject || null, category };
    case "QUOTE_REQUEST_UPDATED": return { title: "Pedido a fornecedor actualizado", detail: null, category };
    default: return { title: "Actividade do evento", detail: null, category };
  }
}

@ApiTags("Actividade do evento")
@ApiCookieAuth("casar_session")
@UseGuards(SessionGuard)
@Controller("projects/:id/activity")
export class ProjectActivityController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async list(
    @Param("id") projectId: string,
    @CurrentUser() user: SessionUser,
    @Query("page") pageRaw = "1",
    @Query("category") categoryRaw = "all",
    @Query("limit") limitRaw = "20",
    @Query("actor") actorId?: string,
    @Query("from") fromRaw?: string,
    @Query("to") toRaw?: string,
  ) {
    const member = await this.db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
      select: { projectId: true },
    });
    if (!member) throw new NotFoundException("Evento não encontrado.");

    const pageValue = Number(pageRaw);
    const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? Math.min(pageValue, 1_000_000) : 1;
    const limitValue = Number(limitRaw);
    const pageSize = [5, 10, 20, 50, 100].includes(limitValue) ? limitValue : 20;
    const category = categories.includes(categoryRaw as ActivityCategory) ? categoryRaw as ActivityCategory : "all";
    const categoryWhere = category === "all" ? {} : {
      OR: prefixes[category].map((prefix) => ({ action: { startsWith: prefix } })),
    };
    const parseBoundary = (raw?: string) => {
      if (!raw || Number.isNaN(Date.parse(raw))) return undefined;
      return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00+01:00`) : new Date(raw);
    };
    const from = parseBoundary(fromRaw);
    const toStart = parseBoundary(toRaw);
    const to = toStart && /^\d{4}-\d{2}-\d{2}$/.test(toRaw ?? "")
      ? new Date(toStart.getTime() + 24 * 60 * 60 * 1000)
      : toStart;
    const where = {
      AND: [
        { metadata: { path: ["projectId"], equals: projectId } },
        ...(category === "all" ? [] : [categoryWhere]),
        ...(actorId ? [{ actorId }] : []),
        ...(from || to ? [{ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } }] : []),
      ],
    };

    const [rows, total, actors] = await Promise.all([
      this.db.auditLog.findMany({
        where,
        include: { actor: { select: { name: true, email: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.auditLog.count({ where }),
      this.db.auditLog.findMany({
        where: { metadata: { path: ["projectId"], equals: projectId } },
        distinct: ["actorId"],
        select: { actorId: true, actor: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    return {
      items: rows.map((row) => {
        const description = describe(row.action, row.metadata);
        return {
          id: row.id,
          category: description.category,
          categoryLabel: categoryLabel[description.category],
          title: description.title,
          detail: description.detail,
          createdAt: row.createdAt,
          actor: row.actor.name || row.actor.email,
        };
      }),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      categories: categories.map((key) => ({ id: key, label: categoryLabel[key] })),
      actors: actors.map((item) => ({ id: item.actorId, name: item.actor.name || item.actor.email })),
    };
  }
}
