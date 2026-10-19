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

export interface NavItem {
  href: string;
  label: MessageKey;
  icon: typeof LayoutDashboard;
  /** prompt ที่จะทำหน้านี้ (docs/ai-playbook.md ข้อ 3) */
  phase: string;
}

export const NAV: NavItem[] = [
  { href: "/", label: "nav.dashboard", icon: LayoutDashboard, phase: "P16" },
  { href: "/leads", label: "nav.leads", icon: Users, phase: "P07" },
  { href: "/assets", label: "nav.assets", icon: Building2, phase: "P06" },
  { href: "/owners", label: "nav.owners", icon: UserRound, phase: "P06" },
  { href: "/appointments", label: "nav.appointments", icon: CalendarDays, phase: "P10" },
  { href: "/deals", label: "nav.deals", icon: FileSignature, phase: "P11–P12" },
  { href: "/commissions", label: "nav.commissions", icon: HandCoins, phase: "P14–P15" },
  { href: "/reports", label: "nav.reports", icon: BarChart3, phase: "P16" },
  { href: "/settings", label: "nav.settings", icon: Settings, phase: "P04" },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
