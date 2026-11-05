import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEncryptedBackup, restoreAndVerifyBackup } from "../src/backup/backup-restore";
import { seed } from "../src/seed";
import { resetTestDb } from "./reset";

const prisma = new PrismaClient();

beforeAll(async () => {
  await resetTestDb();
  await seed(prisma);

  const owner = await prisma.owner.findFirstOrThrow();
  const asset = await prisma.asset.findFirstOrThrow();
  const lead = await prisma.lead.findFirstOrThrow();
  const user = await prisma.user.findFirstOrThrow();

  const contract = await prisma.contract.create({
    data: {
      contractNo: "LS-2026-9901",
      assetId: asset.id,
      leadId: lead.id,
      ownerId: owner.id,
      monthlyRent: new Prisma.Decimal("25000.00"),
      securityDeposit: new Prisma.Decimal("50000.00"),
      advanceRent: new Prisma.Decimal("25000.00"),
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T00:00:00.000Z"),
      status: "ACTIVE",
    },
  });

  await prisma.payment.create({
    data: {
      type: "MONTHLY_RENT",
      direction: "IN",
      amount: new Prisma.Decimal("25000.00"),
      paidAt: new Date("2026-02-01T10:00:00.000Z"),
      method: "BANK_TRANSFER",
      assetId: asset.id,
      contractId: contract.id,
      receivedById: user.id,
    },
  });

  await prisma.commission.create({
    data: {
      contractId: contract.id,
      assetId: asset.id,
      ownershipType: asset.ownershipType,
      formula: "ONE_MONTH",
      baseAmount: new Prisma.Decimal("25000.00"),
      totalAmount: new Prisma.Decimal("25000.00"),
      status: "APPROVED",
    },
  });

  await prisma.expense.create({
    data: {
      assetId: asset.id,
      category: "REPAIR",
      amount: new Prisma.Decimal("1500.50"),
      incurredAt: new Date("2026-02-10T00:00:00.000Z"),
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("P19 · ระบบสำรองและกู้คืนข้อมูล (Encrypted Backup → Restore → Verify Counts & Financials)", () => {
  it("สำรองข้อมูลเข้ารหัส AES-256-GCM และกู้คืนลงฐานข้อมูลทดสอบได้จำนวนแถวและยอดเงินตรงกันทุกสตางค์", async () => {
    const passphrase = "rrs-test-backup-passphrase-2026";
    const { encryptedBuffer, metrics } = await createEncryptedBackup(prisma, passphrase);

    expect(encryptedBuffer.byteLength).toBeGreaterThan(100);
    expect(metrics.counts.assets).toBe(30);
    expect(metrics.counts.leads).toBe(50);
    expect(metrics.counts.contracts).toBe(1);
    expect(metrics.financialsSatang.totalPaymentAmountSatang).toBe("2500000");
    expect(metrics.financialsSatang.totalCommissionAmountSatang).toBe("2500000");
    expect(metrics.financialsSatang.totalExpenseAmountSatang).toBe("150050");

    const { restoredMetrics, matchesSource } = await restoreAndVerifyBackup(prisma, encryptedBuffer, passphrase);
    expect(matchesSource).toBe(true);
    expect(restoredMetrics).toEqual(metrics);
  });
});
