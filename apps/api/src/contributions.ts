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
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Response } from "express";
import sharp from "sharp";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ContributionPaymentMethod, ContributionStatus, NotificationType } from "@casar/database";
import { CurrentUser, SessionGuard, SessionUser } from "./auth";
import { DatabaseService } from "./database";
import { EmailService } from "./email";
import { notifyProjectMembers } from "./notifications";

const proofDirectory = () => resolve(process.env.PRIVATE_UPLOAD_STORAGE_DIR || join(process.cwd(), "data", "private-contribution-proofs"));
const maxProofBytes = 5 * 1024 * 1024;
type ContributionUpload = { buffer: Buffer; mimetype: string };

class SaveContributionCampaignDto {
  @IsBoolean() enabled!: boolean;
  @IsString() @MinLength(2) @MaxLength(120) purpose!: string;
  @IsString() @MaxLength(1600) instructions!: string;
  @IsBoolean() proofRequired!: boolean;
  @IsBoolean() allowExpenseSelection!: boolean;
  @IsBoolean() showProgress!: boolean;
  @IsOptional() @Transform(({ value }) => value === "" || value === null ? null : Number(value)) @IsNumber() @Min(1) @Max(999999999999.99) goalAmount?: number | null;
}

class PublicContributionDto {
  @IsOptional() @IsString() @MaxLength(120) contributorName?: string;
  @IsOptional() @IsEmail() @MaxLength(180) contributorEmail?: string;
  @IsOptional() @Transform(({ value }) => value === true || value === "true") @IsBoolean() isAnonymous?: boolean;
  @Type(() => Number) @IsNumber() @Min(1) @Max(999999999999.99) amount!: number;
  @IsEnum(ContributionPaymentMethod) paymentMethod!: ContributionPaymentMethod;
  @IsOptional() @IsString() @MaxLength(1000) message?: string;
  @IsOptional() @IsString() @MaxLength(80) expenseId?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}

class ReviewContributionDto {
  @IsEnum(ContributionStatus) status!: ContributionStatus;
  @IsOptional() @IsString() @MaxLength(500) reviewNote?: string;
}

const projectContributionInclude = {
  expense: { select: { id: true, title: true } },
};

@ApiTags("Contribuições")
@ApiCookieAuth("casar_session")
@UseGuards(SessionGuard)
@Controller("projects/:id/contributions")
export class ProjectContributionsController {
  constructor(private readonly db: DatabaseService, private readonly email: EmailService) {}

  private async member(projectId: string, userId: string, write = false) {
    const member = await this.db.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
    if (!member) throw new NotFoundException("Evento não encontrado.");
    if (write && member.role === "VIEWER") throw new ForbiddenException("A tua permissão permite consultar, mas não alterar este evento.");
    if (write) {
      const project = await this.db.eventProject.findUnique({ where: { id: projectId }, select: { archivedAt: true } });
      if (project?.archivedAt) throw new ForbiddenException("Este evento está arquivado. Restaura-o antes de fazer alterações.");
    }
    return member;
  }

  @Get()
  async list(
    @Param("id") projectId: string,
    @CurrentUser() user: SessionUser,
    @Query("page") pageRaw = "1",
    @Query("status") statusRaw = "ALL",
    @Query("pageSize") pageSizeRaw = "20",
  ) {
    await this.member(projectId, user.id);
    const n = /^\d+$/.test(pageRaw) ? Number(pageRaw) : 1;
    const page = Number.isSafeInteger(n) && n > 0 ? Math.min(n, 1_000_000) : 1;
    const requestedPageSize = /^\d+$/.test(pageSizeRaw) ? Number(pageSizeRaw) : 20;
    const pageSize = [5, 10, 20, 50, 100].includes(requestedPageSize) ? requestedPageSize : 20;
    const status = Object.values(ContributionStatus).includes(statusRaw as ContributionStatus) ? statusRaw as ContributionStatus : "ALL";
    const where = { campaign: { projectId }, ...(status !== "ALL" ? { status } : {}) };
    const [campaign, contributions, total, pendingCount, confirmedAggregate] = await Promise.all([
      this.db.contributionCampaign.findUnique({ where: { projectId } }),
      this.db.eventContribution.findMany({ where, include: projectContributionInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
      this.db.eventContribution.count({ where }),
      this.db.eventContribution.count({ where: { campaign: { projectId }, status: ContributionStatus.PENDING } }),
      this.db.eventContribution.aggregate({ where: { campaign: { projectId }, status: ContributionStatus.CONFIRMED }, _sum: { amount: true }, _count: { id: true } }),
    ]);
    return {
      campaign: campaign ? { ...campaign, sharePath: `/contribuir/${campaign.publicToken}` } : null,
      contributions: contributions.map(({ proofStorageKey, ...item }) => ({ ...item, hasProof: Boolean(proofStorageKey) })),
      summary: { pending: pendingCount, confirmed: confirmedAggregate._count.id, confirmedAmount: Number(confirmedAggregate._sum.amount ?? 0) },
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  @Put()
  async save(
    @Param("id") projectId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: SaveContributionCampaignDto,
  ) {
    await this.member(projectId, user.id, true);
    if (body.enabled && !body.instructions.trim()) throw new BadRequestException("Indica como a pessoa pode fazer o pagamento antes de activar o link.");
    const existing = await this.db.contributionCampaign.findUnique({ where: { projectId }, select: { publicToken: true } });
    const campaign = await this.db.contributionCampaign.upsert({
      where: { projectId },
      create: { projectId, publicToken: randomBytes(32).toString("base64url"), ...body, goalAmount: body.goalAmount ?? null },
      update: { ...body, goalAmount: body.goalAmount ?? null },
    });
    await this.db.auditLog.create({ data: { actorId: user.id, action: "PROJECT_CONTRIBUTION_CAMPAIGN_UPDATED", resource: "ContributionCampaign", resourceId: campaign.id, metadata: { enabled: campaign.enabled, rotated: false } } });
    return { ...campaign, sharePath: `/contribuir/${existing?.publicToken ?? campaign.publicToken}` };
  }

  @Post("rotate-link")
  async rotateLink(@Param("id") projectId: string, @CurrentUser() user: SessionUser) {
    await this.member(projectId, user.id, true);
    const campaign = await this.db.contributionCampaign.findUnique({ where: { projectId } });
    if (!campaign) throw new NotFoundException("Configura as contribuições antes de criar um link.");
    const updated = await this.db.contributionCampaign.update({ where: { projectId }, data: { publicToken: randomBytes(32).toString("base64url") } });
    await this.db.auditLog.create({ data: { actorId: user.id, action: "PROJECT_CONTRIBUTION_LINK_ROTATED", resource: "ContributionCampaign", resourceId: updated.id, metadata: { previousLinkRevoked: true } } });
    return { sharePath: `/contribuir/${updated.publicToken}` };
  }

  @Patch(":contributionId")
  async review(
    @Param("id") projectId: string,
    @Param("contributionId") contributionId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: ReviewContributionDto,
  ) {
    await this.member(projectId, user.id, true);
    if (body.status === ContributionStatus.PENDING) throw new BadRequestException("Escolhe confirmar ou recusar esta contribuição.");
    const item = await this.db.eventContribution.findFirst({ where: { id: contributionId, campaign: { projectId } }, select: { id: true, status: true, amount: true, contributorEmail: true, contributorName: true, isAnonymous: true, campaign: { select: { project: { select: { title: true } } } } } });
    if (!item) throw new NotFoundException("Contribuição não encontrada.");
    if (item.status !== ContributionStatus.PENDING) throw new BadRequestException("Só podes validar contribuições que ainda estão por confirmar.");
    const changed = await this.db.eventContribution.updateMany({
      where: { id: item.id, status: ContributionStatus.PENDING },
      data: { status: body.status, reviewNote: body.reviewNote?.trim() || null, reviewedAt: new Date(), reviewedBy: user.id },
    });
    if (!changed.count) throw new BadRequestException("Esta contribuição já foi validada por outra pessoa.");
    const updated = await this.db.eventContribution.findUnique({ where: { id: item.id }, include: projectContributionInclude });
    if (!updated) throw new NotFoundException("Contribuição não encontrada.");
    await this.db.auditLog.create({ data: { actorId: user.id, action: `PROJECT_CONTRIBUTION_${body.status}`, resource: "EventContribution", resourceId: item.id, metadata: { projectId, amount: Number(item.amount) } } });
    const { proofStorageKey, ...safe } = updated;
    if (item.contributorEmail) void this.email.sendContributionDecision({ to: item.contributorEmail, name: item.isAnonymous ? null : item.contributorName, project: item.campaign.project.title, amount: Number(item.amount), confirmed: body.status === ContributionStatus.CONFIRMED, key: `${item.id}/${body.status}/${updated.reviewedAt?.getTime() ?? Date.now()}` });
    return { ...safe, hasProof: Boolean(proofStorageKey) };
  }

  @Get(":contributionId/proof")
  async proof(
    @Param("id") projectId: string,
    @Param("contributionId") contributionId: string,
    @CurrentUser() user: SessionUser,
    @Res() response: Response,
  ) {
    await this.member(projectId, user.id);
    const item = await this.db.eventContribution.findFirst({ where: { id: contributionId, campaign: { projectId } }, select: { proofStorageKey: true } });
    if (!item?.proofStorageKey) throw new NotFoundException("Comprovativo não encontrado.");
    const buffer = await readFile(join(proofDirectory(), item.proofStorageKey)).catch(() => null);
    if (!buffer) throw new NotFoundException("Comprovativo não encontrado.");
    const ext = item.proofStorageKey.endsWith(".pdf") ? "pdf" : "webp";
    response.setHeader("Content-Type", ext === "pdf" ? "application/pdf" : "image/webp");
    response.setHeader("Content-Disposition", `attachment; filename="comprovativo-${contributionId}.${ext}"`);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.send(buffer);
  }

  @Delete(":contributionId")
  async remove(@Param("id") projectId: string, @Param("contributionId") contributionId: string, @CurrentUser() user: SessionUser) {
    await this.member(projectId, user.id, true);
    const item = await this.db.eventContribution.findFirst({ where: { id: contributionId, campaign: { projectId } }, select: { id: true, proofStorageKey: true } });
    if (!item) throw new NotFoundException("Contribuição não encontrada.");
    await this.db.eventContribution.delete({ where: { id: item.id } });
    if (item.proofStorageKey) await unlink(join(proofDirectory(), item.proofStorageKey)).catch(() => undefined);
    await this.db.auditLog.create({ data: { actorId: user.id, action: "PROJECT_CONTRIBUTION_DELETED", resource: "EventContribution", resourceId: item.id, metadata: { projectId } } });
    return { ok: true };
  }
}

@ApiTags("Contribuições públicas")
@Controller("contributions")
export class PublicContributionsController {
  constructor(private readonly db: DatabaseService, private readonly email: EmailService) {}

  @Get(":token")
  async details(@Param("token") token: string, @Res({ passthrough: true }) response: Response) {
    const campaign = await this.db.contributionCampaign.findFirst({ where: { publicToken: token, enabled: true, project: { archivedAt: null } }, include: { project: { select: { title: true, kind: true, date: true } } } });
    if (!campaign) throw new NotFoundException("Este link de contribuição não está disponível.");
    response.setHeader("Cache-Control", "no-store");
    const [confirmed, expenses] = await Promise.all([
      campaign.showProgress ? this.db.eventContribution.aggregate({ where: { campaignId: campaign.id, status: ContributionStatus.CONFIRMED }, _sum: { amount: true }, _count: { id: true } }) : null,
      campaign.allowExpenseSelection ? this.db.expense.findMany({ where: { projectId: campaign.projectId, status: { not: "PAID" } }, select: { id: true, title: true }, orderBy: { title: "asc" } }) : [],
    ]);
    return {
      title: campaign.project.title,
      eventKind: campaign.project.kind,
      eventDate: campaign.project.date,
      purpose: campaign.purpose,
      instructions: campaign.instructions,
      proofRequired: campaign.proofRequired,
      allowExpenseSelection: campaign.allowExpenseSelection,
      expenses,
      progress: campaign.showProgress ? { confirmedAmount: Number(confirmed?._sum.amount ?? 0), confirmedCount: confirmed?._count.id ?? 0, goalAmount: campaign.goalAmount ? Number(campaign.goalAmount) : null } : null,
    };
  }

  @Post(":token")
  @UseInterceptors(FileInterceptor("proof", {
    limits: { fileSize: maxProofBytes, files: 1 },
    fileFilter: (_request, file, callback) => {
      const allowed = ["image/jpeg", "image/png", "application/pdf"].includes(file.mimetype);
      callback(allowed ? null : new BadRequestException("O comprovativo deve estar em JPG, PNG ou PDF."), allowed);
    },
  }))
  async submit(
    @Param("token") token: string,
    @Body() body: PublicContributionDto,
    @UploadedFile() file?: ContributionUpload,
  ) {
    const campaign = await this.db.contributionCampaign.findFirst({ where: { publicToken: token, enabled: true, project: { archivedAt: null } }, select: { id: true, projectId: true, proofRequired: true, allowExpenseSelection: true, project: { select: { title: true } } } });
    if (!campaign) throw new NotFoundException("Este link de contribuição não está disponível.");
    if (body.website?.trim()) throw new BadRequestException("Não foi possível registar esta contribuição.");
    const isAnonymous = body.isAnonymous === true;
    const contributorName = body.contributorName?.trim() || null;
    if (!isAnonymous && (!contributorName || contributorName.length < 2)) throw new BadRequestException("Indica o teu nome ou escolhe contribuir anonimamente.");
    if (campaign.proofRequired && !file) throw new BadRequestException("Anexa o comprovativo desta contribuição.");
    let expenseId: string | null = null;
    if (body.expenseId) {
      if (!campaign.allowExpenseSelection) throw new BadRequestException("A escolha de uma despesa não está activa neste evento.");
      const expense = await this.db.expense.findFirst({ where: { id: body.expenseId, projectId: campaign.projectId, status: { not: "PAID" } }, select: { id: true } });
      if (!expense) throw new BadRequestException("A despesa seleccionada não está disponível.");
      expenseId = expense.id;
    }

    let proofStorageKey: string | null = null;
    if (file) proofStorageKey = await storeProof(file);
    let contribution: { id: string; status: ContributionStatus };
    try {
      contribution = await this.db.eventContribution.create({ data: {
        campaignId: campaign.id,
        contributorName: isAnonymous ? null : contributorName,
        contributorEmail: body.contributorEmail?.trim().toLowerCase() || null,
        isAnonymous,
        amount: body.amount,
        paymentMethod: body.paymentMethod,
        message: body.message?.trim() || null,
        proofStorageKey,
        expenseId,
      }, select: { id: true, status: true } });
    } catch (error) {
      if (proofStorageKey) await unlink(join(proofDirectory(), proofStorageKey)).catch(() => undefined);
      throw error;
    }
    await notifyProjectMembers(this.db, campaign.projectId, {
        type: NotificationType.CONTRIBUTION_SUBMITTED,
        key: `contribution-submitted:${contribution.id}`,
        sourceId: contribution.id,
        title: "Nova contribuição recebida",
        body: "Uma pessoa enviou um registo de contribuição que aguarda confirmação.",
        href: `/dashboard?tab=contributions&event=${encodeURIComponent(campaign.projectId)}`,
      }).catch(() => undefined);
    void this.email.sendContributionReceived(campaign.projectId, campaign.project.title, Number(body.amount), contribution.id);
    return { id: contribution.id, status: contribution.status, message: "O registo foi enviado à organização do evento para confirmação." };
  }
}

async function storeProof(file: ContributionUpload): Promise<string> {
  const id = randomUUID();
  await mkdir(proofDirectory(), { recursive: true, mode: 0o700 });
  if (file.mimetype === "application/pdf") {
    if (file.buffer.length < 8 || file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") throw new BadRequestException("O ficheiro PDF não parece ser um comprovativo válido.");
    const key = `${id}.pdf`;
    await writeFile(join(proofDirectory(), key), file.buffer, { flag: "wx", mode: 0o600 });
    return key;
  }
  const validSignature = file.mimetype === "image/png"
    ? file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff;
  if (!validSignature) throw new BadRequestException("O conteúdo da imagem não corresponde ao formato declarado.");
  const key = `${id}.webp`;
  const safeImage = await sharp(file.buffer, { limitInputPixels: 30_000_000 }).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer().catch(() => null);
  if (!safeImage) throw new BadRequestException("Não foi possível ler a imagem do comprovativo.");
  await writeFile(join(proofDirectory(), key), safeImage, { flag: "wx", mode: 0o600 });
  return key;
}
