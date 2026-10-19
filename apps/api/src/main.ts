import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import type { Env } from "./config/env";
import { setupApp } from "./setup-app";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  setupApp(app);
  const port = app.get(ConfigService<Env, true>).get("API_PORT", { infer: true });
  await app.listen(port);
  app.get(Logger).log(`API พร้อมที่ http://localhost:${port} (Swagger: /docs)`);
}

void bootstrap();
