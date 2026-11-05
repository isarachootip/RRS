"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ALL_CHANNELS,
  CHANNEL_LABELS,
  RECIPIENT_TOKEN_LABELS,
  type NotificationChannelType,
  type NotificationRuleItem,
} from "@/components/notifications/notifications.types";
import { api } from "@/lib/api";

export function NotificationRulesTab() {
  const [rules, setRules] = useState<NotificationRuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState("");

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ items: NotificationRuleItem[] }>("/api/v1/notifications/rules");
      setRules(res.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const handleToggleEnabled = async (rule: NotificationRuleItem) => {
    await api(`/api/v1/notifications/rules/${rule.event}`, {
      method: "PATCH",
      body: JSON.stringify({ isEnabled: !rule.isEnabled }),
    });
    setStatusMsg(`อัปเดตสถานะกฎ ${rule.event} เรียบร้อย`);
    await loadRules();
  };

  const handleToggleChannel = async (rule: NotificationRuleItem, ch: NotificationChannelType) => {
    const next = rule.channels.includes(ch) ? rule.channels.filter((c) => c !== ch) : [...rule.channels, ch];
    if (next.length === 0) return;
    await api(`/api/v1/notifications/rules/${rule.event}`, {
      method: "PATCH",
      body: JSON.stringify({ channels: next }),
    });
    setStatusMsg(`อัปเดตช่องทางของ ${rule.event} เรียบร้อย`);
    await loadRules();
  };

  const handleRunScheduledNow = async () => {
    const res = await api<{ totalSent: number }>("/api/v1/notifications/jobs/run", {
      method: "POST",
      body: JSON.stringify({}),
    });
    setStatusMsg(`รันงานตรวจสอบแจ้งเตือนตามเวลาสำเร็จ (ส่งใหม่ ${res.totalSent} รายการ)`);
  };

  if (loading) {
    return <div className="py-8 text-center text-xs text-gray-500">กำลังโหลดกฎการแจ้งเตือน...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-600">
          กำหนดเปิด/ปิดกฎการแจ้งเตือน ผู้รับ และช่องทางเริ่มต้นของระบบ (แก้ไขลงตาราง notification_rules ทันที)
        </p>
        <button
          type="button"
          onClick={() => void handleRunScheduledNow()}
          className="rounded bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
        >
          รันตรวจสอบแจ้งเตือนตามเวลาทันที
        </button>
      </div>

      {statusMsg && (
        <div className="rounded border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800">{statusMsg}</div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="border-b p-3">เหตุการณ์</th>
              <th className="border-b p-3">ผู้รับเริ่มต้น</th>
              <th className="border-b p-3 text-center">เปิดใช้งาน</th>
              {ALL_CHANNELS.map((ch) => (
                <th key={ch} className="border-b p-3 text-center">
                  {CHANNEL_LABELS[ch]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.event} className="border-b hover:bg-gray-50">
                <td className="p-3">
                  <div className="font-medium text-gray-900">{r.description}</div>
                  <div className="text-[11px] text-gray-400">{r.event}</div>
                </td>
                <td className="p-3 text-gray-600">
                  {r.recipients.map((tok) => RECIPIENT_TOKEN_LABELS[tok] ?? tok).join(", ")}
                </td>
                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    aria-label={`enable-${r.event}`}
                    checked={r.isEnabled}
                    onChange={() => void handleToggleEnabled(r)}
                  />
                </td>
                {ALL_CHANNELS.map((ch) => (
                  <td key={ch} className="p-3 text-center">
                    <input
                      type="checkbox"
                      aria-label={`rule-${r.event}-${ch}`}
                      checked={r.channels.includes(ch)}
                      onChange={() => void handleToggleChannel(r, ch)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
