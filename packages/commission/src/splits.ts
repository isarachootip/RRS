import { fromSatang, toSatang } from "@rrs/shared";
import type { ComputedSplitRow, SplitInputItem, SplitValidationError, SplitValidationResult } from "./commission.types";
import { formatBasisPointsDiff, toBasisPoints } from "./formula";

export function validateSplits(totalAmount: string | bigint, splits: SplitInputItem[]): SplitValidationResult {
  const totalSatang = toSatang(totalAmount);
  const errors: SplitValidationError[] = [];

  if (splits.length === 0) {
    errors.push({ code: "MISSING_COMPANY_ROW", message: "ต้องมีรายการแบ่งค่านายหน้าอย่างน้อย 1 รายการ" });
    return { valid: false, errors };
  }

  const shareTypes = new Set(splits.map((s) => s.shareType));
  if (shareTypes.size > 1) {
    errors.push({
      code: "MIXED_SHARE_TYPES",
      message: "ห้ามผสมรูปแบบการแบ่งแบบเปอร์เซ็นต์และแบบจำนวนเงินในดีลเดียวกัน",
    });
    return { valid: false, errors };
  }

  const mode = splits[0]!.shareType;

  if (mode === "PERCENT") {
    const hasCompany = splits.some((s) => s.role === "COMPANY");
    if (!hasCompany) {
      errors.push({
        code: "MISSING_COMPANY_ROW",
        message: "ต้องมีแถวส่วนแบ่งของบริษัท (COMPANY) เพื่อรับเศษจากการปัดลง",
      });
    }

    let sumBps = 0n;
    for (const row of splits) {
      const bps = toBasisPoints(row.sharePercent);
      if (bps < 0n) {
        errors.push({ code: "NEGATIVE_SHARE", message: "สัดส่วนเปอร์เซ็นต์ต้องไม่ติดลบ" });
      }
      sumBps += bps;
    }

    if (sumBps !== 10000n) {
      const diffBps = sumBps - 10000n;
      const diffStr = formatBasisPointsDiff(diffBps);
      errors.push({
        code: "PERCENT_TOTAL_NOT_100",
        message:
          diffBps > 0n
            ? `สัดส่วนรวมเกิน 100% อยู่ ${diffStr.slice(1)}%`
            : `สัดส่วนรวมขาดจาก 100% อยู่ ${diffStr.slice(1)}%`,
        diff: diffStr,
      });
    }
  } else {
    let nonCompanySumSatang = 0n;
    for (const row of splits) {
      const amt = toSatang(row.amount !== undefined && row.amount !== null ? String(row.amount) : "0");
      if (amt < 0n) {
        errors.push({ code: "NEGATIVE_SHARE", message: "จำนวนเงินส่วนแบ่งต้องไม่ติดลบ" });
      }
      if (row.role !== "COMPANY") {
        nonCompanySumSatang += amt;
      }
    }

    if (nonCompanySumSatang > totalSatang) {
      const diffSatang = nonCompanySumSatang - totalSatang;
      const diffBaht = fromSatang(diffSatang);
      errors.push({
        code: "AMOUNT_EXCEEDS_TOTAL",
        message: `ยอดแบ่งรวมเกินค่านายหน้ารวมอยู่ ${diffBaht} บาท`,
        diff: `+${diffBaht}`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

function computeWithholdingTaxSatang(amountSatang: bigint, item: SplitInputItem): bigint {
  if (item.role === "COMPANY" || amountSatang <= 0n) return 0n;
  const rateRaw =
    item.withholdingRatePercent !== undefined && item.withholdingRatePercent !== null
      ? item.withholdingRatePercent
      : item.isFreelance
        ? "3"
        : "0";
  const rateBps = toBasisPoints(rateRaw);
  if (rateBps <= 0n) return 0n;
  return (amountSatang * rateBps) / 10000n;
}

export function calculateCommissionSplits(totalAmount: string | bigint, splits: SplitInputItem[]): ComputedSplitRow[] {
  const totalSatang = toSatang(totalAmount);
  const normalizedSplits: SplitInputItem[] =
    splits.length > 0 && splits[0]!.shareType === "AMOUNT" && !splits.some((s) => s.role === "COMPANY")
      ? [...splits, { role: "COMPANY", userId: null, shareType: "AMOUNT", amount: "0" }]
      : splits;

  const validation = validateSplits(totalSatang, normalizedSplits);
  if (!validation.valid) {
    throw new Error(validation.errors.map((e) => e.message).join("; "));
  }

  const companyIndices = normalizedSplits.map((s, idx) => (s.role === "COMPANY" ? idx : -1)).filter((idx) => idx >= 0);
  const primaryCompanyIdx = companyIndices[companyIndices.length - 1]!;

  const rowAmountsSatang: bigint[] = new Array(normalizedSplits.length).fill(0n);
  let nonPrimarySumSatang = 0n;

  for (let i = 0; i < normalizedSplits.length; i++) {
    if (i === primaryCompanyIdx) continue;
    const item = normalizedSplits[i]!;
    const amtSatang =
      item.shareType === "PERCENT"
        ? (totalSatang * toBasisPoints(item.sharePercent)) / 10000n
        : toSatang(item.amount !== undefined && item.amount !== null ? String(item.amount) : "0");
    rowAmountsSatang[i] = amtSatang;
    nonPrimarySumSatang += amtSatang;
  }

  rowAmountsSatang[primaryCompanyIdx] = totalSatang - nonPrimarySumSatang;

  return normalizedSplits.map((item, idx) => {
    const amountSatang = rowAmountsSatang[idx]!;
    const whtSatang = computeWithholdingTaxSatang(amountSatang, item);
    const netSatang = amountSatang - whtSatang;
    const pctStr = item.shareType === "PERCENT" ? fromSatang(toBasisPoints(item.sharePercent)) : null;

    return {
      role: item.role,
      userId: item.role === "COMPANY" ? null : (item.userId ?? null),
      shareType: item.shareType,
      sharePercent: pctStr,
      amount: fromSatang(amountSatang),
      amountSatang,
      withholdingTax: fromSatang(whtSatang),
      withholdingTaxSatang: whtSatang,
      netAmount: fromSatang(netSatang),
      netAmountSatang: netSatang,
    };
  });
}
