import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  calculateCommission,
  calculateCommissionSplits,
  calculateCommissionTotal,
  validateSplits,
  type SplitInputItem,
} from "../src";

describe("P14 · Commission Engine — สูตรคำนวณยอดรวม 6 สูตร", () => {
  it("ONE_MONTH: คืนค่าเช่า 1 เดือนตรงทุกสตางค์", () => {
    const res = calculateCommissionTotal({ formula: "ONE_MONTH", baseAmount: "30000.00", termMonths: 12 });
    expect(res.totalAmount).toBe("30000.00");
    expect(res.totalSatang).toBe(3000000n);
  });

  it("PERCENT_TOTAL: คำนวณ % ของค่าเช่ารวมทั้งสัญญา และรองรับ capMonths (D05)", () => {
    const fullTerm = calculateCommissionTotal({
      formula: "PERCENT_TOTAL",
      baseAmount: "45000.00",
      termMonths: 24,
      params: { percent: "5" },
    });
    expect(fullTerm.totalAmount).toBe("54000.00");

    const capped12 = calculateCommissionTotal({
      formula: "PERCENT_TOTAL",
      baseAmount: "45000.00",
      termMonths: 24,
      params: { percent: "5", capMonths: 12 },
    });
    expect(capped12.totalAmount).toBe("27000.00");
  });

  it("N_MONTHS: รองรับจำนวนเดือนเป็นทศนิยม เช่น 0.5 เดือน และ 1.5 เดือน", () => {
    expect(
      calculateCommissionTotal({
        formula: "N_MONTHS",
        baseAmount: "12000.00",
        termMonths: 6,
        params: { months: "0.5" },
      }).totalAmount,
    ).toBe("6000.00");

    expect(
      calculateCommissionTotal({
        formula: "N_MONTHS",
        baseAmount: "35000.00",
        termMonths: 24,
        params: { months: "1.5" },
      }).totalAmount,
    ).toBe("52500.00");
  });

  it("FIXED และ CUSTOM: คืนยอดคงที่ และ CUSTOM บังคับต้องระบุหมายเหตุ", () => {
    expect(
      calculateCommissionTotal({
        formula: "FIXED",
        baseAmount: "28000.00",
        params: { amount: "25000.00" },
      }).totalAmount,
    ).toBe("25000.00");

    expect(() =>
      calculateCommissionTotal({
        formula: "CUSTOM",
        baseAmount: "28000.00",
        params: { amount: "20000.00", note: "   " },
      }),
    ).toThrow(/หมายเหตุ/);

    expect(
      calculateCommissionTotal({
        formula: "CUSTOM",
        baseAmount: "28000.00",
        params: { amount: "20000.50", note: "ลดค่านายหน้าให้ลูกค้าประจำ" },
      }).totalAmount,
    ).toBe("20000.50");
  });

  it("PERCENT_SALE_PRICE: คำนวณ % จากราคาขายและปัดลงเป็นสตางค์", () => {
    const res = calculateCommissionTotal({
      formula: "PERCENT_SALE_PRICE",
      baseAmount: "4999999.00",
      params: { percent: "3" },
    });
    expect(res.totalAmount).toBe("149999.97");
  });
});

describe("P14 · การแบ่งค่านายหน้าตามบทบาท, การตรวจความถูกต้อง และการปัดเศษเข้า COMPANY", () => {
  it("เคสจาก SRS: ยอด 30,000 แบ่ง 30/20/30/20 → 9,000 / 6,000 / 9,000 / 6,000 พอดี", () => {
    const rows = calculateCommissionSplits("30000.00", [
      { role: "FINDER", userId: "agent-a", shareType: "PERCENT", sharePercent: "30" },
      { role: "LISTING", userId: "agent-b", shareType: "PERCENT", sharePercent: "20" },
      { role: "CLOSER", userId: "agent-c", shareType: "PERCENT", sharePercent: "30" },
      { role: "COMPANY", userId: null, shareType: "PERCENT", sharePercent: "20" },
    ]);
    expect(rows.map((r) => r.amount)).toEqual(["9000.00", "6000.00", "9000.00", "6000.00"]);
  });

  it("คนเดียวถือหลายบทบาทได้ และปัดลงทุกแถวของ Agent เศษสตางค์เข้า COMPANY เสมอ", () => {
    const rows = calculateCommissionSplits("25000.33", [
      { role: "FINDER", userId: "agent-a", shareType: "PERCENT", sharePercent: "33.33" },
      { role: "LISTING", userId: "agent-a", shareType: "PERCENT", sharePercent: "33.33" },
      { role: "CLOSER", userId: "agent-b", shareType: "PERCENT", sharePercent: "13.34" },
      { role: "COMPANY", userId: null, shareType: "PERCENT", sharePercent: "20" },
    ]);
    expect(rows.map((r) => r.amount)).toEqual(["8332.60", "8332.60", "3335.04", "5000.09"]);
    const sumSatang = rows.reduce((acc, r) => acc + r.amountSatang, 0n);
    expect(sumSatang).toBe(2500033n);
  });

  it("Validate: แบ่งรวม 110% → ไม่ผ่านและแจ้งว่าเกิน 10.00%; แบ่งจำนวนเงินเกินยอดรวม → ไม่ผ่าน", () => {
    const overPct = validateSplits("30000.00", [
      { role: "FINDER", userId: "a", shareType: "PERCENT", sharePercent: "40" },
      { role: "LISTING", userId: "b", shareType: "PERCENT", sharePercent: "20" },
      { role: "CLOSER", userId: "c", shareType: "PERCENT", sharePercent: "30" },
      { role: "COMPANY", userId: null, shareType: "PERCENT", sharePercent: "20" },
    ]);
    expect(overPct.valid).toBe(false);
    expect(overPct.errors[0]?.code).toBe("PERCENT_TOTAL_NOT_100");
    expect(overPct.errors[0]?.diff).toBe("+10.00");

    const overAmt = validateSplits("10000.00", [
      { role: "FINDER", userId: "a", shareType: "AMOUNT", amount: "6000.00" },
      { role: "CLOSER", userId: "b", shareType: "AMOUNT", amount: "5000.00" },
    ]);
    expect(overAmt.valid).toBe(false);
    expect(overAmt.errors[0]?.code).toBe("AMOUNT_EXCEEDS_TOTAL");
    expect(overAmt.errors[0]?.diff).toBe("+1000.00");

    const underPct = validateSplits("30000.00", [
      { role: "FINDER", userId: "a", shareType: "PERCENT", sharePercent: "50" },
      { role: "COMPANY", userId: null, shareType: "PERCENT", sharePercent: "40" },
    ]);
    expect(underPct.valid).toBe(false);
    expect(underPct.errors[0]?.diff).toBe("-10.00");

    const empty = validateSplits("30000.00", []);
    expect(empty.valid).toBe(false);

    const mixed = validateSplits("30000.00", [
      { role: "FINDER", userId: "a", shareType: "PERCENT", sharePercent: "50" },
      { role: "COMPANY", userId: null, shareType: "AMOUNT", amount: "15000" },
    ]);
    expect(mixed.valid).toBe(false);
    expect(mixed.errors[0]?.code).toBe("MIXED_SHARE_TYPES");

    const missingCompany = validateSplits("30000.00", [
      { role: "FINDER", userId: "a", shareType: "PERCENT", sharePercent: "100" },
    ]);
    expect(missingCompany.valid).toBe(false);
    expect(missingCompany.errors[0]?.code).toBe("MISSING_COMPANY_ROW");

    expect(() =>
      calculateCommissionSplits("30000.00", [
        { role: "FINDER", userId: "a", shareType: "PERCENT", sharePercent: "100" },
      ]),
    ).toThrow();
  });

  it("ภาษีหัก ณ ที่จ่าย (D06): หัก 3% เฉพาะ Agent ฟรีแลนซ์ ปัดลงเป็นสตางค์ พนักงานและบริษัทไม่หัก", () => {
    const result = calculateCommission({
      formula: "ONE_MONTH",
      baseAmount: "18000.00",
      termMonths: 12,
      splits: [
        { role: "FINDER", userId: "a", shareType: "PERCENT", sharePercent: "25", isFreelance: true },
        { role: "LISTING", userId: "b", shareType: "PERCENT", sharePercent: "25", isFreelance: false },
        { role: "SHOWING", userId: "c", shareType: "PERCENT", sharePercent: "10", isFreelance: true },
        { role: "CLOSER", userId: "d", shareType: "PERCENT", sharePercent: "20", isFreelance: false },
        { role: "COMPANY", userId: null, shareType: "PERCENT", sharePercent: "20" },
      ],
    });
    expect(result.splits[0]).toMatchObject({ amount: "4500.00", withholdingTax: "135.00", netAmount: "4365.00" });
    expect(result.splits[1]).toMatchObject({ amount: "4500.00", withholdingTax: "0.00", netAmount: "4500.00" });
    expect(result.splits[2]).toMatchObject({ amount: "1800.00", withholdingTax: "54.00", netAmount: "1746.00" });
  });

  it("Property-based test (fast-check): ทุกอินพุตที่ถูกต้อง ผลรวมส่วนแบ่งทุกแถว = ยอดรวมพอดีทุกสตางค์", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 500_000_000n }),
        fc.integer({ min: 1, max: 4000 }),
        fc.integer({ min: 1, max: 3000 }),
        fc.integer({ min: 1, max: 2000 }),
        (totalSatang, p1Bps, p2Bps, p3Bps) => {
          const companyBps = 10000 - (p1Bps + p2Bps + p3Bps);
          const toPctStr = (bps: number) => `${Math.floor(bps / 100)}.${String(bps % 100).padStart(2, "0")}`;
          const splits: SplitInputItem[] = [
            { role: "FINDER", userId: "u1", shareType: "PERCENT", sharePercent: toPctStr(p1Bps) },
            { role: "LISTING", userId: "u2", shareType: "PERCENT", sharePercent: toPctStr(p2Bps) },
            { role: "CLOSER", userId: "u3", shareType: "PERCENT", sharePercent: toPctStr(p3Bps) },
            { role: "COMPANY", userId: null, shareType: "PERCENT", sharePercent: toPctStr(companyBps) },
          ];
          const computed = calculateCommissionSplits(totalSatang, splits);
          const sum = computed.reduce((acc, r) => acc + r.amountSatang, 0n);
          expect(sum).toBe(totalSatang);
        },
      ),
      { numRuns: 200 },
    );
  });
});
