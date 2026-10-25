import { abbreviateName, maskPhone, type Scope } from "@rrs/shared";
import type { AuthUser } from "../auth/auth.types";

export interface AssetWithRelations {
  id: string;
  code: string;
  category: string;
  ownershipType: string;
  rentPrice: unknown;
  minRentPrice: unknown;
  salePrice: unknown;
  minSalePrice: unknown;
  primaryAgentId: string | null;
  primaryAgent?: { id: string; fullName: string; teamId: string | null } | null;
  agents?: Array<{ userId: string; role: string; user?: { teamId: string | null } }>;
  owner?: {
    id: string;
    code: string;
    fullName: string;
    phone: string | null;
    lineId: string | null;
    email: string | null;
    agentId: string | null;
    agent?: { teamId: string | null } | null;
  } | null;
  [key: string]: unknown;
}

export interface LeadWithRelations {
  id: string;
  code: string;
  fullName: string;
  phone: string | null;
  lineId: string | null;
  email: string | null;
  ownerAgentId: string;
  ownerAgent?: { id: string; fullName: string; teamId: string | null } | null;
  collaborators?: Array<{ userId: string; status: string; user?: { teamId: string | null } }>;
  [key: string]: unknown;
}

function matchesAssetScope(user: AuthUser, asset: AssetWithRelations, scope: Scope | undefined): boolean {
  if (!scope) return false;
  if (scope === "ALL") return true;
  const isOwn = asset.primaryAgentId === user.id || Boolean(asset.agents?.some((a) => a.userId === user.id));
  if (scope === "OWN") return isOwn;
  if (!user.teamId) return isOwn;
  return (
    isOwn ||
    asset.primaryAgent?.teamId === user.teamId ||
    Boolean(asset.agents?.some((a) => a.user?.teamId === user.teamId))
  );
}

function matchesOwnerScope(user: AuthUser, asset: AssetWithRelations, scope: Scope | undefined): boolean {
  if (!scope) return false;
  if (scope === "ALL") return true;
  const isOwn =
    asset.owner?.agentId === user.id ||
    asset.primaryAgentId === user.id ||
    Boolean(asset.agents?.some((a) => a.userId === user.id));
  if (scope === "OWN") return isOwn;
  if (!user.teamId) return isOwn;
  return isOwn || asset.owner?.agent?.teamId === user.teamId || matchesAssetScope(user, asset, "TEAM");
}

function formatMoney(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "object" && val !== null && "toFixed" in val && typeof val.toFixed === "function") {
    return (val as { toFixed: (d: number) => string }).toFixed(2);
  }
  return String(val);
}

/**
 * ซ่อน minRentPrice / minSalePrice และข้อมูลติดต่อเจ้าของทรัพย์ตามสิทธิ์ระดับฟิลด์ (P04)
 */
export function redactAssetForUser(user: AuthUser, asset: AssetWithRelations, opts?: { isList?: boolean }) {
  const canSeeMinPrice = matchesAssetScope(user, asset, user.permissions?.["asset.minprice.view"]);
  const canSeeOwnerContact = matchesOwnerScope(user, asset, user.permissions?.["owner.contact.view"]);

  const owner = asset.owner
    ? {
        id: asset.owner.id,
        code: asset.owner.code,
        fullName: asset.owner.fullName,
        agentId: asset.owner.agentId,
        phone: canSeeOwnerContact ? (opts?.isList ? maskPhone(asset.owner.phone) : asset.owner.phone) : null,
        lineId: canSeeOwnerContact ? asset.owner.lineId : null,
        email: canSeeOwnerContact ? asset.owner.email : null,
      }
    : null;

  return {
    ...asset,
    rentPrice: formatMoney(asset.rentPrice),
    minRentPrice: canSeeMinPrice ? formatMoney(asset.minRentPrice) : null,
    salePrice: formatMoney(asset.salePrice),
    minSalePrice: canSeeMinPrice ? formatMoney(asset.minSalePrice) : null,
    owner,
  };
}

export function canUserAccessLead(user: AuthUser, lead: LeadWithRelations, scope: Scope | undefined): boolean {
  if (!scope) return false;
  if (scope === "ALL") return true;
  const isOwn =
    lead.ownerAgentId === user.id ||
    Boolean(lead.collaborators?.some((c) => c.userId === user.id && c.status === "APPROVED"));
  if (scope === "OWN") return isOwn;
  if (!user.teamId) return isOwn;
  return (
    isOwn ||
    lead.ownerAgent?.teamId === user.teamId ||
    Boolean(lead.collaborators?.some((c) => c.status === "APPROVED" && c.user?.teamId === user.teamId))
  );
}

/**
 * ปิดบังเบอร์โทรในรายการ (08x-xxx-1234) และย่อชื่อสำหรับ Lead ของคนอื่น (D16)
 */
export function redactLeadInList(user: AuthUser, lead: LeadWithRelations) {
  const isAccessible = canUserAccessLead(user, lead, user.permissions?.["lead.read"]);
  return {
    id: lead.id,
    code: lead.code,
    fullName: isAccessible ? lead.fullName : abbreviateName(lead.fullName),
    phone: maskPhone(lead.phone),
    ownerAgentId: lead.ownerAgentId,
    ownerAgentName: lead.ownerAgent?.fullName ?? null,
    isOwn: isAccessible,
  };
}
