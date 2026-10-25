import { DEFAULT_ROLE_PERMISSIONS, type PermissionCode, type RoleCode, type Scope } from "@rrs/shared";
import {
  BarChart3,
  Building2,
  CalendarDays,
  FileSignature,
  HandCoins,
  LayoutDashboard,
  Settings,
  UserRound,
  Users,
} from "lucide-react";
import type { MessageKey } from "@/i18n/th";
import type { Me } from "@/lib/api";

export interface NavItem {
  href: string;
  label: MessageKey;
  icon: typeof LayoutDashboard;
  /** prompt ที่จะทำหน้านี้ (docs/ai-playbook.md ข้อ 3) */
  phase: string;
  /** สิทธิ์ที่ต้องมีอย่างน้อย 1 รายการเพื่อแสดงเมนูนี้ */
  permissions: PermissionCode[];
}

export const NAV: NavItem[] = [
  { href: "/", label: "nav.dashboard", icon: LayoutDashboard, phase: "P16", permissions: ["dashboard.read"] },
  { href: "/leads", label: "nav.leads", icon: Users, phase: "P07", permissions: ["lead.read"] },
  { href: "/assets", label: "nav.assets", icon: Building2, phase: "P06", permissions: ["asset.read"] },
  { href: "/owners", label: "nav.owners", icon: UserRound, phase: "P06", permissions: ["owner.read"] },
  {
    href: "/appointments",
    label: "nav.appointments",
    icon: CalendarDays,
    phase: "P10",
    permissions: ["appointment.read"],
  },
  {
    href: "/deals",
    label: "nav.deals",
    icon: FileSignature,
    phase: "P11–P12",
    permissions: ["booking.read", "contract.read", "sale.read"],
  },
  {
    href: "/commissions",
    label: "nav.commissions",
    icon: HandCoins,
    phase: "P14–P15",
    permissions: ["commission.read"],
  },
  { href: "/reports", label: "nav.reports", icon: BarChart3, phase: "P16", permissions: ["report.read"] },
  {
    href: "/settings",
    label: "nav.settings",
    icon: Settings,
    phase: "P04",
    permissions: ["user.manage", "role.manage"],
  },
];

export function canSeeNavItem(user: Me | null, item: NavItem): boolean {
  if (!user) return true;
  const hasExplicitPerms = Object.keys(user.permissions ?? {}).length > 0;
  const effective: Partial<Record<PermissionCode, Scope>> = hasExplicitPerms
    ? (user.permissions as Partial<Record<PermissionCode, Scope>>)
    : Object.assign({}, ...user.roles.map((r) => DEFAULT_ROLE_PERMISSIONS[r as RoleCode] ?? {}));
  return item.permissions.some((p) => Boolean(effective[p]));
}

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
