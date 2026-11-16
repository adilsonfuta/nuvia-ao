import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Response } from "express";
import sharp from "sharp";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { NotificationType, QuoteRequestStatus, VendorClaimStatus } from "@casar/database";
import { CurrentUser, SessionGuard, SessionUser } from "./auth";
import { DatabaseService } from "./database";
import { notifyProjectMembers } from "./notifications";

const storageDirectory = () => resolve(process.env.PORTFOLIO_STORAGE_DIR || join(process.cwd(), "data", "vendor-portfolio"));
const publicImageUrl = (id: string) => `/api/v1/vendor-portfolio/${id}/image`;
export async function sendStoredVendorImage(storageKey: string, response: Response, isPublic: boolean) {
  if (!/^[a-f0-9-]{36}\.webp$/i.test(storageKey)) throw new NotFoundException("Imagem não encontrada.");
  const image = await readFile(join(storageDirectory(), storageKey)).catch(() => null);
  if (!image) throw new NotFoundException("Imagem não encontrada.");
  response.setHeader("Content-Type", "image/webp");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", isPublic ? "public, max-age=31536000, immutable" : "private, no-store");
  response.send(image);
}

class VendorClaimDto {
  @IsString() vendorId!: string;
  @IsString() @MinLength(10) @MaxLength(600) message!: string;
}
class NewVendorProfileDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(2) @MaxLength(80) category!: string;
  @IsString() @MinLength(2) @MaxLength(80) province!: string;
  @IsOptional() @IsString() @MaxLength(100) municipality?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(120, { each: true }) services?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(120, { each: true }) serviceAreas?: string[];
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @IsEmail() @MaxLength(180) email?: string;
  @IsOptional() @IsString() @IsUrl({ protocols: ["https"], require_protocol: true }) websiteUrl?: string;
  @IsOptional() @IsString() @IsUrl({ protocols: ["https"], require_protocol: true }) instagramUrl?: string;
  @IsOptional() @IsString() @IsUrl({ protocols: ["https"], require_protocol: true }) facebookUrl?: string;
  @IsOptional() @IsString() @IsUrl({ protocols: ["https"], require_protocol: true }) tiktokUrl?: string;
}
class VendorProfileSubmissionDto {
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(120, { each: true }) services?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(120, { each: true }) serviceAreas?: string[];
  @IsOptional() @IsString() @IsUrl({ protocols: ["https"], require_protocol: true }) websiteUrl?: string | null;
  @IsOptional() @IsString() @IsUrl({ protocols: ["https"], require_protocol: true }) instagramUrl?: string | null;
  @IsOptional() @IsString() @IsUrl({ protocols: ["https"], require_protocol: true }) facebookUrl?: string | null;
  @IsOptional() @IsString() @IsUrl({ protocols: ["https"], require_protocol: true }) tiktokUrl?: string | null;
}
class PortfolioUploadDto {
  @IsString() @MinLength(8) @MaxLength(180) altText!: string;
}
class PortfolioItemUpdateDto {
  @IsOptional() @IsString() @MinLength(8) @MaxLength(180) altText?: string;
  @IsOptional() @IsBoolean() isCover?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(20) sortOrder?: number;
}
class PortfolioOrderDto {
  @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) ids!: string[];
}
class VendorReviewResponseDto {
  @IsString() @MinLength(8) @MaxLength(1500) response!: string;
}
class VendorQuoteResponseDto {
  @IsOptional() @IsInt() @Min(0) @Max(1000000000000) quotedAmount?: number | null;
  @IsOptional() @IsString() @MaxLength(2000) responseNote?: string | null;
}

@ApiTags("Área de fornecedores")
@ApiCookieAuth("casar_session")
@UseGuards(SessionGuard)
@Controller("vendor-portal")
export class VendorPortalController {
  constructor(private readonly db: DatabaseService) {}

  private async ownedVendor(vendorId: string, userId: string) {
    const vendor = await this.db.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor || vendor.ownerUserId !== userId)
      throw new NotFoundException("Perfil de fornecedor não encontrado.");
    return vendor;
  }

  @Get()
  async profiles(
    @CurrentUser() user: SessionUser,
    @Query("inquiryPage") inquiryPageRaw = "1",
    @Query("inquiryStatus") inquiryStatusRaw = "ALL",
    @Query("inquirySearch") inquirySearchRaw = "",
  ) {
    const requestedPage = /^\d+$/.test(inquiryPageRaw) ? Number(inquiryPageRaw) : 1;
    const inquiryPage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 1_000_000) : 1;
    const pageSize = 10;
    const inquiryStatus = inquiryStatusRaw === "OPEN" || Object.values(QuoteRequestStatus).includes(inquiryStatusRaw as QuoteRequestStatus)
      ? inquiryStatusRaw
      : "ALL";
    const inquirySearch = inquirySearchRaw.trim().slice(0, 100);
    const inquiryWhere = {
      vendor: { ownerUserId: user.id },
      ...(inquiryStatus === "OPEN" ? { status: { in: [QuoteRequestStatus.NEW, QuoteRequestStatus.SENT] } }
        : inquiryStatus !== "ALL" ? { status: inquiryStatus as QuoteRequestStatus } : {}),
      ...(inquirySearch ? {
        OR: [
          { message: { contains: inquirySearch, mode: "insensitive" as const } },
          { project: { title: { contains: inquirySearch, mode: "insensitive" as const } } },
          { vendor: { name: { contains: inquirySearch, mode: "insensitive" as const }, ownerUserId: user.id } },
        ],
      } : {}),
    };
    const ownerWhere = { vendor: { ownerUserId: user.id } };
    const [vendors, claims, inquiries, inquiryCount, unreadCount, openCount] = await Promise.all([
      this.db.vendor.findMany({
        where: { ownerUserId: user.id },
        include: {
          portfolio: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { uploadedAt: "asc" }] },
          profileSubmissions: { orderBy: { createdAt: "desc" }, take: 8 },
          reviews: {
            where: { status: "APPROVED" },
            select: { id: true, rating: true, communicationRating: true, punctualityRating: true, qualityRating: true, comment: true, isAnonymous: true, createdAt: true, response: true, responseStatus: true, responseReason: true, reviewer: { select: { name: true } }, quoteRequest: { select: { project: { select: { title: true, date: true } } } } },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { name: "asc" },
      }),
      this.db.vendorClaim.findMany({
        where: { userId: user.id },
        include: { vendor: { select: { id: true, name: true, slug: true, status: true } } },
        orderBy: { createdAt: "desc" },
      }),
      this.db.quoteRequest.findMany({
        where: inquiryWhere,
        include: {
          vendor: { select: { id: true, name: true, slug: true, category: true } },
          project: { select: { id: true, title: true, date: true, province: true, guestEstimate: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (inquiryPage - 1) * pageSize,
        take: pageSize,
      }),
      this.db.quoteRequest.count({ where: inquiryWhere }),
      this.db.quoteRequest.count({ where: { ...ownerWhere, vendorViewedAt: null } }),
      this.db.quoteRequest.count({ where: { ...ownerWhere, status: { in: [QuoteRequestStatus.NEW, QuoteRequestStatus.SENT] } } }),
    ]);
    return {
      vendors: vendors.map((vendor) => ({ ...vendor, reviews: vendor.reviews.map((review) => ({ ...review, reviewerName: review.isAnonymous ? null : review.reviewer?.name ?? null, reviewer: undefined })) })),
      claims,
      inquiries,
      inquiryMeta: { page: inquiryPage, pageSize, total: inquiryCount, totalPages: Math.max(1, Math.ceil(inquiryCount / pageSize)), unreadCount, openCount },
    };
  }

  @Patch("inquiries/:requestId")
  async respondToInquiry(
    @Param("requestId") requestId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: VendorQuoteResponseDto,
  ) {
    const request = await this.db.quoteRequest.findFirst({
      where: { id: requestId, vendor: { ownerUserId: user.id } },
      include: { vendor: { select: { name: true } }, review: true },
    });
    if (!request) throw new NotFoundException("Pedido não encontrado.");
    if (request.status === QuoteRequestStatus.HIRED || request.status === QuoteRequestStatus.CLOSED)
      throw new BadRequestException("Este pedido já está fechado e não pode receber uma nova resposta.");
    const updated = await this.db.quoteRequest.update({
      where: { id: request.id },
      data: {
        status: QuoteRequestStatus.RESPONDED,
        quotedAmount: body.quotedAmount === undefined ? request.quotedAmount : body.quotedAmount,
        responseNote: body.responseNote?.trim() || null,
        respondedAt: request.respondedAt ?? new Date(),
      },
      select: { id: true, projectId: true, vendorId: true, status: true, quotedAmount: true, responseNote: true, respondedAt: true },
    });
    await notifyProjectMembers(this.db, request.projectId, {
      type: NotificationType.QUOTE_RESPONSE_RECEIVED,
      key: `quote-response:${request.id}:${updated.respondedAt?.toISOString()}`,
      sourceId: request.id,
      title: `Resposta de ${request.vendor.name}`,
      body: body.quotedAmount === undefined || body.quotedAmount === null
        ? "O fornecedor respondeu ao teu pedido de informação."
        : `O fornecedor respondeu com uma proposta de ${new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(body.quotedAmount)}.`,
      href: `/dashboard?tab=fornecedores&event=${encodeURIComponent(request.projectId)}`,
    });
    return updated;
  }

  @Patch("inquiries/:requestId/read")
  async markInquiryRead(@Param("requestId") requestId: string, @CurrentUser() user: SessionUser) {
    const inquiry = await this.db.quoteRequest.findFirst({
      where: { id: requestId, vendor: { ownerUserId: user.id } },
      select: { id: true, vendorViewedAt: true },
    });
    if (!inquiry) throw new NotFoundException("Pedido não encontrado.");
    return this.db.quoteRequest.update({
      where: { id: inquiry.id },
      data: { vendorViewedAt: inquiry.vendorViewedAt ?? new Date() },
      select: { id: true, vendorViewedAt: true },
    });
  }

  @Post(":id/reviews/:reviewId/response")
  async respondToReview(
    @Param("id") vendorId: string,
    @Param("reviewId") reviewId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: VendorReviewResponseDto,
  ) {
    await this.ownedVendor(vendorId, user.id);
    const review = await this.db.vendorReview.findFirst({ where: { id: reviewId, vendorId, status: "APPROVED" } });
    if (!review) throw new NotFoundException("Avaliação publicada não encontrada.");
    if (review.responseStatus === "PENDING") throw new BadRequestException("A tua resposta já está à espera de revisão.");
    const updated = await this.db.vendorReview.update({ where: { id: reviewId }, data: { response: body.response.trim(), responseStatus: "PENDING", responseReason: null, responseBy: user.id, responseAt: new Date(), responseReviewedAt: null, responseReviewedBy: null } });
    await this.db.auditLog.create({ data: { actorId: user.id, action: "VENDOR_REVIEW_RESPONSE_SUBMITTED", resource: "VendorReview", resourceId: reviewId, metadata: { vendorId } } });
    return { id: updated.id, responseStatus: updated.responseStatus };
  }

  @Post("profiles")
  async createProfile(@CurrentUser() user: SessionUser, @Body() body: NewVendorProfileDto) {
    const profileCount = await this.db.vendor.count({ where: { ownerUserId: user.id } });
    if (profileCount >= 5) throw new BadRequestException("Cada conta pode gerir até cinco perfis de fornecedor.");
    const slugBase = body.name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "fornecedor";
    const slug = `${slugBase}-${randomUUID().slice(0, 8)}`;
    const vendor = await this.db.vendor.create({
      data: {
        slug,
        name: body.name.trim(),
        category: body.category.trim(),
        province: body.province.trim(),
        municipality: body.municipality?.trim() || null,
        description: body.description?.trim() || null,
        services: body.services?.map((item) => item.trim()).filter(Boolean) ?? [],
        serviceAreas: body.serviceAreas?.map((item) => item.trim()).filter(Boolean) ?? [],
        phone: body.phone?.trim() || null,
        email: body.email?.trim().toLowerCase() || user.email,
        websiteUrl: body.websiteUrl?.trim() || null,
        instagramUrl: body.instagramUrl?.trim() || null,
        facebookUrl: body.facebookUrl?.trim() || null,
        tiktokUrl: body.tiktokUrl?.trim() || null,
        ownerUserId: user.id,
        status: "PENDING",
        isDemo: false,
      },
    });
    await this.db.auditLog.create({
      data: { actorId: user.id, action: "VENDOR_PROFILE_SELF_REGISTERED", resource: "Vendor", resourceId: vendor.id, metadata: { status: vendor.status, category: vendor.category } },
    });
    return { id: vendor.id, slug: vendor.slug, name: vendor.name, status: vendor.status, message: "Perfil criado e enviado para revisão. Podes preparar o portefólio enquanto a equipa analisa os dados." };
  }

  @Post("claims")
  async claim(@CurrentUser() user: SessionUser, @Body() body: VendorClaimDto) {
    const vendor = await this.db.vendor.findUnique({ where: { id: body.vendorId } });
    if (!vendor || vendor.status !== "ACTIVE" || vendor.isDemo)
      throw new NotFoundException("Este perfil não pode ser reivindicado.");
    if (vendor.ownerUserId && vendor.ownerUserId !== user.id)
      throw new BadRequestException("Este perfil já está associado a uma conta.");
    if (vendor.ownerUserId === user.id)
      throw new BadRequestException("Este perfil já aparece na tua área de fornecedor.");
    const previous = await this.db.vendorClaim.findUnique({
      where: { vendorId_userId: { vendorId: vendor.id, userId: user.id } },
    });
    if (previous?.status === VendorClaimStatus.PENDING)
      throw new BadRequestException("O teu pedido de acesso já está em revisão.");
    if (previous?.status === VendorClaimStatus.APPROVED)
      throw new BadRequestException("Este pedido já foi aprovado.");
    const claim = previous
      ? await this.db.vendorClaim.update({
          where: { id: previous.id },
          data: { status: "PENDING", message: body.message.trim(), reason: null, reviewedAt: null, reviewedBy: null },
        })
      : await this.db.vendorClaim.create({ data: { vendorId: vendor.id, userId: user.id, message: body.message.trim() } });
    await this.db.auditLog.create({
      data: { actorId: user.id, action: "VENDOR_CLAIM_SUBMITTED", resource: "VendorClaim", resourceId: claim.id, metadata: { vendorId: vendor.id } },
    });
    return claim;
  }

  @Post(":id/profile-submissions")
  async submitProfile(
    @Param("id") vendorId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: VendorProfileSubmissionDto,
  ) {
    const vendor = await this.ownedVendor(vendorId, user.id);
    const pending = await this.db.vendorProfileSubmission.findFirst({ where: { vendorId, status: "PENDING" } });
    if (pending) throw new BadRequestException("Já existe uma alteração à espera de revisão.");
    const payload = {
      description: body.description?.trim() ?? vendor.description,
      services: body.services?.map((item) => item.trim()).filter(Boolean) ?? vendor.services,
      serviceAreas: body.serviceAreas?.map((item) => item.trim()).filter(Boolean) ?? vendor.serviceAreas,
      websiteUrl: body.websiteUrl === undefined ? vendor.websiteUrl : body.websiteUrl?.trim() || null,
      instagramUrl: body.instagramUrl === undefined ? vendor.instagramUrl : body.instagramUrl?.trim() || null,
      facebookUrl: body.facebookUrl === undefined ? vendor.facebookUrl : body.facebookUrl?.trim() || null,
      tiktokUrl: body.tiktokUrl === undefined ? vendor.tiktokUrl : body.tiktokUrl?.trim() || null,
    };
    const submission = await this.db.vendorProfileSubmission.create({
      data: { vendorId, submittedBy: user.id, payload },
    });
    await this.db.auditLog.create({
      data: { actorId: user.id, action: "VENDOR_PROFILE_SUBMITTED", resource: "VendorProfileSubmission", resourceId: submission.id, metadata: { vendorId } },
    });
    return submission;
  }

  @Post(":id/portfolio")
  @UseInterceptors(FileInterceptor("image", {
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    fileFilter: (_request, file, callback) => {
      const accepted = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
      callback(accepted ? null : new BadRequestException("Usa uma imagem JPEG, PNG ou WebP."), accepted);
    },
  }))
  async uploadPortfolioImage(
    @Param("id") vendorId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: PortfolioUploadDto,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string },
  ) {
    await this.ownedVendor(vendorId, user.id);
    if (!file) throw new BadRequestException("Escolhe uma imagem para carregar.");
    const imageCount = await this.db.vendorPortfolioItem.count({ where: { vendorId, status: { in: ["PENDING", "APPROVED"] } } });
    if (imageCount >= 8) throw new BadRequestException("Cada perfil pode ter até 8 imagens publicadas ou em revisão.");
    let normalized: Buffer;
    try {
      normalized = await sharp(file.buffer, { limitInputPixels: 30_000_000 })
        .rotate()
        .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 84, effort: 4 })
        .toBuffer();
    } catch {
      throw new BadRequestException("Não foi possível processar esta imagem. Confirma que o ficheiro é uma imagem válida.");
    }
    const storageKey = `${randomUUID()}.webp`;
    const directory = storageDirectory();
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, storageKey), normalized, { flag: "wx", mode: 0o640 });
    try {
      const highest = await this.db.vendorPortfolioItem.aggregate({ where: { vendorId }, _max: { sortOrder: true } });
      const item = await this.db.vendorPortfolioItem.create({
        data: {
          vendorId,
          storageKey,
          altText: body.altText.trim(),
          sortOrder: (highest._max.sortOrder ?? -1) + 1,
          isCover: imageCount === 0,
          uploadedBy: user.id,
        },
      });
      await this.db.auditLog.create({
        data: { actorId: user.id, action: "VENDOR_PORTFOLIO_UPLOADED", resource: "VendorPortfolioItem", resourceId: item.id, metadata: { vendorId, byteSize: normalized.length, mediaType: "image/webp" } },
      });
      return { ...item, imageUrl: publicImageUrl(item.id) };
    } catch (error) {
      await unlink(join(directory, storageKey)).catch(() => undefined);
      throw error;
    }
  }

  @Patch(":id/portfolio-order")
  async reorderPortfolio(
    @Param("id") vendorId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: PortfolioOrderDto,
  ) {
    await this.ownedVendor(vendorId, user.id);
    const items = await this.db.vendorPortfolioItem.findMany({ where: { vendorId, status: { in: ["PENDING", "APPROVED"] } }, select: { id: true } });
    if (body.ids.length !== items.length || new Set(body.ids).size !== items.length || body.ids.some((id) => !items.some((item) => item.id === id)))
      throw new BadRequestException("A ordem deve incluir exactamente todas as imagens activas do portefólio.");
    await this.db.$transaction(body.ids.map((id, sortOrder) => this.db.vendorPortfolioItem.update({ where: { id }, data: { sortOrder } })));
    await this.db.auditLog.create({ data: { actorId: user.id, action: "VENDOR_PORTFOLIO_REORDERED", resource: "Vendor", resourceId: vendorId, metadata: { itemCount: body.ids.length } } });
    return { ok: true };
  }

  @Patch(":id/portfolio/:itemId")
  async updatePortfolioItem(
    @Param("id") vendorId: string,
    @Param("itemId") itemId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: PortfolioItemUpdateDto,
  ) {
    await this.ownedVendor(vendorId, user.id);
    const item = await this.db.vendorPortfolioItem.findFirst({ where: { id: itemId, vendorId } });
    if (!item) throw new NotFoundException("Imagem não encontrada.");
    if (body.isCover === true) await this.db.vendorPortfolioItem.updateMany({ where: { vendorId }, data: { isCover: false } });
    const updated = await this.db.vendorPortfolioItem.update({
      where: { id: itemId },
      data: { altText: body.altText?.trim(), isCover: body.isCover, sortOrder: body.sortOrder },
    });
    await this.db.auditLog.create({ data: { actorId: user.id, action: "VENDOR_PORTFOLIO_ITEM_UPDATED", resource: "VendorPortfolioItem", resourceId: itemId, metadata: { vendorId, changedFields: Object.keys(body) } } });
    return updated;
  }

  @Delete(":id/portfolio/:itemId")
  async deletePortfolioItem(
    @Param("id") vendorId: string,
    @Param("itemId") itemId: string,
    @CurrentUser() user: SessionUser,
  ) {
    await this.ownedVendor(vendorId, user.id);
    const item = await this.db.vendorPortfolioItem.findFirst({ where: { id: itemId, vendorId } });
    if (!item) throw new NotFoundException("Imagem não encontrada.");
    await this.db.vendorPortfolioItem.delete({ where: { id: itemId } });
    await unlink(join(storageDirectory(), item.storageKey)).catch(() => undefined);
    await this.db.auditLog.create({ data: { actorId: user.id, action: "VENDOR_PORTFOLIO_ITEM_DELETED", resource: "VendorPortfolioItem", resourceId: itemId, metadata: { vendorId, previousStatus: item.status } } });
    return { ok: true };
  }

  @Get(":id/portfolio/:itemId/image")
  async privateImage(
    @Param("id") vendorId: string,
    @Param("itemId") itemId: string,
    @CurrentUser() user: SessionUser,
    @Res() response: Response,
  ) {
    await this.ownedVendor(vendorId, user.id);
    const item = await this.db.vendorPortfolioItem.findFirst({ where: { id: itemId, vendorId } });
    if (!item) throw new NotFoundException("Imagem não encontrada.");
    return sendStoredVendorImage(item.storageKey, response, false);
  }
}

@Controller("vendor-portfolio")
export class PublicVendorPortfolioController {
  constructor(private readonly db: DatabaseService) {}

  @Get(":id/image")
  async image(@Param("id") id: string, @Res() response: Response) {
    const item = await this.db.vendorPortfolioItem.findFirst({
      where: { id, status: "APPROVED", vendor: { status: "ACTIVE" } },
    });
    if (!item) throw new NotFoundException("Imagem não encontrada.");
    return sendStoredVendorImage(item.storageKey, response, true);
  }
}

export function vendorSocialPayloadIsSafe(payload: Record<string, unknown>) {
  return ["websiteUrl", "instagramUrl", "facebookUrl", "tiktokUrl"].every((key) => {
    const value = payload[key];
    if (value === null || value === undefined || value === "") return true;
    if (typeof value !== "string") return false;
    try { return new URL(value).protocol === "https:"; } catch { return false; }
  });
}
