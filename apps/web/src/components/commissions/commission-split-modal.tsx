"use client";

import {
  calculateCommissionSplits,
  calculateCommissionTotal,
  validateSplits,
  type CommissionFormula,
  type SplitInputItem,
} from "@rrs/commission";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { CommissionFormulaFields, CommissionSplitTable, type SplitDraftRow } from "./commission-split-table";
import { buildFormulaParams, collectCommissionAgents, type CommissionRecord } from "./commissions.types";

export function CommissionSplitModal({
  commission,
  onClose,
  onSaved,
}: {
  commission: CommissionRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const hasPriorApproval = commission.revisions.length > 0;
  const [formula, setFormula] = useState<CommissionFormula>(commission.formula);
  const [baseAmount, setBaseAmount] = useState(commission.baseAmount);
  const [termMonths, setTermMonths] = useState(String(commission.termMonths ?? 12));
  const [paramValue, setParamValue] = useState(
    String(commission.params?.percent ?? commission.params?.months ?? commission.params?.amount ?? "3"),
  );
  const [customNote, setCustomNote] = useState(String(commission.params?.note ?? ""));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const availableAgents = useMemo(() => collectCommissionAgents(commission), [commission]);

  const [rows, setRows] = useState<SplitDraftRow[]>(() =>
    (commission.currentSplits.length > 0 ? commission.currentSplits : commission.suggestedSplits).map((s) => ({
      role: s.role,
      userId: s.userId,
      shareType: s.shareType,
      sharePercent: s.sharePercent ?? "0.00",
      amount: "amount" in s && s.amount ? s.amount : "0.00",
    })),
  );

  const liveCalc = useMemo(() => {
    try {
      const params = buildFormulaParams(formula, paramValue, customNote);
      const { totalAmount: totalBaht } = calculateCommissionTotal({
        formula,
        baseAmount,
        termMonths: Number(termMonths) || 12,
        params,
      });
      const splitInputs: SplitInputItem[] = rows.map((r) => ({
        role: r.role,
        userId: r.role === "COMPANY" ? null : r.userId,
        shareType: r.shareType,
        sharePercent: r.shareType === "PERCENT" ? r.sharePercent : null,
        amount: r.shareType === "AMOUNT" ? r.amount : null,
        isFreelance: availableAgents.find((a) => a.id === r.userId)?.isFreelance ?? false,
      }));
      const val = validateSplits(totalBaht, splitInputs);
      const preview = val.valid ? calculateCommissionSplits(totalBaht, splitInputs) : null;
      return { totalBaht, valid: val.valid, errorMessages: val.errors.map((e) => e.message), preview, params };
    } catch (e) {
      return {
        totalBaht: "0.00",
        valid: false,
        errorMessages: [e instanceof Error ? e.message : "ข้อมูลไม่ถูกต้อง"],
        preview: null,
        params: {},
      };
    }
  }, [formula, baseAmount, termMonths, paramValue, customNote, rows, availableAgents]);

  const canSave = liveCalc.valid && (!hasPriorApproval || reason.trim().length > 0) && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setApiError("");
    try {
      await api(`/api/v1/commissions/${commission.id}/splits`, {
        method: "PUT",
        body: JSON.stringify({
          formula,
          baseAmount,
          termMonths: Number(termMonths) || 12,
          params: liveCalc.params,
          reason: hasPriorApproval ? reason.trim() : undefined,
          splits: rows.map((r) => ({
            role: r.role,
            userId: r.role === "COMPANY" ? null : r.userId,
            shareType: r.shareType,
            sharePercent: r.shareType === "PERCENT" ? r.sharePercent : null,
            amount: r.shareType === "AMOUNT" ? r.amount : null,
          })),
        }),
      });
      onSaved();
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <h3 className="text-lg font-semibold">
            คำนวณและแบ่งค่านายหน้า · {commission.asset.code} (ฉบับที่ {commission.currentRevision})
          </h3>
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800">
            ปิด
          </button>
        </div>
        <CommissionFormulaFields
          formula={formula}
          setFormula={setFormula}
          baseAmount={baseAmount}
          setBaseAmount={setBaseAmount}
          termMonths={termMonths}
          setTermMonths={setTermMonths}
          paramValue={paramValue}
          setParamValue={setParamValue}
          customNote={customNote}
          setCustomNote={setCustomNote}
        />
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-blue-900">
            ยอดค่านายหน้ารวม (C): <span data-testid="live-total-baht">{liveCalc.totalBaht}</span> บาท
          </div>
          <button
            type="button"
            onClick={() =>
              setRows(
                commission.suggestedSplits.map((s) => ({
                  role: s.role,
                  userId: s.userId,
                  shareType: "PERCENT",
                  sharePercent: s.sharePercent,
                  amount: "0.00",
                })),
              )
            }
            className="rounded bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
          >
            ใช้เทมเพลต 30/20/30/20
          </button>
        </div>
        <CommissionSplitTable
          rows={rows}
          setRows={setRows}
          availableAgents={availableAgents}
          preview={liveCalc.preview}
          revisions={commission.revisions}
        />
        {(!liveCalc.valid || apiError) && (
          <div role="alert" className="mb-3 rounded bg-red-50 p-3 text-xs text-red-700">
            {liveCalc.errorMessages.map((err, i) => (
              <div key={i}>{err}</div>
            ))}
            {apiError && <div>{apiError}</div>}
          </div>
        )}
        {hasPriorApproval && (
          <label className="mb-3 block text-xs font-medium text-amber-900">
            เหตุผลการแก้ไขหลังอนุมัติ (จะสร้างฉบับที่ {commission.currentRevision + 1} และต้องอนุมัติใหม่) *
            <input
              aria-label="เหตุผลการแก้ไขหลังอนุมัติ"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ระบุเหตุผลในการปรับปรุงส่วนแบ่ง..."
              className="mt-1 w-full rounded border border-amber-400 px-2 py-1.5 text-sm"
            />
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border px-4 py-1.5 text-sm">
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            บันทึกการคำนวณ
          </button>
        </div>
      </div>
    </div>
  );
}
