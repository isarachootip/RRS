import { z } from "zod";

export const ANONYMIZED_NAME = "นิรนาม (PDPA Anonymized)";
export const DEFAULT_RETENTION_MONTHS = 24;

export const PdpaSubjectTypeSchema = z.enum(["LEAD", "OWNER"]);
export type PdpaSubjectType = z.infer<typeof PdpaSubjectTypeSchema>;

export const RecordConsentSchema = z.object({
  subjectType: PdpaSubjectTypeSchema,
  subjectId: z.string().uuid(),
  consentText: z.string().min(1),
  version: z.string().min(1),
  channel: z.enum(["BACKOFFICE", "PORTAL"]),
});
export type RecordConsentInput = z.infer<typeof RecordConsentSchema>;

export const SearchPdpaSubjectsQuerySchema = z.object({
  q: z.string().optional(),
  type: PdpaSubjectTypeSchema.optional(),
  includeAnonymized: z.enum(["true", "false"]).optional(),
});
export type SearchPdpaSubjectsQuery = z.infer<typeof SearchPdpaSubjectsQuerySchema>;

export const ExportPdpaQuerySchema = z.object({
  format: z.enum(["json", "pdf"]).optional(),
});
export type ExportPdpaQuery = z.infer<typeof ExportPdpaQuerySchema>;

export const RectifyPdpaSubjectSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  lineId: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
});
export type RectifyPdpaSubjectInput = z.infer<typeof RectifyPdpaSubjectSchema>;

export const AnonymizePdpaSubjectSchema = z.object({
  reason: z.string().min(3),
});
export type AnonymizePdpaSubjectInput = z.infer<typeof AnonymizePdpaSubjectSchema>;

export const LogViewSensitiveSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  field: z.enum(["PHONE_FULL", "ID_CARD_DOCUMENT", "PERSONAL_DATA"]),
});
export type LogViewSensitiveInput = z.infer<typeof LogViewSensitiveSchema>;

export const RunRetentionCleanupSchema = z.object({
  retentionMonths: z.number().int().min(1).max(120).optional(),
  nowIso: z.string().datetime().optional(),
});
export type RunRetentionCleanupInput = z.infer<typeof RunRetentionCleanupSchema>;

export interface PdpaSubjectItem {
  id: string;
  subjectType: PdpaSubjectType;
  code: string;
  fullName: string;
  phone: string | null;
  lineId: string | null;
  email: string | null;
  status: string;
  consentAt: string | null;
  lastActivityAt: string | null;
  updatedAt: string;
  isAnonymized: boolean;
}

export interface PdpaExportPayload {
  exportedAt: string;
  subjectType: PdpaSubjectType;
  subject: {
    id: string;
    code: string;
    fullName: string;
    phone: string | null;
    lineId: string | null;
    email: string | null;
    status: string;
    consentAt: string | null;
    consentText: string | null;
    createdAt: string;
  };
  activities: Array<{ id: string; type: string; body: string; createdAt: string }>;
  contracts: Array<{ id: string; contractNo: string; status: string; startDate: string; endDate: string }>;
}
