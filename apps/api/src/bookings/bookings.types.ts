import { z } from "zod";

export const bookingStatusEnum = z.enum(["PENDING_PAYMENT", "PAID", "CONVERTED", "CANCELLED"]);
export const paymentMethodEnum = z.enum(["CASH", "BANK_TRANSFER", "PROMPTPAY", "CHEQUE", "CARD", "OTHER"]);

export const listBookingsQuerySchema = z.object({
  status: bookingStatusEnum.optional(),
  leadId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
});

export type ListBookingsQueryDto = z.infer<typeof listBookingsQuerySchema>;

export const createBookingSchema = z
  .object({
    leadId: z.string().uuid("กรุณาเลือกลูกค้า"),
    assetId: z.string().uuid("กรุณาเลือกทรัพย์สิน"),
    monthlyRent: z.coerce.number().positive("ค่าเช่าต่อเดือนต้องมากกว่า 0"),
    bookingFee: z.coerce.number().min(0, "เงินจองต้องไม่ติดลบ").default(0),
    securityDeposit: z.coerce.number().min(0, "เงินประกันต้องไม่ติดลบ").default(0),
    advanceRent: z.coerce.number().min(0, "ค่าเช่าล่วงหน้าต้องไม่ติดลบ").default(0),
    startDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "วันที่เริ่มสัญญาไม่ถูกต้อง"),
    endDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "วันที่สิ้นสุดสัญญาไม่ถูกต้อง"),
    receivedById: z.string().uuid().optional().nullable(),
    note: z.string().trim().max(2000).optional().nullable(),
    payImmediately: z.boolean().optional().default(false),
    paymentMethod: paymentMethodEnum.optional().default("BANK_TRANSFER"),
    paymentReference: z.string().trim().max(200).optional().nullable(),
    proofFileId: z.string().uuid().optional().nullable(),
  })
  .refine((v) => new Date(v.endDate).getTime() >= new Date(v.startDate).getTime(), {
    message: "วันที่สิ้นสุดสัญญาต้องไม่น้อยกว่าวันที่เริ่มสัญญา",
    path: ["endDate"],
  });

export type CreateBookingDto = z.infer<typeof createBookingSchema>;

export const payBookingSchema = z.object({
  method: paymentMethodEnum.optional().default("BANK_TRANSFER"),
  paidAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "วันที่ชำระเงินไม่ถูกต้อง")
    .optional(),
  reference: z.string().trim().max(200).optional().nullable(),
  receivedById: z.string().uuid().optional().nullable(),
  proofFileId: z.string().uuid().optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
});

export type PayBookingDto = z.infer<typeof payBookingSchema>;

export const cancelBookingSchema = z.object({
  cancelReason: z.string().trim().min(1, "กรุณาระบุเหตุผลการยกเลิกการจอง").max(1000),
  feeForfeited: z.boolean({ required_error: "กรุณาระบุว่ายึดเงินจองหรือคืนเงินจอง" }),
});

export type CancelBookingDto = z.infer<typeof cancelBookingSchema>;
