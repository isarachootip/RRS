import type { Scope } from "@rrs/shared";

/** ผู้ใช้ที่ผ่านการยืนยันตัวตน แนบใน req.user */
export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  teamId?: string | null;
  permissions?: Record<string, Scope>;
}

export interface MeResponse {
  id: string;
  email: string;
  fullName: string;
  teamId: string | null;
  roles: string[];
  /** สิทธิ์รวมจากทุกบทบาท ขอบเขตกว้างสุดชนะ (ALL > TEAM > OWN) */
  permissions: Record<string, Scope>;
  totpEnabled: boolean;
  mfaRequired: boolean;
}

export type LoginResult =
  | { status: "OK"; accessToken: string; expiresIn: number; user: MeResponse }
  | { status: "MFA_REQUIRED" | "MFA_SETUP_REQUIRED"; challengeToken: string };

/** บทบาทที่บังคับเปิด 2FA (ค่าเริ่มต้น: ไม่บังคับ เพื่อให้เข้าใช้งานด้วยรหัสผ่านปกติได้ทันที) */
export const MFA_REQUIRED_ROLES: string[] = (process.env.MFA_REQUIRED_ROLES ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
