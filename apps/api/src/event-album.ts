import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException,
  Param, Patch, Post, Put, Req, Res, UploadedFile, UseGuards, UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AlbumPhotoStatus } from "@casar/database";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Request, Response } from "express";
import sharp from "sharp";
import { CurrentUser, SessionGuard, SessionUser } from "./auth";
import { DatabaseService } from "./database";
import { consumeRateLimitBucket } from "./rate-limit";

const storage = () => resolve(process.env.EVENT_ALBUM_STORAGE_DIR || join(process.cwd(), "data", "event-album"));
const albumUrl = (token: string) => `/album/${encodeURIComponent(token)}`;
class AlbumSettingsDto { @IsBoolean() enabled!: boolean }
class AlbumUploadDto { @IsOptional() @IsString() @MaxLength(80) uploaderName?: string }
class AlbumModerationDto { @IsString() status!: "APPROVED" | "REJECTED" }

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
  @UseInterceptors(FileInterceptor("image", { limits: { fileSize: 8 * 1024 * 1024, files: 1 } }))
  async upload(@Param("token") token: string, @UploadedFile() file: { buffer?: Buffer; mimetype?: string } | undefined, @Body() body: AlbumUploadDto, @Req() request: Request) {
    const album = await this.db.eventAlbum.findFirst({ where: { publicToken: token, enabled: true }, select: { id: true } });
    if (!album) throw new NotFoundException("Este álbum não está disponível.");
    const existingPhotos = await this.db.eventAlbumPhoto.count({ where: { albumId: album.id } });
    if (existingPhotos >= 500) throw new BadRequestException("Este álbum atingiu o limite de 500 fotografias.");
    const address = request.ip || request.socket.remoteAddress || "unknown";
    if (!(await consumeRateLimitBucket(this.db, `album-upload:${address}:${album.id}`, 8, 60 * 60_000))) throw new BadRequestException("Atingiste o limite de envios por agora.");
    if (!file?.buffer || !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype ?? "")) throw new BadRequestException("Envia uma fotografia JPG, PNG ou WebP até 8 MB.");
    let webp: Buffer;
    try { webp = await sharp(file.buffer, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(); }
    catch { throw new BadRequestException("O ficheiro enviado não é uma imagem válida."); }
    await mkdir(storage(), { recursive: true, mode: 0o700 });
    const storageKey = `${randomUUID()}.webp`;
    await writeFile(join(storage(), storageKey), webp, { mode: 0o600, flag: "wx" });
    let photo;
    try { photo = await this.db.eventAlbumPhoto.create({ data: { albumId: album.id, storageKey, uploaderName: body.uploaderName?.trim() || null } }); }
    catch (error) { await unlink(join(storage(), storageKey)).catch(() => undefined); throw error; }
    return { id: photo.id, status: photo.status, message: "Fotografia recebida. Será publicada depois da aprovação dos anfitriões." };
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
