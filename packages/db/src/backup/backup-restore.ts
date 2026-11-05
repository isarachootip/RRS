import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import type { PrismaClient } from "@prisma/client";
import { toSatang } from "@rrs/shared";

export interface BackupSummaryMetrics {
  counts: {
    owners: number;
    projects: number;
    assets: number;
    leads: number;
    contracts: number;
    payments: number;
    commissions: number;
    expenses: number;
  };
  financialsSatang: {
    totalAssetRentPriceSatang: string;
    totalContractMonthlyRentSatang: string;
    totalPaymentAmountSatang: string;
    totalCommissionAmountSatang: string;
    totalExpenseAmountSatang: string;
  };
}

interface SnapshotPayload {
  createdAt: string;
  metrics: BackupSummaryMetrics;
  owners: Array<{ id: string; code: string; fullName: string }>;
  projects: Array<{ id: string; name: string }>;
  assets: Array<{ id: string; code: string; rentPrice: string }>;
  leads: Array<{ id: string; code: string; fullName: string }>;
  contracts: Array<{ id: string; contractNo: string; monthlyRent: string }>;
  payments: Array<{ id: string; type: string; amount: string }>;
  commissions: Array<{ id: string; totalAmount: string }>;
  expenses: Array<{ id: string; amount: string }>;
}

function sumSatang(values: Array<{ toString(): string } | null | undefined>): string {
  let total = 0n;
  for (const v of values) {
    if (v !== null && v !== undefined) {
      total += toSatang(v.toString());
    }
  }
  return total.toString();
}

export async function collectDatabaseMetrics(prisma: PrismaClient): Promise<BackupSummaryMetrics> {
  const [owners, projects, assets, leads, contracts, payments, commissions, expenses] = await Promise.all([
    prisma.owner.count(),
    prisma.project.count(),
    prisma.asset.findMany({ select: { rentPrice: true } }),
    prisma.lead.count(),
    prisma.contract.findMany({ select: { monthlyRent: true } }),
    prisma.payment.findMany({ select: { amount: true } }),
    prisma.commission.findMany({ select: { totalAmount: true } }),
    prisma.expense.findMany({ select: { amount: true } }),
  ]);

  return {
    counts: {
      owners,
      projects,
      assets: assets.length,
      leads,
      contracts: contracts.length,
      payments: payments.length,
      commissions: commissions.length,
      expenses: expenses.length,
    },
    financialsSatang: {
      totalAssetRentPriceSatang: sumSatang(assets.map((a) => a.rentPrice)),
      totalContractMonthlyRentSatang: sumSatang(contracts.map((c) => c.monthlyRent)),
      totalPaymentAmountSatang: sumSatang(payments.map((p) => p.amount)),
      totalCommissionAmountSatang: sumSatang(commissions.map((c) => c.totalAmount)),
      totalExpenseAmountSatang: sumSatang(expenses.map((e) => e.amount)),
    },
  };
}

export async function createEncryptedBackup(
  prisma: PrismaClient,
  passphrase: string,
): Promise<{ encryptedBuffer: Buffer; metrics: BackupSummaryMetrics }> {
  const [metrics, owners, projects, assets, leads, contracts, payments, commissions, expenses] = await Promise.all([
    collectDatabaseMetrics(prisma),
    prisma.owner.findMany({ select: { id: true, code: true, fullName: true } }),
    prisma.project.findMany({ select: { id: true, name: true } }),
    prisma.asset.findMany({ select: { id: true, code: true, rentPrice: true } }),
    prisma.lead.findMany({ select: { id: true, code: true, fullName: true } }),
    prisma.contract.findMany({ select: { id: true, contractNo: true, monthlyRent: true } }),
    prisma.payment.findMany({ select: { id: true, type: true, amount: true } }),
    prisma.commission.findMany({ select: { id: true, totalAmount: true } }),
    prisma.expense.findMany({ select: { id: true, amount: true } }),
  ]);

  const payload: SnapshotPayload = {
    createdAt: new Date().toISOString(),
    metrics,
    owners,
    projects,
    assets: assets.map((a) => ({ id: a.id, code: a.code, rentPrice: (a.rentPrice ?? "0.00").toString() })),
    leads,
    contracts: contracts.map((c) => ({ id: c.id, contractNo: c.contractNo, monthlyRent: c.monthlyRent.toString() })),
    payments: payments.map((p) => ({ id: p.id, type: p.type, amount: p.amount.toString() })),
    commissions: commissions.map((c) => ({ id: c.id, totalAmount: c.totalAmount.toString() })),
    expenses: expenses.map((e) => ({ id: e.id, amount: e.amount.toString() })),
  };

  const compressed = gzipSync(Buffer.from(JSON.stringify(payload), "utf8"));
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedBuffer: Buffer.concat([salt, iv, authTag, ciphertext]),
    metrics,
  };
}

export async function restoreAndVerifyBackup(
  prisma: PrismaClient,
  encryptedBuffer: Buffer,
  passphrase: string,
): Promise<{ restoredMetrics: BackupSummaryMetrics; matchesSource: boolean }> {
  const salt = encryptedBuffer.subarray(0, 16);
  const iv = encryptedBuffer.subarray(16, 28);
  const authTag = encryptedBuffer.subarray(28, 44);
  const ciphertext = encryptedBuffer.subarray(44);

  const key = scryptSync(passphrase, salt, 32);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const snapshot = JSON.parse(gunzipSync(compressed).toString("utf8")) as SnapshotPayload;

  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS rrs_restore_verify CASCADE`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA rrs_restore_verify`);
  await prisma.$executeRawUnsafe(
    `CREATE TABLE rrs_restore_verify.restored_records (table_name text NOT NULL, record_id text NOT NULL, amount_satang bigint NOT NULL DEFAULT 0)`,
  );

  const insertBatch: Array<{ table: string; id: string; satang: bigint }> = [
    ...snapshot.owners.map((r) => ({ table: "owners", id: r.id, satang: 0n })),
    ...snapshot.projects.map((r) => ({ table: "projects", id: r.id, satang: 0n })),
    ...snapshot.assets.map((r) => ({ table: "assets", id: r.id, satang: toSatang(r.rentPrice) })),
    ...snapshot.leads.map((r) => ({ table: "leads", id: r.id, satang: 0n })),
    ...snapshot.contracts.map((r) => ({ table: "contracts", id: r.id, satang: toSatang(r.monthlyRent) })),
    ...snapshot.payments.map((r) => ({ table: "payments", id: r.id, satang: toSatang(r.amount) })),
    ...snapshot.commissions.map((r) => ({ table: "commissions", id: r.id, satang: toSatang(r.totalAmount) })),
    ...snapshot.expenses.map((r) => ({ table: "expenses", id: r.id, satang: toSatang(r.amount) })),
  ];

  for (const row of insertBatch) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO rrs_restore_verify.restored_records (table_name, record_id, amount_satang) VALUES ($1, $2, $3)`,
      row.table,
      row.id,
      row.satang,
    );
  }

  const agg = await prisma.$queryRawUnsafe<Array<{ table_name: string; cnt: bigint; sum_satang: bigint }>>(
    `SELECT table_name, COUNT(*)::bigint AS cnt, COALESCE(SUM(amount_satang), 0)::bigint AS sum_satang FROM rrs_restore_verify.restored_records GROUP BY table_name`,
  );
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS rrs_restore_verify CASCADE`);

  const byTable = new Map(agg.map((r) => [r.table_name, { count: Number(r.cnt), satang: r.sum_satang.toString() }]));
  const restoredMetrics: BackupSummaryMetrics = {
    counts: {
      owners: byTable.get("owners")?.count ?? 0,
      projects: byTable.get("projects")?.count ?? 0,
      assets: byTable.get("assets")?.count ?? 0,
      leads: byTable.get("leads")?.count ?? 0,
      contracts: byTable.get("contracts")?.count ?? 0,
      payments: byTable.get("payments")?.count ?? 0,
      commissions: byTable.get("commissions")?.count ?? 0,
      expenses: byTable.get("expenses")?.count ?? 0,
    },
    financialsSatang: {
      totalAssetRentPriceSatang: byTable.get("assets")?.satang ?? "0",
      totalContractMonthlyRentSatang: byTable.get("contracts")?.satang ?? "0",
      totalPaymentAmountSatang: byTable.get("payments")?.satang ?? "0",
      totalCommissionAmountSatang: byTable.get("commissions")?.satang ?? "0",
      totalExpenseAmountSatang: byTable.get("expenses")?.satang ?? "0",
    },
  };

  const matchesSource = JSON.stringify(restoredMetrics) === JSON.stringify(snapshot.metrics);
  return { restoredMetrics, matchesSource };
}
