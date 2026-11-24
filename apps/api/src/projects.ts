import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { randomBytes } from "node:crypto";
import {
  EventType,
  ExpenseStatus,
  ExpensePaymentStatus,
  GuestContactChannel,
  GuestRequestStatus,
  InvitationTheme,
  NotificationType,
  AvailabilityStatus,
  ProjectKind,
  QuoteRequestStatus,
  TaskPriority,
  TaskStatus,
  VendorReviewStatus,
} from "@casar/database";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { DatabaseService } from "./database";
import { EmailService, webOrigin } from "./email";
import { CurrentUser, SessionGuard, SessionUser } from "./auth";
import { dismissSourceNotifications, notifyProjectMembers, notifyUser } from "./notifications";
import { createRsvpTokenCredentials, exposeGuestRsvpToken, hashRsvpToken, revealGuestRsvpToken } from "./rsvp-token";

const projectTaskTemplates: Record<ProjectKind, { title: string; category: string }[]> = {
  WEDDING: [
    { title: "Confirmar os requisitos civis aplicáveis", category: "Documentação" },
    { title: "Definir cerimónia e celebração", category: "Cerimónia" },
    { title: "Preparar a primeira lista de convidados", category: "Convidados" },
    { title: "Comparar espaços e fornecedores", category: "Fornecedores" },
    { title: "Definir orçamento e reserva para imprevistos", category: "Orçamento" },
    { title: "Escolher traje, alianças e beleza", category: "Preparativos" },
    { title: "Preparar convites e prazo de confirmação", category: "Convites" },
    { title: "Organizar mesas, transporte e apoio aos convidados", category: "Logística" },
    { title: "Confirmar horários e pagamentos com fornecedores", category: "Confirmações" },
    { title: "Combinar responsabilidades com a família", category: "Colaboração" },
  ],
  ALAMBAMENTO: [
    { title: "Conversar entre famílias sobre o pedido", category: "Famílias" },
    { title: "Definir data, local e participantes", category: "Planeamento" },
    { title: "Preparar a lista de itens e responsabilidades com ambas as famílias", category: "Tradições e itens" },
    { title: "Confirmar a lista de pedidos com os representantes das famílias", category: "Tradições e itens" },
    { title: "Distribuir responsabilidades e contribuições", category: "Colaboração" },
    { title: "Estimar os custos por categoria", category: "Orçamento" },
    { title: "Escolher espaço, alimentação e decoração", category: "Fornecedores" },
    { title: "Preparar a lista de convidados e confirmações", category: "Convidados" },
    { title: "Organizar transporte, montagem e horários", category: "Logística" },
    { title: "Partilhar o plano e distribuir responsabilidades", category: "Colaboração" },
  ],
  PARTY: [
    { title: "Definir o motivo, formato e duração da festa", category: "Planeamento" },
    { title: "Escolher data e espaço", category: "Espaço" },
    { title: "Preparar a lista de convidados", category: "Convidados" },
    { title: "Definir orçamento e número máximo de participantes", category: "Orçamento" },
    { title: "Comparar catering, música e decoração", category: "Fornecedores" },
    { title: "Confirmar horário, acesso e regras do espaço", category: "Logística" },
    { title: "Planear actividades e momentos principais", category: "Programa" },
    { title: "Organizar convites, confirmações e necessidades alimentares", category: "Convidados" },
    { title: "Confirmar pagamentos, montagem e limpeza", category: "Confirmações" },
    { title: "Distribuir tarefas pela equipa", category: "Colaboração" },
  ],
  OTHER: [
    { title: "Definir o objectivo e formato do evento", category: "Planeamento" },
    { title: "Escolher data e local", category: "Logística" },
    { title: "Preparar uma estimativa de participantes", category: "Convidados" },
    { title: "Definir orçamento, prioridades e margem de segurança", category: "Orçamento" },
    { title: "Confirmar requisitos, autorizações e acessibilidade", category: "Preparação" },
    { title: "Comparar serviços e fornecedores adequados ao evento", category: "Fornecedores" },
    { title: "Criar programa com horários e responsáveis", category: "Programa" },
    { title: "Preparar convites e recolher confirmações", category: "Comunicação" },
    { title: "Confirmar logística, pagamentos e plano alternativo", category: "Confirmações" },
    { title: "Estimar custos e prioridades", category: "Orçamento" },
    { title: "Convidar pessoas para colaborar", category: "Colaboração" },
  ],
};
const projectProgramTemplates: Record<ProjectKind, { title: string; type: EventType }[]> = {
  WEDDING: [
    { title: "Cerimónia civil", type: EventType.CIVIL },
    { title: "Cerimónia religiosa (se aplicável)", type: EventType.RELIGIOUS },
    { title: "Recepção e festa", type: EventType.RECEPTION },
  ],
  ALAMBAMENTO: [
    { title: "Encontro e apresentação das famílias", type: EventType.ALAMBAMENTO },
    { title: "Pedido tradicional", type: EventType.ALAMBAMENTO },
    { title: "Convívio e refeição", type: EventType.RECEPTION },
  ],
  PARTY: [
    { title: "Recepção dos convidados", type: EventType.RECEPTION },
    { title: "Momento principal da festa", type: EventType.CUSTOM },
    { title: "Encerramento", type: EventType.CUSTOM },
  ],
  OTHER: [
    { title: "Acolhimento dos participantes", type: EventType.CUSTOM },
    { title: "Programa principal", type: EventType.CUSTOM },
    { title: "Encerramento", type: EventType.CUSTOM },
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
  @IsOptional() @IsString() @MaxLength(350) address?: string;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ["http", "https"] }) @MaxLength(500) mapsUrl?: string;
  @IsOptional() @IsString() @MaxLength(800) guestNotes?: string;
  @IsOptional() @IsBoolean() showToGuests?: boolean;
}
class UpdateEventDto {
  @IsOptional() @IsEnum(EventType) type?: EventType;
  @IsOptional() @IsString() @MinLength(2) title?: string;
  @IsOptional() @IsDateString() startsAt?: string | null;
  @IsOptional() @IsString() venue?: string | null;
  @IsOptional() @IsString() @MaxLength(350) address?: string | null;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ["http", "https"] }) @MaxLength(500) mapsUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(800) guestNotes?: string | null;
  @IsOptional() @IsBoolean() showToGuests?: boolean;
}
class EventSummarySettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsBoolean() showFinancial?: boolean;
  @IsOptional() @IsBoolean() showGuestCounts?: boolean;
  @IsOptional() @IsBoolean() showVendors?: boolean;
  @IsOptional() @IsBoolean() showCompletedTasks?: boolean;
  @IsOptional() @IsBoolean() showProgram?: boolean;
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
class CreateExpensePaymentDto {
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsNumber() @Min(0.01) amount!: number;
  @IsOptional() @IsDateString() dueAt?: string;
}
class UpdateExpensePaymentDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) title?: string;
  @IsOptional() @IsNumber() @Min(0.01) amount?: number;
  @IsOptional() @IsDateString() dueAt?: string | null;
  @IsOptional() @IsEnum(ExpensePaymentStatus) status?: ExpensePaymentStatus;
}
class ProjectVendorFavoriteDto {
  @IsString() vendorId!: string;
}
class ProjectVenueFavoriteDto { @IsString() venueId!: string }
class ProjectVenueSelectionDto { @IsOptional() @IsString() venueId?: string | null }
class UpdateQuoteRequestDto {
  @IsOptional() @IsEnum(QuoteRequestStatus) status?: QuoteRequestStatus;
  @IsOptional() @IsEnum(AvailabilityStatus) availabilityStatus?: AvailabilityStatus;
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
class UpdateSeatingTableDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1000) capacity?: number | null;
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
  @IsOptional() @IsString() @MaxLength(1200) publicNotes?: string | null;
  @IsOptional() @IsString() @MaxLength(120) dressCode?: string | null;
  @IsOptional() @IsString() @MaxLength(120) supportContactName?: string | null;
  @IsOptional() @IsString() @MaxLength(40) supportContactPhone?: string | null;
  @IsOptional() @IsBoolean() allowGuestRequests?: boolean;
}
class AddMemberDto {
  @IsString() email!: string;
  @IsEnum({ EDITOR: "EDITOR", VIEWER: "VIEWER" }) role!: "EDITOR" | "VIEWER";
}
class SendGuestInvitationsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @IsString({ each: true }) guestIds!: string[];
}
const RsvpDecision = { ACCEPTED: "ACCEPTED", DECLINED: "DECLINED" } as const;
class RsvpDto {
  @IsString() @MinLength(24) @MaxLength(180) token!: string;
  @IsEnum(RsvpDecision) status!: "ACCEPTED" | "DECLINED";
  @IsOptional() @IsInt() @Min(1) @Max(10) partySize?: number;
  @IsOptional() @IsString() @MaxLength(400) note?: string;
}
class RetryRsvpEmailDto {
  @IsString() @MinLength(24) @MaxLength(180) token!: string;
}
class ManualRsvpDto {
  @IsEnum(RsvpDecision) status!: "ACCEPTED" | "DECLINED";
  @IsOptional() @IsInt() @Min(1) @Max(10) partySize?: number;
}
class CreateGuestRequestDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsEmail() @MaxLength(180) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3) @IsEnum(GuestContactChannel, { each: true }) contactChannels!: GuestContactChannel[];
  @IsInt() @Min(1) @Max(10) partySize!: number;
  @IsEnum(RsvpDecision) requestedRsvp!: "ACCEPTED" | "DECLINED";
  @IsOptional() @IsString() @MaxLength(400) note?: string;
  @IsOptional() @IsString() @MaxLength(300) website?: string;
}

@ApiTags("Projectos de eventos")
@ApiCookieAuth("casar_session")
@UseGuards(SessionGuard)
@Controller(["projects", "weddings"])
export class ProjectsController {
  constructor(private readonly db: DatabaseService, private readonly email: EmailService) {}
  private async logActivity(
    projectId: string,
    actorId: string,
    action: string,
    resource: string,
    resourceId: string,
    metadata: Record<string, unknown> = {},
  ) {
    try {
      await this.db.auditLog.create({
        data: {
          actorId,
          action,
          resource,
          resourceId,
          metadata: { projectId, ...metadata } as any,
        },
      });
    } catch (error) {
      console.error("Could not record event activity", { projectId, action, error });
    }
  }
  private async emailGuestsWithUpdates(projectId: string, detail: string, key: string) {
    const [project, invitation, guests] = await Promise.all([
      this.db.eventProject.findUnique({ where: { id: projectId }, select: { title: true } }),
      this.db.invitation.findFirst({ where: { projectId, isPublic: true }, select: { slug: true } }),
      this.db.guest.findMany({ where: { projectId, invitationSentAt: { not: null }, email: { not: null } }, select: { id: true, name: true, email: true } }),
    ]);
    if (!project || !invitation || !guests.length) return;
    await Promise.all(guests.map((guest) => this.email.sendEventUpdate({
      to: guest.email!,
      name: guest.name,
      project: project.title,
      detail,
      url: `${webOrigin()}/c/${invitation.slug}`,
      key: `${projectId}/${guest.id}/${key}`,
    })));
  }
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
  @Get(":id/venues/favorites") async projectVenueFavorites(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id);
    return this.db.projectVenueFavorite.findMany({
      where: { projectId: id, venue: { status: "PUBLISHED" } },
      include: { venue: true },
      orderBy: { createdAt: "desc" },
    });
  }
  @Post(":id/venues/favorites") async addProjectVenueFavorite(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
    @Body() body: ProjectVenueFavoriteDto,
  ) {
    await this.owned(id, user.id, true);
    const venue = await this.db.venue.findFirst({ where: { id: body.venueId, status: "PUBLISHED" }, select: { id: true } });
    if (!venue) throw new NotFoundException("Espaço não encontrado.");
    return this.db.projectVenueFavorite.upsert({
      where: { projectId_venueId: { projectId: id, venueId: venue.id } },
      create: { projectId: id, venueId: venue.id },
      update: {},
      include: { venue: true },
    });
  }
  @Delete(":id/venues/favorites/:venueId") async removeProjectVenueFavorite(
    @Param("id") id: string,
    @Param("venueId") venueId: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id, true);
    await this.db.projectVenueFavorite.deleteMany({ where: { projectId: id, venueId } });
    return { ok: true };
  }
  @Patch(":id/selected-venue") async selectProjectVenue(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
    @Body() body: ProjectVenueSelectionDto,
  ) {
    await this.owned(id, user.id, true);
    if (body.venueId) {
      const venue = await this.db.venue.findFirst({ where: { id: body.venueId, status: "PUBLISHED" }, select: { id: true } });
      if (!venue) throw new NotFoundException("Espaço não encontrado.");
    }
    const project = await this.db.eventProject.update({ where: { id }, data: { selectedVenueId: body.venueId ?? null }, include: { selectedVenue: { select: { id: true, slug: true, name: true, venueType: true, address: true, mapsUrl: true, province: true, municipality: true } } } });
    await this.logActivity(id, user.id, "PROJECT_VENUE_SELECTED", "Venue", body.venueId ?? "none", { subject: project.selectedVenue?.name ?? "Espaço removido" });
    return project.selectedVenue;
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
    const project = await this.db.eventProject.create({
      data: {
        title: body.title.trim(),
        kind,
        date: body.date ? new Date(body.date) : undefined,
        province: body.province,
        budgetLimit: body.budgetLimit,
        guestEstimate: body.guestEstimate,
        members: { create: { userId: user.id, role: "OWNER" } },
        events: {
          create: body.eventType
            ? [{
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
              }]
            : projectProgramTemplates[kind],
        },
        tasks: {
          create: projectTaskTemplates[kind],
        },
      },
      include: { events: true, tasks: true },
    });
    await this.logActivity(project.id, user.id, "PROJECT_CREATED", "EventProject", project.id, { subject: project.title });
    return project;
  }
  @Get(":id") async detail(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id);
    const project = await this.db.eventProject.findUnique({
      where: { id },
      include: {
        selectedVenue: { select: { id: true, slug: true, name: true, venueType: true, address: true, mapsUrl: true, province: true, municipality: true } },
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
            payments: { orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }] },
            contributions: { where: { status: "CONFIRMED" }, select: { id: true, amount: true } },
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
        venueInquiries: {
          include: { venue: { select: { id: true, name: true, slug: true } } },
          orderBy: { createdAt: "desc" },
          take: 100,
        },
      },
    });
    if (!project) throw new NotFoundException("Projecto não encontrado.");
    const confirmedContributions = await this.db.eventContribution.aggregate({
      where: { campaign: { projectId: id }, status: "CONFIRMED" },
      _sum: { amount: true },
    });
    const totalCommitted = project.expenses
      .filter((x) => x.status !== "ESTIMATED")
      .reduce((n, x) => n + Number(x.amount), 0);
    const totalPaid = project.expenses.reduce((sum, expense) => {
      if (expense.status === "PAID") return sum + Number(expense.amount);
      return sum + expense.payments
        .filter((payment) => payment.status === "PAID")
        .reduce((paid, payment) => paid + Number(payment.amount), 0);
    }, 0);
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
      guests: await Promise.all(project.guests.map((guest) => exposeGuestRsvpToken(this.db, guest))),
      metrics: {
        tasksDone: project.tasks.filter((x) => x.status === "DONE").length,
        tasksTotal: project.tasks.length,
        guests: project.guests.length,
        rsvpsAccepted: acceptedRsvpPeople,
        rsvpsPending: pendingRsvps,
        totalCommitted,
        totalPaid,
        totalContributionsConfirmed: Number(confirmedContributions._sum.amount ?? 0),
      },
    };
  }
  @Patch(":id") async update(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
    @Body() body: UpdateProjectDto,
  ) {
    await this.owned(id, user.id, true);
    const previous = await this.db.eventProject.findUnique({ where: { id }, select: { title: true, date: true, province: true } });
    const updated = await this.db.eventProject.update({
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
    await this.logActivity(id, user.id, "PROJECT_UPDATED", "EventProject", id, { changedFields: Object.keys(body) });
    if (previous) {
      const changes: string[] = [];
      if (body.title !== undefined && previous.title !== updated.title) changes.push(`Nome do evento: ${updated.title}.`);
      if (body.date !== undefined && previous.date?.getTime() !== updated.date?.getTime()) changes.push(`Data do evento: ${updated.date ? new Intl.DateTimeFormat("pt-AO", { dateStyle: "long", timeZone: "Africa/Luanda" }).format(updated.date) : "por confirmar"}.`);
      if (body.province !== undefined && previous.province !== updated.province) changes.push(`Localização: ${updated.province || "por confirmar"}.`);
      if (changes.length) await this.emailGuestsWithUpdates(id, changes.join(" "), `event-details/${updated.updatedAt.getTime()}`);
    }
    return updated;
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
    const updated = await this.db.eventProject.update({
      where: { id },
      data: { archivedAt: body.archived ? new Date() : null },
      select: { id: true, archivedAt: true },
    });
    await this.logActivity(id, user.id, body.archived ? "PROJECT_ARCHIVED" : "PROJECT_RESTORED", "EventProject", id);
    return updated;
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
    const created = await this.db.eventMoment.create({
      data: {
        ...body,
        projectId: id,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      },
    });
    await this.logActivity(id, user.id, "PROGRAM_MOMENT_CREATED", "EventMoment", created.id, { subject: created.title });
    if (created.showToGuests) await this.emailGuestsWithUpdates(id, `Novo momento no programa: ${created.title}${created.startsAt ? `, ${new Intl.DateTimeFormat("pt-AO", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Luanda" }).format(created.startsAt)}` : ""}${created.venue ? `, em ${created.venue}` : ""}.`, `program-added/${created.id}`);
    return created;
  }
  @Patch(":id/events/:eventId") async updateEvent(
    @Param("id") id: string,
    @Param("eventId") eventId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: UpdateEventDto,
  ) {
    await this.owned(id, user.id, true);
    const previous = await this.db.eventMoment.findFirst({ where: { id: eventId, projectId: id } });
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
    const updated = await this.db.eventMoment.findUnique({ where: { id: eventId } });
    await this.logActivity(id, user.id, "PROGRAM_MOMENT_UPDATED", "EventMoment", eventId, { subject: updated?.title, changedFields: Object.keys(body) });
    if (previous && updated && (previous.showToGuests || updated.showToGuests) && Object.keys(body).length) {
      const detail = updated.showToGuests
        ? `O programa foi actualizado: ${updated.title}${updated.startsAt ? `, ${new Intl.DateTimeFormat("pt-AO", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Luanda" }).format(updated.startsAt)}` : ""}${updated.venue ? `, em ${updated.venue}` : ""}.`
        : `O momento “${previous.title}” deixou de aparecer no programa do convite.`;
      await this.emailGuestsWithUpdates(id, detail, `program-updated/${eventId}/${Date.now()}`);
    }
    return updated;
  }
  @Delete(":id/events/:eventId") async deleteEvent(
    @Param("id") id: string,
    @Param("eventId") eventId: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id, true);
    const moment = await this.db.eventMoment.findFirst({ where: { id: eventId, projectId: id }, select: { title: true, showToGuests: true } });
    const result = await this.db.eventMoment.deleteMany({
      where: { id: eventId, projectId: id },
    });
    if (!result.count) throw new NotFoundException("Momento não encontrado.");
    await this.logActivity(id, user.id, "PROGRAM_MOMENT_DELETED", "EventMoment", eventId, { subject: moment?.title });
    if (moment?.showToGuests) await this.emailGuestsWithUpdates(id, `O momento “${moment.title}” foi removido do programa do evento.`, `program-removed/${eventId}`);
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
    const created = await this.db.task.create({
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
    await this.logActivity(id, user.id, "TASK_CREATED", "Task", created.id, { subject: created.title });
    if (created.assigneeUserId && created.assigneeUserId !== user.id) {
      await notifyUser(this.db, created.assigneeUserId, id, {
        type: NotificationType.TASK_ASSIGNED,
        key: `task-assigned:${created.id}:${created.assigneeUserId}:${created.createdAt.toISOString()}`,
        sourceId: created.id,
        title: "Tarefa atribuída a ti",
        body: created.title,
        href: `/dashboard?tab=planeamento&event=${encodeURIComponent(id)}`,
      });
    }
    return created;
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
    const previous = await this.db.task.findFirst({
      where: { id: taskId, projectId: id },
      select: { assigneeUserId: true, dueAt: true },
    });
    if (!previous) throw new NotFoundException("Tarefa não encontrada.");
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
    const updated = await this.db.task.findUnique({
      where: { id: taskId },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });
    if (
      updated?.assigneeUserId &&
      updated.assigneeUserId !== previous.assigneeUserId &&
      updated.assigneeUserId !== user.id
    ) {
      await notifyUser(this.db, updated.assigneeUserId, id, {
        type: NotificationType.TASK_ASSIGNED,
        key: `task-assigned:${updated.id}:${updated.assigneeUserId}:${Date.now()}`,
        sourceId: updated.id,
        title: "Tarefa atribuída a ti",
        body: updated.title,
        href: `/dashboard?tab=planeamento&event=${encodeURIComponent(id)}`,
      });
    }
    await this.logActivity(id, user.id, "TASK_UPDATED", "Task", taskId, { subject: updated?.title, changedFields: Object.keys(body) });
    if (
      updated &&
      (updated.status === "DONE" ||
        (body.dueAt !== undefined &&
          updated.dueAt?.getTime() !== previous.dueAt?.getTime()))
    ) {
      await dismissSourceNotifications(this.db, id, NotificationType.TASK_DUE, taskId);
    }
    return updated;
  }
  @Delete(":id/tasks/:taskId") async deleteTask(
    @Param("id") id: string,
    @Param("taskId") taskId: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id, true);
    const task = await this.db.task.findFirst({ where: { id: taskId, projectId: id }, select: { title: true } });
    const result = await this.db.task.deleteMany({
      where: { id: taskId, projectId: id },
    });
    if (!result.count) throw new NotFoundException("Tarefa não encontrada.");
    await this.logActivity(id, user.id, "TASK_DELETED", "Task", taskId, { subject: task?.title });
    await dismissSourceNotifications(this.db, id, NotificationType.TASK_DUE, taskId);
    return { ok: true };
  }
  @Get(":id/guests") async guests(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id);
    const guests = await this.db.guest.findMany({
      where: { projectId: id },
      include: { rsvps: true },
      orderBy: { name: "asc" },
    });
    return Promise.all(guests.map((guest) => exposeGuestRsvpToken(this.db, guest)));
  }
  @Get(":id/guest-requests") async guestRequests(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
    @Query("page") pageQuery?: string,
    @Query("pageSize") pageSizeQuery?: string,
  ) {
    await this.owned(id, user.id);
    const page = Math.max(1, Math.min(10000, Number.parseInt(pageQuery ?? "1", 10) || 1));
    const requestedPageSize = /^\d+$/.test(pageSizeQuery ?? "") ? Number(pageSizeQuery) : 20;
    const pageSize = [5, 10, 20, 50, 100].includes(requestedPageSize) ? requestedPageSize : 20;
    const [items, total, pendingCount] = await Promise.all([
      this.db.guestRequest.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.guestRequest.count({ where: { projectId: id } }),
      this.db.guestRequest.count({ where: { projectId: id, status: GuestRequestStatus.PENDING } }),
    ]);
    return { items, total, pendingCount, page, pageSize };
  }
  @Post(":id/guest-requests/:requestId/approve") async approveGuestRequest(
    @Param("id") id: string,
    @Param("requestId") requestId: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id, true);
    const credentials = createRsvpTokenCredentials();
    const guest = await this.db.$transaction(async (tx) => {
      const request = await tx.guestRequest.findFirst({ where: { id: requestId, projectId: id, status: GuestRequestStatus.PENDING } });
      if (!request) throw new NotFoundException("Pedido pendente não encontrado.");
      const claimed = await tx.guestRequest.updateMany({
        where: { id: requestId, status: GuestRequestStatus.PENDING },
        data: { status: GuestRequestStatus.APPROVED, reviewedAt: new Date() },
      });
      if (!claimed.count) throw new BadRequestException("Este pedido já foi analisado.");
      const created = await tx.guest.create({
        data: {
          projectId: id,
          name: request.name,
          email: request.email,
          phone: request.phone,
          maxPartySize: request.partySize,
          rsvpTokenHash: credentials.rsvpTokenHash,
          rsvpTokenCiphertext: credentials.rsvpTokenCiphertext,
          rsvps: { create: {
            eventKey: "all",
            status: request.requestedRsvp,
            partySize: request.requestedRsvp === "ACCEPTED" ? request.partySize : 0,
            note: request.note,
          } },
        },
        include: { rsvps: true },
      });
      await tx.guestRequest.update({ where: { id: requestId }, data: { guestId: created.id } });
      return created;
    });
    await this.logActivity(id, user.id, "GUEST_REQUEST_APPROVED", "GuestRequest", requestId, { subject: guest.name });
    let invitationSent = false;
    const [invitation, project] = await Promise.all([
      this.db.invitation.findFirst({ where: { projectId: id, isPublic: true }, select: { slug: true } }),
      this.db.eventProject.findUnique({ where: { id }, select: { title: true, date: true, province: true } }),
    ]);
    if (guest.email && invitation && project) {
      const exposed = await exposeGuestRsvpToken(this.db, guest);
      invitationSent = await this.email.sendGuestInvitation({
        to: guest.email,
        name: guest.name,
        project: project.title,
        date: project.date ? new Intl.DateTimeFormat("pt-AO", { dateStyle: "long", timeZone: "Africa/Luanda" }).format(project.date) : "Data por confirmar",
        location: project.province ?? "",
        url: `${webOrigin()}/c/${invitation.slug}?token=${encodeURIComponent(exposed.rsvpToken)}`,
        key: `guest-request-approved/${requestId}`,
      });
      await this.db.guest.update({ where: { id: guest.id }, data: {
        invitationEmailStatus: invitationSent ? "SENT" : "FAILED",
        invitationEmailError: invitationSent ? null : "O serviço de email não confirmou o envio.",
        invitationEmailAttemptedAt: new Date(),
        ...(invitationSent ? { invitationSentAt: new Date() } : {}),
      } });
    }
    return { guest: await exposeGuestRsvpToken(this.db, guest), invitationSent };
  }
  @Post(":id/guest-requests/:requestId/reject") async rejectGuestRequest(
    @Param("id") id: string,
    @Param("requestId") requestId: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id, true);
    const updated = await this.db.guestRequest.updateMany({
      where: { id: requestId, projectId: id, status: GuestRequestStatus.PENDING },
      data: { status: GuestRequestStatus.REJECTED, reviewedAt: new Date() },
    });
    if (!updated.count) throw new NotFoundException("Pedido pendente não encontrado.");
    await this.logActivity(id, user.id, "GUEST_REQUEST_REJECTED", "GuestRequest", requestId);
    return { ok: true };
  }
  @Post(":id/guest-requests/:requestId/revoke") async revokeGuestRequest(
    @Param("id") id: string,
    @Param("requestId") requestId: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id, true);
    const request = await this.db.guestRequest.findFirst({ where: { id: requestId, projectId: id, status: GuestRequestStatus.APPROVED } });
    if (!request) throw new NotFoundException("Inclusão aprovada não encontrada.");
    await this.db.$transaction(async (tx) => {
      await tx.guestRequest.update({ where: { id: requestId }, data: { status: GuestRequestStatus.REVOKED, reviewedAt: new Date() } });
      if (request.guestId) await tx.guest.deleteMany({ where: { id: request.guestId, projectId: id } });
    });
    await this.logActivity(id, user.id, "GUEST_REQUEST_REVOKED", "GuestRequest", requestId);
    return { ok: true };
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
    const credentials = createRsvpTokenCredentials();
    const guest = await this.db.guest.create({
      data: { ...body, maxPartySize: partySize, projectId: id, rsvpTokenHash: credentials.rsvpTokenHash, rsvpTokenCiphertext: credentials.rsvpTokenCiphertext },
    });
    await this.logActivity(id, user.id, "GUEST_ADDED", "Guest", guest.id);
    return exposeGuestRsvpToken(this.db, guest);
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
      rsvpTokenHash: string;
      rsvpTokenCiphertext: string;
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
        ...((({ token: _token, ...stored }) => stored)(createRsvpTokenCredentials())),
      });
    }
    if (records.length) {
      await this.db.guest.createMany({ data: records });
      await this.logActivity(id, user.id, "GUESTS_IMPORTED", "Guest", id, { count: records.length });
    }
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
    const updated = await this.db.guest.update({
      where: { id: guestId },
      data: { ...body, ...(body.email !== undefined && body.email !== guest.email ? { invitationSentAt: null } : {}) },
      include: { rsvps: true, seatingTable: true },
    });
    await this.logActivity(id, user.id, "GUEST_UPDATED", "Guest", guestId);
    return exposeGuestRsvpToken(this.db, updated);
  }
  @Patch(":id/guests/:guestId/rsvp") async updateGuestRsvpManually(
    @Param("id") id: string,
    @Param("guestId") guestId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: ManualRsvpDto,
  ) {
    await this.owned(id, user.id, true);
    const guest = await this.db.guest.findFirst({ where: { id: guestId, projectId: id }, select: { id: true, name: true, maxPartySize: true } });
    if (!guest) throw new NotFoundException("Convidado não encontrado.");
    const partySize = body.status === "ACCEPTED" ? body.partySize ?? 1 : 0;
    if (partySize > guest.maxPartySize) throw new BadRequestException(`Este convite permite confirmar até ${guest.maxPartySize} pessoa(s).`);
    const existing = await this.db.rSVP.findUnique({ where: { guestId_eventKey: { guestId, eventKey: "all" } } });
    const response = await this.db.rSVP.upsert({
      where: { guestId_eventKey: { guestId, eventKey: "all" } },
      create: { guestId, eventKey: "all", status: body.status, partySize, source: "MANUAL" },
      update: { status: body.status, partySize, source: "MANUAL" },
    });
    await this.logActivity(id, user.id, "GUEST_RSVP_RECORDED_MANUALLY", "RSVP", response.id, { subject: guest.name, status: body.status, partySize });
    if (!existing || existing.status !== response.status || existing.partySize !== response.partySize) {
      const answer = response.status === "ACCEPTED" ? `confirmou manualmente presença${response.partySize > 1 ? ` de ${response.partySize} pessoas` : ""}` : "foi marcado/a manualmente como indisponível";
      await notifyProjectMembers(this.db, id, {
        type: NotificationType.RSVP_RECEIVED,
        key: `rsvp-manual:${guest.id}:${response.updatedAt.toISOString()}`,
        sourceId: guest.id,
        title: "Presença registada pela organização",
        body: `${guest.name} ${answer}.`,
        href: `/dashboard?tab=convidados&event=${encodeURIComponent(id)}`,
      });
    }
    return response;
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
    const table = await this.db.seatingTable.create({ data: { ...body, projectId: id } });
    await this.logActivity(id, user.id, "GUEST_TABLE_CREATED", "SeatingTable", table.id, { subject: table.name });
    return table;
  }
  @Patch(":id/tables/:tableId") async updateTable(
    @Param("id") id: string,
    @Param("tableId") tableId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: UpdateSeatingTableDto,
  ) {
    await this.owned(id, user.id, true);
    const table = await this.db.seatingTable.findFirst({ where: { id: tableId, projectId: id }, select: { id: true, name: true } });
    if (!table) throw new NotFoundException("Mesa não encontrada.");
    const updated = await this.db.seatingTable.update({ where: { id: tableId }, data: body });
    await this.logActivity(id, user.id, "GUEST_TABLE_UPDATED", "SeatingTable", tableId, { subject: updated.name, changedFields: Object.keys(body) });
    return updated;
  }
  @Delete(":id/tables/:tableId") async deleteTable(
    @Param("id") id: string,
    @Param("tableId") tableId: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id, true);
    const table = await this.db.seatingTable.findFirst({ where: { id: tableId, projectId: id }, select: { name: true } });
    const result = await this.db.seatingTable.deleteMany({
      where: { id: tableId, projectId: id },
    });
    if (!result.count) throw new NotFoundException("Mesa não encontrada.");
    await this.logActivity(id, user.id, "GUEST_TABLE_DELETED", "SeatingTable", tableId, { subject: table?.name });
    return { ok: true };
  }
  @Delete(":id/guests/:guestId") async deleteGuest(
    @Param("id") id: string,
    @Param("guestId") guestId: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id, true);
    const guest = await this.db.guest.findFirst({ where: { id: guestId, projectId: id }, select: { id: true } });
    const result = await this.db.guest.deleteMany({
      where: { id: guestId, projectId: id },
    });
    if (!result.count) throw new NotFoundException("Convidado não encontrado.");
    await this.logActivity(id, user.id, "GUEST_DELETED", "Guest", guest?.id ?? guestId);
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
        payments: { orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }] },
        contributions: { where: { status: "CONFIRMED" }, select: { id: true, amount: true } },
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
    const expense = await this.db.expense.create({
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
    await this.logActivity(id, user.id, "EXPENSE_CREATED", "Expense", expense.id, { subject: expense.title });
    return expense;
  }
  @Patch(":id/budget/expenses/:expenseId") async updateExpense(
    @Param("id") id: string,
    @Param("expenseId") expenseId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: UpdateExpenseDto,
  ) {
    await this.owned(id, user.id, true);
    const previous = await this.db.expense.findFirst({
      where: { id: expenseId, projectId: id },
      select: { dueAt: true, amount: true, status: true, payments: { select: { amount: true } } },
    });
    if (!previous) throw new NotFoundException("Despesa não encontrada.");
    if (body.amount !== undefined && previous.payments.length) {
      const scheduledCents = previous.payments.reduce((total, payment) => total + Math.round(Number(payment.amount) * 100), 0);
      if (scheduledCents > Math.round(body.amount * 100))
        throw new BadRequestException("O valor da despesa não pode ficar abaixo do total das prestações registadas.");
    }
    if (body.status === "ESTIMATED" && previous.payments.length)
      throw new BadRequestException("Remove ou conclui o plano de pagamentos antes de voltar a marcar esta despesa como prevista.");
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
    if (body.status === "PAID") {
      await this.db.expensePayment.updateMany({
        where: { expenseId, expense: { projectId: id }, status: ExpensePaymentStatus.PENDING },
        data: { status: ExpensePaymentStatus.PAID, paidAt: new Date() },
      });
    }
    const updated = await this.db.expense.findUnique({
      where: { id: expenseId },
      include: { task: { select: { id: true, title: true } }, payments: { orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }] } },
    });
    if (
      updated &&
      (updated.status === "PAID" ||
        (body.dueAt !== undefined &&
          updated.dueAt?.getTime() !== previous.dueAt?.getTime()))
    ) {
      await dismissSourceNotifications(this.db, id, NotificationType.EXPENSE_DUE, expenseId);
    }
    await this.logActivity(id, user.id, "EXPENSE_UPDATED", "Expense", expenseId, { subject: updated?.title, changedFields: Object.keys(body) });
    return updated;
  }
  @Post(":id/budget/expenses/:expenseId/payments") async addExpensePayment(
    @Param("id") id: string,
    @Param("expenseId") expenseId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: CreateExpensePaymentDto,
  ) {
    await this.owned(id, user.id, true);
    const payment = await this.db.$transaction(async (tx) => {
      const expense = await tx.expense.findFirst({ where: { id: expenseId, projectId: id }, select: { id: true, amount: true, status: true } });
      if (!expense) throw new NotFoundException("Despesa não encontrada.");
      const totals = await tx.expensePayment.aggregate({ where: { expenseId }, _sum: { amount: true } });
      const nextTotal = Math.round(Number(totals._sum.amount ?? 0) * 100) + Math.round(body.amount * 100);
      if (nextTotal > Math.round(Number(expense.amount) * 100))
        throw new BadRequestException("O total das prestações não pode ultrapassar o valor da despesa.");
      if (expense.status === ExpenseStatus.PAID)
        throw new BadRequestException("Esta despesa já está paga. Reabre-a como contratada antes de adicionar prestações.");
      const payment = await tx.expensePayment.create({
        data: { expenseId, title: body.title.trim(), amount: body.amount, dueAt: body.dueAt ? new Date(body.dueAt) : undefined },
      });
      if (expense.status === ExpenseStatus.ESTIMATED)
        await tx.expense.update({ where: { id: expenseId }, data: { status: ExpenseStatus.COMMITTED } });
      return payment;
    });
    await this.logActivity(id, user.id, "EXPENSE_PAYMENT_CREATED", "ExpensePayment", payment.id, { subject: body.title.trim() });
    return payment;
  }
  @Patch(":id/budget/expenses/:expenseId/payments/:paymentId") async updateExpensePayment(
    @Param("id") id: string,
    @Param("expenseId") expenseId: string,
    @Param("paymentId") paymentId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: UpdateExpensePaymentDto,
  ) {
    await this.owned(id, user.id, true);
    const payment = await this.db.$transaction(async (tx) => {
      const expense = await tx.expense.findFirst({ where: { id: expenseId, projectId: id }, select: { id: true, amount: true, status: true } });
      if (!expense) throw new NotFoundException("Despesa não encontrada.");
      const payment = await tx.expensePayment.findFirst({ where: { id: paymentId, expenseId } });
      if (!payment) throw new NotFoundException("Prestação não encontrada.");
      const payments = await tx.expensePayment.findMany({ where: { expenseId } });
      const nextAmount = body.amount ?? Number(payment.amount);
      const scheduledCents = payments.reduce((sum, item) => sum + Math.round(Number(item.amount) * 100), 0)
        - Math.round(Number(payment.amount) * 100) + Math.round(nextAmount * 100);
      if (scheduledCents > Math.round(Number(expense.amount) * 100))
        throw new BadRequestException("O total das prestações não pode ultrapassar o valor da despesa.");
      const status = body.status ?? payment.status;
      const updated = await tx.expensePayment.update({
        where: { id: paymentId },
        data: {
          title: body.title?.trim(),
          amount: body.amount,
          dueAt: body.dueAt === null ? null : body.dueAt ? new Date(body.dueAt) : undefined,
          status,
          paidAt: status === ExpensePaymentStatus.PAID ? payment.paidAt ?? new Date() : null,
        },
      });
      const after = payments.map((item) => item.id === paymentId ? { ...item, amount: nextAmount, status } : item);
      const paidCents = after.filter((item) => item.status === ExpensePaymentStatus.PAID).reduce((sum, item) => sum + Math.round(Number(item.amount) * 100), 0);
      const fullyPaid = paidCents >= Math.round(Number(expense.amount) * 100);
      const nextExpenseStatus = fullyPaid ? ExpenseStatus.PAID
        : expense.status === ExpenseStatus.PAID || expense.status === ExpenseStatus.ESTIMATED
          ? ExpenseStatus.COMMITTED : undefined;
      if (nextExpenseStatus) await tx.expense.update({ where: { id: expenseId }, data: { status: nextExpenseStatus } });
      return updated;
    });
    await this.logActivity(id, user.id, "EXPENSE_PAYMENT_UPDATED", "ExpensePayment", payment.id, { subject: payment.title, changedFields: Object.keys(body) });
    return payment;
  }
  @Delete(":id/budget/expenses/:expenseId/payments/:paymentId") async deleteExpensePayment(
    @Param("id") id: string,
    @Param("expenseId") expenseId: string,
    @Param("paymentId") paymentId: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id, true);
    const payment = await this.db.expensePayment.findFirst({ where: { id: paymentId, expenseId, expense: { projectId: id } }, select: { title: true } });
    const result = await this.db.expensePayment.deleteMany({ where: { id: paymentId, expenseId, expense: { projectId: id }, status: ExpensePaymentStatus.PENDING } });
    if (!result.count) throw new NotFoundException("Prestação pendente não encontrada.");
    await this.logActivity(id, user.id, "EXPENSE_PAYMENT_DELETED", "ExpensePayment", paymentId, { subject: payment?.title });
    return { ok: true };
  }
  @Delete(":id/budget/expenses/:expenseId") async deleteExpense(
    @Param("id") id: string,
    @Param("expenseId") expenseId: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id, true);
    const expense = await this.db.expense.findFirst({
      where: { id: expenseId, projectId: id },
      select: { id: true, title: true, quoteRequestId: true },
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
    await dismissSourceNotifications(this.db, id, NotificationType.EXPENSE_DUE, expense.id);
    await this.logActivity(id, user.id, "EXPENSE_DELETED", "Expense", expense.id, { subject: expense.title });
    return { ok: true };
  }
  @Get(":id/share-summary") async getSummaryShare(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id);
    const share = await this.db.eventSummaryShare.findUnique({ where: { projectId: id } });
    return share ? { ...share, sharePath: `/resumo-evento/${share.publicToken}` } : {
      enabled: false, showFinancial: false, showGuestCounts: true, showVendors: false,
      showCompletedTasks: true, showProgram: true, sharePath: null,
    };
  }
  @Put(":id/share-summary") async updateSummaryShare(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
    @Body() body: EventSummarySettingsDto,
  ) {
    await this.owned(id, user.id, true);
    const existing = await this.db.eventSummaryShare.findUnique({ where: { projectId: id } });
    const data = {
      enabled: body.enabled ?? existing?.enabled ?? false,
      showFinancial: body.showFinancial ?? existing?.showFinancial ?? false,
      showGuestCounts: body.showGuestCounts ?? existing?.showGuestCounts ?? true,
      showVendors: body.showVendors ?? existing?.showVendors ?? false,
      showCompletedTasks: body.showCompletedTasks ?? existing?.showCompletedTasks ?? true,
      showProgram: body.showProgram ?? existing?.showProgram ?? true,
    };
    const share = await this.db.eventSummaryShare.upsert({
      where: { projectId: id },
      create: { projectId: id, publicToken: randomBytes(24).toString("base64url"), ...data },
      update: data,
    });
    await this.logActivity(id, user.id, "SUMMARY_SHARE_UPDATED", "EventSummaryShare", share.id);
    return { ...share, sharePath: `/resumo-evento/${share.publicToken}` };
  }
  @Post(":id/share-summary/rotate-link") async rotateSummaryLink(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.owned(id, user.id, true);
    const existing = await this.db.eventSummaryShare.findUnique({ where: { projectId: id } });
    if (!existing) throw new NotFoundException("Ainda não existe um resumo partilhável.");
    const share = await this.db.eventSummaryShare.update({
      where: { projectId: id }, data: { publicToken: randomBytes(24).toString("base64url") },
    });
    await this.logActivity(id, user.id, "SUMMARY_SHARE_LINK_ROTATED", "EventSummaryShare", share.id);
    return { sharePath: `/resumo-evento/${share.publicToken}` };
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
    if (current) {
      const updated = await this.db.invitation.update({
        where: { id: current.id },
        data: {
          headline: body.headline,
          message: body.message,
          theme: body.theme ?? InvitationTheme.CLASSIC,
          publicNotes: body.publicNotes,
          dressCode: body.dressCode,
          supportContactName: body.supportContactName,
          supportContactPhone: body.supportContactPhone,
          allowGuestRequests: body.allowGuestRequests ?? current.allowGuestRequests,
          isPublic: true,
        },
      });
      await this.logActivity(id, user.id, "INVITATION_PUBLISHED", "Invitation", updated.id);
      await this.emailGuestsWithUpdates(id, "O convite digital foi actualizado. Consulta novamente os detalhes, o programa e as informações para convidados.", `invitation-updated/${updated.updatedAt.getTime()}`);
      return updated;
    }
    const invitation = await this.db.invitation.create({
      data: {
        projectId: id,
        slug: `${id.slice(-6)}-${randomBytes(6).toString("hex")}`,
        headline: body.headline,
        message: body.message,
        theme: body.theme ?? InvitationTheme.CLASSIC,
        publicNotes: body.publicNotes,
        dressCode: body.dressCode,
        supportContactName: body.supportContactName,
        supportContactPhone: body.supportContactPhone,
        allowGuestRequests: body.allowGuestRequests ?? false,
        isPublic: true,
      },
    });
    await this.logActivity(id, user.id, "INVITATION_PUBLISHED", "Invitation", invitation.id);
    return invitation;
  }
  @Post(":id/invitations/send") async sendGuestInvitations(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
    @Body() body: SendGuestInvitationsDto,
  ) {
    await this.owned(id, user.id, true);
    const [invitation, project, guests] = await Promise.all([
      this.db.invitation.findFirst({ where: { projectId: id, isPublic: true } }),
      this.db.eventProject.findUnique({ where: { id }, select: { title: true, date: true, province: true } }),
      this.db.guest.findMany({ where: { id: { in: body.guestIds }, projectId: id, email: { not: null } } }),
    ]);
    if (!invitation || !project) throw new BadRequestException("Publica primeiro o convite do evento.");
    const guestById = new Map(guests.map((guest) => [guest.id, guest]));
    let sent = 0;
    for (const guestId of [...new Set(body.guestIds)]) {
      const guest = guestById.get(guestId);
      if (!guest?.email) continue;
      const exposed = await exposeGuestRsvpToken(this.db, guest);
      const eventUrl = `${webOrigin()}/c/${invitation.slug}?token=${encodeURIComponent(exposed.rsvpToken)}`;
      const delivered = await this.email.sendGuestInvitation({
        to: guest.email,
        name: guest.name,
        project: project.title,
        date: project.date ? new Intl.DateTimeFormat("pt-AO", { dateStyle: "long", timeZone: "Africa/Luanda" }).format(project.date) : "Data por confirmar",
        location: project.province || "",
        url: eventUrl,
        key: `${id}/${guest.id}/${invitation.updatedAt.getTime()}/${Date.now()}`,
      });
      await this.db.guest.update({ where: { id: guest.id }, data: {
        invitationEmailStatus: delivered ? "SENT" : "FAILED",
        invitationEmailError: delivered ? null : "O serviço de email não confirmou o envio.",
        invitationEmailAttemptedAt: new Date(),
        ...(delivered ? { invitationSentAt: new Date() } : {}),
      } });
      if (delivered) {
        sent += 1;
      }
    }
    return { sent, requested: new Set(body.guestIds).size, message: sent ? `${sent} convite(s) enviado(s) por email.` : "Não foi possível enviar os convites. Confirma a configuração de email e tenta novamente." };
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
    const updated = await this.db.quoteRequest.update({
      where: { id: requestId },
      data: {
        status: body.status,
        availabilityStatus: body.availabilityStatus,
        quotedAmount: body.quotedAmount === null ? null : body.quotedAmount,
        responseNote: body.responseNote,
        respondedAt:
          body.status === "RESPONDED"
            ? (request.respondedAt ?? new Date())
            : undefined,
      },
      include: { vendor: true, expense: true },
    });
    await this.logActivity(id, user.id, "QUOTE_REQUEST_UPDATED", "QuoteRequest", requestId, { subject: updated.vendor.name });
    return updated;
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
    const hired = await this.db.$transaction(async (tx) => {
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
    await this.logActivity(id, user.id, "QUOTE_REQUEST_HIRED", "QuoteRequest", requestId, { subject: request.vendor.name });
    return hired;
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
    const membership = await this.db.projectMember.upsert({
      where: { projectId_userId: { projectId: id, userId: invited.id } },
      create: { projectId: id, userId: invited.id, role: body.role },
      update: { role: body.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    let emailAttempted = false;
    let emailSent = false;
    if (!existing || existing.role !== body.role) {
      const project = await this.db.eventProject.findUnique({
        where: { id },
        select: { title: true },
      });
      await notifyUser(this.db, invited.id, id, {
        type: NotificationType.PROJECT_SHARED,
        key: `project-shared:${id}:${invited.id}:${Date.now()}`,
        title: existing ? "Acesso ao evento actualizado" : "Partilharam um evento contigo",
        body: `${user.name || user.email} ${existing ? "actualizou o teu acesso a" : "partilhou contigo"} ${project?.title || "um evento"}.`,
        href: `/dashboard?tab=eventos&event=${encodeURIComponent(id)}`,
      });
      const eventUrl = `${webOrigin()}/dashboard?tab=eventos&event=${encodeURIComponent(id)}`;
      emailAttempted = true;
      if (existing) {
        emailSent = await this.email.sendMemberAccessChanged({
          to: invited.email,
          name: invited.name,
          actor: user.name || user.email,
          project: project?.title || "um evento",
          projectId: id,
          detail: `O teu nível de acesso agora é ${body.role === "VIEWER" ? "Só consulta" : "Pode editar"}.`,
          key: `${id}/${invited.id}/${body.role}/${Date.now()}`,
        });
      } else {
        emailSent = await this.email.sendProjectShared(
          invited.email,
          {
            recipient: invited.name,
            inviter: user.name || user.email,
            project: project?.title || "um evento",
            role: body.role === "VIEWER" ? "Consulta" : "Edição",
            url: eventUrl,
          },
          `${id}/${invited.id}/${Date.now()}`,
        );
      }
      await this.logActivity(
        id,
        user.id,
        existing ? "PROJECT_MEMBER_ROLE_UPDATED" : "PROJECT_MEMBER_ADDED",
        "ProjectMember",
        invited.id,
        { subject: invited.name || invited.email, role: body.role },
      );
    }
    return { ...membership, emailAttempted, emailSent };
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
    const target = await this.db.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId } },
      include: { user: { select: { name: true, email: true } } },
    });
    const removed = await this.db.projectMember.deleteMany({
      where: { projectId: id, userId, role: { not: "OWNER" } },
    });
    if (!removed.count) throw new NotFoundException("Acesso não encontrado.");
    await this.logActivity(id, user.id, "PROJECT_MEMBER_REMOVED", "ProjectMember", userId, { subject: target?.user.name || target?.user.email });
    let emailAttempted = false;
    let emailSent = false;
    if (target) {
      const project = await this.db.eventProject.findUnique({ where: { id }, select: { title: true } });
      emailAttempted = true;
      emailSent = await this.email.sendMemberAccessRemoved({
        to: target.user.email,
        name: target.user.name,
        actor: user.name || user.email,
        project: project?.title || "um evento",
        projectId: id,
        key: `${id}/${userId}/${Date.now()}`,
      });
    }
    return { ok: true, emailAttempted, emailSent };
  }
  @Post(":id/members/:userId/email") async resendMemberAccessEmail(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @CurrentUser() user: SessionUser,
  ) {
    const owner = await this.owned(id, user.id, true);
    if (owner.role !== "OWNER") throw new ForbiddenException("Só a pessoa responsável pode reenviar o acesso.");
    const member = await this.db.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId } },
      include: { user: { select: { id: true, name: true, email: true } }, project: { select: { title: true } } },
    });
    if (!member || member.role === "OWNER") throw new NotFoundException("Acesso não encontrado.");
    const sent = await this.email.sendProjectShared(member.user.email, {
      recipient: member.user.name,
      inviter: user.name || user.email,
      project: member.project.title,
      role: member.role === "VIEWER" ? "Consulta" : "Edição",
      url: `${webOrigin()}/dashboard?tab=eventos&event=${encodeURIComponent(id)}`,
    }, `${id}/${userId}/retry/${Date.now()}`);
    return { emailAttempted: true, emailSent: sent, message: sent ? "Email de acesso enviado." : "Não foi possível enviar o email de acesso." };
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
  constructor(private readonly db: DatabaseService, private readonly email: EmailService) {}
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
            events: {
              where: { showToGuests: true },
              orderBy: { startsAt: "asc" },
              select: {
                id: true,
                title: true,
                type: true,
                startsAt: true,
                venue: true,
                address: true,
                mapsUrl: true,
                guestNotes: true,
              },
            },
          },
        },
      },
    });
    if (!inv || !inv.isPublic)
      throw new NotFoundException("Convite não encontrado.");
    let guest = token && token.length <= 180
      ? await this.db.guest.findFirst({
          where: { OR: [
            { rsvpTokenHash: hashRsvpToken(token) },
            { rsvpTokenPreviousHash: hashRsvpToken(token), rsvpTokenPreviousExpiresAt: { gt: new Date() } },
          ] },
          select: {
            id: true, name: true, projectId: true, maxPartySize: true,
            rsvpTokenHash: true, rsvpTokenCiphertext: true, rsvpTokenLegacy: true,
            rsvpTokenPreviousHash: true, rsvpTokenPreviousExpiresAt: true,
            seatingTable: { select: { name: true } },
            rsvps: { where: { eventKey: "all" } },
          },
        })
      : null;
    if (!guest && token && token.length <= 180) {
      guest = await this.db.guest.findUnique({
        where: { rsvpTokenLegacy: token },
        select: {
          id: true, name: true, projectId: true, maxPartySize: true,
          rsvpTokenHash: true, rsvpTokenCiphertext: true, rsvpTokenLegacy: true,
          rsvpTokenPreviousHash: true, rsvpTokenPreviousExpiresAt: true,
          seatingTable: { select: { name: true } },
          rsvps: { where: { eventKey: "all" } },
        },
      });
    }
    if (guest) await revealGuestRsvpToken(this.db, guest);
    return {
      ...inv,
      recipient:
        guest?.projectId === inv.projectId
          ? {
              name: guest.name,
              maxPartySize: guest.maxPartySize,
              tableName: guest.seatingTable?.name ?? null,
              rsvp: guest.rsvps[0] ? {
                status: guest.rsvps[0].status,
                partySize: guest.rsvps[0].partySize,
                confirmationEmailStatus: guest.rsvps[0].confirmationEmailStatus,
              } : null,
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
    const tokenHash = hashRsvpToken(body.token);
    let guest = await this.db.guest.findFirst({ where: { OR: [
      { rsvpTokenHash: tokenHash },
      { rsvpTokenPreviousHash: tokenHash, rsvpTokenPreviousExpiresAt: { gt: new Date() } },
    ] } });
    if (!guest) guest = await this.db.guest.findUnique({ where: { rsvpTokenLegacy: body.token } });
    if (!guest || guest.projectId !== inv.projectId)
      throw new NotFoundException(
        "Este convite individual não foi encontrado.",
      );
    await revealGuestRsvpToken(this.db, guest);
    if (
      body.status === "ACCEPTED" &&
      (body.partySize ?? 1) > guest.maxPartySize
    )
      throw new BadRequestException(
        `Este convite permite confirmar até ${guest.maxPartySize} pessoa(s).`,
      );
    const existing = await this.db.rSVP.findUnique({
      where: { guestId_eventKey: { guestId: guest.id, eventKey: "all" } },
      select: { status: true, partySize: true, confirmationEmailStatus: true },
    });
    const response = await this.db.rSVP.upsert({
      where: { guestId_eventKey: { guestId: guest.id, eventKey: "all" } },
      create: {
        guestId: guest.id,
        eventKey: "all",
        status: body.status,
        source: "PUBLIC_LINK",
        partySize: body.status === "ACCEPTED" ? (body.partySize ?? 1) : 0,
        note: body.note,
      },
      update: {
        status: body.status,
        source: "PUBLIC_LINK",
        partySize: body.status === "ACCEPTED" ? (body.partySize ?? 1) : 0,
        note: body.note,
      },
    });
    let emailAttempted = false;
    let emailSent = false;
    let emailMessage: string | null = null;
    const responseChanged = !existing || existing.status !== response.status || existing.partySize !== response.partySize;
    if (
      responseChanged
    ) {
      const answer =
        response.status === "ACCEPTED"
          ? `confirmou presença${response.partySize > 1 ? ` de ${response.partySize} pessoas` : ""}`
          : "indicou que não poderá estar presente";
      await notifyProjectMembers(this.db, inv.projectId, {
        type: NotificationType.RSVP_RECEIVED,
        key: `rsvp:${guest.id}:${response.updatedAt.toISOString()}`,
        sourceId: guest.id,
        title: existing
          ? "Resposta de convidado actualizada"
          : "Nova confirmação de presença",
        body: `${guest.name} ${answer}.`,
        href: `/dashboard?tab=convidados&event=${encodeURIComponent(inv.projectId)}`,
      });
    }
    if (guest.email && (responseChanged || existing?.confirmationEmailStatus !== "SENT")) {
      emailAttempted = true;
      const project = await this.db.eventProject.findUnique({ where: { id: inv.projectId }, select: { title: true, date: true } });
      emailSent = await this.email.sendRsvpConfirmation({
        to: guest.email,
        name: guest.name,
        project: project?.title || "o evento",
        date: project?.date ? new Intl.DateTimeFormat("pt-AO", { dateStyle: "long", timeZone: "Africa/Luanda" }).format(project.date) : "",
        status: response.status as "ACCEPTED" | "DECLINED",
        partySize: response.partySize,
        url: `${webOrigin()}/c/${inv.slug}?token=${encodeURIComponent(body.token)}`,
        key: `${response.id}/${response.updatedAt.toISOString()}`,
      });
      emailMessage = emailSent ? "A confirmação foi aceite pelo serviço de email." : "A resposta foi registada, mas não foi possível enviar o email de confirmação. Podes tentar novamente abaixo.";
      const attemptedAt = new Date();
      await this.db.rSVP.update({
        where: { id: response.id },
        data: {
          confirmationEmailStatus: emailSent ? "SENT" : "FAILED",
          confirmationEmailError: emailSent ? null : (this.email.isConfigured ? "Não foi possível entregar o email ao serviço de envio." : "O envio de email está desactivado ou não configurado."),
          confirmationEmailAttemptedAt: attemptedAt,
          confirmationEmailSentAt: emailSent ? attemptedAt : null,
        },
      });
    } else if (guest.email && !responseChanged) {
      emailMessage = "A tua resposta já estava registada e a confirmação por email já foi enviada.";
    } else {
      emailMessage = "A tua resposta foi registada. Este convite não tem um email associado para confirmação.";
    }
    return { id: response.id, status: response.status, partySize: response.partySize, updatedAt: response.updatedAt, emailAttempted, emailSent, emailMessage };
  }
  @Post(":slug/rsvp/resend") async resendRsvpConfirmation(@Param("slug") slug: string, @Body() body: RetryRsvpEmailDto) {
    const invitation = await this.db.invitation.findUnique({ where: { slug }, select: { id: true, slug: true, projectId: true, isPublic: true } });
    if (!invitation?.isPublic) throw new NotFoundException("Convite não encontrado.");
    const tokenHash = hashRsvpToken(body.token);
    let guest = await this.db.guest.findFirst({ where: { projectId: invitation.projectId, OR: [
      { rsvpTokenHash: tokenHash },
      { rsvpTokenPreviousHash: tokenHash, rsvpTokenPreviousExpiresAt: { gt: new Date() } },
    ] } });
    if (!guest) guest = await this.db.guest.findFirst({ where: { projectId: invitation.projectId, rsvpTokenLegacy: body.token } });
    if (!guest) throw new NotFoundException("Este convite individual não foi encontrado.");
    if (!guest.email) throw new BadRequestException("Este convite não tem um endereço de email associado. Contacta a organização do evento.");
    const rsvp = await this.db.rSVP.findUnique({ where: { guestId_eventKey: { guestId: guest.id, eventKey: "all" } } });
    if (!rsvp || (rsvp.status !== "ACCEPTED" && rsvp.status !== "DECLINED")) throw new BadRequestException("Regista primeiro a tua resposta ao convite.");
    const project = await this.db.eventProject.findUnique({ where: { id: invitation.projectId }, select: { title: true, date: true } });
    const attemptedAt = new Date();
    const sent = await this.email.sendRsvpConfirmation({
      to: guest.email,
      name: guest.name,
      project: project?.title || "o evento",
      date: project?.date ? new Intl.DateTimeFormat("pt-AO", { dateStyle: "long", timeZone: "Africa/Luanda" }).format(project.date) : "",
      status: rsvp.status,
      partySize: rsvp.partySize,
      url: `${webOrigin()}/c/${invitation.slug}?token=${encodeURIComponent(body.token)}`,
      key: `${rsvp.id}/${attemptedAt.toISOString()}`,
    });
    await this.db.rSVP.update({ where: { id: rsvp.id }, data: {
      confirmationEmailStatus: sent ? "SENT" : "FAILED",
      confirmationEmailError: sent ? null : (this.email.isConfigured ? "Não foi possível entregar o email ao serviço de envio." : "O envio de email está desactivado ou não configurado."),
      confirmationEmailAttemptedAt: attemptedAt,
      confirmationEmailSentAt: sent ? new Date() : null,
    } });
    return { emailAttempted: true, emailSent: sent, emailMessage: sent ? "Enviámos uma confirmação para o teu email." : "Não foi possível enviar o email. Tenta novamente mais tarde." };
  }
  @Post(":slug/requests") async requestGuestInclusion(
    @Param("slug") slug: string,
    @Body() body: CreateGuestRequestDto,
  ) {
    const invitation = await this.db.invitation.findUnique({ where: { slug }, select: { id: true, projectId: true, isPublic: true, allowGuestRequests: true } });
    if (!invitation?.isPublic || !invitation.allowGuestRequests)
      throw new NotFoundException("Este convite não está a receber pedidos de inclusão.");
    if (body.website?.trim()) return { ok: true };
    const email = body.email?.trim().toLowerCase() || null;
    const phone = body.phone?.trim() || null;
    const wantsEmail = body.contactChannels.includes(GuestContactChannel.EMAIL);
    const wantsPhone = body.contactChannels.some((channel) => channel === GuestContactChannel.PHONE || channel === GuestContactChannel.WHATSAPP);
    if (wantsEmail && !email) throw new BadRequestException("Indica o email que queres usar para contacto.");
    if (wantsPhone && !phone) throw new BadRequestException("Indica o número de telefone ou WhatsApp que queres usar para contacto.");
    if (email && !wantsEmail) throw new BadRequestException("Remove o email ou selecciona Email como meio de contacto.");
    if (phone && !wantsPhone) throw new BadRequestException("Remove o telefone ou selecciona Telefone ou WhatsApp como meio de contacto.");
    const duplicate = await this.db.guestRequest.findFirst({
      where: {
        projectId: invitation.projectId,
        status: { in: [GuestRequestStatus.PENDING, GuestRequestStatus.APPROVED] },
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
      select: { id: true },
    });
    if (duplicate) return { ok: true, alreadyReceived: true };
    const request = await this.db.guestRequest.create({
      data: {
        projectId: invitation.projectId,
        invitationId: invitation.id,
        name: body.name.trim(),
        email,
        phone,
        contactChannels: body.contactChannels,
        partySize: body.partySize,
        requestedRsvp: body.requestedRsvp,
        note: body.note?.trim() || null,
      },
      select: { id: true, name: true },
    });
    await notifyProjectMembers(this.db, invitation.projectId, {
      type: NotificationType.RSVP_RECEIVED,
      key: `guest-request:${request.id}`,
      sourceId: request.id,
      title: "Novo pedido para participar",
      body: `${request.name} pediu para ser incluído/a na lista de convidados.`,
      href: `/dashboard?tab=convidados&event=${encodeURIComponent(invitation.projectId)}`,
    });
    return { ok: true };
  }
}


@ApiTags("Resumo público do evento")
@Controller("event-summaries")
export class PublicEventSummaryController {
  constructor(private readonly db: DatabaseService) {}

  @Get(":token")
  @Header("Cache-Control", "no-store")
  async get(@Param("token") token: string) {
    const share = await this.db.eventSummaryShare.findFirst({
      where: { publicToken: token, enabled: true, project: { archivedAt: null } },
      include: {
        project: {
          select: {
            title: true, kind: true, date: true, province: true,
            tasks: { select: { id: true, title: true, status: true }, orderBy: { createdAt: "desc" } },
            guests: { select: { maxPartySize: true, rsvps: { where: { eventKey: "all" }, select: { status: true, partySize: true } } } },
            expenses: { select: { amount: true, status: true, payments: { select: { amount: true, status: true } } } },
            quoteRequests: { select: { status: true, vendor: { select: { name: true, category: true } } }, orderBy: { createdAt: "desc" } },
            events: { where: { showToGuests: true }, select: { id: true, title: true, type: true, startsAt: true, venue: true, address: true, mapsUrl: true }, orderBy: { startsAt: "asc" } },
            contributionCampaign: { select: { id: true } },
          },
        },
      },
    });
    if (!share) throw new NotFoundException("Este resumo não está disponível.");
    const project = share.project;
    const tasksDone = project.tasks.filter(task => task.status === "DONE");
    const completedPaid = project.expenses.reduce((total, expense) => total + (expense.status === "PAID" ? Number(expense.amount) : expense.payments.filter(payment => payment.status === "PAID").reduce((sum, payment) => sum + Number(payment.amount), 0)), 0);
    const guestSummary = project.guests.reduce((summary, guest) => {
      const rsvp = guest.rsvps[0];
      if (!rsvp || (rsvp.status !== "ACCEPTED" && rsvp.status !== "DECLINED")) {
        summary.pendingInvitations += 1;
        summary.pendingPeople += guest.maxPartySize;
      } else if (rsvp.status === "ACCEPTED") summary.confirmedPeople += rsvp.partySize;
      else summary.declinedInvitations += 1;
      return summary;
    }, { confirmedPeople: 0, pendingPeople: 0, pendingInvitations: 0, declinedInvitations: 0 });
    const contributionTotal = share.showFinancial && project.contributionCampaign
      ? await this.db.eventContribution.aggregate({ where: { campaignId: project.contributionCampaign.id, status: "CONFIRMED" }, _sum: { amount: true } })
      : null;
    return {
      title: project.title, kind: project.kind, date: project.date, province: project.province,
      updatedAt: new Date(),
      progress: { completed: tasksDone.length, total: project.tasks.length, percent: project.tasks.length ? Math.round(tasksDone.length / project.tasks.length * 100) : 0, tasks: share.showCompletedTasks ? tasksDone.map(({ title }) => title) : [] },
      guests: share.showGuestCounts ? guestSummary : null,
      finance: share.showFinancial ? { expensesPaid: completedPaid, contributionsConfirmed: Number(contributionTotal?._sum.amount ?? 0), net: Number(contributionTotal?._sum.amount ?? 0) - completedPaid } : null,
      vendors: share.showVendors ? project.quoteRequests.map(request => ({ name: request.vendor.name, category: request.vendor.category, status: request.status })) : null,
      program: share.showProgram ? project.events : null,
    };
  }
}
