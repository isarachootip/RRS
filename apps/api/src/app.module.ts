import { randomUUID } from "node:crypto";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { validateEnv } from "./config/env";
import { HealthController } from "./health/health.controller";
import { MailModule } from "./mail/mail.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RbacModule } from "./rbac/rbac.module";

const isDev = process.env.NODE_ENV !== "production";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"], validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? "info",
        genReqId: (req, res) => {
          const id = (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
          res.setHeader("x-request-id", id);
          return id;
        },
        // ห้าม log ข้อมูลลับ
        redact: ["req.headers.authorization", "req.headers.cookie", "res.headers['set-cookie']"],
        autoLogging: { ignore: (req) => req.url === "/health" },
        transport:
          isDev && process.env.NODE_ENV !== "test"
            ? { target: "pino-pretty", options: { singleLine: true } }
            : undefined,
      },
    }),
    // ค่าเริ่มต้นทั้งระบบ 300 ครั้ง/นาที/IP; endpoint ล็อกอินตั้งเข้มกว่าใน AuthController
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    AuditModule,
    MailModule,
    AuthModule,
    RbacModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
