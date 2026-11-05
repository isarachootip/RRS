"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { NotificationPreferencesPanel } from "./notification-preferences-panel";
import type {
  NotificationChannelType,
  NotificationItem,
  NotificationPreferencesResponse,
  NotificationsListResponse,
} from "./notifications.types";

export function NotificationsView() {
  const [tab, setTab] = useState<"LIST" | "PREFS">("LIST");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [prefsData, setPrefsData] = useState<NotificationPreferencesResponse | null>(null);
  const [lineInput, setLineInput] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const loadList = useCallback(async () => {
    const res = await api<NotificationsListResponse>(
      `/api/v1/notifications?unreadOnly=${unreadOnly ? "true" : "false"}&limit=50`,
    );
    setItems(res.items);
    setUnreadCount(res.unreadCount);
  }, [unreadOnly]);

  const loadPrefs = useCallback(async () => {
    const res = await api<NotificationPreferencesResponse>("/api/v1/notifications/preferences");
    setPrefsData(res);
    setLineInput(res.lineUserId ?? "");
  }, []);

  useEffect(() => {
    if (tab === "LIST") void loadList();
    else void loadPrefs();
  }, [tab, loadList, loadPrefs]);

  const handleMarkAllRead = async () => {
    await api("/api/v1/notifications/read-all", { method: "POST" });
    await loadList();
  };

  const handleLinkLine = async () => {
    if (!lineInput.trim()) return;
    await api("/api/v1/notifications/line/link", {
      method: "POST",
      body: JSON.stringify({ lineUserId: lineInput.trim() }),
    });
    setStatusMsg("ผูกบัญชี LINE Official Account สำเร็จ");
    await loadPrefs();
  };

  const handleUnlinkLine = async () => {
    await api("/api/v1/notifications/line/link", { method: "DELETE" });
    setStatusMsg("ยกเลิกผูกบัญชี LINE แล้ว");
    await loadPrefs();
  };

  const handleTogglePrefChannel = async (
    event: string,
    ch: NotificationChannelType,
    defaultChs: NotificationChannelType[],
  ) => {
    if (!prefsData) return;
    const current = prefsData.preferences[event] ?? defaultChs;
    const next = current.includes(ch) ? current.filter((c) => c !== ch) : [...current, ch];
    await api("/api/v1/notifications/preferences", {
      method: "PATCH",
      body: JSON.stringify({ preferences: { ...prefsData.preferences, [event]: next } }),
    });
    setStatusMsg("บันทึกการตั้งค่าช่องทางแจ้งเตือนเรียบร้อย");
    await loadPrefs();
  };

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ศูนย์การแจ้งเตือนและตั้งค่าช่องทาง</h1>
          <p className="text-xs text-gray-500">
            ตรวจสอบข้อความแจ้งเตือน ผูกบัญชี LINE Login และเลือกช่องทางต่อประเภทเหตุการณ์
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("LIST")}
            className={`rounded px-3 py-1.5 text-xs font-medium ${tab === "LIST" ? "bg-teal-700 text-white" : "bg-gray-100 text-gray-700"}`}
          >
            รายการแจ้งเตือน ({unreadCount})
          </button>
          <button
            type="button"
            onClick={() => setTab("PREFS")}
            className={`rounded px-3 py-1.5 text-xs font-medium ${tab === "PREFS" ? "bg-teal-700 text-white" : "bg-gray-100 text-gray-700"}`}
          >
            ผูก LINE & ตั้งค่าช่องทาง
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="rounded border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800">{statusMsg}</div>
      )}

      {tab === "LIST" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
              แสดงเฉพาะที่ยังไม่อ่าน
            </label>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                className="rounded border border-teal-700 px-3 py-1 text-xs font-medium text-teal-800 hover:bg-teal-50"
              >
                ทำเครื่องหมายว่าอ่านแล้วทั้งหมด
              </button>
            )}
          </div>
          <div className="space-y-2">
            {items.length === 0 ? (
              <div className="rounded-lg border bg-white p-8 text-center text-xs text-gray-500">
                ไม่พบรายการแจ้งเตือน
              </div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-lg border p-3 text-xs ${n.readAt ? "bg-white" : "border-teal-300 bg-teal-50/40"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">{n.title}</span>
                    <span className="text-[11px] text-gray-400">{new Date(n.createdAt).toLocaleString("th-TH")}</span>
                  </div>
                  {n.body && <p className="mt-1 text-gray-600">{n.body}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        prefsData && (
          <NotificationPreferencesPanel
            prefsData={prefsData}
            lineInput={lineInput}
            setLineInput={setLineInput}
            onLinkLine={() => void handleLinkLine()}
            onUnlinkLine={() => void handleUnlinkLine()}
            onTogglePrefChannel={(ev, ch, def) => void handleTogglePrefChannel(ev, ch, def)}
          />
        )
      )}
    </div>
  );
}
