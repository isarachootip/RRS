import type { PermissionCode, Scope } from "@rrs/shared";

export interface AdminUserRole {
  id: string;
  code: string;
  name: string;
}

export interface AdminUserItem {
  id: string;
  email: string;
  fullName: string;
  nickname: string | null;
  phone: string | null;
  teamId: string | null;
  teamName: string | null;
  isActive: boolean;
  isFreelance: boolean;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  roles: AdminUserRole[];
}

export interface AdminTeamItem {
  id: string;
  name: string;
  managerId: string | null;
  managerName: string | null;
  memberCount: number;
  members: Array<{ id: string; fullName: string; email: string; isActive: boolean }>;
}

export interface AdminRolePermission {
  code: PermissionCode;
  scope: Scope;
}

export interface AdminRoleItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: AdminRolePermission[];
}

export interface PermissionCatalogItem {
  code: PermissionCode;
  module: string;
  description: string;
}
