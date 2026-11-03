import { DECIMAL_AMOUNT_REGEX, toSatang } from "@rrs/shared";
import { z } from "zod";

const NonNegativeAmountSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => DECIMAL_AMOUNT_REGEX.test(v) && toSatang(v) >= 0n, {
    message: "จำนวนเงินต้องเป็นทศนิยมไม่เกิน 2 ตำแหน่งและไม่ติดลบ",
  });

const PositiveAmountSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => DECIMAL_AMOUNT_REGEX.test(v) && toSatang(v) > 0n, {
    message: "จำนวนเงินต้องมากกว่า 0",
  });

export const CommissionFormulaEnum = z.enum([
  "ONE_MONTH",
  "PERCENT_TOTAL",
  "N_MONTHS",
  "FIXED",
  "CUSTOM",
  "PERCENT_SALE_PRICE",
]);

export const CommissionStatusEnum = z.enum([
  "PENDING_CALC",
  "PENDING_REVIEW",
  "APPROVED",
  "AWAITING_OWNER_PAYMENT",
  "RECEIVED",
  "AWAITING_PAYOUT",
  "PAID",
  "CANCELLED",
]);

export const DealRoleEnum = z.enum(["FINDER", "LISTING", "SHOWING", "CLOSER", "COMPANY"]);

export const ShareTypeEnum = z.enum(["PERCENT", "AMOUNT"]);

export const PaymentMethodEnum = z.enum(["CASH", "BANK_TRANSFER", "PROMPTPAY", "CHEQUE", "CARD", "OTHER"]);

export const ListCommissionsQuerySchema = z.object({
  status: CommissionStatusEnum.optional(),
  assetId: z.string().uuid().optional(),
  contractId: z.string().uuid().optional(),
  saleDealId: z.string().uuid().optional(),
});

export type ListCommissionsQueryDto = z.infer<typeof ListCommissionsQuerySchema>;

export const SplitRowInputSchema = z.object({
  role: DealRoleEnum,
  userId: z.string().uuid().optional().nullable(),
  shareType: ShareTypeEnum,
  sharePercent: z.union([z.string(), z.number()]).optional().nullable(),
  amount: z.union([z.string(), z.number()]).optional().nullable(),
  withholdingRatePercent: z.union([z.string(), z.number()]).optional().nullable(),
});

export const CalculateCommissionSplitsSchema = z.object({
  formula: CommissionFormulaEnum,
  baseAmount: NonNegativeAmountSchema.optional(),
  termMonths: z.coerce.number().int().min(0).max(600).optional().nullable(),
  params: z
    .object({
      percent: z.union([z.string(), z.number()]).optional().nullable(),
      capMonths: z.coerce.number().int().min(1).max(600).optional().nullable(),
      months: z.union([z.string(), z.number()]).optional().nullable(),
      amount: z.union([z.string(), z.number()]).optional().nullable(),
      note: z.string().max(1000).optional().nullable(),
    })
    .optional()
    .nullable(),
  splits: z.array(SplitRowInputSchema).min(1),
  reason: z.string().max(1000).optional().nullable(),
});

export type CalculateCommissionSplitsDto = z.infer<typeof CalculateCommissionSplitsSchema>;

export const ApproveCommissionSchema = z.object({
  ownerPaymentDueAt: z.string().optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

export type ApproveCommissionDto = z.infer<typeof ApproveCommissionSchema>;

export const ReceiveOwnerPaymentSchema = z.object({
  amount: PositiveAmountSchema.optional(),
  paidAt: z.string().optional(),
  method: PaymentMethodEnum.default("BANK_TRANSFER"),
  reference: z.string().max(200).optional().nullable(),
  proofFileId: z.string().uuid().optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

export type ReceiveOwnerPaymentDto = z.infer<typeof ReceiveOwnerPaymentSchema>;

export const CreateCommissionPayoutSchema = z.object({
  userId: z.string().uuid(),
  periodLabel: z.string().min(1).max(100),
  splitIds: z.array(z.string().uuid()).min(1),
  payImmediately: z.boolean().optional(),
  paidAt: z.string().optional(),
  method: PaymentMethodEnum.optional(),
  proofFileId: z.string().uuid().optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

export type CreateCommissionPayoutDto = z.infer<typeof CreateCommissionPayoutSchema>;

export const PayCommissionPayoutSchema = z.object({
  paidAt: z.string().optional(),
  method: PaymentMethodEnum.default("BANK_TRANSFER"),
  proofFileId: z.string().uuid().optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

export type PayCommissionPayoutDto = z.infer<typeof PayCommissionPayoutSchema>;
