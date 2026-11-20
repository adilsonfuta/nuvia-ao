import { createHash } from "node:crypto";
import type { DatabaseService } from "./database";

export async function consumeRateLimitBucket(
  db: DatabaseService,
  value: string,
  max: number,
  windowMs: number,
  now = new Date(),
  cost = 1,
) {
  const key = createHash("sha256").update(value).digest("hex");
  const resetAt = new Date(now.getTime() + windowMs);
  const rows = await db.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, ${cost}, ${resetAt}, NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= NOW() THEN ${cost} ELSE "RateLimitBucket"."count" + ${cost} END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= NOW() THEN EXCLUDED."resetAt" ELSE "RateLimitBucket"."resetAt" END,
      "updatedAt" = NOW()
    RETURNING "count"
  `;
  return (rows[0]?.count ?? max + 1) <= max;
}

export function createPersistentRateLimit(
  db: DatabaseService,
  max: number,
  windowMs: number,
) {
  let lastCleanup = 0;
  return (request: any, response: any, next: (error?: unknown) => void) => {
    const path = String(request.originalUrl ?? request.url);
    const uploadRequest = request.method === "POST" && /^\/api\/v1\/vendor-portal\/[^/]+\/portfolio(?:\?|$)/.test(path);
    const contributionRequest = request.method === "POST" && /^\/api\/v1\/contributions\/[A-Za-z0-9_-]+(?:\?|$)/.test(path);
    const contributionLookup = request.method === "GET" && /^\/api\/v1\/contributions\/[A-Za-z0-9_-]+(?:\?|$)/.test(path);
    const projectDocumentUpload = request.method === "POST" && /^\/api\/v1\/projects\/[^/]+\/documents\/[^/]+\/file(?:\?|$)/.test(path);
    const publicSupportRequest = request.method === "POST" && /^\/api\/v1\/support\/public-requests(?:\?|$)/.test(path);
    const emailChangeRequest = request.method === "POST" && /^\/api\/v1\/auth\/email-change\/request(?:\?|$)/.test(path);
    const guestInclusionRequest = request.method === "POST" && /^\/api\/v1\/invitations\/[^/]+\/requests(?:\?|$)/.test(path);
    const albumUpload = request.method === "POST" && /^\/api\/v1\/albums\/[^/]+\/photos(?:\?|$)/.test(path);
    const venueInquiry = request.method === "POST" && /^\/api\/v1\/venues\/[^/]+\/inquiries(?:\?|$)/.test(path);
    const limited =
      path.startsWith("/api/v1/auth/login") ||
      path.startsWith("/api/v1/auth/register") ||
      path.startsWith("/api/v1/auth/password-reset/request") ||
      path.startsWith("/api/v1/auth/password-reset/reset") ||
      emailChangeRequest ||
      guestInclusionRequest ||
      albumUpload ||
      venueInquiry ||
      path.startsWith("/api/v1/vendor-applications") ||
      uploadRequest ||
      projectDocumentUpload ||
      contributionRequest ||
      contributionLookup ||
      publicSupportRequest ||
      /^\/api\/v1\/invitations\/[^/]+\/rsvp/.test(path);
    if (!limited) return next();
    void (async () => {
      const now = new Date();
      const route = path.split("?")[0]
        .replace(/\/vendor-portal\/[^/]+\/portfolio$/, "/vendor-portal/:vendorId/portfolio")
        .replace(/\/contributions\/[A-Za-z0-9_-]+$/, "/contributions/:token")
        .replace(/\/invitations\/[^/]+\/requests$/, "/invitations/:slug/requests")
        .replace(/\/albums\/[^/]+\/photos$/, "/albums/:token/photos")
        .replace(/\/venues\/[^/]+\/inquiries$/, "/venues/:venueId/inquiries")
        .replace(/\/[^/]+\/rsvp$/, "/:slug/rsvp");
      const routeMax = guestInclusionRequest ? Math.min(max, 5) : emailChangeRequest ? Math.min(max, 3) : albumUpload ? 8 : venueInquiry ? 5 : uploadRequest || contributionRequest || projectDocumentUpload || publicSupportRequest ? Math.min(max, 8) : contributionLookup ? Math.max(max, 60) : max;
      const routeWindowMs = guestInclusionRequest || emailChangeRequest || albumUpload ? Math.max(windowMs, 60 * 60_000) : venueInquiry ? Math.max(windowMs, 10 * 60_000) : uploadRequest || contributionRequest || projectDocumentUpload || publicSupportRequest ? Math.max(windowMs, 10 * 60_000) : windowMs;
      const address = String(
        request.ip ?? request.socket?.remoteAddress ?? "unknown",
      );
      const keys = [`${address}:${request.method}:${route}`];
      if (
        (path.startsWith("/api/v1/auth/login") ||
          path.startsWith("/api/v1/auth/password-reset/request") ||
          publicSupportRequest) &&
        typeof request.body?.email === "string"
      )
        keys.push(`account:${request.body.email.trim().toLowerCase()}`);
      const allowed = await Promise.all(
        keys.map((key) => consumeRateLimitBucket(db, key, routeMax, routeWindowMs, now)),
      );
      if (now.getTime() - lastCleanup > 60 * 60_000) {
        lastCleanup = now.getTime();
        await db.rateLimitBucket.deleteMany({
          where: { resetAt: { lt: now } },
        });
      }
      if (allowed.some((value) => !value)) {
        response
          .status(429)
          .json({
            statusCode: 429,
            message:
              "Demasiadas tentativas. Aguarda um pouco e tenta novamente.",
          });
        return;
      }
      next();
    })().catch(() => {
      response
        .status(503)
        .json({
          statusCode: 503,
          message:
            "Não foi possível validar o limite de pedidos. Tenta novamente.",
        });
    });
  };
}
