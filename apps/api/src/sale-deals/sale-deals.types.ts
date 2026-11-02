import { z } from "zod";
import { commissionFormulaEnum } from "../contracts/contracts.types";

export const saleStageEnum = z.enum([
  "INTERESTED",
  "OFFERED",
  "DEPOSIT_PAID",
  "SPA_SIGNED",
  "LOAN_PENDING",
  "TRANSFERRED",
  "CLOSED",
  "CANCELLED",
]);

export const feePayerEnum = z.enum(["BUYER", "SELLER", "SPLIT"]);

export const listSaleDealsQuerySchema = z.object({
  stage: saleStageEnum.optional(),
  assetId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
});

export type ListSaleDealsQueryDto = z.infer<typeof listSaleDealsQuerySchema>;

export const createSaleDealSchema = z.object({
  leadId: z.string().uuid("กรุณาเลือกลูกค้า"),
  assetId: z.string().uuid("กรุณาเลือกทรัพย์สิน"),
  agentId: z.string().uuid().optional(),
  stage: saleStageEnum.optional().default("INTERESTED"),
  askingPrice: z.coerce.number().positive().optional().nullable(),
  offeredPrice: z.coerce.number().positive().optional().nullable(),
  agreedPrice: z.coerce.number().positive().optional().nullable(),
  depositAmount: z.coerce.number().min(0).optional().nullable(),
  spaSignedAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "วันที่ทำสัญญาจะซื้อจะขายไม่ถูกต้อง")
    .optional()
    .nullable(),
  transferDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "วันนัดโอนกรรมสิทธิ์ไม่ถูกต้อง")
    .optional()
    .nullable(),
  transferFeePayer: feePayerEnum.optional().nullable(),
  loanBank: z.string().trim().max(200).optional().nullable(),
  commissionFormula: commissionFormulaEnum.optional().default("PERCENT_SALE_PRICE"),
  commissionParams: z.record(z.string(), z.unknown()).optional().default({ percent: 3 }),
  note: z.string().trim().max(2000).optional().nullable(),
});

export type CreateSaleDealDto = z.infer<typeof createSaleDealSchema>;

export const updateSaleDealSchema = z.object({
  stage: saleStageEnum.optional(),
  askingPrice: z.coerce.number().positive().optional().nullable(),
  offeredPrice: z.coerce.number().positive().optional().nullable(),
  agreedPrice: z.coerce.number().positive().optional().nullable(),
  depositAmount: z.coerce.number().min(0).optional().nullable(),
  spaSignedAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "วันที่ทำสัญญาจะซื้อจะขายไม่ถูกต้อง")
    .optional()
    .nullable(),
  transferDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "วันนัดโอนกรรมสิทธิ์ไม่ถูกต้อง")
    .optional()
    .nullable(),
  transferFeePayer: feePayerEnum.optional().nullable(),
  loanBank: z.string().trim().max(200).optional().nullable(),
  commissionFormula: commissionFormulaEnum.optional(),
  commissionParams: z.record(z.string(), z.unknown()).optional(),
  cancelReason: z.string().trim().max(1000).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
});

export type UpdateSaleDealDto = z.infer<typeof updateSaleDealSchema>;
