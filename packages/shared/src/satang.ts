/**
 * คำนวณเงินเป็นหน่วยสตางค์ (จำนวนเต็ม BigInt) ห้ามใช้ number/float กับเงินทุกที่ (Phase 4 Rule)
 */
export const DECIMAL_AMOUNT_REGEX = /^-?\d+(\.\d{1,2})?$/;

export function toSatang(value: string | bigint | { toString(): string } | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  const raw = value.toString().trim().replace(/,/g, "");
  if (!raw || raw === "0") return 0n;

  const isNegative = raw.startsWith("-");
  const clean = isNegative ? raw.slice(1) : raw;
  const [wholePart = "0", fracPart = ""] = clean.split(".");
  if (!/^\d+$/.test(wholePart) || (fracPart && !/^\d+$/.test(fracPart))) {
    throw new Error(`Invalid monetary value: ${raw}`);
  }
  const paddedFrac = (fracPart + "00").slice(0, 2);
  const satang = BigInt(wholePart) * 100n + BigInt(paddedFrac);
  return isNegative ? -satang : satang;
}

export function fromSatang(satang: bigint): string {
  const isNegative = satang < 0n;
  const abs = isNegative ? -satang : satang;
  const baht = abs / 100n;
  const rem = abs % 100n;
  const frac = rem.toString().padStart(2, "0");
  return `${isNegative ? "-" : ""}${baht.toString()}.${frac}`;
}

export function formatBahtFromSatang(satang: bigint): string {
  const str = fromSatang(satang);
  const isNegative = str.startsWith("-");
  const clean = isNegative ? str.slice(1) : str;
  const [baht = "0", frac = "00"] = clean.split(".");
  const withCommas = baht.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${isNegative ? "-" : ""}${withCommas}.${frac}`;
}

export function formatDecimalBaht(value: string | bigint | { toString(): string } | null | undefined): string {
  return formatBahtFromSatang(toSatang(value));
}
