import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { DatabaseService } from "./database";

export type GuestTokenFields = {
  id: string;
  rsvpTokenHash: string | null;
  rsvpTokenCiphertext: string | null;
  rsvpTokenLegacy: string | null;
  rsvpTokenPreviousHash: string | null;
  rsvpTokenPreviousExpiresAt: Date | null;
};

function encryptionKey() {
  const configured = process.env.RSVP_TOKEN_ENCRYPTION_KEY;
  if (configured) {
    const key = Buffer.from(configured, "base64");
    if (key.length !== 32) throw new Error("RSVP_TOKEN_ENCRYPTION_KEY deve ser uma chave base64 de 32 bytes.");
    return key;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Configura RSVP_TOKEN_ENCRYPTION_KEY em produção.");
  return createHash("sha256").update("nuvia-development-only-rsvp-encryption-key").digest();
}

export function assertRsvpTokenEncryptionKey() {
  encryptionKey();
}

export function hashRsvpToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createRsvpTokenCredentials() {
  const token = randomBytes(32).toString("base64url");
  return { token, ...createRsvpTokenCredentialsFor(token) };
}

function createRsvpTokenCredentialsFor(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const ciphertext = [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
  return { rsvpTokenHash: hashRsvpToken(token), rsvpTokenCiphertext: `v1.${ciphertext}` };
}

function decryptRsvpToken(value: string) {
  const [version, ivPart, tagPart, dataPart] = value.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !dataPart) throw new Error("Token RSVP cifrado inválido.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
}

export async function revealGuestRsvpToken(db: Pick<DatabaseService, "guest">, guest: GuestTokenFields) {
  if (guest.rsvpTokenHash && guest.rsvpTokenCiphertext) {
    return decryptRsvpToken(guest.rsvpTokenCiphertext);
  }
  if (!guest.rsvpTokenLegacy) throw new Error("O token RSVP deste convidado não está disponível.");
  const previousToken = guest.rsvpTokenLegacy;
  const credentials = createRsvpTokenCredentials();
  await db.guest.update({
    where: { id: guest.id },
    data: {
      rsvpTokenHash: credentials.rsvpTokenHash,
      rsvpTokenCiphertext: credentials.rsvpTokenCiphertext,
      rsvpTokenPreviousHash: hashRsvpToken(previousToken),
      rsvpTokenPreviousExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      rsvpTokenLegacy: null,
    },
  });
  return credentials.token;
}

export async function exposeGuestRsvpToken<T extends GuestTokenFields>(db: Pick<DatabaseService, "guest">, guest: T) {
  const token = await revealGuestRsvpToken(db, guest);
  const {
    rsvpTokenHash: _hash,
    rsvpTokenCiphertext: _ciphertext,
    rsvpTokenLegacy: _legacy,
    rsvpTokenPreviousHash: _previousHash,
    rsvpTokenPreviousExpiresAt: _previousExpiresAt,
    ...safeGuest
  } = guest;
  return { ...safeGuest, rsvpToken: token };
}

export async function migrateLegacyRsvpTokens(db: Pick<DatabaseService, "guest">) {
  let migrated = 0;
  while (true) {
    const guests = await db.guest.findMany({
      where: { rsvpTokenLegacy: { not: null } },
      select: { id: true, rsvpTokenLegacy: true },
      take: 100,
      orderBy: { id: "asc" },
    });
    if (!guests.length) return migrated;
    await Promise.all(guests.map(async (guest) => {
      if (!guest.rsvpTokenLegacy) return;
      const previousToken = guest.rsvpTokenLegacy;
      const credentials = createRsvpTokenCredentials();
      const result = await db.guest.updateMany({
        where: { id: guest.id, rsvpTokenLegacy: previousToken },
        data: {
          rsvpTokenHash: credentials.rsvpTokenHash,
          rsvpTokenCiphertext: credentials.rsvpTokenCiphertext,
          rsvpTokenPreviousHash: hashRsvpToken(previousToken),
          rsvpTokenPreviousExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          rsvpTokenLegacy: null,
        },
      });
      migrated += result.count;
    }));
  }
}
