import { randomUUID } from "node:crypto";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { AppointmentsModule } from "./appointments/appointments.module";
import { AssetsModule } from "./assets/assets.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { BookingsModule } from "./bookings/bookings.module";
import { ChatModule } from "./chat/chat.module";
import { CommissionsModule } from "./commissions/commissions.module";
import { validateEnv } from "./config/env";
import { ContractsModule } from "./contracts/contracts.module";
import { FilesModule } from "./files/files.module";
import { FinanceModule } from "./finance/finance.module";
import { HealthController } from "./health/health.controller";
import { LeadsModule } from "./leads/leads.module";
import { ListingsModule } from "./listings/listings.module";
import { MailModule } from "./mail/mail.module";
import { MatchingModule } from "./matching/matching.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { OwnersModule } from "./owners/owners.module";
import { PdpaModule } from "./pdpa/pdpa.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RbacModule } from "./rbac/rbac.module";
import { ReportsModule } from "./reports/reports.module";
import { SaleDealsModule } from "./sale-deals/sale-deals.module";
import { SearchModule } from "./search/search.module";

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
    FilesModule,
    OwnersModule,
    AssetsModule,
    LeadsModule,
    SearchModule,
    MatchingModule,
    AppointmentsModule,
    BookingsModule,
    ContractsModule,
    SaleDealsModule,
    FinanceModule,
    CommissionsModule,
    ReportsModule,
    NotificationsModule,
    PdpaModule,
    ListingsModule,
    ChatModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
