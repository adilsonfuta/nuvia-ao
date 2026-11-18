import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength, MaxLength } from "class-validator";
import { DatabaseService } from "./database";
import { CurrentUser, SessionGuard, SessionUser } from "./auth";

class CreateQuoteDto {
  @IsString() projectId!: string;
  @IsString() vendorId!: string;
  @IsString() @MinLength(10) @MaxLength(2000) message!: string;
}

const defaultVendorCategories = ["Catering", "Decoração", "Fotografia e vídeo", "Música e DJ", "Beleza", "Transportes", "Bolos e doces", "Organização", "Espaços"];
const defaultProvinces = ["Bengo", "Benguela", "Bié", "Cabinda", "Cuando", "Cubango", "Cuanza Norte", "Cuanza Sul", "Cunene", "Huambo", "Huíla", "Icolo e Bengo", "Luanda", "Lunda Norte", "Lunda Sul", "Malanje", "Moxico", "Moxico Leste", "Namibe", "Uíge", "Zaire"];

@Controller("catalog-config")
export class CatalogConfigController {
  constructor(private readonly db: DatabaseService) {}
  @Get() async getConfig() {
    const settings = await this.db.platformSetting.findMany({ where: { key: { in: ["vendorCategories", "provinces"] } } });
    const values = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
    return {
      vendorCategories: values.vendorCategories ?? defaultVendorCategories,
      provinces: values.provinces ?? defaultProvinces,
    };
  }
}

@ApiTags("Fornecedores")
@Controller("vendors")
export class VendorsController {
  constructor(private readonly db: DatabaseService) {}
  @Get() list(
    @Query("category") category?: string,
    @Query("province") province?: string,
    @Query("search") search?: string,
  ) {
    return this.db.vendor.findMany({
      where: {
        status: "ACTIVE",
        ...(category ? { category } : {}),
        ...(province ? { province } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        description: true,
        province: true,
        municipality: true,
        priceFrom: true,
        priceTo: true,
        verifiedAt: true,
        isDemo: true,
      },
      orderBy: [{ verifiedAt: "desc" }, { name: "asc" }],
    });
  }
  @Get(":slug") async detail(@Param("slug") slug: string) {
    const vendor = await this.db.vendor.findFirst({
      where: { slug, status: "ACTIVE" },
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        description: true,
        services: true,
        serviceAreas: true,
        galleryUrls: true,
        websiteUrl: true,
        instagramUrl: true,
        facebookUrl: true,
        tiktokUrl: true,
        ownerUserId: true,
        portfolio: {
          where: { status: "APPROVED" },
          select: { id: true, altText: true, sortOrder: true, isCover: true },
          orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { uploadedAt: "asc" }],
        },
        reviews: {
          where: { status: "APPROVED" },
          select: {
            id: true,
            rating: true,
            communicationRating: true,
            punctualityRating: true,
            qualityRating: true,
            comment: true,
            isAnonymous: true,
            createdAt: true,
            reviewer: { select: { name: true } },
            response: true,
            responseStatus: true,
          },
          orderBy: { createdAt: "desc" },
          take: 30,
        },
        province: true,
        municipality: true,
        capacityMin: true,
        capacityMax: true,
        priceFrom: true,
        priceTo: true,
        bookingTerms: true,
        paymentTerms: true,
        cancellationTerms: true,
        phone: true,
        email: true,
        verifiedAt: true,
        isDemo: true,
      },
    });
    if (!vendor) throw new NotFoundException("Fornecedor não encontrado.");
    const { ownerUserId, reviews, ...publicVendor } = vendor;
    const ratingAverage = reviews.length ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10) / 10 : null;
    return {
      ...publicVendor,
      hasManager: Boolean(ownerUserId),
      reviewSummary: {
        average: ratingAverage,
        count: reviews.length,
        items: reviews.map((review) => ({
          id: review.id,
          rating: review.rating,
          communicationRating: review.communicationRating,
          punctualityRating: review.punctualityRating,
          qualityRating: review.qualityRating,
          comment: review.comment,
          reviewerName: review.isAnonymous ? null : review.reviewer?.name ?? null,
          createdAt: review.createdAt,
          response: review.responseStatus === "APPROVED" ? review.response : null,
        })),
      },
    };
  }
}

@ApiTags("Pedidos de orçamento")
@ApiCookieAuth("casar_session")
@Controller("quote-requests")
@UseGuards(SessionGuard)
export class QuoteRequestsController {
  constructor(private readonly db: DatabaseService) {}
  @Post() async create(
    @CurrentUser() user: SessionUser,
    @Body() body: CreateQuoteDto,
  ) {
    const member = await this.db.projectMember.findUnique({
      where: {
        projectId_userId: { projectId: body.projectId, userId: user.id },
      },
    });
    if (!member) throw new NotFoundException("Projecto não encontrado.");
    if (member.role === "VIEWER")
      throw new NotFoundException("Projecto não encontrado.");
    const vendor = await this.db.vendor.findFirst({
      where: { id: body.vendorId, status: "ACTIVE" },
      select: { id: true, ownerUserId: true, isDemo: true },
    });
    if (!vendor) throw new NotFoundException("Fornecedor não encontrado.");
    const request = await this.db.quoteRequest.create({
      data: {
        userId: user.id,
        projectId: body.projectId,
        vendorId: body.vendorId,
        message: body.message,
      },
      include: { vendor: { select: { name: true } } },
    });
    return {
      id: request.id,
      status: request.status,
      deliveredToPortal: Boolean(vendor.ownerUserId && !vendor.isDemo),
      vendorName: request.vendor.name,
    };
  }
}

class FavoriteDto {
  @IsString() @MinLength(1) vendorId!: string;
}
@ApiTags("Fornecedores favoritos")
@ApiCookieAuth("casar_session")
@Controller("favorites")
@UseGuards(SessionGuard)
export class VendorFavoritesController {
  constructor(private readonly db: DatabaseService) {}
  @Get() list(@CurrentUser() user: SessionUser) {
    return this.db.vendorFavorite.findMany({
      where: { userId: user.id, vendor: { status: "ACTIVE" } },
      include: {
        vendor: {
          select: {
            id: true,
            slug: true,
            name: true,
            category: true,
            province: true,
            municipality: true,
            isDemo: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
  @Post() async add(
    @CurrentUser() user: SessionUser,
    @Body() body: FavoriteDto,
  ) {
    const vendor = await this.db.vendor.findFirst({
      where: { id: body.vendorId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!vendor) throw new NotFoundException("Fornecedor não encontrado.");
    return this.db.vendorFavorite.upsert({
      where: { userId_vendorId: { userId: user.id, vendorId: vendor.id } },
      create: { userId: user.id, vendorId: vendor.id },
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
            isDemo: true,
          },
        },
      },
    });
  }
  @Delete(":vendorId") async remove(
    @CurrentUser() user: SessionUser,
    @Param("vendorId") vendorId: string,
  ) {
    await this.db.vendorFavorite.deleteMany({
      where: { userId: user.id, vendorId },
    });
    return { ok: true };
  }
}

@ApiTags("Guias")
@Controller("guides")
export class GuidesController {
  constructor(private readonly db: DatabaseService) {}
  @Get() list(@Query("category") category?: string) {
    return this.db.guideArticle.findMany({
      where: { status: "PUBLISHED", ...(category ? { category } : {}) },
      select: {
        slug: true,
        title: true,
        summary: true,
        category: true,
        reviewedAt: true,
        isDemo: true,
      },
      orderBy: { reviewedAt: "desc" },
    });
  }
  @Get(":slug") async detail(@Param("slug") slug: string) {
    const guide = await this.db.guideArticle.findFirst({
      where: { slug, status: "PUBLISHED" },
    });
    if (!guide) throw new NotFoundException("Guia não encontrado.");
    return guide;
  }
}

class LegalEvaluationDto {
  @IsString() @MaxLength(120) nationalityA!: string;
  @IsString() @MaxLength(120) nationalityB!: string;
  @IsString() @MaxLength(120) province!: string;
  @IsOptional() @IsString() previousMarriageA?: string;
  @IsOptional() @IsString() previousMarriageB?: string;
}
@ApiTags("Informação civil")
@Controller()
export class LegalController {
  constructor(private readonly db: DatabaseService) {}
  @Get("legal-guidance/status") async guidanceStatus() {
    const sources = await this.db.legalSource.findMany({
      where: { status: "CONFIRMED" },
      include: {
        requirements: {
          where: {
            applicability: { in: ["CONFIRMED", "CONDITIONAL", "UNCONFIRMED"] },
          },
        },
      },
    });
    const requirements = sources.flatMap((source) => source.requirements);
    const confirmed = requirements.filter(
      (item) => item.applicability === "CONFIRMED" && item.reviewedAt,
    );
    const conditional = requirements.filter(
      (item) => item.applicability === "CONDITIONAL",
    );
    const pending = requirements.filter(
      (item) =>
        item.applicability === "UNCONFIRMED" ||
        (item.applicability === "CONFIRMED" && !item.reviewedAt),
    );
    const dates = confirmed
      .map((item) => item.reviewedAt)
      .filter((date): date is Date => date !== null)
      .sort((a, b) => b.getTime() - a.getTime());
    return {
      sourceCount: sources.length,
      confirmedCount: confirmed.length,
      conditionalCount: conditional.length,
      pendingCount: pending.length,
      latestReviewedAt: dates[0]?.toISOString() ?? null,
    };
  }
  @Post("legal-guidance/evaluate") async evaluate(
    @Body() body: LegalEvaluationDto,
  ) {
    const requirements = await this.db.legalRequirement.findMany({
      where: {
        applicability: { in: ["CONFIRMED", "CONDITIONAL", "UNCONFIRMED"] },
        source: { is: { status: "CONFIRMED" } },
      },
      include: { source: true },
      orderBy: { reviewedAt: "desc" },
    });
    const norm = (v: string | null | undefined) =>
      (v ?? "").trim().toLocaleLowerCase("pt-AO");
    const legacyPreviousMatches = (value: string | null) =>
      !value ||
      (!!body.previousMarriageA &&
        !!body.previousMarriageB &&
        norm(body.previousMarriageA) === norm(value) &&
        norm(body.previousMarriageB) === norm(value));
    const matches = (r: (typeof requirements)[number]) =>
      (!r.nationalityA || norm(r.nationalityA) === norm(body.nationalityA)) &&
      (!r.nationalityB || norm(r.nationalityB) === norm(body.nationalityB)) &&
      (!r.province || norm(r.province) === norm(body.province)) &&
      (!r.previousMarriageA ||
        norm(r.previousMarriageA) === norm(body.previousMarriageA)) &&
      (!r.previousMarriageB ||
        norm(r.previousMarriageB) === norm(body.previousMarriageB)) &&
      legacyPreviousMatches(r.previousMarriage);
    const matched = requirements.filter(matches);
    const confirmed = matched
      .filter((r) => r.applicability === "CONFIRMED" && r.reviewedAt)
      .map((r) => ({
        title: r.title,
        description: r.description,
        source: r.source.title,
        url: r.source.url,
        reviewedAt: r.reviewedAt,
      }));
    const conditional = matched
      .filter((r) => r.applicability === "CONDITIONAL")
      .map((r) => ({
        title: r.title,
        description: r.description,
        source: r.source.title,
        url: r.source.url,
        reviewedAt: r.reviewedAt,
      }));
    const pending = matched
      .filter(
        (r) =>
          r.applicability === "UNCONFIRMED" ||
          (r.applicability === "CONFIRMED" && !r.reviewedAt),
      )
      .map((r) => ({
        title: r.title,
        description: r.description,
        source: r.source.title,
        url: r.source.url,
        reviewedAt: r.reviewedAt,
      }));
    return {
      status: confirmed.length ? "PARCIALMENTE_CONFIRMADO" : "POR_CONFIRMAR",
      confirmed,
      conditional,
      porConfirmar: pending,
      message:
        "Esta orientação é informativa e pode não cobrir todas as condições do teu caso. Confirma os requisitos junto da Conservatória competente.",
      reviewedAt: confirmed.length
        ? confirmed
            .map((r) => r.reviewedAt)
            .filter(Boolean)
            .sort()
            .at(-1)
        : null,
    };
  }
  @Get("legal-sources") sources() {
    return this.db.legalSource.findMany({
      where: { status: "CONFIRMED" },
      include: {
        requirements: {
          where: { applicability: "CONFIRMED" },
          orderBy: { reviewedAt: "desc" },
        },
      },
      orderBy: { reviewedAt: "desc" },
    });
  }
  @Get("registry-offices") async registryOffices() {
    const items = await this.db.registryOffice.findMany({
      where: { status: "CONFIRMED" },
      orderBy: [{ province: "asc" }, { name: "asc" }],
    });
    return items.length
      ? { status: "CONFIRMADO", items }
      : {
          status: "POR_CONFIRMAR",
          items: [],
          message:
            "O directório de Conservatórias ainda não tem contactos verificados.",
        };
  }
}

@ApiTags("Espaços")
@Controller("venues")
export class VenuesController {
  constructor(private readonly db: DatabaseService) {}
  @Get() async list(
    @Query("search") search?: string,
    @Query("province") province?: string,
    @Query("type") venueType?: string,
    @Query("capacity") capacityRaw?: string,
  ) {
    const rawCapacity = capacityRaw && /^\d+$/.test(capacityRaw) ? Number(capacityRaw) : undefined;
    const capacity = rawCapacity && Number.isSafeInteger(rawCapacity) && rawCapacity <= 100000 ? rawCapacity : undefined;
    const where = {
      status: "PUBLISHED" as const,
      ...(province ? { province } : {}),
      ...(venueType ? { venueType } : {}),
      ...(capacity && capacity > 0 ? { capacityMax: { gte: capacity } } : {}),
      ...(search?.trim() ? { OR: [
        { name: { contains: search.trim().slice(0, 100), mode: "insensitive" as const } },
        { description: { contains: search.trim().slice(0, 100), mode: "insensitive" as const } },
        { municipality: { contains: search.trim().slice(0, 100), mode: "insensitive" as const } },
      ] } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.venue.findMany({ where, select: { id: true, slug: true, name: true, venueType: true, description: true, province: true, municipality: true, address: true, mapsUrl: true, capacityMin: true, capacityMax: true, priceFrom: true, priceTo: true, galleryUrls: true, phone: true, email: true, websiteUrl: true, amenities: true, eventTypes: true, verifiedAt: true }, orderBy: [{ verifiedAt: "desc" }, { name: "asc" }], take: 60 }),
      this.db.venue.count({ where }),
    ]);
    return { items, total, status: items.length ? "PUBLICADO" : "SEM_RESULTADOS" };
  }
  @Get(":slug") async detail(@Param("slug") slug: string) {
    const venue = await this.db.venue.findFirst({
      where: { slug, status: "PUBLISHED" },
      select: { id: true, slug: true, name: true, venueType: true, description: true, province: true, municipality: true, address: true, mapsUrl: true, capacityMin: true, capacityMax: true, priceFrom: true, priceTo: true, amenities: true, eventTypes: true, galleryUrls: true, phone: true, email: true, websiteUrl: true, bookingTerms: true, paymentTerms: true, cancellationTerms: true, verifiedAt: true },
    });
    if (!venue) throw new NotFoundException("Espaço não encontrado.");
    return venue;
  }
}
