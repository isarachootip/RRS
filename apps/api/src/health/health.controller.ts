import { Controller, Get, HttpCode, ServiceUnavailableException } from "@nestjs/common";
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/public.decorator";
import { PrismaService } from "../prisma/prisma.service";

export interface HealthStatus {
  status: "ok";
  database: "up";
  time: string;
}

@ApiTags("system")
@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @HttpCode(200)
  @ApiOkResponse({ description: "ระบบและฐานข้อมูลพร้อมใช้งาน" })
  @ApiServiceUnavailableResponse({ description: "เชื่อมต่อฐานข้อมูลไม่ได้" })
  async check(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ code: "DATABASE_UNAVAILABLE", message: "เชื่อมต่อฐานข้อมูลไม่ได้" });
    }
    return { status: "ok", database: "up", time: new Date().toISOString() };
  }
}
