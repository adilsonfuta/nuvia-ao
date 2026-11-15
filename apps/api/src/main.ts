import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./module";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { DatabaseService } from "./database";
import { createPersistentRateLimit } from "./rate-limit";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
        ];
  const allowedOrigins = [
    ...new Set(
      [process.env.WEB_ORIGIN, ...developmentOrigins].filter(
        (origin): origin is string => Boolean(origin),
      ),
    ),
  ];
  app.enableCors({ origin: allowedOrigins, credentials: true });
  app.use(
    createPersistentRateLimit(
      app.get<DatabaseService>(DatabaseService),
      12,
      60_000,
    ),
  );
  app.use((_request: any, response: any, next: () => void) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader("X-Frame-Options", "DENY");
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
  await app.listen(Number(process.env.API_PORT ?? 4000), "127.0.0.1");
}

void bootstrap();
