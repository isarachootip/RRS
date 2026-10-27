import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";
import { runWithAuditContext } from "./audit/request-context";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { requestMeta } from "./common/request-meta";
import type { Env } from "./config/env";

/** ตั้งค่าที่ใช้ร่วมกันระหว่าง main.ts และเทสต์ */
export function setupApp(app: INestApplication) {
  const config = app.get(ConfigService<Env, true>);
  app.setGlobalPrefix("api/v1", { exclude: ["health"] });
  app.use(cookieParser());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const meta = requestMeta(req);
    runWithAuditContext({ ip: meta.ip, userAgent: meta.userAgent }, () => next());
  });
  // อยู่หลัง reverse proxy ให้ใช้ IP จริงของผู้ใช้ (ใช้ใน rate limit และ audit)
  (app.getHttpAdapter().getInstance() as { set: (k: string, v: unknown) => void }).set("trust proxy", 1);
  app.enableCors({ origin: [config.get("WEB_ORIGIN"), config.get("PORTAL_ORIGIN")], credentials: true });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  if (config.get("SWAGGER_ENABLED")) {
    const doc = new DocumentBuilder()
      .setTitle("RRS API")
      .setDescription("ระบบบริหารงานเช่า/ขายอสังหาริมทรัพย์")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();
    SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, doc));
  }
  return app;
}
