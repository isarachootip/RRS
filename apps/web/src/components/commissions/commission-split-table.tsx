"use client";

import type { CommissionFormula, ComputedSplitRow, DealRole, ShareType } from "@rrs/commission";
import { FORMULA_LABELS, ROLE_LABELS, type AgentBasic, type CommissionRevisionItem } from "./commissions.types";

export interface SplitDraftRow {
  role: DealRole;
  userId: string | null;
  shareType: ShareType;
  sharePercent: string;
  amount: string;
}

export function CommissionFormulaFields({
  formula,
  setFormula,
  baseAmount,
  setBaseAmount,
  termMonths,
  setTermMonths,
  paramValue,
  setParamValue,
  customNote,
  setCustomNote,
}: {
  formula: CommissionFormula;
  setFormula: (f: CommissionFormula) => void;
  baseAmount: string;
  setBaseAmount: (v: string) => void;
  termMonths: string;
  setTermMonths: (v: string) => void;
  paramValue: string;
  setParamValue: (v: string) => void;
  customNote: string;
  setCustomNote: (v: string) => void;
}) {
  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="text-xs font-medium">
          สูตรค่านายหน้า
          <select
            aria-label="สูตรค่านายหน้า"
            value={formula}
            onChange={(e) => setFormula(e.target.value as CommissionFormula)}
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          >
            {(Object.keys(FORMULA_LABELS) as CommissionFormula[]).map((f) => (
              <option key={f} value={f}>
                {FORMULA_LABELS[f]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          ฐานคำนวณ (บาท)
          <input
            aria-label="ฐานคำนวณ"
            value={baseAmount}
            onChange={(e) => setBaseAmount(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-medium">
          ระยะสัญญา (เดือน)
          <input
            aria-label="ระยะสัญญา"
            value={termMonths}
            onChange={(e) => setTermMonths(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
        {formula !== "ONE_MONTH" && (
          <label className="text-xs font-medium">
            ค่าพารามิเตอร์สูตร (% / เดือน / บาท)
            <input
              aria-label="ค่าพารามิเตอร์สูตร"
              value={paramValue}
              onChange={(e) => setParamValue(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
        )}
      </div>
      {formula === "CUSTOM" && (
        <label className="mb-3 block text-xs font-medium">
          หมายเหตุสูตรกำหนดเอง
          <input
            aria-label="หมายเหตุสูตรกำหนดเอง"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
      )}
    </>
  );
}

export function CommissionSplitTable({
  rows,
  setRows,
  availableAgents,
  preview,
  revisions,
}: {
  rows: SplitDraftRow[];
  setRows: React.Dispatch<React.SetStateAction<SplitDraftRow[]>>;
  availableAgents: AgentBasic[];
  preview: ComputedSplitRow[] | null;
  revisions: CommissionRevisionItem[];
}) {
  return (
    <>
      <table className="mb-4 w-full border-collapse text-xs">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="border p-2">บทบาท</th>
            <th className="border p-2">ผู้รับส่วนแบ่ง</th>
            <th className="border p-2">สัดส่วน (%)</th>
            <th className="border p-2 text-right">ก่อนหักภาษี</th>
            <th className="border p-2 text-right">หัก ณ ที่จ่าย</th>
            <th className="border p-2 text-right">รับสุทธิ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const p = preview?.[idx];
            return (
              <tr key={`${r.role}-${idx}`}>
                <td className="border p-2 font-medium">{ROLE_LABELS[r.role]}</td>
                <td className="border p-2">
                  {r.role === "COMPANY" ? (
                    <span className="text-gray-500">บริษัท (รับเศษสตางค์)</span>
                  ) : (
                    <select
                      aria-label={`ผู้รับ-${r.role}`}
                      value={r.userId ?? ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, userId: e.target.value || null } : item)),
                        )
                      }
                      className="w-full rounded border px-1.5 py-1"
                    >
                      <option value="">-- เลือก Agent --</option>
                      {availableAgents.map((ag) => (
                        <option key={ag.id} value={ag.id}>
                          {ag.fullName} {ag.isFreelance ? "(ฟรีแลนซ์ 3%)" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="border p-2">
                  <input
                    aria-label={`เปอร์เซ็นต์-${r.role}`}
                    value={r.sharePercent}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, sharePercent: e.target.value } : item)),
                      )
                    }
                    className="w-24 rounded border px-2 py-1 text-right"
                  />
                </td>
                <td className="border p-2 text-right">{p?.amount ?? "-"}</td>
                <td className="border p-2 text-right text-amber-700">{p?.withholdingTax ?? "-"}</td>
                <td className="border p-2 text-right font-semibold">{p?.netAmount ?? "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {revisions.length > 0 && (
        <div className="mb-4 rounded border bg-gray-50 p-3 text-xs">
          <div className="mb-1 font-semibold text-gray-700">ประวัติฉบับที่บันทึกไว้ (แก้ไขย้อนหลังไม่ได้):</div>
          {revisions.map((rev) => (
            <div key={rev.id} className="border-t py-1 text-gray-600">
              ฉบับที่ {rev.revision} · ยอดรวม {rev.snapshot.totalAmount} บาท ·{" "}
              {rev.approvedAt ? "อนุมัติแล้ว" : "รออนุมัติ"} {rev.reason ? `· เหตุผล: ${rev.reason}` : ""}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
