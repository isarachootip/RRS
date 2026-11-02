import { DECIMAL_AMOUNT_REGEX, toSatang } from "@rrs/shared";
import { z } from "zod";

const PositiveAmountSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => DECIMAL_AMOUNT_REGEX.test(v) && toSatang(v) > 0n, {
    message: "จำนวนเงินต้องเป็นตัวเลขทศนิยมไม่เกิน 2 ตำแหน่งและมากกว่า 0",
  });

export const PaymentTypeEnum = z.enum([
  "BOOKING_FEE",
  "SECURITY_DEPOSIT",
  "ADVANCE_RENT",
  "MONTHLY_RENT",
  "SALE_DEPOSIT",
  "SALE_PAYMENT",
  "COMMISSION_FROM_OWNER",
  "OTHER_INCOME",
  "REFUND",
]);

export const PaymentDirectionEnum = z.enum(["IN", "OUT"]);

export const PaymentMethodEnum = z.enum(["CASH", "BANK_TRANSFER", "PROMPTPAY", "CHEQUE", "CARD", "OTHER"]);

export const RentScheduleStatusEnum = z.enum(["DUE", "PARTIAL", "PAID", "OVERDUE", "WAIVED"]);

export const ExpenseCategoryEnum = z.enum([
  "COMMON_FEE",
  "REPAIR",
  "UTILITY",
  "PROPERTY_TAX",
  "INSURANCE",
  "CLEANING",
  "MARKETING",
  "OTHER",
]);

export const ListPaymentsQuerySchema = z.object({
  assetId: z.string().uuid().optional(),
  contractId: z.string().uuid().optional(),
  bookingId: z.string().uuid().optional(),
  saleDealId: z.string().uuid().optional(),
  rentScheduleId: z.string().uuid().optional(),
  type: PaymentTypeEnum.optional(),
  direction: PaymentDirectionEnum.optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export type ListPaymentsQueryDto = z.infer<typeof ListPaymentsQuerySchema>;

export const CreatePaymentSchema = z.object({
  type: PaymentTypeEnum,
  direction: PaymentDirectionEnum.optional(),
  amount: PositiveAmountSchema,
  paidAt: z.string().min(1),
  method: PaymentMethodEnum,
  reference: z.string().max(200).optional().nullable(),
  assetId: z.string().uuid().optional().nullable(),
  bookingId: z.string().uuid().optional().nullable(),
  contractId: z.string().uuid().optional().nullable(),
  saleDealId: z.string().uuid().optional().nullable(),
  rentScheduleId: z.string().uuid().optional().nullable(),
  commissionId: z.string().uuid().optional().nullable(),
  receivedById: z.string().uuid().optional().nullable(),
  proofFileId: z.string().uuid().optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

export type CreatePaymentDto = z.infer<typeof CreatePaymentSchema>;

export const ListRentSchedulesQuerySchema = z.object({
  contractId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  status: RentScheduleStatusEnum.optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export type ListRentSchedulesQueryDto = z.infer<typeof ListRentSchedulesQuerySchema>;

export const UpdateRentScheduleStatusSchema = z.object({
  status: RentScheduleStatusEnum,
});

export type UpdateRentScheduleStatusDto = z.infer<typeof UpdateRentScheduleStatusSchema>;

export const ListExpensesQuerySchema = z.object({
  assetId: z.string().uuid().optional(),
  category: ExpenseCategoryEnum.optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export type ListExpensesQueryDto = z.infer<typeof ListExpensesQuerySchema>;

export const CreateExpenseSchema = z.object({
  assetId: z.string().uuid(),
  category: ExpenseCategoryEnum,
  amount: PositiveAmountSchema,
  incurredAt: z.string().min(1),
  paidAt: z.string().optional().nullable(),
  vendor: z.string().max(200).optional().nullable(),
  proofFileId: z.string().uuid().optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

export type CreateExpenseDto = z.infer<typeof CreateExpenseSchema>;

export const OwnerNetIncomeQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  assetId: z.string().uuid().optional(),
});

export type OwnerNetIncomeQueryDto = z.infer<typeof OwnerNetIncomeQuerySchema>;
