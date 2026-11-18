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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { ProjectDocumentStatus } from "@casar/database";
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Response } from "express";
import { CurrentUser, SessionGuard, SessionUser } from "./auth";
import { DatabaseService } from "./database";

const maxFileBytes = 10 * 1024 * 1024;
const encryptedFilePrefix = Buffer.from("NUVIADOC1");
const storageDirectory = () => resolve(process.env.PROJECT_DOCUMENT_STORAGE_DIR || join(process.cwd(), "data", "private-project-documents"));
type UploadedDocument = { buffer: Buffer; mimetype: string };

function encryptionKey() {
  const configured = process.env.PROJECT_DOCUMENT_ENCRYPTION_KEY;
  if (configured) {
    const key = Buffer.from(configured, "base64");
    if (key.length !== 32) throw new Error("PROJECT_DOCUMENT_ENCRYPTION_KEY deve ser uma chave Base64 de 32 bytes.");
    return key;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Configura PROJECT_DOCUMENT_ENCRYPTION_KEY em produção.");
  return createHash("sha256").update("nuvia-local-project-document-encryption-key").digest();
}

export function assertProjectDocumentEncryptionKey() {
  encryptionKey();
}

function encryptDocument(buffer: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([encryptedFilePrefix, iv, cipher.getAuthTag(), encrypted]);
}

function decryptDocument(buffer: Buffer) {
  const headerSize = encryptedFilePrefix.length + 12 + 16;
  if (buffer.length < headerSize || !buffer.subarray(0, encryptedFilePrefix.length).equals(encryptedFilePrefix))
    throw new Error("Formato do ficheiro cifrado inválido.");
  const ivStart = encryptedFilePrefix.length;
  const tagStart = ivStart + 12;
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), buffer.subarray(ivStart, tagStart));
  decipher.setAuthTag(buffer.subarray(tagStart, headerSize));
  return Buffer.concat([decipher.update(buffer.subarray(headerSize)), decipher.final()]);
}

class CreateProjectDocumentDto {
  @IsString() @MinLength(2) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsString() @MaxLength(1500) notes?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() @MaxLength(120) assigneeName?: string;
}

class UpdateProjectDocumentDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsEnum(ProjectDocumentStatus) status?: ProjectDocumentStatus;
  @IsOptional() @IsString() @MaxLength(1500) notes?: string | null;
  @IsOptional() @IsDateString() dueAt?: string | null;
  @IsOptional() @IsString() @MaxLength(120) assigneeName?: string | null;
}

function inspectDocument(buffer: Buffer): { mimeType: string; extension: string } | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mimeType: "image/png", extension: ".png" };
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return { mimeType: "image/jpeg", extension: ".jpg" };
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-")
    return { mimeType: "application/pdf", extension: ".pdf" };
  return null;
}

const documentSelect = {
  id: true,
  projectId: true,
  title: true,
  category: true,
  status: true,
  notes: true,
  dueAt: true,
  assigneeName: true,
  mimeType: true,
  byteSize: true,
  fileUploadedAt: true,
  uploadedBy: { select: { id: true, name: true, email: true } },
  createdAt: true,
  updatedAt: true,
} as const;

@ApiTags("Documentos do evento")
@ApiCookieAuth("casar_session")
@UseGuards(SessionGuard)
@Controller("projects/:projectId/documents")
export class ProjectDocumentsController {
  constructor(private readonly db: DatabaseService) {}

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

  private async audit(projectId: string, actorId: string, action: string, documentId: string, subject?: string) {
    await this.db.auditLog.create({
      data: {
        actorId,
        action,
        resource: "ProjectDocument",
        resourceId: documentId,
        metadata: { projectId, ...(subject ? { subject: subject.slice(0, 120) } : {}) },
      },
    });
  }

  @Get()
  async list(@Param("projectId") projectId: string, @CurrentUser() user: SessionUser) {
    await this.member(projectId, user.id);
    return this.db.projectDocument.findMany({ where: { projectId }, select: documentSelect, orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }] });
  }

  @Post()
  async create(@Param("projectId") projectId: string, @CurrentUser() user: SessionUser, @Body() body: CreateProjectDocumentDto) {
    await this.member(projectId, user.id, true);
    const document = await this.db.projectDocument.create({
      data: {
        projectId,
        title: body.title.trim(),
        category: body.category?.trim() || "Documentação",
        notes: body.notes?.trim() || null,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        assigneeName: body.assigneeName?.trim() || null,
      },
      select: documentSelect,
    });
    await this.audit(projectId, user.id, "PROJECT_DOCUMENT_CREATED", document.id, document.title);
    return document;
  }

  @Patch(":documentId")
  async update(
    @Param("projectId") projectId: string,
    @Param("documentId") documentId: string,
    @CurrentUser() user: SessionUser,
    @Body() body: UpdateProjectDocumentDto,
  ) {
    await this.member(projectId, user.id, true);
    const existing = await this.db.projectDocument.findFirst({ where: { id: documentId, projectId }, select: { id: true, title: true } });
    if (!existing) throw new NotFoundException("Documento do evento não encontrado.");
    const update = await this.db.projectDocument.update({
      where: { id: documentId },
      data: {
        title: body.title?.trim(),
        category: body.category?.trim(),
        status: body.status,
        notes: body.notes === null ? null : body.notes?.trim(),
        dueAt: body.dueAt === null ? null : body.dueAt ? new Date(body.dueAt) : undefined,
        assigneeName: body.assigneeName === null ? null : body.assigneeName?.trim(),
      },
      select: documentSelect,
    });
    const changedFields = Object.keys(body);
    await this.audit(projectId, user.id, "PROJECT_DOCUMENT_UPDATED", documentId, update.title);
    return { ...update, changedFields };
  }

  @Post(":documentId/file")
  @UseInterceptors(FileInterceptor("file", {
    limits: { fileSize: maxFileBytes, files: 1 },
    fileFilter: (_request, file, callback) => {
      const accepted = ["image/jpeg", "image/png", "application/pdf"].includes(file.mimetype);
      callback(accepted ? null : new BadRequestException("O ficheiro deve ser PDF, JPG ou PNG."), accepted);
    },
  }))
  async upload(
    @Param("projectId") projectId: string,
    @Param("documentId") documentId: string,
    @CurrentUser() user: SessionUser,
    @UploadedFile() file?: UploadedDocument,
  ) {
    await this.member(projectId, user.id, true);
    const existing = await this.db.projectDocument.findFirst({ where: { id: documentId, projectId }, select: { id: true, title: true, storageKey: true } });
    if (!existing) throw new NotFoundException("Documento do evento não encontrado.");
    if (!file) throw new BadRequestException("Escolhe um ficheiro para carregar.");
    const detected = inspectDocument(file.buffer);
    if (!detected) throw new BadRequestException("O conteúdo do ficheiro não corresponde a um PDF, JPG ou PNG válido.");

    const storageKey = `${randomUUID()}.enc`;
    const directory = storageDirectory();
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(join(directory, storageKey), encryptDocument(file.buffer), { flag: "wx", mode: 0o600 });
    let document;
    try {
      document = await this.db.projectDocument.update({
        where: { id: existing.id },
        data: { storageKey, mimeType: detected.mimeType, byteSize: file.buffer.length, fileUploadedAt: new Date(), uploadedById: user.id },
        select: documentSelect,
      });
    } catch (error) {
      await unlink(join(directory, storageKey)).catch(() => undefined);
      throw error;
    }
    if (existing.storageKey) await unlink(join(directory, existing.storageKey)).catch(() => undefined);
    await this.audit(projectId, user.id, "PROJECT_DOCUMENT_FILE_UPLOADED", documentId, document.title);
    return document;
  }

  @Get(":documentId/file")
  async download(
    @Param("projectId") projectId: string,
    @Param("documentId") documentId: string,
    @CurrentUser() user: SessionUser,
    @Res() response: Response,
  ) {
    await this.member(projectId, user.id);
    const document = await this.db.projectDocument.findFirst({ where: { id: documentId, projectId }, select: { id: true, title: true, storageKey: true, mimeType: true } });
    if (!document?.storageKey || !document.mimeType) throw new NotFoundException("Não existe ficheiro anexado a este item.");
    const encrypted = await readFile(join(storageDirectory(), document.storageKey)).catch(() => null);
    if (!encrypted) throw new NotFoundException("O ficheiro já não está disponível.");
    let file: Buffer;
    try { file = decryptDocument(encrypted); }
    catch { throw new NotFoundException("Não foi possível abrir este ficheiro. Contacta o suporte da plataforma."); }
    const extension = document.mimeType === "application/pdf" ? "pdf" : document.mimeType === "image/png" ? "png" : "jpg";
    await this.audit(projectId, user.id, "PROJECT_DOCUMENT_FILE_DOWNLOADED", documentId, document.title);
    response.setHeader("Content-Type", document.mimeType);
    response.setHeader("Content-Disposition", `attachment; filename="documento-${document.id}.${extension}"`);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.send(file);
  }

  @Delete(":documentId")
  async remove(@Param("projectId") projectId: string, @Param("documentId") documentId: string, @CurrentUser() user: SessionUser) {
    await this.member(projectId, user.id, true);
    const document = await this.db.projectDocument.findFirst({ where: { id: documentId, projectId }, select: { id: true, title: true, storageKey: true } });
    if (!document) throw new NotFoundException("Documento do evento não encontrado.");
    await this.db.projectDocument.delete({ where: { id: document.id } });
    if (document.storageKey) await unlink(join(storageDirectory(), document.storageKey)).catch(() => undefined);
    await this.audit(projectId, user.id, "PROJECT_DOCUMENT_DELETED", document.id, document.title);
    return { ok: true };
  }
}
