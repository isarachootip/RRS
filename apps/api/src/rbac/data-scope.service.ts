import { ForbiddenException, Injectable } from "@nestjs/common";
import type { PermissionCode, Scope } from "@rrs/shared";
import type { AuthUser } from "../auth/auth.types";

export type ScopeEntity = "leads" | "owners" | "assets" | "appointments" | "bookings" | "contracts" | "commissions";

const DEFAULT_READ_PERMISSION: Record<ScopeEntity, PermissionCode> = {
  leads: "lead.read",
  owners: "owner.read",
  assets: "asset.read",
  appointments: "appointment.read",
  bookings: "booking.read",
  contracts: "contract.read",
  commissions: "commission.read",
};

/**
 * คืนเงื่อนไข Prisma where ตามขอบเขตข้อมูลของผู้ใช้ (ALL / TEAM / OWN)
 * ใช้กับ leads, owners, assets, appointments, bookings, contracts, commissions
 */
@Injectable()
export class DataScopeService {
  scopeFor(user: AuthUser, permission: PermissionCode): Scope {
    const scope = user.permissions?.[permission];
    if (!scope) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้" });
    }
    if (scope === "TEAM" && !user.teamId) return "OWN";
    return scope;
  }

  where(user: AuthUser, entity: ScopeEntity, permission?: PermissionCode): Record<string, unknown> {
    const perm = permission ?? DEFAULT_READ_PERMISSION[entity];
    const scope = this.scopeFor(user, perm);
    if (scope === "ALL") return { archivedAt: null };
    if (scope === "TEAM") return this.teamWhere(user.teamId!, entity);
    return this.ownWhere(user.id, entity);
  }

  private teamWhere(teamId: string, entity: ScopeEntity): Record<string, unknown> {
    switch (entity) {
      case "leads":
        return {
          archivedAt: null,
          OR: [{ ownerAgent: { teamId } }, { collaborators: { some: { status: "APPROVED", user: { teamId } } } }],
        };
      case "owners":
        return { archivedAt: null, OR: [{ isCompany: true }, { agent: { teamId } }] };
      case "assets":
        return {
          archivedAt: null,
          OR: [{ primaryAgent: { teamId } }, { agents: { some: { user: { teamId } } } }],
        };
      case "appointments":
        return {
          archivedAt: null,
          OR: [{ agent: { teamId } }, { coordinator: { teamId } }, { lead: { ownerAgent: { teamId } } }],
        };
      case "bookings":
      case "contracts":
        return {
          archivedAt: null,
          OR: [{ lead: { ownerAgent: { teamId } } }, { asset: { primaryAgent: { teamId } } }],
        };
      case "commissions":
        return {
          archivedAt: null,
          OR: [{ splits: { some: { user: { teamId } } } }, { asset: { primaryAgent: { teamId } } }],
        };
    }
  }

  private ownWhere(userId: string, entity: ScopeEntity): Record<string, unknown> {
    switch (entity) {
      case "leads":
        return {
          archivedAt: null,
          OR: [{ ownerAgentId: userId }, { collaborators: { some: { userId, status: "APPROVED" } } }],
        };
      case "owners":
        return { archivedAt: null, OR: [{ isCompany: true }, { agentId: userId }] };
      case "assets":
        return {
          archivedAt: null,
          OR: [{ primaryAgentId: userId }, { agents: { some: { userId } } }],
        };
      case "appointments":
        return {
          archivedAt: null,
          OR: [{ agentId: userId }, { coordinatorId: userId }, { lead: { ownerAgentId: userId } }],
        };
      case "bookings":
        return {
          archivedAt: null,
          OR: [{ lead: { ownerAgentId: userId } }, { receivedById: userId }, { asset: { primaryAgentId: userId } }],
        };
      case "contracts":
        return {
          archivedAt: null,
          OR: [{ lead: { ownerAgentId: userId } }, { asset: { primaryAgentId: userId } }],
        };
      case "commissions":
        return { archivedAt: null, splits: { some: { userId } } };
    }
  }
}
