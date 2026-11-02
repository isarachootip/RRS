import type { PrismaService } from "../src/prisma/prisma.service";

export const EXPECTED_ROOM1_MONTHLY_NET: Record<string, string> = {
  "2027-01": "-549.75",
  "2027-02": "23200.50",
  "2027-03": "19749.75",
  "2027-04": "23200.50",
  "2027-05": "23200.50",
  "2027-06": "23701.25",
  "2027-07": "23200.50",
  "2027-08": "23200.50",
  "2027-09": "23200.50",
  "2027-10": "23200.50",
  "2027-11": "23200.50",
  "2027-12": "19000.00",
};

export const EXPECTED_ROOM2_MONTHLY_NET: Record<string, string> = {
  "2027-01": "18500.25",
  "2027-02": "18500.25",
  "2027-03": "18500.25",
  "2027-04": "18500.25",
  "2027-05": "18500.25",
  "2027-06": "18500.25",
  "2027-07": "18500.25",
  "2027-08": "18500.25",
  "2027-09": "-1200.50",
  "2027-10": "-5500.25",
  "2027-11": "11500.37",
  "2027-12": "19000.75",
};

export const EXPECTED_ROOM3_MONTHLY_NET: Record<string, string> = {
  "2027-01": "-1500.10",
  "2027-02": "35200.25",
  "2027-03": "42000.75",
  "2027-04": "20000.25",
  "2027-05": "64001.25",
  "2027-06": "42000.75",
  "2027-07": "41050.50",
  "2027-08": "42000.75",
  "2027-09": "42000.75",
  "2027-10": "42000.75",
  "2027-11": "42000.75",
  "2027-12": "42000.75",
};

export async function seedThreeOwnerRoomsTwelveMonths(
  prisma: PrismaService,
  assetIds: [string, string, string],
  actorId: string,
) {
  const [r1, r2, r3] = assetIds;
  const mkPay = (
    assetId: string,
    type: "MONTHLY_RENT" | "OTHER_INCOME" | "COMMISSION_FROM_OWNER" | "BOOKING_FEE",
    direction: "IN" | "OUT",
    amount: string,
    dateStr: string,
  ) => ({
    type,
    direction,
    amount,
    paidAt: new Date(`${dateStr}T10:00:00.000Z`),
    method: "BANK_TRANSFER" as const,
    assetId,
    receivedById: actorId,
    createdById: actorId,
  });

  const mkExp = (
    assetId: string,
    category: "COMMON_FEE" | "REPAIR" | "PROPERTY_TAX" | "CLEANING" | "MARKETING" | "INSURANCE" | "UTILITY",
    amount: string,
    dateStr: string,
  ) => ({
    assetId,
    category,
    amount,
    incurredAt: new Date(`${dateStr}T00:00:00.000Z`),
    paidAt: new Date(`${dateStr}T00:00:00.000Z`),
    createdById: actorId,
  });

  const paymentsData = [];
  const expensesData = [];

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    paymentsData.push(mkPay(r1, "MONTHLY_RENT", "IN", "25000.50", `2027-${mm}-05`));
    expensesData.push(mkExp(r1, "COMMON_FEE", "1800.00", `2027-${mm}-10`));

    if (m <= 8) paymentsData.push(mkPay(r2, "MONTHLY_RENT", "IN", "18500.25", `2027-${mm}-05`));
    else if (m >= 11) paymentsData.push(mkPay(r2, "MONTHLY_RENT", "IN", "19000.75", `2027-${mm}-05`));

    const r3Amt = m === 4 ? "20000.25" : m === 5 ? "64001.25" : "42000.75";
    paymentsData.push(mkPay(r3, "MONTHLY_RENT", "IN", r3Amt, `2027-${mm}-05`));
  }

  paymentsData.push(
    mkPay(r1, "OTHER_INCOME", "IN", "1250.25", "2027-01-15"),
    mkPay(r1, "OTHER_INCOME", "IN", "500.75", "2027-06-15"),
    mkPay(r1, "COMMISSION_FROM_OWNER", "OUT", "25000.50", "2027-01-20"),
    mkPay(r2, "BOOKING_FEE", "IN", "2000.00", "2027-11-02"),
    mkPay(r2, "COMMISSION_FROM_OWNER", "OUT", "9500.38", "2027-11-18"),
    mkPay(r3, "COMMISSION_FROM_OWNER", "OUT", "42000.75", "2027-01-25"),
  );

  expensesData.push(
    mkExp(r1, "REPAIR", "3450.75", "2027-03-12"),
    mkExp(r1, "PROPERTY_TAX", "4200.50", "2027-12-20"),
    mkExp(r2, "CLEANING", "1200.50", "2027-09-10"),
    mkExp(r2, "REPAIR", "5500.25", "2027-10-15"),
    mkExp(r3, "MARKETING", "1500.10", "2027-01-08"),
    mkExp(r3, "INSURANCE", "6800.50", "2027-02-14"),
    mkExp(r3, "UTILITY", "950.25", "2027-07-19"),
  );

  await prisma.payment.createMany({ data: paymentsData });
  await prisma.expense.createMany({ data: expensesData });
}
