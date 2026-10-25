import { SetMetadata } from "@nestjs/common";
import type { PermissionCode } from "@rrs/shared";

export const REQUIRED_PERMISSIONS = "requiredPermissions";

/**
 * กำหนดสิทธิ์ที่ต้องมีสำหรับ controller หรือ handler
 * ถ้าระบุหลายค่า ผู้ใช้มีสิทธิ์อย่างน้อย 1 ค่าก็เข้าได้
 */
export const Can = (...permissions: PermissionCode[]) => SetMetadata(REQUIRED_PERMISSIONS, permissions);
