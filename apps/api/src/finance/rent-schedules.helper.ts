import type { Prisma, RentScheduleStatus } from "@rrs/db";
import { fromSatang, toSatang } from "@rrs/shared";

function addUtcMonths(base: Date, months: number): Date {
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + months;
  const day = base.getUTCDate();
  const targetFirst = new Date(Date.UTC(year, month, 1));
  const maxDay = new Date(Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth(), Math.min(day, maxDay)));
}

export interface SchedulePeriod {
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
}

export function buildMonthlySchedulePeriods(startDate: Date, endDate: Date): SchedulePeriod[] {
  const start = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
  const periods: SchedulePeriod[] = [];
  let idx = 0;

  while (true) {
    const periodStart = addUtcMonths(start, idx);
    if (periodStart.getTime() > end.getTime()) break;

    const nextStart = addUtcMonths(start, idx + 1);
    const rawPeriodEnd = new Date(nextStart.getTime() - 24 * 60 * 60 * 1000);
    const periodEnd = rawPeriodEnd.getTime() > end.getTime() ? end : rawPeriodEnd;

    periods.push({
      periodStart,
      periodEnd,
      dueDate: periodStart,
    });
    idx += 1;
    if (idx > 240) break;
  }
  return periods;
}

export async function generateRentSchedulesTx(tx: Prisma.TransactionClient, contractId: string) {
  const contract = await tx.contract.findUnique({
    where: { id: contractId },
    include: { asset: { select: { id: true, ownershipType: true } } },
  });
  if (!contract || contract.asset.ownershipType !== "OWNER") {
    return [];
  }

  const amountDueStr = fromSatang(toSatang(contract.monthlyRent));
  const periods = buildMonthlySchedulePeriods(contract.startDate, contract.endDate);
  const created = [];

  for (const p of periods) {
    const row = await tx.rentSchedule.upsert({
      where: {
        contractId_periodStart: {
          contractId: contract.id,
          periodStart: p.periodStart,
        },
      },
      update: {
        periodEnd: p.periodEnd,
        dueDate: p.dueDate,
        amountDue: amountDueStr,
      },
      create: {
        contractId: contract.id,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        dueDate: p.dueDate,
        amountDue: amountDueStr,
        amountPaid: "0.00",
        status: "DUE",
      },
    });
    created.push(row);
  }
  return created;
}

export async function recomputeRentScheduleFromPaymentsTx(tx: Prisma.TransactionClient, rentScheduleId: string) {
  const schedule = await tx.rentSchedule.findUnique({
    where: { id: rentScheduleId },
    include: {
      payments: {
        where: { archivedAt: null },
        select: { amount: true, direction: true },
      },
    },
  });
  if (!schedule) return null;

  let paidSatang = 0n;
  for (const pay of schedule.payments) {
    const amt = toSatang(pay.amount);
    if (pay.direction === "IN") paidSatang += amt;
    else paidSatang -= amt;
  }
  if (paidSatang < 0n) paidSatang = 0n;

  const dueSatang = toSatang(schedule.amountDue);
  let nextStatus: RentScheduleStatus = schedule.status;
  if (schedule.status !== "WAIVED") {
    if (paidSatang >= dueSatang && dueSatang > 0n) {
      nextStatus = "PAID";
    } else if (paidSatang > 0n) {
      nextStatus = "PARTIAL";
    } else {
      nextStatus = "DUE";
    }
  }

  return tx.rentSchedule.update({
    where: { id: rentScheduleId },
    data: {
      amountPaid: fromSatang(paidSatang),
      status: nextStatus,
    },
  });
}
