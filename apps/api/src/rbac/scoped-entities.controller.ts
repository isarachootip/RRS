import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("rbac-scoped")
@ApiBearerAuth()
@Controller()
export class ScopedEntitiesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("agents")
  @ApiOperation({ summary: "รายชื่อผู้ใช้งานที่เปิดใช้งานอยู่สำหรับเลือกผู้รับผิดชอบ" })
  async listAgents() {
    const items = await this.prisma.user.findMany({
      where: { isActive: true, archivedAt: null },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, nickname: true, teamId: true },
    });
    return { items };
  }
}
