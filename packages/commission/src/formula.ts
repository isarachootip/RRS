import { fromSatang, toSatang } from "@rrs/shared";
import type { FormulaInput, FormulaResult } from "./commission.types";

/**
 * แปลงตัวเลขทศนิยม (เช่น "8.33" หรือ "1.5") เป็นจำนวนเต็มคูณ 10,000 (4 ตำแหน่งทศนิยม) โดยไม่ใช้ float
 */
export function toScaled4(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  const raw = String(value).trim().replace(/,/g, "");
  if (!raw || raw === "0") return 0n;

  const isNegative = raw.startsWith("-");
  const clean = isNegative ? raw.slice(1) : raw;
  const [wholePart = "0", fracPart = ""] = clean.split(".");
  if (!/^\d+$/.test(wholePart) || (fracPart && !/^\d+$/.test(fracPart))) {
    throw new Error(`รูปแบบตัวเลขไม่ถูกต้อง: ${raw}`);
  }
  const paddedFrac = (fracPart + "0000").slice(0, 4);
  const scaled = BigInt(wholePart) * 10000n + BigInt(paddedFrac);
  return isNegative ? -scaled : scaled;
}

/**
 * แปลงเปอร์เซ็นต์เป็น basis points (100.00% = 10000n) โดยไม่ใช้ float
 */
export function toBasisPoints(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  const raw = String(value).trim().replace(/,/g, "");
  if (!raw || raw === "0") return 0n;

  const isNegative = raw.startsWith("-");
  const clean = isNegative ? raw.slice(1) : raw;
  const [wholePart = "0", fracPart = ""] = clean.split(".");
  if (!/^\d+$/.test(wholePart) || (fracPart && !/^\d+$/.test(fracPart))) {
    throw new Error(`รูปแบบเปอร์เซ็นต์ไม่ถูกต้อง: ${raw}`);
  }
  const paddedFrac = (fracPart + "00").slice(0, 2);
  const bps = BigInt(wholePart) * 100n + BigInt(paddedFrac);
  return isNegative ? -bps : bps;
}

export function formatBasisPointsDiff(diffBps: bigint): string {
  const sign = diffBps >= 0n ? "+" : "-";
  const abs = diffBps < 0n ? -diffBps : diffBps;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${sign}${whole.toString()}.${frac}`;
}

export function calculateCommissionTotal(input: FormulaInput): FormulaResult {
  const baseSatang = toSatang(input.baseAmount);
  const params = input.params ?? {};
  let totalSatang = 0n;

  switch (input.formula) {
    case "ONE_MONTH": {
      totalSatang = baseSatang;
      break;
    }
    case "PERCENT_TOTAL": {
      const rawMonths = input.termMonths ?? 12;
      const effectiveMonths =
        params.capMonths && params.capMonths > 0 ? Math.min(rawMonths, params.capMonths) : rawMonths;
      const pctScaled4 = toScaled4(params.percent);
      totalSatang = (baseSatang * BigInt(effectiveMonths) * pctScaled4) / 1_000_000n;
      break;
    }
    case "N_MONTHS": {
      const monthsScaled4 = toScaled4(params.months);
      totalSatang = (baseSatang * monthsScaled4) / 10_000n;
      break;
    }
    case "FIXED": {
      totalSatang = toSatang(params.amount !== undefined && params.amount !== null ? String(params.amount) : "0");
      break;
    }
    case "CUSTOM": {
      const note = params.note?.trim() ?? "";
      if (!note) {
        throw new Error("สูตร CUSTOM ต้องระบุหมายเหตุ (note) เสมอ");
      }
      totalSatang = toSatang(params.amount !== undefined && params.amount !== null ? String(params.amount) : "0");
      break;
    }
    case "PERCENT_SALE_PRICE": {
      const pctScaled4 = toScaled4(params.percent);
      totalSatang = (baseSatang * pctScaled4) / 1_000_000n;
      break;
    }
  }

  return {
    totalAmount: fromSatang(totalSatang),
    totalSatang,
  };
}
