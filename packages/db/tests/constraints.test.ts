import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { isContractLockedError, isPeriodOverlapError, nextCode } from "../src";
import { resetTestDb } from "./reset";

const prisma = new PrismaClient();
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const money = (n: number) => new Prisma.Decimal(n);

let agentId: string;
let ownerId: string;
let leadId: string;

async function newAsset() {
  const asset = await prisma.asset.create({
    data: {
      code: await nextCode(prisma, "TEST-PR", "T-PR-"),
      category: "CONDO",
      ownershipType: "AGENT",
      ownerId,
      rentPrice: money(15000),
    },
  });
  return asset.id;
}

async function booking(
  assetId: string,
  start: string,
  end: string,
  status: "PENDING_PAYMENT" | "PAID" | "CANCELLED" = "PAID",
) {
  return prisma.booking.create({
    data: {
      code: await nextCode(prisma, "TEST-BK", "T-BK-"),
      leadId,
      assetId,
      monthlyRent: money(15000),
      startDate: d(start),
      endDate: d(end),
      status,
    },
  });
}

async function contract(
  assetId: string,
  start: string,
  end: string,
  extra: Partial<Prisma.ContractUncheckedCreateInput> = {},
) {
  return prisma.contract.create({
    data: {
      contractNo: await nextCode(prisma, "TEST-LS", "T-LS-"),
      assetId,
      leadId,
      ownerId,
      monthlyRent: money(15000),
      startDate: d(start),
      endDate: d(end),
      status: "ACTIVE",
      ...extra,
    },
  });
}

beforeAll(async () => {
  await resetTestDb();
  const agent = await prisma.user.create({
    data: { email: "constraints-agent@test.local", fullName: "Agent Test", passwordHash: "x" },
  });
  agentId = agent.id;
  const owner = await prisma.owner.create({ data: { code: "T-OW-1", fullName: "Owner Test" } });
  ownerId = owner.id;
  const lead = await prisma.lead.create({
    data: { code: "T-LD-1", fullName: "Lead Test", source: "WEBSITE", ownerAgentId: agentId },
  });
  leadId = lead.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("กันจองซ้ำ (bookings_no_overlap)", () => {
  it("จองที่ชำระแล้ว 2 รายการช่วงทับกันบนห้องเดียวกัน → รายการที่สองถูกปฏิเสธ", async () => {
    const assetId = await newAsset();
    await booking(assetId, "2027-01-01", "2027-12-31");
    const second = booking(assetId, "2027-06-01", "2028-05-31");
    await expect(second).rejects.toThrow();
    await second.catch((e) => expect(isPeriodOverlapError(e)).toBe(true));
  });

  it("วันสุดท้ายของรายการแรกชนวันแรกของรายการถัดไป → ถือว่าทับ (ช่วงรวมวันสุดท้าย)", async () => {
    const assetId = await newAsset();
    await booking(assetId, "2027-01-01", "2027-06-30");
    await expect(booking(assetId, "2027-06-30", "2027-12-31")).rejects.toThrow(/bookings_no_overlap/);
  });

  it("ช่วงต่อกันพอดี (ออก 30 มิ.ย. เข้า 1 ก.ค.) → บันทึกได้", async () => {
    const assetId = await newAsset();
    await booking(assetId, "2027-01-01", "2027-06-30");
    await expect(booking(assetId, "2027-07-01", "2027-12-31")).resolves.toBeTruthy();
  });

  it("จองที่ยังไม่ชำระ หรือยกเลิกแล้ว ไม่ล็อกห้อง", async () => {
    const assetId = await newAsset();
    await booking(assetId, "2027-01-01", "2027-12-31", "PENDING_PAYMENT");
    await booking(assetId, "2027-01-01", "2027-12-31", "CANCELLED");
    await expect(booking(assetId, "2027-01-01", "2027-12-31")).resolves.toBeTruthy();
  });

  it("คนละห้อง ช่วงเดียวกัน → บันทึกได้", async () => {
    const a = await newAsset();
    const b = await newAsset();
    await booking(a, "2027-01-01", "2027-12-31");
    await expect(booking(b, "2027-01-01", "2027-12-31")).resolves.toBeTruthy();
  });

  it("ยิงจองห้องเดียวกันช่วงเดียวกันพร้อมกัน 10 request → สำเร็จ 1 รายการเท่านั้น", async () => {
    const assetId = await newAsset();
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => booking(assetId, "2028-01-01", "2028-12-31")),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.booking.count({ where: { assetId, status: "PAID" } })).toBe(1);
  });

  it("เปลี่ยนสถานะจองเดิมเป็น PAID ทีหลัง ก็ถูกตรวจเหมือนกัน", async () => {
    const assetId = await newAsset();
    await booking(assetId, "2027-01-01", "2027-12-31");
    const pending = await booking(assetId, "2027-03-01", "2027-04-30", "PENDING_PAYMENT");
    await expect(prisma.booking.update({ where: { id: pending.id }, data: { status: "PAID" } })).rejects.toThrow(
      /bookings_no_overlap/,
    );
  });
});

describe("กันจองซ้ำข้ามตาราง booking ↔ contract", () => {
  it("สัญญาที่มีผลอยู่ ล็อกห้อง → จองทับช่วงเดียวกันไม่ได้", async () => {
    const assetId = await newAsset();
    await contract(assetId, "2027-01-01", "2027-12-31");
    await expect(booking(assetId, "2027-11-01", "2028-10-31")).rejects.toThrow(/asset_period_overlap/);
  });

  it("จองที่ชำระแล้ว ล็อกห้อง → สัญญาของคนอื่นทับช่วงเดียวกันไม่ได้", async () => {
    const assetId = await newAsset();
    await booking(assetId, "2027-01-01", "2027-12-31");
    await expect(contract(assetId, "2027-05-01", "2028-04-30")).rejects.toThrow(/asset_period_overlap/);
  });

  it("แปลงจองเป็นสัญญาของตัวเองได้ แล้วจองกลายเป็น CONVERTED", async () => {
    const assetId = await newAsset();
    const b = await booking(assetId, "2027-01-01", "2027-12-31");
    await expect(contract(assetId, "2027-01-01", "2027-12-31", { bookingId: b.id })).resolves.toBeTruthy();
    await expect(prisma.booking.update({ where: { id: b.id }, data: { status: "CONVERTED" } })).resolves.toBeTruthy();
  });

  it("สัญญาทับกันเองไม่ได้ (contracts_no_overlap)", async () => {
    const assetId = await newAsset();
    await contract(assetId, "2027-01-01", "2027-12-31");
    await expect(contract(assetId, "2027-12-31", "2028-12-30")).rejects.toThrow(/contracts_no_overlap/);
  });

  it("ยกเลิกสัญญาก่อนกำหนด → ห้องว่างหลังวันยกเลิก จองต่อได้", async () => {
    const assetId = await newAsset();
    const c = await contract(assetId, "2027-01-01", "2027-12-31");
    await expect(booking(assetId, "2027-08-01", "2028-07-31")).rejects.toThrow(/asset_period_overlap/);
    await prisma.contract.update({
      where: { id: c.id },
      data: { status: "TERMINATED", terminatedAt: d("2027-06-30"), terminationReason: "ผู้เช่าย้ายงาน" },
    });
    await expect(booking(assetId, "2027-08-01", "2028-07-31")).resolves.toBeTruthy();
  });
});

describe("สัญญาที่มีผลแล้วห้ามแก้เนื้อหา", () => {
  it("แก้ค่าเช่าของสัญญา ACTIVE → ถูกปฏิเสธ", async () => {
    const assetId = await newAsset();
    const c = await contract(assetId, "2029-01-01", "2029-12-31");
    const attempt = prisma.contract.update({ where: { id: c.id }, data: { monthlyRent: money(12000) } });
    await expect(attempt).rejects.toThrow(/contract_locked/);
    await attempt.catch((e) => expect(isContractLockedError(e)).toBe(true));
  });

  it("แก้ด้วยการสร้าง revision ใหม่ → ข้อมูลเดิมไม่เปลี่ยน", async () => {
    const assetId = await newAsset();
    const c = await contract(assetId, "2029-01-01", "2029-12-31");
    const rev2 = await prisma.$transaction(async (tx) => {
      await tx.contract.update({ where: { id: c.id }, data: { status: "SUPERSEDED" } });
      return tx.contract.create({
        data: {
          contractNo: `${c.contractNo}-R2`,
          revision: 2,
          revisionOfId: c.id,
          assetId,
          leadId,
          ownerId,
          monthlyRent: money(12000),
          startDate: c.startDate,
          endDate: c.endDate,
          status: "ACTIVE",
        },
      });
    });
    const original = await prisma.contract.findUniqueOrThrow({ where: { id: c.id } });
    expect(original.monthlyRent.toString()).toBe("15000");
    expect(original.status).toBe("SUPERSEDED");
    expect(rev2.monthlyRent.toString()).toBe("12000");
    // สัญญาที่ปิดแล้วเปิดใหม่ไม่ได้
    await expect(prisma.contract.update({ where: { id: c.id }, data: { status: "ACTIVE" } })).rejects.toThrow(
      /contract_locked/,
    );
  });

  it("สัญญาฉบับร่างแก้ได้ตามปกติ", async () => {
    const assetId = await newAsset();
    const c = await contract(assetId, "2029-01-01", "2029-12-31", { status: "DRAFT" });
    await expect(
      prisma.contract.update({ where: { id: c.id }, data: { monthlyRent: money(14000) } }),
    ).resolves.toBeTruthy();
  });
});

describe("audit_logs append-only", () => {
  it("เพิ่มได้ แต่แก้/ลบ/ล้างตารางไม่ได้", async () => {
    const log = await prisma.auditLog.create({
      data: { entityType: "asset", entityId: "x", action: "UPDATE", before: { a: 1 }, after: { a: 2 } },
    });
    await expect(prisma.auditLog.update({ where: { id: log.id }, data: { action: "CREATE" } })).rejects.toThrow(
      /append_only/,
    );
    await expect(prisma.auditLog.delete({ where: { id: log.id } })).rejects.toThrow(/append_only/);
    await expect(prisma.$executeRawUnsafe(`UPDATE "audit_logs" SET "after" = '{}'`)).rejects.toThrow(/append_only/);
    await expect(prisma.$executeRawUnsafe(`DELETE FROM "audit_logs"`)).rejects.toThrow(/append_only/);
    await expect(prisma.$executeRawUnsafe(`TRUNCATE "audit_logs"`)).rejects.toThrow(/append_only/);
    expect(await prisma.auditLog.count({ where: { id: log.id } })).toBe(1);
  });
});

describe("ค่านายหน้า", () => {
  it("ต้องผูกกับสัญญาหรือดีลขายอย่างใดอย่างหนึ่งพอดี", async () => {
    const assetId = await newAsset();
    await expect(
      prisma.commission.create({
        data: { assetId, ownershipType: "AGENT", formula: "ONE_MONTH", baseAmount: money(15000) },
      }),
    ).rejects.toThrow(/commissions_single_source/);
  });

  it("แถวบริษัทต้องไม่มี user และ % ต้องอยู่ใน 0–100", async () => {
    const assetId = await newAsset();
    const c = await contract(assetId, "2030-01-01", "2030-12-31");
    const com = await prisma.commission.create({
      data: {
        contractId: c.id,
        assetId,
        ownershipType: "AGENT",
        formula: "ONE_MONTH",
        baseAmount: money(15000),
        totalAmount: money(15000),
      },
    });
    const base = { commissionId: com.id, revision: 1, shareType: "PERCENT" as const };
    await expect(
      prisma.commissionSplit.create({
        data: {
          ...base,
          role: "COMPANY",
          userId: agentId,
          sharePercent: money(20),
          amount: money(3000),
          netAmount: money(3000),
        },
      }),
    ).rejects.toThrow(/commission_splits_company_user/);
    await expect(
      prisma.commissionSplit.create({
        data: {
          ...base,
          role: "FINDER",
          userId: agentId,
          sharePercent: money(120),
          amount: money(3000),
          netAmount: money(3000),
        },
      }),
    ).rejects.toThrow(/commission_splits_percent_range/);
    await expect(
      prisma.commissionSplit.create({
        data: {
          ...base,
          role: "FINDER",
          userId: agentId,
          sharePercent: money(30),
          amount: money(4500),
          withholdingTax: money(135),
          netAmount: money(4365),
        },
      }),
    ).resolves.toBeTruthy();
  });

  it("snapshot ที่อนุมัติแล้วแก้ไม่ได้", async () => {
    const assetId = await newAsset();
    const c = await contract(assetId, "2031-01-01", "2031-12-31");
    const com = await prisma.commission.create({
      data: {
        contractId: c.id,
        assetId,
        ownershipType: "AGENT",
        formula: "ONE_MONTH",
        baseAmount: money(15000),
        totalAmount: money(15000),
      },
    });
    const rev = await prisma.commissionRevision.create({
      data: { commissionId: com.id, revision: 1, snapshot: { total: "15000.00" }, createdById: agentId },
    });
    await prisma.commissionRevision.update({
      where: { id: rev.id },
      data: { approvedById: agentId, approvedAt: new Date() },
    });
    await expect(
      prisma.commissionRevision.update({ where: { id: rev.id }, data: { snapshot: { total: "1.00" } } }),
    ).rejects.toThrow(/append_only/);
    await expect(prisma.commissionRevision.delete({ where: { id: rev.id } })).rejects.toThrow(/append_only/);
  });
});

describe("อื่น ๆ", () => {
  it("nextCode ออกเลขเรียงและไม่ซ้ำแม้เรียกพร้อมกัน", async () => {
    const codes = await Promise.all(Array.from({ length: 20 }, () => nextCode(prisma, "TEST-SEQ", "S-", 4)));
    expect(new Set(codes).size).toBe(20);
    expect(codes.sort()[0]).toBe("S-0001");
  });

  it("มีเจ้าของประเภทบริษัทได้รายการเดียว", async () => {
    await prisma.owner.create({ data: { code: "T-OW-CO1", fullName: "บริษัท", isCompany: true } });
    await expect(
      prisma.owner.create({ data: { code: "T-OW-CO2", fullName: "บริษัท 2", isCompany: true } }),
    ).rejects.toThrow(/owners_single_company/);
  });

  it("attributes ต้องเป็น object และวันที่จองต้องไม่ย้อนกลับ", async () => {
    await expect(
      prisma.asset.create({
        data: { code: "T-PR-BAD", category: "CONDO", ownershipType: "AGENT", ownerId, attributes: [] },
      }),
    ).rejects.toThrow(/assets_attributes_object/);
    const assetId = await newAsset();
    await expect(booking(assetId, "2027-12-31", "2027-01-01", "PENDING_PAYMENT")).rejects.toThrow(
      /bookings_date_range/,
    );
  });
});
