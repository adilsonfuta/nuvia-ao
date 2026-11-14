import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { randomBytes } from "node:crypto";
import {
  EventType,
  ExpenseStatus,
  InvitationTheme,
  ProjectKind,
  QuoteRequestStatus,
  TaskPriority,
  TaskStatus,
  VendorReviewStatus,
} from "@casar/database";
import {
  ArrayMaxSize,
  IsBoolean,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { DatabaseService } from "./database";
import { CurrentUser, SessionGuard, SessionUser } from "./auth";

const projectTaskTemplates: Record<ProjectKind, string[]> = {
  WEDDING: [
    "Confirmar os requisitos civis aplicáveis",
    "Definir cerimónia e celebração",
    "Preparar a primeira lista de convidados",
    "Comparar espaços e fornecedores",
    "Combinar responsabilidades com a família",
  ],
  ALAMBAMENTO: [
    "Conversar entre famílias sobre o pedido",
    "Definir data, local e participantes",
    "Preparar a lista de itens e responsabilidades",
    "Estimar os custos por categoria",
    "Partilhar o plano com quem vai ajudar",
  ],
  PARTY: [
    "Definir o motivo e formato da festa",
    "Escolher data e espaço",
    "Preparar a lista de convidados",
    "Comparar catering, música e decoração",
    "Distribuir tarefas pela equipa",
  ],
  OTHER: [
    "Definir o objectivo e formato do evento",
    "Escolher data e local",
    "Preparar uma estimativa de participantes",
    "Estimar custos e prioridades",
    "Convidar pessoas para colaborar",
  ],
};
const vendorBudgetCategory: Record<string, string> = {
  Catering: "Catering",
  Decoração: "Decoração",
  "Fotografia e vídeo": "Fotografia e vídeo",
  "Música e DJ": "Música",
  Beleza: "Roupa e beleza",
  Transportes: "Transporte",
  "Bolos e doces": "Catering",
  Espaços: "Espaço",
  Organização: "Outros",
};

class CreateProjectDto {
  @IsOptional() @IsEnum(ProjectKind) kind?: ProjectKind;
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsNumber() @Min(0) budgetLimit?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10000) guestEstimate?: number;
  @IsOptional() @IsEnum(EventType) eventType?: EventType;
}
class CreateTaskDto {
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() @MaxLength(120) assigneeName?: string;
  @IsOptional() @IsString() assigneeUserId?: string;
}
class UpdateTaskDto {
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsDateString() dueAt?: string | null;
  @IsOptional() @IsString() @MaxLength(120) assigneeName?: string | null;
  @IsOptional() @IsString() assigneeUserId?: string | null;
}
class CreateEventDto {
  @IsEnum(EventType) type!: EventType;
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsString() venue?: string;
}
class UpdateEventDto {
  @IsOptional() @IsEnum(EventType) type?: EventType;
  @IsOptional() @IsString() @MinLength(2) title?: string;
  @IsOptional() @IsDateString() startsAt?: string | null;
  @IsOptional() @IsString() venue?: string | null;
}
class CreateExpenseDto {
  @IsString() @MinLength(2) title!: string;
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsEnum(ExpenseStatus) status?: ExpenseStatus;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() taskId?: string;
}
class UpdateExpenseDto {
  @IsOptional() @IsString() @MinLength(2) title?: string;
  @IsOptional() @IsNumber() @Min(0) amount?: number;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsEnum(ExpenseStatus) status?: ExpenseStatus;
  @IsOptional() @IsDateString() dueAt?: string | null;
  @IsOptional() @IsString() taskId?: string | null;
}
class ProjectVendorFavoriteDto {
  @IsString() vendorId!: string;
}
class UpdateQuoteRequestDto {
  @IsOptional() @IsEnum(QuoteRequestStatus) status?: QuoteRequestStatus;
  @IsOptional() @IsNumber() @Min(0) quotedAmount?: number | null;
  @IsOptional() @IsString() @MaxLength(2000) responseNote?: string | null;
}
class HireVendorDto {
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsDateString() dueAt?: string;
}
class VendorReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsInt() @Min(1) @Max(5) communicationRating!: number;
  @IsInt() @Min(1) @Max(5) punctualityRating!: number;
  @IsInt() @Min(1) @Max(5) qualityRating!: number;
  @IsOptional() @IsString() @MaxLength(1500) comment?: string;
  @IsOptional() @IsBoolean() isAnonymous?: boolean;
}
class CreateGuestDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() groupName?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10) maxPartySize?: number;
  @IsOptional() @IsString() seatingTableId?: string;
}
export class GuestImportRowDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsEmail() @MaxLength(180) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(100) groupName?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10) maxPartySize?: number;
}
export class ImportGuestsDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => GuestImportRowDto)
  guests!: GuestImportRowDto[];
}
class UpdateGuestDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() email?: string | null;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsString() groupName?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(10) maxPartySize?: number;
  @IsOptional() @IsString() seatingTableId?: string | null;
}
class CreateSeatingTableDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsOptional() @IsInt() @Min(1) @Max(1000) capacity?: number;
}
class UpdateProjectDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) title?: string;
  @IsOptional() @IsEnum(ProjectKind) kind?: ProjectKind;
  @IsOptional() @IsDateString() date?: string | null;
  @IsOptional() @IsString() province?: string | null;
  @IsOptional() @IsNumber() @Min(0) budgetLimit?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(10000) guestEstimate?: number | null;
}
class ArchiveProjectDto {
  @IsBoolean() archived!: boolean;
}
class CreateInvitationDto {
  @IsOptional() @IsString() @MaxLength(140) headline?: string;
  @IsOptional() @IsString() @MaxLength(2000) message?: string;
  @IsOptional() @IsEnum(InvitationTheme) theme?: InvitationTheme;
}
class AddMemberDto {
  @IsString() email!: string;
  @IsEnum({ EDITOR: "EDITOR", VIEWER: "VIEWER" }) role!: "EDITOR" | "VIEWER";
}
const RsvpDecision = { ACCEPTED: "ACCEPTED", DECLINED: "DECLINED" } as const;
class RsvpDto {
  @IsString() token!: string;
  @IsEnum(RsvpDecision) status!: "ACCEPTED" | "DECLINED";
  @IsOptional() @IsInt() @Min(1) @Max(10) partySize?: number;
  @IsOptional() @IsString() @MaxLength(400) note?: string;
}

@ApiTags("Projectos de eventos")
@ApiCookieAuth("casar_session")
@UseGuards(SessionGuard)
@Controller(["projects", "weddings"])
export class ProjectsController {
  constructor(private readonly db: DatabaseService) {}
  private async owned(projectId: string, userId: string, write = false) {
    const member = await this.db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) throw new NotFoundException("Projecto não encontrado.");
    if (write && member.role === "VIEWER")
      throw new ForbiddenException(
        "A tua permissão permite consultar, mas não alterar, este projecto.",
      );
    if (write && this.db.eventProject?.findUnique) {
      const project = await this.db.eventProject.findUnique({
        where: { id: projectId },
        select: { archivedAt: true },
      });
      if (project?.archivedAt)
        throw new ForbiddenException(
          "Este evento está arquivado. Restaura-o antes de fazer alterações.",
        );
    }
    return member;
  }
  @Get() async list(@CurrentUser() user: SessionUser) {
    const projects = await this.db.eventProject.findMany({
      where: { members: { some: { userId: user.id } } },
      include: {
        events: true,
        members: { where: { userId: user.id }, select: { role: true } },
      },
      orderBy: [{ archivedAt: "asc" }, { updatedAt: "desc" }],
    });
    return projects.map(({ members, ...project }) => ({
      ...project,
      currentRole: members[0]?.role ?? "VIEWER",
    }));
  }
  @Get(":id/vendors/favorites") async projectVendorFavorites(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id);
    return this.db.projectVendorFavorite.findMany({
      where: { projectId: id, vendor: { status: "ACTIVE" } },
      include: {
        vendor: {
          select: {
            id: true,
            slug: true,
            name: true,
            category: true,
            province: true,
            municipality: true,
            priceFrom: true,
            priceTo: true,
            isDemo: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
  @Post(":id/vendors/favorites") async addProjectVendorFavorite(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
    @Body() body: ProjectVendorFavoriteDto,
  ) {
    await this.owned(id, user.id, true);
    const vendor = await this.db.vendor.findFirst({
      where: { id: body.vendorId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!vendor) throw new NotFoundException("Fornecedor não encontrado.");
    return this.db.projectVendorFavorite.upsert({
      where: { projectId_vendorId: { projectId: id, vendorId: vendor.id } },
      create: { projectId: id, vendorId: vendor.id },
      update: {},
      include: {
        vendor: {
          select: {
            id: true,
            slug: true,
            name: true,
            category: true,
            province: true,
            municipality: true,
            priceFrom: true,
            priceTo: true,
            isDemo: true,
          },
        },
      },
    });
  }
  @Delete(":id/vendors/favorites/:vendorId") async removeProjectVendorFavorite(
    @Param("id") id: string,
    @Param("vendorId") vendorId: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id, true);
    await this.db.projectVendorFavorite.deleteMany({
      where: { projectId: id, vendorId },
    });
    return { ok: true };
  }
  @Post() async create(
    @CurrentUser() user: SessionUser,
    @Body() body: CreateProjectDto,
  ) {
    const kind =
      body.kind ??
      (body.eventType === "ALAMBAMENTO"
        ? "ALAMBAMENTO"
        : body.eventType === "RECEPTION"
          ? "PARTY"
          : body.eventType === "CUSTOM"
            ? "OTHER"
            : "WEDDING");
    return this.db.eventProject.create({
      data: {
        title: body.title.trim(),
        kind,
        date: body.date ? new Date(body.date) : undefined,
        province: body.province,
        budgetLimit: body.budgetLimit,
        guestEstimate: body.guestEstimate,
        members: { create: { userId: user.id, role: "OWNER" } },
        events: body.eventType
          ? {
              create: {
                title:
                  body.eventType === "CIVIL"
                    ? "Cerimónia civil"
                    : body.eventType === "RECEPTION"
                      ? "Festa"
                      : body.eventType === "ALAMBAMENTO"
                        ? "Alambamento/pedido tradicional"
                        : body.eventType === "RELIGIOUS"
                          ? "Cerimónia religiosa"
                          : "Outro momento",
                type: body.eventType,
                startsAt: body.date ? new Date(body.date) : undefined,
              },
            }
          : undefined,
        tasks: {
          create: projectTaskTemplates[kind].map((title) => ({ title })),
        },
      },
      include: { events: true, tasks: true },
    });
  }
  @Get(":id") async detail(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id);
    const project = await this.db.eventProject.findUnique({
      where: { id },
      include: {
        events: true,
        tasks: {
          orderBy: { createdAt: "asc" },
          include: {
            assignedTo: { select: { id: true, name: true, email: true } },
          },
        },
        guests: { include: { rsvps: true, seatingTable: true } },
        expenses: {
          orderBy: { createdAt: "desc" },
          include: {
            task: { select: { id: true, title: true } },
            quoteRequest: {
              select: { id: true, vendor: { select: { name: true } } },
            },
          },
        },
        invitations: true,
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        quoteRequests: {
          include: {
            vendor: true,
            expense: true,
            review: { select: { id: true, rating: true, communicationRating: true, punctualityRating: true, qualityRating: true, comment: true, isAnonymous: true, status: true, rejectionReason: true, response: true, responseStatus: true, responseReason: true, createdAt: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!project) throw new NotFoundException("Projecto não encontrado.");
    const totalCommitted = project.expenses
      .filter((x) => x.status !== "ESTIMATED")
      .reduce((n, x) => n + Number(x.amount), 0);
    const totalPaid = project.expenses
      .filter((x) => x.status === "PAID")
      .reduce((n, x) => n + Number(x.amount), 0);
    const acceptedRsvpPeople = project.guests.reduce(
      (sum, guest) =>
        sum +
        guest.rsvps
          .filter((rsvp) => rsvp.status === "ACCEPTED")
          .reduce((n, rsvp) => n + rsvp.partySize, 0),
      0,
    );
    const pendingRsvps = project.guests.filter(
      (guest) =>
        !guest.rsvps.some(
          (rsvp) => rsvp.status === "ACCEPTED" || rsvp.status === "DECLINED",
        ),
    ).length;
    return {
      ...project,
      metrics: {
        tasksDone: project.tasks.filter((x) => x.status === "DONE").length,
        tasksTotal: project.tasks.length,
        guests: project.guests.length,
        rsvpsAccepted: acceptedRsvpPeople,
        rsvpsPending: pendingRsvps,
        totalCommitted,
        totalPaid,
      },
    };
  }
  @Patch(":id") async update(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
    @Body() body: UpdateProjectDto,
  ) {
    await this.owned(id, user.id, true);
    return this.db.eventProject.update({
      where: { id },
      data: {
        title: body.title?.trim(),
        kind: body.kind,
        date:
          body.date === null
            ? null
            : body.date
              ? new Date(body.date)
              : undefined,
        province: body.province,
        budgetLimit: body.budgetLimit,
        guestEstimate: body.guestEstimate,
      },
    });
  }
  @Patch(":id/archive") async setArchived(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
    @Body() body: ArchiveProjectDto,
  ) {
    const member = await this.owned(id, user.id);
    if (member.role !== "OWNER")
      throw new ForbiddenException(
        "Só a pessoa responsável pelo evento pode arquivar ou restaurar o evento.",
      );
    return this.db.eventProject.update({
      where: { id },
      data: { archivedAt: body.archived ? new Date() : null },
      select: { id: true, archivedAt: true },
    });
  }
  @Get(":id/events") async events(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id);
    return this.db.eventMoment.findMany({
      where: { projectId: id },
      orderBy: { startsAt: "asc" },
    });
  }
  @Post(":id/events") async addEvent(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
    @Body() body: CreateEventDto,
  ) {
    await this.owned(id, user.id, true);
    return this.db.eventMoment.create({
      data: {
        ...body,
        projectId: id,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      },
    });
  }
  @Patch(":id/events/:eventId") async updateEvent(
    @Param("id") id: string,
    @Param("eventId") eventId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: UpdateEventDto,
  ) {
    await this.owned(id, user.id, true);
    const result = await this.db.eventMoment.updateMany({
      where: { id: eventId, projectId: id },
      data: {
        ...body,
        startsAt:
          body.startsAt === null
            ? null
            : body.startsAt
              ? new Date(body.startsAt)
              : undefined,
      },
    });
    if (!result.count) throw new NotFoundException("Momento não encontrado.");
    return this.db.eventMoment.findUnique({ where: { id: eventId } });
  }
  @Delete(":id/events/:eventId") async deleteEvent(
    @Param("id") id: string,
    @Param("eventId") eventId: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id, true);
    const result = await this.db.eventMoment.deleteMany({
      where: { id: eventId, projectId: id },
    });
    if (!result.count) throw new NotFoundException("Momento não encontrado.");
    return { ok: true };
  }
  @Get(":id/tasks") async tasks(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id);
    return this.db.task.findMany({
      where: { projectId: id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    });
  }
  @Post(":id/tasks") async addTask(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
    @Body() body: CreateTaskDto,
  ) {
    await this.owned(id, user.id, true);
    if (
      body.assigneeUserId &&
      !(await this.db.projectMember.findUnique({
        where: {
          projectId_userId: { projectId: id, userId: body.assigneeUserId },
        },
      }))
    )
      throw new BadRequestException(
        "O responsável seleccionado não faz parte deste evento.",
      );
    const { assigneeUserId, ...task } = body;
    return this.db.task.create({
      data: {
        ...task,
        status: body.status ?? "TODO",
        projectId: id,
        assigneeUserId,
        dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });
  }
  @Patch(":id/tasks/:taskId") async updateTask(
    @Param("id") id: string,
    @Param("taskId") taskId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: UpdateTaskDto,
  ) {
    await this.owned(id, user.id, true);
    if (
      body.assigneeUserId &&
      !(await this.db.projectMember.findUnique({
        where: {
          projectId_userId: { projectId: id, userId: body.assigneeUserId },
        },
      }))
    )
      throw new BadRequestException(
        "O responsável seleccionado não faz parte deste evento.",
      );
    const result = await this.db.task.updateMany({
      where: { id: taskId, projectId: id },
      data: {
        ...body,
        dueAt:
          body.dueAt === null
            ? null
            : body.dueAt
              ? new Date(body.dueAt)
              : undefined,
      },
    });
    if (!result.count) throw new NotFoundException("Tarefa não encontrada.");
    return this.db.task.findUnique({
      where: { id: taskId },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });
  }
  @Delete(":id/tasks/:taskId") async deleteTask(
    @Param("id") id: string,
    @Param("taskId") taskId: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id, true);
    const result = await this.db.task.deleteMany({
      where: { id: taskId, projectId: id },
    });
    if (!result.count) throw new NotFoundException("Tarefa não encontrada.");
    return { ok: true };
  }
  @Get(":id/guests") async guests(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id);
    return this.db.guest.findMany({
      where: { projectId: id },
      include: { rsvps: true },
      orderBy: { name: "asc" },
    });
  }
  @Post(":id/guests") async addGuest(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
    @Body() body: CreateGuestDto,
  ) {
    await this.owned(id, user.id, true);
    const partySize = body.maxPartySize ?? 1;
    if (body.seatingTableId)
      await this.assertTableCapacity(
        id,
        body.seatingTableId,
        undefined,
        partySize,
      );
    return this.db.guest.create({
      data: { ...body, maxPartySize: partySize, projectId: id },
    });
  }
  @Post(":id/guests/import") async importGuests(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
    @Body() body: ImportGuestsDto,
  ) {
    await this.owned(id, user.id, true);
    const existing = await this.db.guest.findMany({
      where: { projectId: id },
      select: { name: true, email: true, phone: true, groupName: true },
    });
    const normalize = (value: string | null | undefined) =>
      (value ?? "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-AO");
    const normalizePhone = (value: string | null | undefined) =>
      (value ?? "").replace(/\D/g, "");
    const emails = new Set(
      existing.map((guest) => normalize(guest.email)).filter(Boolean),
    );
    const phones = new Set(
      existing.map((guest) => normalizePhone(guest.phone)).filter(Boolean),
    );
    const names = new Set(
      existing
        .filter((guest) => !guest.email && !guest.phone)
        .map(
          (guest) => `${normalize(guest.name)}|${normalize(guest.groupName)}`,
        ),
    );
    const records: Array<{
      name: string;
      email: string | null;
      phone: string | null;
      groupName: string | null;
      maxPartySize: number;
      projectId: string;
    }> = [];
    let skippedCount = 0;
    for (const guest of body.guests) {
      const email = guest.email?.trim().toLowerCase() || null;
      const phone = guest.phone?.trim() || null;
      const nameKey = `${normalize(guest.name)}|${normalize(guest.groupName)}`;
      if (
        (email && emails.has(normalize(email))) ||
        (phone && phones.has(normalizePhone(phone))) ||
        (!email && !phone && names.has(nameKey))
      ) {
        skippedCount += 1;
        continue;
      }
      if (email) emails.add(normalize(email));
      if (phone) phones.add(normalizePhone(phone));
      if (!email && !phone) names.add(nameKey);
      records.push({
        name: guest.name.trim(),
        email,
        phone,
        groupName: guest.groupName?.trim() || null,
        maxPartySize: guest.maxPartySize ?? 1,
        projectId: id,
      });
    }
    if (records.length) await this.db.guest.createMany({ data: records });
    return { createdCount: records.length, skippedCount };
  }
  @Patch(":id/guests/:guestId") async updateGuest(
    @Param("id") id: string,
    @Param("guestId") guestId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: UpdateGuestDto,
  ) {
    await this.owned(id, user.id, true);
    const guest = await this.db.guest.findFirst({
      where: { id: guestId, projectId: id },
      include: { rsvps: { where: { eventKey: "all" } } },
    });
    if (!guest) throw new NotFoundException("Convidado não encontrado.");
    const acceptedPartySize =
      guest.rsvps[0]?.status === "ACCEPTED" ? guest.rsvps[0].partySize : 0;
    if (
      body.maxPartySize !== undefined &&
      acceptedPartySize > body.maxPartySize
    )
      throw new BadRequestException(
        "O limite do convite não pode ser inferior ao número de pessoas já confirmado.",
      );
    const targetTable =
      body.seatingTableId === undefined
        ? guest.seatingTableId
        : body.seatingTableId;
    if (targetTable)
      await this.assertTableCapacity(
        id,
        targetTable,
        guestId,
        guest.rsvps[0]?.status === "DECLINED"
          ? 0
          : guest.rsvps[0]?.status === "ACCEPTED"
            ? guest.rsvps[0].partySize
            : (body.maxPartySize ?? guest.maxPartySize),
      );
    return this.db.guest.update({
      where: { id: guestId },
      data: body,
      include: { rsvps: true, seatingTable: true },
    });
  }
  @Get(":id/tables") async tables(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id);
    const tables = await this.db.seatingTable.findMany({
      where: { projectId: id },
      include: {
        guests: {
          select: {
            maxPartySize: true,
            rsvps: {
              where: { eventKey: "all" },
              select: { status: true, partySize: true },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });
    return tables.map(({ guests, ...table }) => ({
      ...table,
      capacityUsed: guests.reduce(
        (sum, guest) =>
          sum +
          (guest.rsvps[0]?.status === "DECLINED"
            ? 0
            : guest.rsvps[0]?.status === "ACCEPTED"
              ? guest.rsvps[0].partySize
              : guest.maxPartySize),
        0,
      ),
      _count: { guests: guests.length },
    }));
  }
  @Post(":id/tables") async addTable(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
    @Body() body: CreateSeatingTableDto,
  ) {
    await this.owned(id, user.id, true);
    return this.db.seatingTable.create({ data: { ...body, projectId: id } });
  }
  @Delete(":id/tables/:tableId") async deleteTable(
    @Param("id") id: string,
    @Param("tableId") tableId: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id, true);
    const result = await this.db.seatingTable.deleteMany({
      where: { id: tableId, projectId: id },
    });
    if (!result.count) throw new NotFoundException("Mesa não encontrada.");
    return { ok: true };
  }
  @Delete(":id/guests/:guestId") async deleteGuest(
    @Param("id") id: string,
    @Param("guestId") guestId: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id, true);
    const result = await this.db.guest.deleteMany({
      where: { id: guestId, projectId: id },
    });
    if (!result.count) throw new NotFoundException("Convidado não encontrado.");
    return { ok: true };
  }
  @Get(":id/budget/expenses") async expenses(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id);
    return this.db.expense.findMany({
      where: { projectId: id },
      include: {
        task: { select: { id: true, title: true } },
        quoteRequest: {
          select: { id: true, vendor: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
  @Post(":id/budget/expenses") async addExpense(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
    @Body() body: CreateExpenseDto,
  ) {
    await this.owned(id, user.id, true);
    if (
      body.taskId &&
      !(await this.db.task.findFirst({
        where: { id: body.taskId, projectId: id },
        select: { id: true },
      }))
    )
      throw new BadRequestException(
        "A tarefa ligada não pertence a este evento.",
      );
    return this.db.expense.create({
      data: {
        ...body,
        amount: body.amount,
        projectId: id,
        dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
      },
      include: {
        task: { select: { id: true, title: true } },
        quoteRequest: {
          select: { id: true, vendor: { select: { name: true } } },
        },
      },
    });
  }
  @Patch(":id/budget/expenses/:expenseId") async updateExpense(
    @Param("id") id: string,
    @Param("expenseId") expenseId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: UpdateExpenseDto,
  ) {
    await this.owned(id, user.id, true);
    if (
      body.taskId &&
      !(await this.db.task.findFirst({
        where: { id: body.taskId, projectId: id },
        select: { id: true },
      }))
    )
      throw new BadRequestException(
        "A tarefa ligada não pertence a este evento.",
      );
    const result = await this.db.expense.updateMany({
      where: { id: expenseId, projectId: id },
      data: {
        ...body,
        dueAt:
          body.dueAt === null
            ? null
            : body.dueAt
              ? new Date(body.dueAt)
              : undefined,
      },
    });
    if (!result.count) throw new NotFoundException("Despesa não encontrada.");
    return this.db.expense.findUnique({
      where: { id: expenseId },
      include: { task: { select: { id: true, title: true } } },
    });
  }
  @Delete(":id/budget/expenses/:expenseId") async deleteExpense(
    @Param("id") id: string,
    @Param("expenseId") expenseId: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id, true);
    const expense = await this.db.expense.findFirst({
      where: { id: expenseId, projectId: id },
      select: { id: true, quoteRequestId: true },
    });
    if (!expense) throw new NotFoundException("Despesa não encontrada.");
    await this.db.$transaction(async (tx) => {
      await tx.expense.delete({ where: { id: expense.id } });
      if (expense.quoteRequestId)
        await tx.quoteRequest.update({
          where: { id: expense.quoteRequestId },
          data: { status: "RESPONDED" },
        });
    });
    return { ok: true };
  }
  @Post(":id/invitations") async publishInvitation(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
    @Body() body: CreateInvitationDto,
  ) {
    await this.owned(id, user.id, true);
    const current = await this.db.invitation.findFirst({
      where: { projectId: id },
    });
    if (current)
      return this.db.invitation.update({
        where: { id: current.id },
        data: {
          headline: body.headline,
          message: body.message,
          theme: body.theme ?? InvitationTheme.CLASSIC,
          isPublic: true,
        },
      });
    return this.db.invitation.create({
      data: {
        projectId: id,
        slug: `${id.slice(-6)}-${randomBytes(6).toString("hex")}`,
        headline: body.headline,
        message: body.message,
        theme: body.theme ?? InvitationTheme.CLASSIC,
        isPublic: true,
      },
    });
  }
  @Get(":id/quote-requests") async quotes(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id);
    return this.db.quoteRequest.findMany({
      where: { projectId: id },
      include: {
        vendor: true,
        expense: true,
        review: { select: { id: true, rating: true, communicationRating: true, punctualityRating: true, qualityRating: true, comment: true, isAnonymous: true, status: true, rejectionReason: true, response: true, responseStatus: true, responseReason: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }
  @Post(":id/quote-requests/:requestId/review") async submitVendorReview(
    @Param("id") id: string,
    @Param("requestId") requestId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: VendorReviewDto,
  ) {
    await this.owned(id, user.id, true);
    const [project, request] = await Promise.all([
      this.db.eventProject.findUnique({ where: { id }, select: { date: true } }),
      this.db.quoteRequest.findFirst({ where: { id: requestId, projectId: id }, include: { expense: true, review: true } }),
    ]);
    if (!project || !request) throw new NotFoundException("Serviço contratado não encontrado.");
    if (!project.date) throw new BadRequestException("Define a data do evento antes de avaliar o serviço.");
    const dateKey = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Luanda", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
    if (dateKey(project.date) >= dateKey(new Date())) throw new BadRequestException("A avaliação fica disponível depois da data do evento.");
    if (request.status !== QuoteRequestStatus.HIRED || !request.expense) throw new BadRequestException("Só podes avaliar um serviço registado como contratado no orçamento.");
    if (request.review && request.review.status !== VendorReviewStatus.REJECTED) throw new BadRequestException("Já existe uma avaliação para este serviço.");
    const values = {
      rating: body.rating,
      communicationRating: body.communicationRating,
      punctualityRating: body.punctualityRating,
      qualityRating: body.qualityRating,
      comment: body.comment?.trim() || null,
      isAnonymous: body.isAnonymous ?? true,
      status: VendorReviewStatus.PENDING,
      rejectionReason: null,
      reviewedAt: null,
      reviewedBy: null,
      response: null,
      responseStatus: null,
      responseReason: null,
      responseBy: null,
      responseAt: null,
      responseReviewedAt: null,
      responseReviewedBy: null,
    };
    const review = request.review
      ? await this.db.vendorReview.update({ where: { id: request.review.id }, data: { ...values, reviewerId: user.id } })
      : await this.db.vendorReview.create({ data: { ...values, quoteRequestId: request.id, vendorId: request.vendorId, reviewerId: user.id } });
    await this.db.auditLog.create({ data: { actorId: user.id, action: request.review ? "VENDOR_REVIEW_RESUBMITTED" : "VENDOR_REVIEW_SUBMITTED", resource: "VendorReview", resourceId: review.id, metadata: { projectId: id, vendorId: request.vendorId, rating: body.rating, isAnonymous: values.isAnonymous } } });
    return review;
  }
  @Patch(":id/quote-requests/:requestId") async updateQuoteRequest(
    @Param("id") id: string,
    @Param("requestId") requestId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: UpdateQuoteRequestDto,
  ) {
    await this.owned(id, user.id, true);
    if (body.status === "HIRED")
      throw new BadRequestException(
        "Usa a acção de contratação para criar a despesa no orçamento.",
      );
    const request = await this.db.quoteRequest.findFirst({
      where: { id: requestId, projectId: id },
    });
    if (!request) throw new NotFoundException("Pedido não encontrado.");
    return this.db.quoteRequest.update({
      where: { id: requestId },
      data: {
        status: body.status,
        quotedAmount: body.quotedAmount === null ? null : body.quotedAmount,
        responseNote: body.responseNote,
        respondedAt:
          body.status === "RESPONDED"
            ? (request.respondedAt ?? new Date())
            : undefined,
      },
      include: { vendor: true, expense: true },
    });
  }
  @Post(":id/quote-requests/:requestId/hire") async hireVendor(
    @Param("id") id: string,
    @Param("requestId") requestId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: HireVendorDto,
  ) {
    await this.owned(id, user.id, true);
    const request = await this.db.quoteRequest.findFirst({
      where: { id: requestId, projectId: id },
      include: { vendor: true, expense: true },
    });
    if (!request) throw new NotFoundException("Pedido não encontrado.");
    if (request.expense) return request;
    const category = vendorBudgetCategory[request.vendor.category] ?? "Outros";
    return this.db.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          projectId: id,
          title: `${request.vendor.name} — ${request.vendor.category}`,
          category,
          amount: body.amount,
          status: "COMMITTED",
          dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
          quoteRequestId: request.id,
        },
      });
      const updated = await tx.quoteRequest.update({
        where: { id: request.id },
        data: {
          status: "HIRED",
          quotedAmount: body.amount,
          respondedAt: request.respondedAt ?? new Date(),
        },
        include: { vendor: true },
      });
      return { ...updated, expense };
    });
  }
  @Post(":id/members") async addMember(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
    @Body() body: AddMemberDto,
  ) {
    const owner = await this.owned(id, user.id, true);
    if (owner.role !== "OWNER")
      throw new ForbiddenException(
        "Só os responsáveis pelo evento podem gerir os acessos.",
      );
    const invited = await this.db.user.findUnique({
      where: { email: body.email.trim().toLowerCase() },
    });
    if (!invited)
      throw new NotFoundException(
        "Esta pessoa ainda não tem uma conta. Pede-lhe que crie uma conta primeiro.",
      );
    if (invited.id === user.id)
      throw new BadRequestException(
        "Não podes alterar o teu próprio acesso por este formulário.",
      );
    const existing = await this.db.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: invited.id } },
      select: { role: true },
    });
    if (existing?.role === "OWNER")
      throw new BadRequestException(
        "O acesso de responsável não pode ser alterado por este formulário.",
      );
    return this.db.projectMember.upsert({
      where: { projectId_userId: { projectId: id, userId: invited.id } },
      create: { projectId: id, userId: invited.id, role: body.role },
      update: { role: body.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }
  @Delete(":id/members/:userId") async removeMember(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @CurrentUser() user: SessionUser,
  ) {
    const owner = await this.owned(id, user.id, true);
    if (owner.role !== "OWNER" || userId === user.id)
      throw new ForbiddenException(
        "Só os responsáveis pelo evento podem gerir os acessos de outras pessoas.",
      );
    const removed = await this.db.projectMember.deleteMany({
      where: { projectId: id, userId, role: { not: "OWNER" } },
    });
    if (!removed.count) throw new NotFoundException("Acesso não encontrado.");
    return { ok: true };
  }
  private async assertTableCapacity(
    projectId: string,
    tableId: string,
    excludingGuestId?: string,
    requestedSeats = 1,
  ) {
    const table = await this.db.seatingTable.findFirst({
      where: { id: tableId, projectId },
      include: {
        guests: {
          select: {
            id: true,
            maxPartySize: true,
            rsvps: {
              where: { eventKey: "all" },
              select: { status: true, partySize: true },
            },
          },
        },
      },
    });
    if (!table)
      throw new NotFoundException("Mesa não encontrada neste projecto.");
    const occupied = table.guests.reduce(
      (sum, guest) =>
        sum +
        (guest.id === excludingGuestId
          ? 0
          : guest.rsvps[0]?.status === "DECLINED"
            ? 0
            : guest.rsvps[0]?.status === "ACCEPTED"
              ? guest.rsvps[0].partySize
              : guest.maxPartySize),
      0,
    );
    if (table.capacity && occupied + requestedSeats > table.capacity)
      throw new ForbiddenException(
        "Esta mesa não tem lugares suficientes para este grupo.",
      );
  }
}

@ApiTags("Convites públicos")
@Controller("invitations")
export class PublicInvitationController {
  constructor(private readonly db: DatabaseService) {}
  @Get(":slug") async get(
    @Param("slug") slug: string,
    @Query("token") token?: string,
  ) {
    const inv = await this.db.invitation.findUnique({
      where: { slug },
      include: {
        project: {
          select: {
            title: true,
            kind: true,
            date: true,
            province: true,
            events: { orderBy: { startsAt: "asc" } },
          },
        },
      },
    });
    if (!inv || !inv.isPublic)
      throw new NotFoundException("Convite não encontrado.");
    const guest = token
      ? await this.db.guest.findUnique({
          where: { rsvpToken: token },
          select: {
            name: true,
            projectId: true,
            maxPartySize: true,
            rsvps: { where: { eventKey: "all" } },
          },
        })
      : null;
    return {
      ...inv,
      recipient:
        guest?.projectId === inv.projectId
          ? {
              name: guest.name,
              maxPartySize: guest.maxPartySize,
              rsvp: guest.rsvps[0] ?? null,
            }
          : null,
    };
  }
  @Post(":slug/rsvp") async rsvp(
    @Param("slug") slug: string,
    @Body() body: RsvpDto,
  ) {
    const inv = await this.db.invitation.findUnique({ where: { slug } });
    if (!inv || !inv.isPublic)
      throw new NotFoundException("Convite não encontrado.");
    const guest = await this.db.guest.findUnique({
      where: { rsvpToken: body.token },
    });
    if (!guest || guest.projectId !== inv.projectId)
      throw new NotFoundException(
        "Este convite individual não foi encontrado.",
      );
    if (
      body.status === "ACCEPTED" &&
      (body.partySize ?? 1) > guest.maxPartySize
    )
      throw new BadRequestException(
        `Este convite permite confirmar até ${guest.maxPartySize} pessoa(s).`,
      );
    return this.db.rSVP.upsert({
      where: { guestId_eventKey: { guestId: guest.id, eventKey: "all" } },
      create: {
        guestId: guest.id,
        eventKey: "all",
        status: body.status,
        partySize: body.status === "ACCEPTED" ? (body.partySize ?? 1) : 0,
        note: body.note,
      },
      update: {
        status: body.status,
        partySize: body.status === "ACCEPTED" ? (body.partySize ?? 1) : 0,
        note: body.note,
      },
    });
  }
}
