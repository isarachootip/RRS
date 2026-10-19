import type { Scope } from "@rrs/shared";

/** ผู้ใช้ที่ผ่านการยืนยันตัวตน แนบใน req.user */
export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
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

/** บทบาทที่บังคับเปิด 2FA (P03) */
export const MFA_REQUIRED_ROLES = ["ADMIN", "ACCOUNTING"];
