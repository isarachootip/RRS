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

  @Get("teams-options")
  @ApiOperation({ summary: "รายชื่อทีมสำหรับตัวกรองปฏิทินและฟอร์ม" })
  async listTeamOptions() {
    const items = await this.prisma.team.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return { items };
  }
}
