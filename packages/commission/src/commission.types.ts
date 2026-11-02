export type CommissionFormula = "ONE_MONTH" | "PERCENT_TOTAL" | "N_MONTHS" | "FIXED" | "CUSTOM" | "PERCENT_SALE_PRICE";

export type DealRole = "FINDER" | "LISTING" | "SHOWING" | "CLOSER" | "COMPANY";

export type ShareType = "PERCENT" | "AMOUNT";

export interface FormulaParams {
  percent?: string | number | null;
  capMonths?: number | null;
  months?: string | number | null;
  amount?: string | number | null;
  note?: string | null;
}

export interface FormulaInput {
  formula: CommissionFormula;
  baseAmount: string | bigint;
  termMonths?: number | null;
  params?: FormulaParams | null;
}

export interface FormulaResult {
  totalAmount: string;
  totalSatang: bigint;
}

export interface SplitInputItem {
  role: DealRole;
  userId?: string | null;
  shareType: ShareType;
  sharePercent?: string | number | null;
  amount?: string | number | null;
  isFreelance?: boolean;
  withholdingRatePercent?: string | number | null;
}

export type SplitValidationErrorCode =
  | "PERCENT_TOTAL_NOT_100"
  | "AMOUNT_EXCEEDS_TOTAL"
  | "MIXED_SHARE_TYPES"
  | "MISSING_COMPANY_ROW"
  | "NEGATIVE_SHARE";

export interface SplitValidationError {
  code: SplitValidationErrorCode;
  message: string;
  diff?: string;
}

export interface SplitValidationResult {
  valid: boolean;
  errors: SplitValidationError[];
}

export interface ComputedSplitRow {
  role: DealRole;
  userId: string | null;
  shareType: ShareType;
  sharePercent: string | null;
  amount: string;
  amountSatang: bigint;
  withholdingTax: string;
  withholdingTaxSatang: bigint;
  netAmount: string;
  netAmountSatang: bigint;
}

export interface CalculateCommissionInput extends FormulaInput {
  splits: SplitInputItem[];
}

export interface CalculateCommissionResult extends FormulaResult {
  splits: ComputedSplitRow[];
}
