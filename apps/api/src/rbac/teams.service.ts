import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/auth.types";
import type { RequestMeta } from "../common/request-meta";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser) {
    const canSeeAll = user.permissions?.["user.manage"] === "ALL" || user.permissions?.["team.read"] === "ALL";
    const where = canSeeAll
      ? { archivedAt: null }
      : {
          archivedAt: null,
          OR: [...(user.teamId ? [{ id: user.teamId }] : []), { managerId: user.id }],
        };

    const teams = await this.prisma.team.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        manager: { select: { id: true, fullName: true, email: true } },
        members: {
          where: { archivedAt: null },
          select: { id: true, fullName: true, email: true, isActive: true },
        },
      },
    });

    return {
      items: teams.map((t) => ({
        id: t.id,
        name: t.name,
        managerId: t.managerId,
        managerName: t.manager?.fullName ?? null,
        memberCount: t.members.length,
        members: t.members,
      })),
    };
  }

  async create(actorId: string, input: { name: string; managerId?: string | null }, meta: RequestMeta) {
    const name = input.name.trim();
    const exists = await this.prisma.team.findUnique({ where: { name } });
    if (exists) {
      throw new BadRequestException({ code: "TEAM_EXISTS", message: "ชื่อทีมนี้มีอยู่แล้ว" });
    }
    const created = await this.prisma.team.create({
      data: { name, managerId: input.managerId ?? null },
    });
    await this.audit.log({
      actorId,
      action: "CREATE",
      entityType: "team",
      entityId: created.id,
      after: { name: created.name, managerId: created.managerId },
      meta,
    });
    return created;
  }

  async update(actorId: string, id: string, input: { name?: string; managerId?: string | null }, meta: RequestMeta) {
    const before = await this.prisma.team.findUnique({ where: { id } });
    if (!before || before.archivedAt) {
      throw new NotFoundException({ code: "TEAM_NOT_FOUND", message: "ไม่พบทีมนี้" });
    }
    const updated = await this.prisma.team.update({
      where: { id },
      data: {
        name: input.name ? input.name.trim() : before.name,
        managerId: input.managerId !== undefined ? input.managerId : before.managerId,
      },
    });
    await this.audit.log({
      actorId,
      action: "UPDATE",
      entityType: "team",
      entityId: id,
      before: { name: before.name, managerId: before.managerId },
      after: { name: updated.name, managerId: updated.managerId },
      meta,
    });
    return updated;
  }
}
