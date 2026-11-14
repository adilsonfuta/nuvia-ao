import {
  Body,
  Controller,
  Get,
  BadRequestException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { VendorApplicationStatus, VendorClaimStatus, VendorContentStatus, VendorReviewStatus, VendorStatus } from "@casar/database";
import type { Response } from "express";
import { sendStoredVendorImage, vendorSocialPayloadIsSafe } from "./vendor-portal";
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  ValidateIf,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { AdminGuard, CurrentUser, SessionGuard, SessionUser } from "./auth";
import { DatabaseService } from "./database";

class VendorInput {
  @IsString() @MinLength(2) name!: string;
  @IsString() @MinLength(2) slug!: string;
  @IsString() @MinLength(2) category!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  services?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  serviceAreas?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsUrl(
    { protocols: ["http", "https"], require_protocol: true },
    { each: true },
  )
  @MaxLength(1000, { each: true })
  galleryUrls?: string[];
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() municipality?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100000) capacityMin?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100000) capacityMax?: number;
  @IsOptional() @IsNumber() @Min(0) priceFrom?: number;
  @IsOptional() @IsNumber() @Min(0) priceTo?: number;
  @IsOptional() @IsString() @MaxLength(1000) bookingTerms?: string;
  @IsOptional() @IsString() @MaxLength(1000) paymentTerms?: string;
  @IsOptional() @IsString() @MaxLength(1000) cancellationTerms?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }) websiteUrl?: string;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }) instagramUrl?: string;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }) facebookUrl?: string;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }) tiktokUrl?: string;
}
class VendorReview {
  @IsOptional() @IsEnum(VendorStatus) status?: VendorStatus;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(500) reason?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) slug?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) category?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) services?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) serviceAreas?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsUrl({ protocols: ["http", "https"], require_protocol: true }, { each: true }) galleryUrls?: string[];
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() municipality?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100000) capacityMin?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100000) capacityMax?: number;
  @IsOptional() @IsNumber() @Min(0) priceFrom?: number;
  @IsOptional() @IsNumber() @Min(0) priceTo?: number;
  @IsOptional() @IsString() @MaxLength(1000) bookingTerms?: string;
  @IsOptional() @IsString() @MaxLength(1000) paymentTerms?: string;
  @IsOptional() @IsString() @MaxLength(1000) cancellationTerms?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }) websiteUrl?: string | null;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }) instagramUrl?: string | null;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }) facebookUrl?: string | null;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }) tiktokUrl?: string | null;
}
class LegalSourceInput {
  @IsString() @MinLength(3) title!: string;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() jurisdiction?: string;
  @IsOptional()
  @IsEnum({
    CONFIRMED: "CONFIRMED",
    UNCONFIRMED: "UNCONFIRMED",
    OUTDATED: "OUTDATED",
  })
  status?: string;
}
class RequirementInput {
  @IsString() sourceId!: string;
  @IsString() @MinLength(3) title!: string;
  @IsString() @MinLength(10) @MaxLength(3000) description!: string;
  @IsEnum({
    CONFIRMED: "CONFIRMED",
    CONDITIONAL: "CONDITIONAL",
    UNCONFIRMED: "UNCONFIRMED",
    OUTDATED: "OUTDATED",
  })
  applicability!: string;
  @IsOptional() @IsString() nationalityA?: string;
  @IsOptional() @IsString() nationalityB?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() previousMarriageA?: string;
  @IsOptional() @IsString() previousMarriageB?: string;
  @IsOptional() @IsString() previousMarriage?: string;
  @IsOptional() @IsDateString() reviewedAt?: string;
}
class LegalSourceReview {
  @IsEnum({
    CONFIRMED: "CONFIRMED",
    UNCONFIRMED: "UNCONFIRMED",
    OUTDATED: "OUTDATED",
  })
  status!: string;
  @IsOptional() @IsDateString() reviewedAt?: string;
}
class GuideInput {
  @IsString() slug!: string;
  @IsString() @MinLength(3) title!: string;
  @IsString() @MinLength(10) summary!: string;
  @IsString() @MinLength(20) body!: string;
  @IsString() category!: string;
  @IsOptional()
  @IsEnum({ DRAFT: "DRAFT", PUBLISHED: "PUBLISHED", ARCHIVED: "ARCHIVED" })
  status?: string;
  @IsOptional() @IsDateString() reviewedAt?: string;
}
export class UpdateGuideDto {
  @IsOptional() @IsString() @MinLength(2) slug?: string;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(180) title?: string;
  @IsOptional() @IsString() @MinLength(10) @MaxLength(500) summary?: string;
  @IsOptional() @IsString() @MinLength(20) @MaxLength(30000) body?: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional()
  @IsEnum({ DRAFT: "DRAFT", PUBLISHED: "PUBLISHED", ARCHIVED: "ARCHIVED" })
  status?: string;
  @IsOptional() @IsDateString() reviewedAt?: string;
}
class RegistryOfficeInput {
  @IsString() @MinLength(2) name!: string;
  @IsString() @MinLength(2) province!: string;
  @IsOptional() @IsString() municipality?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() sourceUrl?: string;
}
export class RegistryOfficeReviewDto {
  @IsEnum({
    CONFIRMED: "CONFIRMED",
    UNCONFIRMED: "UNCONFIRMED",
    OUTDATED: "OUTDATED",
  })
  status!: "CONFIRMED" | "UNCONFIRMED" | "OUTDATED";
  @IsOptional() @IsDateString() reviewedAt?: string;
}
export class VendorApplicationReviewDto {
  @IsEnum({ CONTACTED: "CONTACTED", DECLINED: "DECLINED" })
  status!: "CONTACTED" | "DECLINED";
  @ValidateIf((body: VendorApplicationReviewDto) => body.status === "DECLINED")
  @IsString() @MinLength(8) @MaxLength(500)
  reason?: string;
}

export class PlatformConfigDto {
  @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) @MaxLength(80, { each: true })
  vendorCategories!: string[];
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(80, { each: true })
  provinces!: string[];
}
class VendorClaimReviewDto {
  @IsEnum({ APPROVED: "APPROVED", REJECTED: "REJECTED" }) status!: "APPROVED" | "REJECTED";
  @ValidateIf((body: VendorClaimReviewDto) => body.status === "REJECTED") @IsString() @MinLength(8) @MaxLength(500) reason?: string;
}
class VendorContentReviewDto {
  @IsEnum(VendorContentStatus) status!: VendorContentStatus;
  @ValidateIf((body: VendorContentReviewDto) => body.status === "REJECTED") @IsString() @MinLength(8) @MaxLength(500) reason?: string;
}
class VendorRatingReviewDto {
  @IsEnum(VendorReviewStatus) status!: VendorReviewStatus;
  @ValidateIf((body: VendorRatingReviewDto) => body.status === "REJECTED") @IsString() @MinLength(8) @MaxLength(500) reason?: string;
}

@ApiTags("Administração")
@ApiCookieAuth("casar_session")
@UseGuards(SessionGuard, AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly db: DatabaseService) {}
  @Get("vendors") vendors() {
    return this.db.vendor.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  }
  @Post("vendors") async createVendor(
    @Body() body: VendorInput,
    @CurrentUser() user: SessionUser,
  ) {
    if (
      body.capacityMin !== undefined &&
      body.capacityMax !== undefined &&
      body.capacityMin > body.capacityMax
    )
      throw new BadRequestException(
        "A capacidade mínima não pode ser superior à máxima.",
      );
    if (
      body.priceFrom !== undefined &&
      body.priceTo !== undefined &&
      body.priceFrom > body.priceTo
    )
      throw new BadRequestException(
        "O preço mínimo não pode ser superior ao máximo.",
      );
    const vendor = await this.db.vendor.create({
      data: { ...body, status: "PENDING" },
    });
    await this.db.auditLog.create({
      data: {
        actorId: user.id,
        action: "VENDOR_CREATED",
        resource: "Vendor",
        resourceId: vendor.id,
        metadata: { status: "PENDING" },
      },
    });
    return vendor;
  }
  @Patch("vendors/:id") async reviewVendor(
    @Param("id") id: string,
    @Body() body: VendorReview,
    @CurrentUser() user: SessionUser,
  ) {
    const existing = await this.db.vendor.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Fornecedor não encontrado.");
    if (!vendorSocialPayloadIsSafe(body as Record<string, unknown>))
      throw new BadRequestException("Os links públicos devem usar HTTPS.");
    const capacityMin = body.capacityMin ?? existing.capacityMin;
    const capacityMax = body.capacityMax ?? existing.capacityMax;
    const priceFrom = body.priceFrom ?? (existing.priceFrom === null ? undefined : Number(existing.priceFrom));
    const priceTo = body.priceTo ?? (existing.priceTo === null ? undefined : Number(existing.priceTo));
    if (capacityMin !== null && capacityMax !== null && capacityMin !== undefined && capacityMax !== undefined && capacityMin > capacityMax)
      throw new BadRequestException("A capacidade mínima não pode ser superior à máxima.");
    if (priceFrom !== undefined && priceTo !== undefined && priceFrom > priceTo)
      throw new BadRequestException("O preço mínimo não pode ser superior ao máximo.");
    if (body.status === "SUSPENDED" && !body.reason)
      throw new BadRequestException("Indica o motivo da suspensão para manter o histórico da decisão.");
    if (existing.isDemo && body.status === "ACTIVE")
      throw new BadRequestException(
        "Perfis de demonstração não podem receber selo de verificação.",
      );
    const vendor = await this.db.vendor.update({
      where: { id },
      data: {
        ...Object.fromEntries(Object.entries(body).filter(([key, value]) => key !== "reason" && value !== undefined)),
        status: body.status ?? existing.status,
        verifiedAt: body.status === "ACTIVE" ? new Date() : body.status ? null : undefined,
      },
    });
    await this.db.auditLog.create({
      data: {
        actorId: user.id,
        action: body.status ? "VENDOR_STATUS_CHANGED" : "VENDOR_PROFILE_UPDATED",
        resource: "Vendor",
        resourceId: id,
        metadata: {
          from: existing.status,
          to: body.status ?? existing.status,
          reason: body.reason ?? null,
          changedFields: Object.keys(body).filter((field) => field !== "reason"),
        },
      },
    });
    return vendor;
  }
  @Get("legal/sources") legalSources() {
    return this.db.legalSource.findMany({ orderBy: { title: "asc" } });
  }
  @Post("legal/sources") async createSource(
    @Body() body: LegalSourceInput,
    @CurrentUser() user: SessionUser,
  ) {
    const source = await this.db.legalSource.create({
      data: { ...body, status: "UNCONFIRMED" },
    });
    await this.db.auditLog.create({
      data: {
        actorId: user.id,
        action: "LEGAL_SOURCE_CREATED",
        resource: "LegalSource",
        resourceId: source.id,
        metadata: { status: "UNCONFIRMED" },
      },
    });
    return source;
  }
  @Patch("legal/sources/:id") async reviewSource(
    @Param("id") id: string,
    @Body() body: LegalSourceReview,
    @CurrentUser() user: SessionUser,
  ) {
    const current = await this.db.legalSource.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Fonte não encontrada.");
    if (body.status === "CONFIRMED" && (!current.url || !body.reviewedAt))
      throw new BadRequestException(
        "Para confirmar a fonte, adiciona um URL oficial e a data de revisão.",
      );
    const source = await this.db.legalSource.update({
      where: { id },
      data: {
        status: body.status,
        reviewedAt: body.reviewedAt ? new Date(body.reviewedAt) : undefined,
      },
    });
    await this.db.auditLog.create({
      data: {
        actorId: user.id,
        action: "LEGAL_SOURCE_REVIEWED",
        resource: "LegalSource",
        resourceId: id,
        metadata: {
          status: source.status,
          reviewedAt: source.reviewedAt?.toISOString() ?? null,
        },
      },
    });
    return source;
  }
  @Post("legal/requirements") async addRequirement(
    @Body() body: RequirementInput,
    @CurrentUser() user: SessionUser,
  ) {
    const source = await this.db.legalSource.findUnique({
      where: { id: body.sourceId },
    });
    if (!source) throw new NotFoundException("Fonte não encontrada.");
    if (
      body.applicability === "CONFIRMED" &&
      (!body.reviewedAt || !source.url || source.status !== "CONFIRMED")
    )
      throw new NotFoundException(
        "Para confirmar um requisito, regista uma fonte oficial confirmada e uma data de revisão.",
      );
    const latest = await this.db.legalRequirement.findFirst({
      where: { sourceId: body.sourceId, title: body.title },
      orderBy: { version: "desc" },
    });
    const requirement = await this.db.legalRequirement.create({
      data: {
        ...body,
        applicability: body.applicability,
        reviewedAt: body.reviewedAt ? new Date(body.reviewedAt) : undefined,
        version: (latest?.version ?? 0) + 1,
      },
    });
    await this.db.auditLog.create({
      data: {
        actorId: user.id,
        action: "LEGAL_REQUIREMENT_VERSIONED",
        resource: "LegalRequirement",
        resourceId: requirement.id,
        metadata: {
          version: requirement.version,
          applicability: requirement.applicability,
        },
      },
    });
    return requirement;
  }
  @Get("guides") guides() {
    return this.db.guideArticle.findMany({ orderBy: { createdAt: "desc" } });
  }
  @Post("guides") async createGuide(
    @Body() body: GuideInput,
    @CurrentUser() user: SessionUser,
  ) {
    const guide = await this.db.guideArticle.create({
      data: {
        ...body,
        status: body.status ?? "DRAFT",
        reviewedAt: body.reviewedAt ? new Date(body.reviewedAt) : undefined,
      },
    });
    await this.db.auditLog.create({
      data: {
        actorId: user.id,
        action: "GUIDE_CREATED",
        resource: "GuideArticle",
        resourceId: guide.id,
        metadata: { status: guide.status },
      },
    });
    return guide;
  }
  @Patch("guides/:id") async updateGuide(
    @Param("id") id: string,
    @Body() body: UpdateGuideDto,
    @CurrentUser() user: SessionUser,
  ) {
    const guide = await this.db.guideArticle.findUnique({ where: { id } });
    if (!guide) throw new NotFoundException("Guia não encontrado.");
    const updated = await this.db.guideArticle.update({
      where: { id },
      data: {
        ...body,
        reviewedAt: body.reviewedAt ? new Date(body.reviewedAt) : undefined,
      },
    });
    await this.db.auditLog.create({
      data: {
        actorId: user.id,
        action: "GUIDE_UPDATED",
        resource: "GuideArticle",
        resourceId: id,
        metadata: { from: guide.status, to: updated.status },
      },
    });
    return updated;
  }
  @Get("registry-offices") registryOffices() {
    return this.db.registryOffice.findMany({ orderBy: { createdAt: "desc" } });
  }
  @Post("registry-offices") async createOffice(
    @Body() body: RegistryOfficeInput,
    @CurrentUser() user: SessionUser,
  ) {
    const office = await this.db.registryOffice.create({
      data: { ...body, status: "UNCONFIRMED" },
    });
    await this.db.auditLog.create({
      data: {
        actorId: user.id,
        action: "REGISTRY_OFFICE_CREATED",
        resource: "RegistryOffice",
        resourceId: office.id,
        metadata: { status: "UNCONFIRMED" },
      },
    });
    return office;
  }
  @Patch("registry-offices/:id") async reviewOffice(
    @Param("id") id: string,
    @Body() body: RegistryOfficeReviewDto,
    @CurrentUser() user: SessionUser,
  ) {
    const current = await this.db.registryOffice.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Conservatória não encontrada.");
    if (body.status === "CONFIRMED" && (!current.sourceUrl || !body.reviewedAt))
      throw new BadRequestException(
        "Para confirmar este contacto, regista a fonte e a data de revisão.",
      );
    const office = await this.db.registryOffice.update({
      where: { id },
      data: {
        status: body.status,
        reviewedAt: body.reviewedAt ? new Date(body.reviewedAt) : undefined,
      },
    });
    await this.db.auditLog.create({
      data: {
        actorId: user.id,
        action: "REGISTRY_OFFICE_REVIEWED",
        resource: "RegistryOffice",
        resourceId: id,
        metadata: { status: office.status },
      },
    });
    return office;
  }
  @Get("vendor-applications") vendorApplications() {
    return this.db.vendorApplication.findMany({
      orderBy: { createdAt: "asc" },
    });
  }

  @Get("audit") async audit() {
    return this.db.auditLog.findMany({
      where: { resource: { in: ["Vendor", "VendorApplication", "PlatformConfig", "VendorClaim", "VendorPortfolioItem", "VendorProfileSubmission", "VendorReview"] } },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  @Get("config") async config(@CurrentUser() user: SessionUser) {
    const settings = await this.db.platformSetting.findMany({
      where: { key: { in: ["vendorCategories", "provinces"] } },
    });
    return Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
  }

  @Patch("config") async updateConfig(@Body() body: PlatformConfigDto, @CurrentUser() user: SessionUser) {
    const normalize = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];
    const vendorCategories = normalize(body.vendorCategories);
    const provinces = normalize(body.provinces);
    if (!vendorCategories.length || !provinces.length)
      throw new BadRequestException("Mantém pelo menos uma categoria e uma província configuradas.");
    const result = await this.db.$transaction(async (tx) => {
      const categories = await tx.platformSetting.upsert({
        where: { key: "vendorCategories" },
        create: { key: "vendorCategories", value: vendorCategories, updatedBy: user.id },
        update: { value: vendorCategories, updatedBy: user.id },
      });
      const provinceSetting = await tx.platformSetting.upsert({
        where: { key: "provinces" },
        create: { key: "provinces", value: provinces, updatedBy: user.id },
        update: { value: provinces, updatedBy: user.id },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "PLATFORM_CATALOG_CONFIG_UPDATED",
          resource: "PlatformConfig",
          resourceId: "vendor-directory",
          metadata: { vendorCategories, provinces },
        },
      });
      return { vendorCategories: categories.value, provinces: provinceSetting.value };
    });
    return result;
  }
  @Patch("vendor-applications/:id") async reviewVendorApplication(
    @Param("id") id: string,
    @Body() body: VendorApplicationReviewDto,
    @CurrentUser() user: SessionUser,
  ) {
    const current = await this.db.vendorApplication.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException("Candidatura não encontrada.");
    if (current.status === VendorApplicationStatus.CONVERTED)
      throw new BadRequestException("Esta candidatura já originou um perfil.");
    if (current.status === VendorApplicationStatus.DECLINED && body.status !== "CONTACTED")
      throw new BadRequestException("A candidatura recusada não pode ser recusada novamente.");
    const application = await this.db.vendorApplication.update({
      where: { id },
      data: { status: body.status, reviewedAt: new Date() },
    });
    await this.db.auditLog.create({
      data: {
        actorId: user.id,
        action: "VENDOR_APPLICATION_REVIEWED",
        resource: "VendorApplication",
        resourceId: id,
          metadata: { from: current.status, to: body.status, reason: body.reason ?? null },
      },
    });
    return application;
  }
  @Post("vendor-applications/:id/convert") async convertVendorApplication(
    @Param("id") id: string,
    @CurrentUser() user: SessionUser,
  ) {
    const application = await this.db.vendorApplication.findUnique({
      where: { id },
    });
    if (!application)
      throw new NotFoundException("Candidatura não encontrada.");
    if (application.status === VendorApplicationStatus.DECLINED)
      throw new BadRequestException("Uma candidatura recusada não pode originar um perfil.");
    if (application.vendorId)
      throw new BadRequestException(
        "Esta candidatura já tem um perfil associado.",
      );
    const slugBase =
      application.businessName
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48) || "fornecedor";
    const vendor = await this.db.$transaction(async (tx) => {
      const created = await tx.vendor.create({
        data: {
          slug: `${slugBase}-${application.id.slice(-6).toLowerCase()}`,
          name: application.businessName,
          category: application.category,
          province: application.province,
          municipality: application.municipality,
          phone: application.phone,
          email: application.email,
          websiteUrl: application.website,
          status: "PENDING",
        },
      });
      await tx.vendorApplication.update({
        where: { id },
        data: {
          status: "CONVERTED",
          reviewedAt: new Date(),
          vendorId: created.id,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "VENDOR_APPLICATION_CONVERTED",
          resource: "VendorApplication",
          resourceId: id,
          metadata: { vendorId: created.id },
        },
      });
      return created;
    });
    return vendor;
  }

  @Get("vendor-claims") vendorClaims() {
    return this.db.vendorClaim.findMany({
      where: { status: "PENDING" },
      include: {
        vendor: { select: { id: true, name: true, slug: true, status: true, ownerUserId: true } },
        user: { select: { id: true, name: true, email: true, createdAt: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  @Patch("vendor-claims/:id") async reviewVendorClaim(
    @Param("id") id: string,
    @Body() body: VendorClaimReviewDto,
    @CurrentUser() user: SessionUser,
  ) {
    const claim = await this.db.vendorClaim.findUnique({ where: { id }, include: { vendor: true } });
    if (!claim) throw new NotFoundException("Pedido de acesso não encontrado.");
    if (claim.status !== VendorClaimStatus.PENDING) throw new BadRequestException("Este pedido já foi revisto.");
    if (body.status === "APPROVED" && claim.vendor.ownerUserId && claim.vendor.ownerUserId !== claim.userId)
      throw new BadRequestException("Este perfil já está associado a outra conta. Confirma a titularidade antes de transferir o acesso.");
    return this.db.$transaction(async (tx) => {
      if (body.status === "APPROVED") await tx.vendor.update({ where: { id: claim.vendorId }, data: { ownerUserId: claim.userId } });
      const updated = await tx.vendorClaim.update({ where: { id }, data: { status: body.status, reason: body.reason ?? null, reviewedAt: new Date(), reviewedBy: user.id } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "VENDOR_CLAIM_REVIEWED", resource: "VendorClaim", resourceId: id, metadata: { vendorId: claim.vendorId, claimantId: claim.userId, status: body.status, reason: body.reason ?? null } } });
      return updated;
    });
  }

  @Get("vendor-portfolio") vendorPortfolioForReview() {
    return this.db.vendorPortfolioItem.findMany({
      where: { status: "PENDING" },
      include: { vendor: { select: { id: true, name: true, slug: true, status: true, isDemo: true } }, uploader: { select: { id: true, name: true, email: true } } },
      orderBy: { uploadedAt: "asc" },
    });
  }

  @Get("vendor-portfolio/:id/image")
  async vendorPortfolioImage(@Param("id") id: string, @Res() response: Response) {
    const item = await this.db.vendorPortfolioItem.findFirst({ where: { id, status: "PENDING" } });
    if (!item) throw new NotFoundException("Imagem pendente não encontrada.");
    return sendStoredVendorImage(item.storageKey, response, false);
  }

  @Patch("vendor-portfolio/:id") async reviewVendorPortfolioImage(
    @Param("id") id: string,
    @Body() body: VendorContentReviewDto,
    @CurrentUser() user: SessionUser,
  ) {
    const item = await this.db.vendorPortfolioItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException("Imagem de portefólio não encontrada.");
    if (item.status !== VendorContentStatus.PENDING) throw new BadRequestException("Esta imagem já foi revista.");
    return this.db.$transaction(async (tx) => {
      if (body.status === "APPROVED" && item.isCover)
        await tx.vendorPortfolioItem.updateMany({ where: { vendorId: item.vendorId }, data: { isCover: false } });
      const updated = await tx.vendorPortfolioItem.update({ where: { id }, data: { status: body.status, rejectionReason: body.reason ?? null, reviewedAt: new Date(), reviewedBy: user.id } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "VENDOR_PORTFOLIO_REVIEWED", resource: "VendorPortfolioItem", resourceId: id, metadata: { vendorId: item.vendorId, status: body.status, reason: body.reason ?? null } } });
      return updated;
    });
  }

  @Get("vendor-profile-submissions") vendorProfileSubmissions() {
    return this.db.vendorProfileSubmission.findMany({
      where: { status: "PENDING" },
      include: { vendor: { select: { id: true, name: true, slug: true, status: true } }, submitter: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  @Patch("vendor-profile-submissions/:id") async reviewVendorProfileSubmission(
    @Param("id") id: string,
    @Body() body: VendorContentReviewDto,
    @CurrentUser() user: SessionUser,
  ) {
    const submission = await this.db.vendorProfileSubmission.findUnique({ where: { id } });
    if (!submission) throw new NotFoundException("Alteração de perfil não encontrada.");
    if (submission.status !== VendorContentStatus.PENDING) throw new BadRequestException("Esta alteração já foi revista.");
    const payload = submission.payload as Record<string, unknown>;
    if (body.status === "APPROVED" && (!vendorSocialPayloadIsSafe(payload) || !Array.isArray(payload.services) || !Array.isArray(payload.serviceAreas)))
      throw new BadRequestException("Os dados submetidos não passaram a validação de segurança.");
    return this.db.$transaction(async (tx) => {
      if (body.status === "APPROVED") await tx.vendor.update({
        where: { id: submission.vendorId },
        data: {
          description: typeof payload.description === "string" ? payload.description : null,
          services: (payload.services as string[]).filter((value) => typeof value === "string").slice(0, 30),
          serviceAreas: (payload.serviceAreas as string[]).filter((value) => typeof value === "string").slice(0, 30),
          websiteUrl: typeof payload.websiteUrl === "string" ? payload.websiteUrl : null,
          instagramUrl: typeof payload.instagramUrl === "string" ? payload.instagramUrl : null,
          facebookUrl: typeof payload.facebookUrl === "string" ? payload.facebookUrl : null,
          tiktokUrl: typeof payload.tiktokUrl === "string" ? payload.tiktokUrl : null,
        },
      });
      const updated = await tx.vendorProfileSubmission.update({ where: { id }, data: { status: body.status, reason: body.reason ?? null, reviewedAt: new Date(), reviewedBy: user.id } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "VENDOR_PROFILE_SUBMISSION_REVIEWED", resource: "VendorProfileSubmission", resourceId: id, metadata: { vendorId: submission.vendorId, status: body.status, reason: body.reason ?? null } } });
      return updated;
    });
  }

  @Get("vendor-reviews") vendorReviewsForModeration() {
    return this.db.vendorReview.findMany({
      where: { OR: [{ status: "PENDING" }, { responseStatus: "PENDING" }] },
      include: {
        vendor: { select: { id: true, name: true, slug: true } },
        reviewer: { select: { name: true, email: true } },
        quoteRequest: { select: { project: { select: { title: true, date: true, kind: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  @Patch("vendor-reviews/:id/review") async reviewCustomerRating(
    @Param("id") id: string,
    @Body() body: VendorRatingReviewDto,
    @CurrentUser() user: SessionUser,
  ) {
    const review = await this.db.vendorReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException("Avaliação não encontrada.");
    if (review.status !== VendorReviewStatus.PENDING) throw new BadRequestException("Esta avaliação já foi revista.");
    const updated = await this.db.vendorReview.update({ where: { id }, data: { status: body.status, rejectionReason: body.reason ?? null, reviewedAt: new Date(), reviewedBy: user.id } });
    await this.db.auditLog.create({ data: { actorId: user.id, action: "VENDOR_REVIEW_MODERATED", resource: "VendorReview", resourceId: id, metadata: { vendorId: review.vendorId, status: body.status, reason: body.reason ?? null } } });
    return updated;
  }

  @Patch("vendor-reviews/:id/response") async reviewVendorReply(
    @Param("id") id: string,
    @Body() body: VendorContentReviewDto,
    @CurrentUser() user: SessionUser,
  ) {
    const review = await this.db.vendorReview.findUnique({ where: { id } });
    if (!review || review.responseStatus !== VendorContentStatus.PENDING) throw new NotFoundException("Resposta pendente não encontrada.");
    const updated = await this.db.vendorReview.update({ where: { id }, data: { responseStatus: body.status, responseReason: body.reason ?? null, responseReviewedAt: new Date(), responseReviewedBy: user.id } });
    await this.db.auditLog.create({ data: { actorId: user.id, action: "VENDOR_REVIEW_RESPONSE_MODERATED", resource: "VendorReview", resourceId: id, metadata: { vendorId: review.vendorId, status: body.status, reason: body.reason ?? null } } });
    return updated;
  }
}
