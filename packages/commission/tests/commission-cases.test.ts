import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateCommission, type CommissionFormula, type ShareType, type SplitInputItem } from "../src";

interface CsvCaseRow {
  caseId: string;
  formula: CommissionFormula;
  baseAmount: string;
  termMonths: number;
  paramValue: string;
  shareType: ShareType;
  finderShare: string;
  finderFreelance: boolean;
  listingShare: string;
  listingFreelance: boolean;
  showingShare: string;
  showingFreelance: boolean;
  closerShare: string;
  closerFreelance: boolean;
  companyShare: string;
  expectedTotal: string;
  expectedFinderNet: string;
  expectedListingNet: string;
  expectedShowingNet: string;
  expectedCloserNet: string;
  expectedCompanyAmt: string;
}

function loadCasesCsv(): CsvCaseRow[] {
  const csvPath = resolve(__dirname, "../../../docs/commission-cases.csv");
  const lines = readFileSync(csvPath, "utf-8")
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  return lines.slice(1).map((line) => {
    const [
      caseId,
      formula,
      baseAmount,
      termMonths,
      paramValue,
      shareType,
      finderShare,
      finderFreelance,
      listingShare,
      listingFreelance,
      showingShare,
      showingFreelance,
      closerShare,
      closerFreelance,
      companyShare,
      expectedTotal,
      expectedFinderNet,
      expectedListingNet,
      expectedShowingNet,
      expectedCloserNet,
      expectedCompanyAmt,
    ] = line.split(",");
    return {
      caseId: caseId!,
      formula: formula as CommissionFormula,
      baseAmount: baseAmount!,
      termMonths: Number(termMonths),
      paramValue: paramValue!,
      shareType: shareType as ShareType,
      finderShare: finderShare!,
      finderFreelance: finderFreelance === "true",
      listingShare: listingShare!,
      listingFreelance: listingFreelance === "true",
      showingShare: showingShare!,
      showingFreelance: showingFreelance === "true",
      closerShare: closerShare!,
      closerFreelance: closerFreelance === "true",
      companyShare: companyShare!,
      expectedTotal: expectedTotal!,
      expectedFinderNet: expectedFinderNet!,
      expectedListingNet: expectedListingNet!,
      expectedShowingNet: expectedShowingNet!,
      expectedCloserNet: expectedCloserNet!,
      expectedCompanyAmt: expectedCompanyAmt!,
    };
  });
}

describe("P14 · ชุดทดสอบ 20 ดีลจริงจาก docs/commission-cases.csv", () => {
  const cases = loadCasesCsv();

  it("มีครบ 20 ดีลในไฟล์ CSV", () => {
    expect(cases).toHaveLength(20);
  });

  it.each(cases)("$caseId ($formula, base=$baseAmount, mode=$shareType) → total=$expectedTotal ตรงทุกแถว", (row) => {
    const mkItem = (role: SplitInputItem["role"], shareVal: string, isFreelance: boolean): SplitInputItem =>
      row.shareType === "PERCENT"
        ? {
            role,
            userId: role === "COMPANY" ? null : `user-${role.toLowerCase()}`,
            shareType: "PERCENT",
            sharePercent: shareVal,
            isFreelance,
          }
        : {
            role,
            userId: role === "COMPANY" ? null : `user-${role.toLowerCase()}`,
            shareType: "AMOUNT",
            amount: shareVal,
            isFreelance,
          };

    const splits: SplitInputItem[] = [
      mkItem("FINDER", row.finderShare, row.finderFreelance),
      mkItem("LISTING", row.listingShare, row.listingFreelance),
      mkItem("SHOWING", row.showingShare, row.showingFreelance),
      mkItem("CLOSER", row.closerShare, row.closerFreelance),
      mkItem("COMPANY", row.companyShare, false),
    ];

    const params =
      row.formula === "PERCENT_TOTAL" || row.formula === "PERCENT_SALE_PRICE"
        ? { percent: row.paramValue }
        : row.formula === "N_MONTHS"
          ? { months: row.paramValue }
          : row.formula === "FIXED"
            ? { amount: row.paramValue }
            : row.formula === "CUSTOM"
              ? { amount: row.paramValue, note: `ดีลพิเศษ ${row.caseId}` }
              : {};

    const res = calculateCommission({
      formula: row.formula,
      baseAmount: row.baseAmount,
      termMonths: row.termMonths,
      params,
      splits,
    });

    expect(res.totalAmount).toBe(row.expectedTotal);
    const byRole = Object.fromEntries(res.splits.map((s) => [s.role, s]));
    expect(byRole.FINDER?.netAmount).toBe(row.expectedFinderNet);
    expect(byRole.LISTING?.netAmount).toBe(row.expectedListingNet);
    expect(byRole.SHOWING?.netAmount).toBe(row.expectedShowingNet);
    expect(byRole.CLOSER?.netAmount).toBe(row.expectedCloserNet);
    expect(byRole.COMPANY?.amount).toBe(row.expectedCompanyAmt);

    const sumSplits = res.splits.reduce((acc, s) => acc + s.amountSatang, 0n);
    expect(sumSplits).toBe(res.totalSatang);
  });
});
