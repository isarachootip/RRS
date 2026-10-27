import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { type LeadSource, type OwnerStatus, type Prisma, nextCode } from "@rrs/db";
import { maskPhone, normalizePhone } from "@rrs/shared";
import type { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { DataScopeService } from "../rbac/data-scope.service";

export interface ListOwnersParams {
  search?: string;
  status?: OwnerStatus;
  agentId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "code" | "fullName";
  sortDir?: "asc" | "desc";
}

export interface UpsertOwnerInput {
  fullName?: string;
  isCompany?: boolean;
  phone?: string | null;
  lineId?: string | null;
  email?: string | null;
  sourceChannel?: LeadSource | null;
  firstContactAt?: string | null;
  agentId?: string | null;
  status?: OwnerStatus;
  note?: string | null;
}

@Injectable()
export class OwnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  private canViewContact(user: AuthUser, owner: { agentId: string | null; agent?: { teamId: string | null } | null }) {
    const scope = user.permissions?.["owner.contact.view"];
    if (!scope) return false;
    if (scope === "ALL") return true;
    const isOwn = owner.agentId === user.id;
    return scope === "OWN" ? isOwn : isOwn || Boolean(user.teamId && owner.agent?.teamId === user.teamId);
  }

  private parseNormalizedPhone(raw: string | null | undefined): string | null | undefined {
    if (raw === undefined) return undefined;
    if (raw === null || raw.trim() === "") return null;
    const norm = normalizePhone(raw);
    if (!norm) throw new BadRequestException({ code: "INVALID_PHONE", message: "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง" });
    return norm;
  }

  async checkDuplicates(query: { phone?: string; lineId?: string; email?: string; excludeId?: string }) {
    const or: Prisma.OwnerWhereInput[] = [];
    if (query.phone?.trim()) or.push({ phone: normalizePhone(query.phone) ?? query.phone.trim() });
    if (query.lineId?.trim()) or.push({ lineId: { equals: query.lineId.trim(), mode: "insensitive" } });
    if (query.email?.trim()) or.push({ email: { equals: query.email.trim(), mode: "insensitive" } });
    if (or.length === 0) return { items: [] };

    const owners = await this.prisma.owner.findMany({
      where: { archivedAt: null, ...(query.excludeId ? { id: { not: query.excludeId } } : {}), OR: or },
      include: { agent: { select: { id: true, fullName: true } } },
      take: 10,
    });
    return {
      items: owners.map((o) => ({
        id: o.id,
        code: o.code,
        fullName: o.fullName,
        status: o.status,
        agentId: o.agentId,
        agentName: o.agent?.fullName ?? null,
      })),
    };
  }

  async list(user: AuthUser, params: ListOwnersParams) {
    const scopedWhere = this.dataScope.where(user, "owners", "owner.read") as Prisma.OwnerWhereInput;
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const search = params.search?.trim();
    const normPhone = search ? normalizePhone(search) : null;

    const where: Prisma.OwnerWhereInput = {
      AND: [
        scopedWhere,
        ...(params.status ? [{ status: params.status }] : []),
        ...(params.agentId ? [{ agentId: params.agentId }] : []),
        ...(search
          ? [
              {
                OR: [
                  { fullName: { contains: search, mode: "insensitive" as const } },
                  { code: { contains: search, mode: "insensitive" as const } },
                  { phone: { contains: normPhone ?? search } },
                  { lineId: { contains: search, mode: "insensitive" as const } },
                ],
              },
            ]
          : []),
      ],
    };

    const [total, rows] = await Promise.all([
      this.prisma.owner.count({ where }),
      this.prisma.owner.findMany({
        where,
        orderBy: { [params.sortBy ?? "createdAt"]: params.sortDir ?? "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          agent: { select: { id: true, fullName: true, teamId: true } },
          _count: { select: { assets: { where: { archivedAt: null } } } },
        },
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      items: rows.map((o) => {
        const canContact = this.canViewContact(user, o);
        return {
          ...o,
          phone: canContact ? maskPhone(o.phone) : null,
          lineId: canContact ? o.lineId : null,
          email: canContact ? o.email : null,
          assetCount: o._count.assets,
        };
      }),
    };
  }

  async getById(user: AuthUser, id: string) {
    const scopedWhere = this.dataScope.where(user, "owners", "owner.read") as Prisma.OwnerWhereInput;
    const owner = await this.prisma.owner.findFirst({
      where: { AND: [{ id }, scopedWhere] },
      include: {
        agent: { select: { id: true, fullName: true, teamId: true } },
        assets: { where: { archivedAt: null }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!owner) throw new NotFoundException({ code: "OWNER_NOT_FOUND", message: "ไม่พบข้อมูลเจ้าของทรัพย์นี้" });
    const canContact = this.canViewContact(user, owner);
    return {
      ...owner,
      phone: canContact ? owner.phone : null,
      lineId: canContact ? owner.lineId : null,
      email: canContact ? owner.email : null,
    };
  }

  async create(user: AuthUser, input: UpsertOwnerInput & { fullName: string }) {
    const code = await nextCode(this.prisma, "OW", "OW-");
    return this.prisma.owner.create({
      data: {
        code,
        fullName: input.fullName,
        isCompany: input.isCompany ?? false,
        phone: this.parseNormalizedPhone(input.phone) ?? null,
        lineId: input.lineId ?? null,
        email: input.email ?? null,
        sourceChannel: input.sourceChannel ?? null,
        firstContactAt: input.firstContactAt ? new Date(input.firstContactAt) : null,
        agentId: input.agentId ?? user.id,
        status: input.status ?? "NEW",
        note: input.note ?? null,
        createdById: user.id,
        updatedById: user.id,
      },
    });
  }

  async update(user: AuthUser, id: string, input: UpsertOwnerInput) {
    const scopedWhere = this.dataScope.where(user, "owners", "owner.write") as Prisma.OwnerWhereInput;
    const existing = await this.prisma.owner.findFirst({ where: { AND: [{ id }, scopedWhere] } });
    if (!existing)
      throw new ForbiddenException({ code: "FORBIDDEN", message: "คุณไม่มีสิทธิ์แก้ไขเจ้าของทรัพย์รายนี้" });
    const phone = this.parseNormalizedPhone(input.phone);
    return this.prisma.owner.update({
      where: { id },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(input.lineId !== undefined ? { lineId: input.lineId } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.sourceChannel !== undefined ? { sourceChannel: input.sourceChannel } : {}),
        ...(input.firstContactAt !== undefined
          ? { firstContactAt: input.firstContactAt ? new Date(input.firstContactAt) : null }
          : {}),
        ...(input.agentId !== undefined ? { agentId: input.agentId } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
        updatedById: user.id,
      },
    });
  }

  async archive(user: AuthUser, id: string) {
    const scopedWhere = this.dataScope.where(user, "owners", "owner.write") as Prisma.OwnerWhereInput;
    const existing = await this.prisma.owner.findFirst({ where: { AND: [{ id }, scopedWhere] } });
    if (!existing) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "คุณไม่มีสิทธิ์เก็บข้อมูลเจ้าของทรัพย์รายนี้เข้ากรุ",
      });
    }
    return this.prisma.owner.update({
      where: { id },
      data: { archivedAt: new Date(), archivedById: user.id, updatedById: user.id },
    });
  }
}
