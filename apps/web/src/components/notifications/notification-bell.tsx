"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { API_URL, api, getAccessToken } from "@/lib/api";
import type { NotificationItem, NotificationsListResponse } from "./notifications.types";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await api<NotificationsListResponse>("/api/v1/notifications?limit=10");
      setItems(res.items);
      setUnreadCount(res.unreadCount);
    } catch {
      // ignore unauthenticated or initial load errors
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;
    const token = getAccessToken();
    if (!token) return;
    let es: EventSource | null = null;
    try {
      es = new EventSource(`${API_URL}/api/v1/notifications/stream`, { withCredentials: true });
      es.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data) as NotificationItem;
          setItems((prev) => [parsed, ...prev.filter((x) => x.id !== parsed.id)].slice(0, 10));
          setUnreadCount((c) => c + 1);
        } catch {
          // ignore malformed SSE payload
        }
      };
    } catch {
      // ignore SSE connection error in test environments
    }
    return () => {
      es?.close();
    };
  }, []);

  const handleMarkRead = async (id: string) => {
    await api(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
    await loadNotifications();
  };

  const handleMarkAllRead = async () => {
    await api("/api/v1/notifications/read-all", { method: "POST" });
    await loadNotifications();
  };

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="notification-bell"
        aria-label="การแจ้งเตือน"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-1.5 text-ink-muted hover:bg-paper"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span
            data-testid="notification-unread-badge"
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="notification-dropdown"
          className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-line bg-surface p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between border-b pb-2">
            <span className="text-xs font-semibold text-ink">การแจ้งเตือน ({unreadCount} ยังไม่อ่าน)</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                className="text-xs text-teal-700 hover:underline"
              >
                อ่านทั้งหมด
              </button>
            )}
          </div>

          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {items.length === 0 ? (
              <p className="py-4 text-center text-xs text-ink-muted">ยังไม่มีการแจ้งเตือน</p>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`rounded border p-2 text-xs ${
                    n.readAt ? "border-gray-100 bg-white text-gray-600" : "border-teal-200 bg-teal-50/50 text-gray-900"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={() => {
                          if (!n.readAt) void handleMarkRead(n.id);
                          setOpen(false);
                        }}
                        className="font-medium text-teal-800 hover:underline"
                      >
                        {n.title}
                      </Link>
                    ) : (
                      <span className="font-medium">{n.title}</span>
                    )}
                    {!n.readAt && (
                      <button
                        type="button"
                        onClick={() => void handleMarkRead(n.id)}
                        className="shrink-0 text-[11px] text-teal-700 hover:underline"
                      >
                        อ่านแล้ว
                      </button>
                    )}
                  </div>
                  {n.body && <p className="mt-0.5 text-[11px] text-gray-500">{n.body}</p>}
                </div>
              ))
            )}
          </div>

          <div className="mt-2 border-t pt-2 text-center">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-teal-700 hover:underline"
            >
              ดูการแจ้งเตือนและตั้งค่าทั้งหมด
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
