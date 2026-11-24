import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { IsDateString, IsInt, IsOptional, IsString, Max, Min, MinLength, MaxLength } from "class-validator";
import { DatabaseService } from "./database";
import { EmailService } from "./email";
import { CurrentUser, SessionGuard, SessionUser } from "./auth";
import type { Response } from "express";
import { sendGuideCover } from "./guide-covers";
import { sendVenuePhoto } from "./venue-photos";

class CreateQuoteDto {
  @IsString() projectId!: string;
  @IsString() vendorId!: string;
  @IsString() @MinLength(10) @MaxLength(2000) message!: string;
  @IsOptional() @IsDateString() eventDate?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10000) partySize?: number;
}
class CreateVenueInquiryDto {
  @IsString() projectId!: string;
  @IsOptional() @IsDateString() eventDate?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10000) partySize?: number;
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
    @Query("page") pageRaw?: string,
    @Query("pageSize") pageSizeRaw?: string,
  ) {
    const where = {
        status: "ACTIVE" as const,
        ...(category ? { category } : {}),
        ...(province ? { province } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { description: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };
    const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
    const requestedPageSize = /^\d+$/.test(pageSizeRaw ?? "") ? Number(pageSizeRaw) : 20;
    const pageSize = [5, 10, 20, 50, 100].includes(requestedPageSize) ? requestedPageSize : 20;
    const query = {
      where,
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        description: true,
        galleryUrls: true,
        portfolio: {
          where: { status: "APPROVED" as const },
          select: { id: true, altText: true, sortOrder: true, isCover: true },
          orderBy: [{ isCover: "desc" as const }, { sortOrder: "asc" as const }, { uploadedAt: "asc" as const }],
          take: 1,
        },
        province: true,
        municipality: true,
        priceFrom: true,
        priceTo: true,
        verifiedAt: true,
        isDemo: true,
      },
      orderBy: [{ verifiedAt: "desc" as const }, { name: "asc" as const }],
    };
    if (pageRaw === undefined && pageSizeRaw === undefined) return this.db.vendor.findMany(query);
    return Promise.all([
      this.db.vendor.findMany({ ...query, skip: (page - 1) * pageSize, take: pageSize }),
      this.db.vendor.count({ where }),
    ]).then(([items, total]) => ({ items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }));
  }
  @Get(":slug") async detail(
    @Param("slug") slug: string,
    @Query("page") pageRaw = "1",
    @Query("pageSize") pageSizeRaw = "10",
  ) {
    const page = Math.max(1, Math.min(10000, Number.parseInt(pageRaw, 10) || 1));
    const requestedPageSize = /^\d+$/.test(pageSizeRaw) ? Number(pageSizeRaw) : 10;
    const pageSize = [5, 10, 20, 50, 100].includes(requestedPageSize) ? requestedPageSize : 10;
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
          skip: (page - 1) * pageSize,
          take: pageSize,
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
    const reviewAggregate = await this.db.vendorReview.aggregate({ where: { vendorId: vendor.id, status: "APPROVED" }, _avg: { rating: true }, _count: { id: true } });
    const reviewCount = reviewAggregate._count.id;
    const ratingAverage = reviewAggregate._avg.rating === null ? null : Math.round(reviewAggregate._avg.rating * 10) / 10;
    return {
      ...publicVendor,
      hasManager: Boolean(ownerUserId),
      reviewSummary: {
        average: ratingAverage,
        count: reviewCount,
        pagination: { page, pageSize, total: reviewCount, totalPages: Math.max(1, Math.ceil(reviewCount / pageSize)) },
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
  constructor(private readonly db: DatabaseService, private readonly email: EmailService) {}
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
        eventDate: body.eventDate ? new Date(body.eventDate) : undefined,
        partySize: body.partySize,
      },
      include: { vendor: { select: { name: true } }, project: { select: { title: true } } },
    });
    if (vendor.ownerUserId && !vendor.isDemo) void this.email.sendVendorInquiry({ userId: vendor.ownerUserId, name: null, project: request.project.title, vendor: request.vendor.name, key: request.id });
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
  @Get("covers/:id/image") cover(@Param("id") id: string, @Res() response: Response) {
    return sendGuideCover(id, response);
  }
  @Get() list(@Query("category") category?: string) {
    return this.db.guideArticle.findMany({
      where: { status: "PUBLISHED", ...(category ? { category } : {}) },
      select: {
        slug: true,
        title: true,
        summary: true,
        category: true,
        readingMinutes: true,
        coverImage: true,
        reviewedAt: true,
        isDemo: true,
      },
      orderBy: [{ sortOrder: "asc" }, { reviewedAt: "desc" }, { createdAt: "asc" }],
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
  constructor(private readonly db: DatabaseService, private readonly email: EmailService) {}
  @Get("photos/:id/image") photo(@Param("id") id: string, @Res() response: Response) {
    return sendVenuePhoto(id, response);
  }
  @Get() async list(
    @Query("search") search?: string,
    @Query("province") province?: string,
    @Query("type") venueType?: string,
    @Query("capacity") capacityRaw?: string,
    @Query("page") pageRaw?: string,
    @Query("pageSize") pageSizeRaw?: string,
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
    const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
    const requestedPageSize = /^\d+$/.test(pageSizeRaw ?? "") ? Number(pageSizeRaw) : 20;
    const pageSize = [5, 10, 20, 50, 100].includes(requestedPageSize) ? requestedPageSize : 20;
    const [items, total] = await Promise.all([
      this.db.venue.findMany({ where, select: { id: true, slug: true, name: true, venueType: true, description: true, province: true, municipality: true, address: true, mapsUrl: true, latitude: true, longitude: true, capacityMin: true, capacityMax: true, priceFrom: true, priceTo: true, galleryUrls: true, phone: true, email: true, websiteUrl: true, amenities: true, eventTypes: true, verifiedAt: true, isDemo: true }, orderBy: [{ isDemo: "asc" }, { verifiedAt: "desc" }, { name: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
      this.db.venue.count({ where }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), status: total ? "PUBLICADO" : "SEM_RESULTADOS" };
  }
  @Get(":slug") async detail(@Param("slug") slug: string) {
    const venue = await this.db.venue.findFirst({
      where: { slug, status: "PUBLISHED" },
      select: { id: true, slug: true, name: true, venueType: true, description: true, province: true, municipality: true, address: true, mapsUrl: true, latitude: true, longitude: true, capacityMin: true, capacityMax: true, priceFrom: true, priceTo: true, amenities: true, eventTypes: true, galleryUrls: true, phone: true, email: true, websiteUrl: true, bookingTerms: true, paymentTerms: true, cancellationTerms: true, verifiedAt: true, isDemo: true },
    });
    if (!venue) throw new NotFoundException("Espaço não encontrado.");
    return venue;
  }

  @Post(":venueId/inquiries")
  @UseGuards(SessionGuard)
  async inquire(@Param("venueId") venueId: string, @CurrentUser() user: SessionUser, @Body() body: CreateVenueInquiryDto) {
    const member = await this.db.projectMember.findUnique({ where: { projectId_userId: { projectId: body.projectId, userId: user.id } }, include: { project: { select: { title: true, date: true, guestEstimate: true } } } });
    if (!member || member.role === "VIEWER") throw new NotFoundException("Evento não encontrado.");
    const venue = await this.db.venue.findFirst({ where: { id: venueId, status: "PUBLISHED", isDemo: false }, include: { vendor: { select: { id: true, name: true, ownerUserId: true, isDemo: true } } } });
    if (!venue) throw new NotFoundException("Espaço não encontrado.");
    const inquiry = await this.db.venueInquiry.create({ data: { venueId, userId: user.id, projectId: body.projectId, eventDate: body.eventDate ? new Date(body.eventDate) : member.project.date, partySize: body.partySize ?? member.project.guestEstimate, message: body.message.trim() } });
    let deliveredToPortal = false;
    if (venue.vendor?.ownerUserId && !venue.vendor.isDemo) {
      void this.email.sendVendorInquiry({ userId: venue.vendor.ownerUserId, name: null, project: member.project.title, vendor: venue.name, key: `venue/${inquiry.id}` });
      deliveredToPortal = true;
    }
    return { id: inquiry.id, status: inquiry.status, deliveredToPortal, message: deliveredToPortal ? "Pedido enviado ao espaço." : "Pedido registado. Este espaço ainda não tem um responsável activo na Nuvia." };
  }
}
