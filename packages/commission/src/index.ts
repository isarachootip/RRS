import type { CalculateCommissionInput, CalculateCommissionResult } from "./commission.types";
import { calculateCommissionTotal } from "./formula";
import { calculateCommissionSplits } from "./splits";

export * from "./commission.types";
export * from "./formula";
export * from "./splits";

export function calculateCommission(input: CalculateCommissionInput): CalculateCommissionResult {
  const { totalAmount, totalSatang } = calculateCommissionTotal(input);
  const splits = calculateCommissionSplits(totalSatang, input.splits);
  return {
    totalAmount,
    totalSatang,
    splits,
  };
}
