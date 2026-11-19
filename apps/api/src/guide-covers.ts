import { BadRequestException, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Response } from "express";
import sharp from "sharp";

const storageDirectory = () => resolve(process.env.GUIDE_COVER_STORAGE_DIR || join(process.cwd(), "data", "guide-covers"));

export async function storeGuideCover(buffer: Buffer) {
  let normalized: Buffer;
  try {
    normalized = await sharp(buffer, { limitInputPixels: 30_000_000 })
      .rotate()
      .resize({ width: 1800, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84, effort: 4 })
      .toBuffer();
  } catch {
    throw new BadRequestException("Não foi possível processar a imagem. Confirma que o ficheiro é válido.");
  }
  const id = randomUUID();
  const directory = storageDirectory();
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${id}.webp`), normalized, { flag: "wx", mode: 0o640 });
  return { id, coverImage: `/api/v1/guides/covers/${id}/image`, byteSize: normalized.length };
}

export async function sendGuideCover(id: string, response: Response) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new NotFoundException("Capa não encontrada.");
  const image = await readFile(join(storageDirectory(), `${id}.webp`)).catch(() => null);
  if (!image) throw new NotFoundException("Capa não encontrada.");
  response.setHeader("Content-Type", "image/webp");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  response.send(image);
}
