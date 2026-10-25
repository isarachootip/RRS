import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { AuthUser } from "../src/auth/auth.types";
import { DataScopeService, type ScopeEntity } from "../src/rbac/data-scope.service";

const svc = new DataScopeService();
const entities: ScopeEntity[] = ["leads", "owners", "assets", "appointments", "bookings", "contracts", "commissions"];

describe("DataScopeService", () => {
  it("ALL คืน { archivedAt: null } ทุกเอนทิตี", () => {
    const admin: AuthUser = {
      id: "u-admin",
      email: "a@test.local",
      roles: ["ADMIN"],
      teamId: null,
      permissions: {
        "lead.read": "ALL",
        "owner.read": "ALL",
        "asset.read": "ALL",
        "appointment.read": "ALL",
        "booking.read": "ALL",
        "contract.read": "ALL",
        "commission.read": "ALL",
      },
    };
    for (const entity of entities) {
      expect(svc.where(admin, entity)).toEqual({ archivedAt: null });
    }
  });

  it("TEAM คืนเงื่อนไขกรองตาม teamId ของผู้ใช้ และถ้าไม่มี teamId จะลดระดับเป็น OWN", () => {
    const mgr: AuthUser = {
      id: "u-mgr",
      email: "m@test.local",
      roles: ["MANAGER"],
      teamId: "team-1",
      permissions: {
        "lead.read": "TEAM",
        "owner.read": "TEAM",
        "asset.read": "TEAM",
        "appointment.read": "TEAM",
        "booking.read": "TEAM",
        "contract.read": "TEAM",
        "commission.read": "TEAM",
      },
    };
    for (const entity of entities) {
      const w = svc.where(mgr, entity);
      expect(w).toHaveProperty("archivedAt", null);
      expect(w).toHaveProperty("OR");
      expect(JSON.stringify(w)).toContain("team-1");
    }

    const mgrNoTeam: AuthUser = { ...mgr, teamId: null };
    expect(JSON.stringify(svc.where(mgrNoTeam, "leads"))).toContain("u-mgr");
  });

  it("OWN คืนเงื่อนไขกรองตาม userId ของตัวเอง และรวม collaborator สำหรับ leads", () => {
    const agent: AuthUser = {
      id: "u-agent",
      email: "ag@test.local",
      roles: ["AGENT"],
      teamId: "team-1",
      permissions: {
        "lead.read": "OWN",
        "owner.read": "OWN",
        "asset.read": "OWN",
        "appointment.read": "OWN",
        "booking.read": "OWN",
        "contract.read": "OWN",
        "commission.read": "OWN",
      },
    };
    for (const entity of entities) {
      const w = svc.where(agent, entity);
      expect(w).toHaveProperty("archivedAt", null);
      expect(JSON.stringify(w)).toContain("u-agent");
    }
  });

  it("ไม่มีสิทธิ์ในเอนทิตีนั้น → โยน ForbiddenException", () => {
    const user: AuthUser = {
      id: "u-none",
      email: "n@test.local",
      roles: ["ACCOUNTING"],
      teamId: null,
      permissions: {},
    };
    expect(() => svc.where(user, "leads")).toThrow(ForbiddenException);
  });
});
