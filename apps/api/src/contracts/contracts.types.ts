import { z } from "zod";

export const contractStatusEnum = z.enum(["DRAFT", "PENDING_SIGNATURE", "ACTIVE", "ENDED", "TERMINATED", "SUPERSEDED"]);

export const partyTypeEnum = z.enum(["TENANT", "CO_TENANT", "OCCUPANT", "GUARANTOR"]);

export const commissionFormulaEnum = z.enum([
  "ONE_MONTH",
  "PERCENT_TOTAL",
  "N_MONTHS",
  "FIXED",
  "CUSTOM",
  "PERCENT_SALE_PRICE",
]);

export const contractPartySchema = z.object({
  partyType: partyTypeEnum.default("TENANT"),
  fullName: z.string().trim().min(1, "กรุณาระบุชื่อคู่สัญญา").max(200),
  idNumber: z.string().trim().max(50).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z.string().trim().email("อีเมลไม่ถูกต้อง").optional().nullable(),
});

export type ContractPartyDto = z.infer<typeof contractPartySchema>;

export const listContractsQuerySchema = z.object({
  status: contractStatusEnum.optional(),
  assetId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  includeSuperseded: z.coerce.boolean().optional().default(false),
});

export type ListContractsQueryDto = z.infer<typeof listContractsQuerySchema>;

export const createContractSchema = z.object({
  bookingId: z.string().uuid().optional().nullable(),
  previousContractId: z.string().uuid().optional().nullable(),
  assetId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  monthlyRent: z.coerce.number().positive("ค่าเช่าต่อเดือนต้องมากกว่า 0").optional(),
  securityDeposit: z.coerce.number().min(0).optional(),
  advanceRent: z.coerce.number().min(0).optional(),
  startDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "วันที่เริ่มสัญญาไม่ถูกต้อง")
    .optional(),
  endDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "วันที่สิ้นสุดสัญญาไม่ถูกต้อง")
    .optional(),
  status: z.enum(["DRAFT", "PENDING_SIGNATURE", "ACTIVE"]).optional().default("DRAFT"),
  reminderDays: z.array(z.coerce.number().int().positive()).optional().default([90, 60, 30]),
  commissionFormula: commissionFormulaEnum.optional().default("ONE_MONTH"),
  commissionParams: z.record(z.string(), z.unknown()).optional().default({}),
  fileId: z.string().uuid().optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
  parties: z.array(contractPartySchema).optional().default([]),
});

export type CreateContractDto = z.infer<typeof createContractSchema>;

export const signContractSchema = z.object({
  signedAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "วันที่ลงนามไม่ถูกต้อง")
    .optional(),
  fileId: z.string().uuid().optional().nullable(),
  commissionFormula: commissionFormulaEnum.optional(),
  commissionParams: z.record(z.string(), z.unknown()).optional(),
});

export type SignContractDto = z.infer<typeof signContractSchema>;

export const reviseContractSchema = z.object({
  monthlyRent: z.coerce.number().positive("ค่าเช่าต่อเดือนต้องมากกว่า 0").optional(),
  securityDeposit: z.coerce.number().min(0).optional(),
  advanceRent: z.coerce.number().min(0).optional(),
  startDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "วันที่เริ่มสัญญาไม่ถูกต้อง")
    .optional(),
  endDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "วันที่สิ้นสุดสัญญาไม่ถูกต้อง")
    .optional(),
  reminderDays: z.array(z.coerce.number().int().positive()).optional(),
  commissionFormula: commissionFormulaEnum.optional(),
  commissionParams: z.record(z.string(), z.unknown()).optional(),
  fileId: z.string().uuid().optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
  parties: z.array(contractPartySchema).optional(),
});

export type ReviseContractDto = z.infer<typeof reviseContractSchema>;

export const renewContractSchema = z
  .object({
    startDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "วันที่เริ่มสัญญาใหม่ไม่ถูกต้อง"),
    endDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "วันที่สิ้นสุดสัญญาใหม่ไม่ถูกต้อง"),
    monthlyRent: z.coerce.number().positive("ค่าเช่าต่อเดือนต้องมากกว่า 0").optional(),
    securityDeposit: z.coerce.number().min(0).optional(),
    advanceRent: z.coerce.number().min(0).optional(),
    activateImmediately: z.boolean().optional().default(true),
    fileId: z.string().uuid().optional().nullable(),
    note: z.string().trim().max(2000).optional().nullable(),
  })
  .refine((v) => new Date(v.endDate).getTime() >= new Date(v.startDate).getTime(), {
    message: "วันที่สิ้นสุดสัญญาต้องไม่น้อยกว่าวันที่เริ่มสัญญา",
    path: ["endDate"],
  });

export type RenewContractDto = z.infer<typeof renewContractSchema>;

export const terminateContractSchema = z.object({
  terminatedAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "วันที่ยกเลิกสัญญาไม่ถูกต้อง"),
  terminationReason: z.string().trim().min(1, "กรุณาระบุเหตุผลการยกเลิกสัญญาก่อนกำหนด").max(1000),
});

export type TerminateContractDto = z.infer<typeof terminateContractSchema>;

export const expireContractsJobSchema = z.object({
  asOfDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "วันที่อ้างอิงไม่ถูกต้อง")
    .optional(),
});

export type ExpireContractsJobDto = z.infer<typeof expireContractsJobSchema>;
