import { BadRequestException, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Response } from "express";
import sharp from "sharp";

const storageDirectory = () => resolve(process.env.VENUE_PHOTO_STORAGE_DIR || join(process.cwd(), "data", "venue-photos"));

export async function storeVenuePhoto(buffer: Buffer) {
  let normalized: Buffer;
  try {
    normalized = await sharp(buffer, { limitInputPixels: 30_000_000 })
      .rotate()
      .resize({ width: 2000, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84, effort: 4 })
      .toBuffer();
  } catch {
    throw new BadRequestException("Não foi possível processar a fotografia. Confirma que o ficheiro é válido.");
  }
  const id = randomUUID();
  const directory = storageDirectory();
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${id}.webp`), normalized, { flag: "wx", mode: 0o640 });
  return { id, imageUrl: `/api/v1/venues/photos/${id}/image`, byteSize: normalized.length };
}

export async function sendVenuePhoto(id: string, response: Response) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new NotFoundException("Fotografia não encontrada.");
  const image = await readFile(join(storageDirectory(), `${id}.webp`)).catch(() => null);
  if (!image) throw new NotFoundException("Fotografia não encontrada.");
  response.setHeader("Content-Type", "image/webp");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  response.send(image);
}
