import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./module";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { DatabaseService } from "./database";
import { createPersistentRateLimit } from "./rate-limit";
import { assertRsvpTokenEncryptionKey, migrateLegacyRsvpTokens } from "./rsvp-token";
import { assertProjectDocumentEncryptionKey } from "./project-documents";
import { bootstrapAdminFromEnvironment } from "./admin-bootstrap";

async function bootstrap() {
  assertRsvpTokenEncryptionKey();
  assertProjectDocumentEncryptionKey();
  const app = await NestFactory.create(AppModule);
  await bootstrapAdminFromEnvironment(app.get(DatabaseService));
  const migratedRsvpTokens = await migrateLegacyRsvpTokens(app.get(DatabaseService));
  if (migratedRsvpTokens > 0) console.info(`Migrated ${migratedRsvpTokens} legacy RSVP token(s).`);
  app.setGlobalPrefix("api/v1");
  const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (Number.isInteger(trustedProxyHops) && trustedProxyHops > 0)
    app.getHttpAdapter().getInstance().set("trust proxy", trustedProxyHops);
  const developmentOrigins =
    process.env.NODE_ENV === "production"
      ? []
      : [
          "http://127.0.0.1:3000",
          "http://127.0.0.1:3001",
          "http://localhost:3000",
          "http://localhost:3001",
          "http://127.0.0.1:3002",
          "http://localhost:3002",
        ];
  const allowedOrigins = [...new Set(
    [process.env.WEB_ORIGIN, ...developmentOrigins]
      .filter((origin): origin is string => Boolean(origin))
      .map((origin) => new URL(origin).origin),
  )];
  app.enableCors({ origin: allowedOrigins, credentials: true });
  const csrfAllowedOrigins = new Set(allowedOrigins.map((origin) => new URL(origin).origin));
  app.use((request: any, response: any, next: () => void) => {
    if (["GET", "HEAD", "OPTIONS"].includes(String(request.method).toUpperCase())) return next();
    const origin = request.headers.origin;
    const referer = request.headers.referer;
    let requestOrigin: string | undefined;
    try {
      if (typeof origin === "string") requestOrigin = new URL(origin).origin;
      else if (typeof referer === "string") requestOrigin = new URL(referer).origin;
    } catch {
      response.status(403).json({ statusCode: 403, message: "Origem do pedido inválida." });
      return;
    }
    if ((requestOrigin && !csrfAllowedOrigins.has(requestOrigin)) || (!requestOrigin && request.headers["sec-fetch-site"] === "cross-site")) {
      response.status(403).json({ statusCode: 403, message: "Pedido bloqueado por validação de origem." });
      return;
    }
    next();
  });
  app.use(
    createPersistentRateLimit(
      app.get<DatabaseService>(DatabaseService),
      12,
      60_000,
    ),
  );
  app.use((_request: any, response: any, next: () => void) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Frame-Options", "DENY");
    if (process.env.NODE_ENV === "production") response.setHeader("Strict-Transport-Security", "max-age=31536000");
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const docs = new DocumentBuilder()
    .setTitle("Nuvia API")
    .setDescription("API REST da plataforma Nuvia para eventos e celebrações em Angola")
    .setVersion("1.0")
    .addCookieAuth("casar_session")
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, docs));
  app.enableShutdownHooks();
  await app.listen(Number(process.env.API_PORT ?? 4000), process.env.API_HOST ?? "127.0.0.1");
}

void bootstrap();
