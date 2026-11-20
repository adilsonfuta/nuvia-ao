import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException,
  Param, Patch, Post, Put, Req, Res, UploadedFiles, UseGuards, UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AlbumPhotoStatus } from "@casar/database";
import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { randomBytes, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Request, Response } from "express";
import archiver from "archiver";
import sharp from "sharp";
import { CurrentUser, SessionGuard, SessionUser } from "./auth";
import { DatabaseService } from "./database";
import { consumeRateLimitBucket } from "./rate-limit";

const storage = () => resolve(process.env.EVENT_ALBUM_STORAGE_DIR || join(process.cwd(), "data", "event-album"));
const albumUrl = (token: string) => `/album/${encodeURIComponent(token)}`;
class AlbumSettingsDto { @IsBoolean() enabled!: boolean }
class AlbumUploadDto { @IsOptional() @IsString() @MaxLength(80) uploaderName?: string }
class AlbumModerationDto { @IsString() status!: "APPROVED" | "REJECTED" }
class AlbumBulkModerationDto {
  @IsArray() @ArrayNotEmpty() @ArrayUnique() @ArrayMaxSize(500) @IsString({ each: true }) photoIds!: string[];
  @IsIn(["APPROVED", "REJECTED"]) status!: "APPROVED" | "REJECTED";
}

@ApiTags("Álbum do evento")
@ApiCookieAuth("casar_session")
@UseGuards(SessionGuard)
@Controller("projects/:projectId/album")
export class ProjectAlbumController {
  constructor(private readonly db: DatabaseService) {}

  private async member(projectId: string, userId: string, write = false) {
    const member = await this.db.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
    if (!member || (write && member.role === "VIEWER")) throw new NotFoundException("Evento não encontrado.");
    return member;
  }

  @Get()
  async get(@Param("projectId") projectId: string, @CurrentUser() user: SessionUser) {
    await this.member(projectId, user.id);
    const [member, album] = await Promise.all([
      this.db.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: user.id } }, select: { role: true } }),
      this.db.eventAlbum.upsert({ where: { projectId }, create: { projectId, publicToken: randomBytes(24).toString("base64url") }, update: {}, include: { photos: { orderBy: { createdAt: "desc" } } } }),
    ]);
    return { ...album, canManage: member?.role === "OWNER", sharePath: album.enabled ? albumUrl(album.publicToken) : null, photos: album.photos.map(({ storageKey: _key, ...photo }) => ({ ...photo, imagePath: `/api/v1/albums/${encodeURIComponent(album.publicToken)}/photos/${photo.id}/image` })) };
  }

  @Get("download")
  async downloadApproved(@Param("projectId") projectId: string, @CurrentUser() user: SessionUser, @Res() response: Response) {
    await this.member(projectId, user.id);
    const album = await this.db.eventAlbum.findUnique({
      where: { projectId },
      include: { photos: { where: { status: "APPROVED" }, orderBy: { createdAt: "asc" }, select: { storageKey: true } } },
    });
    if (!album?.photos.length) throw new NotFoundException("Ainda não há fotografias aprovadas para descarregar.");

    response.setHeader("Content-Type", "application/zip");
    response.setHeader("Content-Disposition", 'attachment; filename="nuvia-fotografias-aprovadas.zip"');
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    const zip = archiver("zip", { store: true });
    zip.on("error", (error) => response.destroy(error));
    zip.pipe(response);
    album.photos.forEach((photo, index) => {
      zip.append(createReadStream(join(storage(), photo.storageKey)), { name: `fotografia-${String(index + 1).padStart(3, "0")}.webp` });
    });
    await zip.finalize();
  }

  @Put()
  async update(@Param("projectId") projectId: string, @CurrentUser() user: SessionUser, @Body() body: AlbumSettingsDto) {
    const member = await this.member(projectId, user.id, true);
    if (member.role !== "OWNER") throw new ForbiddenException("Só a pessoa responsável pelo evento pode activar ou desactivar o álbum.");
    const existing = await this.db.eventAlbum.findUnique({ where: { projectId } });
    const album = existing
      ? await this.db.eventAlbum.update({ where: { projectId }, data: { enabled: body.enabled, ...(!body.enabled ? { publicToken: randomBytes(24).toString("base64url") } : {}) } })
      : await this.db.eventAlbum.create({ data: { projectId, enabled: body.enabled, publicToken: randomBytes(24).toString("base64url") } });
    return { enabled: album.enabled, sharePath: album.enabled ? albumUrl(album.publicToken) : null };
  }

  @Get("photos/:photoId/image")
  async privateImage(@Param("projectId") projectId: string, @Param("photoId") photoId: string, @CurrentUser() user: SessionUser, @Res() response: Response) {
    await this.member(projectId, user.id);
    const photo = await this.db.eventAlbumPhoto.findFirst({ where: { id: photoId, album: { projectId } } });
    if (!photo) throw new NotFoundException("Fotografia não encontrada.");
    return this.send(photo.storageKey, response);
  }

  @Patch("photos/:photoId")
  async moderate(@Param("projectId") projectId: string, @Param("photoId") photoId: string, @CurrentUser() user: SessionUser, @Body() body: AlbumModerationDto) {
    const member = await this.member(projectId, user.id, true);
    if (member.role !== "OWNER") throw new ForbiddenException("Só a pessoa responsável pelo evento pode moderar fotografias.");
    if (body.status !== "APPROVED" && body.status !== "REJECTED") throw new BadRequestException("Estado de moderação inválido.");
    const photo = await this.db.eventAlbumPhoto.findFirst({ where: { id: photoId, album: { projectId } } });
    if (!photo) throw new NotFoundException("Fotografia não encontrada.");
    return this.db.eventAlbumPhoto.update({ where: { id: photoId }, data: { status: body.status as AlbumPhotoStatus, reviewedAt: new Date(), reviewedBy: user.id }, select: { id: true, status: true, reviewedAt: true } });
  }

  @Patch("moderation")
  async moderateMany(@Param("projectId") projectId: string, @CurrentUser() user: SessionUser, @Body() body: AlbumBulkModerationDto) {
    const member = await this.member(projectId, user.id, true);
    if (member.role !== "OWNER") throw new ForbiddenException("Só a pessoa responsável pelo evento pode moderar fotografias.");
    const album = await this.db.eventAlbum.findUnique({ where: { projectId }, select: { id: true } });
    if (!album) throw new NotFoundException("Álbum não encontrado.");
    const result = await this.db.eventAlbumPhoto.updateMany({
      where: { id: { in: body.photoIds }, albumId: album.id, status: "PENDING" },
      data: { status: body.status as AlbumPhotoStatus, reviewedAt: new Date(), reviewedBy: user.id },
    });
    return { count: result.count };
  }

  @Delete("photos/:photoId")
  async remove(@Param("projectId") projectId: string, @Param("photoId") photoId: string, @CurrentUser() user: SessionUser) {
    const member = await this.member(projectId, user.id, true);
    if (member.role !== "OWNER") throw new ForbiddenException("Só a pessoa responsável pelo evento pode apagar fotografias.");
    const photo = await this.db.eventAlbumPhoto.findFirst({ where: { id: photoId, album: { projectId } } });
    if (!photo) throw new NotFoundException("Fotografia não encontrada.");
    await this.db.eventAlbumPhoto.delete({ where: { id: photo.id } });
    await unlink(join(storage(), photo.storageKey)).catch(() => undefined);
    return { deleted: true };
  }

  private async send(key: string, response: Response) {
    const bytes = await readFile(join(storage(), key)).catch(() => null);
    if (!bytes) throw new NotFoundException("Fotografia não encontrada.");
    response.setHeader("Content-Type", "image/webp");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "private, no-store");
    response.send(bytes);
  }
}

@ApiTags("Álbum público")
@Controller("albums")
export class PublicAlbumController {
  constructor(private readonly db: DatabaseService) {}

  @Get(":token")
  async view(@Param("token") token: string) {
    const album = await this.db.eventAlbum.findFirst({ where: { publicToken: token, enabled: true }, include: { project: { select: { title: true, date: true, province: true } }, photos: { where: { status: "APPROVED" }, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true } } } });
    if (!album) throw new NotFoundException("Este álbum não está disponível.");
    return { title: album.project.title, date: album.project.date, province: album.project.province, photos: album.photos.map((photo) => ({ ...photo, imagePath: `/api/v1/albums/${encodeURIComponent(token)}/photos/${photo.id}/image` })) };
  }

  @Post(":token/photos")
  @UseInterceptors(FilesInterceptor("images", 10, { limits: { fileSize: 8 * 1024 * 1024, files: 10 } }))
  async upload(@Param("token") token: string, @UploadedFiles() files: { buffer?: Buffer; mimetype?: string }[] | undefined, @Body() body: AlbumUploadDto, @Req() request: Request) {
    const album = await this.db.eventAlbum.findFirst({ where: { publicToken: token, enabled: true }, select: { id: true } });
    if (!album) throw new NotFoundException("Este álbum não está disponível.");
    if (!files?.length || files.length > 10) throw new BadRequestException("Selecciona entre 1 e 10 fotografias por envio.");
    const existingPhotos = await this.db.eventAlbumPhoto.count({ where: { albumId: album.id } });
    if (existingPhotos + files.length > 500) throw new BadRequestException(`O álbum aceita até 500 fotografias. Ainda há espaço para ${Math.max(0, 500 - existingPhotos)}.`);
    if (files.some((file) => !file.buffer || !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype ?? ""))) throw new BadRequestException("Todos os ficheiros devem ser fotografias JPG, PNG ou WebP até 8 MB.");
    const address = request.ip || request.socket.remoteAddress || "unknown";
    if (!(await consumeRateLimitBucket(this.db, `album-upload:${address}:${album.id}`, 10, 60 * 60_000, new Date(), files.length))) throw new BadRequestException("O limite é de 10 fotografias por hora para este álbum.");
    let webps: Buffer[];
    try {
      webps = [];
      // Decode/resize one image at a time. Several large phone photos can each
      // expand to hundreds of MB while Sharp processes them, so Promise.all
      // can exhaust the API container's memory on a batch upload.
      for (const file of files) {
        webps.push(await sharp(file.buffer!, { limitInputPixels: 40_000_000 })
          .rotate()
          .resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer());
      }
    }
    catch { throw new BadRequestException("Um ou mais ficheiros não são imagens válidas."); }
    await mkdir(storage(), { recursive: true, mode: 0o700 });
    const storageKeys = webps.map(() => `${randomUUID()}.webp`);
    try {
      await Promise.all(webps.map((webp, index) => writeFile(join(storage(), storageKeys[index]), webp, { mode: 0o600, flag: "wx" })));
      await this.db.eventAlbumPhoto.createMany({ data: storageKeys.map((storageKey) => ({ albumId: album.id, storageKey, uploaderName: body.uploaderName?.trim() || null })) });
    } catch (error) {
      await Promise.all(storageKeys.map((storageKey) => unlink(join(storage(), storageKey)).catch(() => undefined)));
      throw error;
    }
    return { count: files.length, message: `${files.length} ${files.length === 1 ? "fotografia recebida" : "fotografias recebidas"}. ${files.length === 1 ? "Será publicada" : "Serão publicadas"} depois da aprovação dos anfitriões.` };
  }

  @Get(":token/photos/:photoId/image")
  async photo(@Param("token") token: string, @Param("photoId") photoId: string, @Res() response: Response) {
    const photo = await this.db.eventAlbumPhoto.findFirst({ where: { id: photoId, status: "APPROVED", album: { publicToken: token, enabled: true } }, select: { storageKey: true } });
    if (!photo) throw new NotFoundException("Fotografia não encontrada.");
    const bytes = await readFile(join(storage(), photo.storageKey)).catch(() => null);
    if (!bytes) throw new NotFoundException("Fotografia não encontrada.");
    response.setHeader("Content-Type", "image/webp");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "public, max-age=300");
    response.send(bytes);
  }
}
