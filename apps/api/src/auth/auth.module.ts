import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import type { Env } from "../config/env";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { SessionService } from "./session.service";

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get("JWT_ACCESS_SECRET"),
        signOptions: { issuer: "rrs-api" },
        verifyOptions: { issuer: "rrs-api" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
