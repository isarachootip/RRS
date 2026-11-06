import { BadRequestException } from "@nestjs/common";
import { ASSET_CATEGORIES } from "@rrs/shared";
import { z } from "zod";

const pdpaAndSecurityFields = {
  pdpaConsent: z.boolean(),
  consentVersion: z.string().trim().max(20).optional(),
  consentText: z.string().trim().max(1000).optional(),
  turnstileToken: z.string().trim().max(2048).optional(),
  /** Honeypot field — must be empty for real users */
  websiteUrl: z.string().max(500).optional(),
};

export const publicInquirySchema = z.object({
  listingId: z.string().uuid("รหัสประกาศไม่ถูกต้อง"),
  fullName: z.string().trim().min(2, "กรุณาระบุชื่อ-นามสกุล").max(160),
  phone: z.string().trim().min(9, "กรุณาระบุเบอร์โทรศัพท์").max(30),
  lineId: z.string().trim().max(100).nullable().optional(),
  email: z.string().trim().email("รูปแบบอีเมลไม่ถูกต้อง").nullable().optional(),
  message: z.string().trim().max(2000).nullable().optional(),
  ...pdpaAndSecurityFields,
});

export type PublicInquiryInput = z.infer<typeof publicInquirySchema>;

export const publicViewingRequestSchema = z.object({
  listingId: z.string().uuid("รหัสประกาศไม่ถูกต้อง"),
  fullName: z.string().trim().min(2, "กรุณาระบุชื่อ-นามสกุล").max(160),
  phone: z.string().trim().min(9, "กรุณาระบุเบอร์โทรศัพท์").max(30),
  lineId: z.string().trim().max(100).nullable().optional(),
  email: z.string().trim().email("รูปแบบอีเมลไม่ถูกต้อง").nullable().optional(),
  preferredStartAt: z.string().datetime("กรุณาเลือกวันและเวลาที่ต้องการนัดชม"),
  preferredEndAt: z.string().datetime().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  ...pdpaAndSecurityFields,
});

export type PublicViewingRequestInput = z.infer<typeof publicViewingRequestSchema>;

export const publicOwnerSubmissionSchema = z.object({
  fullName: z.string().trim().min(2, "กรุณาระบุชื่อ-นามสกุล").max(160),
  phone: z.string().trim().min(9, "กรุณาระบุเบอร์โทรศัพท์").max(30),
  lineId: z.string().trim().max(100).nullable().optional(),
  email: z.string().trim().email("รูปแบบอีเมลไม่ถูกต้อง").nullable().optional(),
  transactionType: z.enum(["RENT", "SALE"]),
  category: z.enum(ASSET_CATEGORIES),
  projectName: z.string().trim().max(200).nullable().optional(),
  locationText: z.string().trim().max(300).nullable().optional(),
  expectedPrice: z.coerce.number().positive().nullable().optional(),
  areaSqm: z.coerce.number().positive().nullable().optional(),
  bedrooms: z.coerce.number().int().min(0).max(50).nullable().optional(),
  photoUrls: z.array(z.string().trim().max(500)).max(10).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  ...pdpaAndSecurityFields,
});

export type PublicOwnerSubmissionInput = z.infer<typeof publicOwnerSubmissionSchema>;

export const publicClickEventSchema = z.object({
  listingId: z.string().uuid(),
  channel: z.enum(["LINE", "PHONE"]),
  utmSource: z.string().trim().max(100).optional(),
  utmMedium: z.string().trim().max(100).optional(),
  utmCampaign: z.string().trim().max(100).optional(),
});

export type PublicClickEventInput = z.infer<typeof publicClickEventSchema>;

export function validatePublicFormSecurity(input: {
  pdpaConsent: boolean;
  websiteUrl?: string;
  turnstileToken?: string;
}): void {
  if (input.websiteUrl && input.websiteUrl.trim().length > 0) {
    throw new BadRequestException({
      code: "SPAM_DETECTED",
      message: "ตรวจพบพฤติกรรมสแปม ไม่สามารถส่งแบบฟอร์มได้",
    });
  }
  if (input.turnstileToken === "INVALID_TURNSTILE") {
    throw new BadRequestException({
      code: "CAPTCHA_FAILED",
      message: "การยืนยัน CAPTCHA (Cloudflare Turnstile) ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    });
  }
  if (!input.pdpaConsent) {
    throw new BadRequestException({
      code: "PDPA_CONSENT_REQUIRED",
      message: "กรุณากดยอมรับนโยบายความเป็นส่วนตัว (PDPA) ก่อนส่งข้อมูล",
    });
  }
}
