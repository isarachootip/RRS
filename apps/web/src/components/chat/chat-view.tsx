"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { ChatThreadPanel } from "./chat-thread-panel";
import type { ChatRoomItem, ChatRoomType, ChatRoomsResponse, OwnerListItem } from "./chat.types";

export function ChatView() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<ChatRoomType>("CUSTOMER");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [newCustomerTitle, setNewCustomerTitle] = useState("");
  const [newAssetCode, setNewAssetCode] = useState("");

  const roomsQuery = useQuery({
    queryKey: ["chat-rooms", activeTab],
    queryFn: () => api<ChatRoomsResponse>(`/api/v1/chat/rooms?type=${activeTab}`),
    refetchInterval: 5000,
  });

  const ownersQuery = useQuery({
    queryKey: ["chat-owners-list"],
    queryFn: () => api<{ items: OwnerListItem[] }>("/api/v1/owners?pageSize=200"),
    enabled: activeTab === "OWNER",
    staleTime: 60_000,
  });

  const rooms = useMemo(() => roomsQuery.data?.items ?? [], [roomsQuery.data?.items]);
  const summary = roomsQuery.data?.unreadSummary ?? { customerUnread: 0, ownerUnread: 0, totalUnread: 0 };

  useEffect(() => {
    if (rooms.length > 0 && (!selectedRoomId || !rooms.some((r) => r.id === selectedRoomId))) {
      setSelectedRoomId(rooms[0]!.id);
    } else if (rooms.length === 0) {
      setSelectedRoomId(null);
    }
  }, [rooms, selectedRoomId]);

  const startOwnerChat = useMutation({
    mutationFn: () =>
      api<ChatRoomItem>("/api/v1/chat/rooms/owner", {
        method: "POST",
        body: JSON.stringify({
          ownerId: selectedOwnerId || ownersQuery.data?.items[0]?.id,
          assetCode: newAssetCode.trim() || undefined,
        }),
      }),
    onSuccess: (room) => {
      setNewAssetCode("");
      void qc.invalidateQueries({ queryKey: ["chat-rooms"] });
      setSelectedRoomId(room.id);
    },
  });

  const startCustomerChat = useMutation({
    mutationFn: () =>
      api<ChatRoomItem>("/api/v1/chat/rooms/customer", {
        method: "POST",
        body: JSON.stringify({
          title: newCustomerTitle.trim(),
          assetCode: newAssetCode.trim() || undefined,
        }),
      }),
    onSuccess: (room) => {
      setNewCustomerTitle("");
      setNewAssetCode("");
      void qc.invalidateQueries({ queryKey: ["chat-rooms"] });
      setSelectedRoomId(room.id);
    },
  });

  const owners = ownersQuery.data?.items ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink">ห้องแชท (Customer & Owner Chat)</h1>
        <p className="mt-1 text-sm text-ink-muted">
          ตอบแชทลูกค้าที่ทักจาก LINE OA / หน้าเว็บ และห้องแชทภายในสำหรับประสานงานกับเจ้าของทรัพย์สิน
        </p>
      </div>

      <div role="tablist" aria-label="ประเภทห้องแชท" className="flex flex-wrap gap-2 border-b border-line">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "CUSTOMER"}
          onClick={() => setActiveTab("CUSTOMER")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "CUSTOMER"
              ? "border-lagoon text-lagoon-deep"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          <span>1. ลูกค้าทักเข้ามา (LINE OA & หน้าเว็บ)</span>
          {summary.customerUnread > 0 && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
              {summary.customerUnread}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "OWNER"}
          onClick={() => setActiveTab("OWNER")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "OWNER"
              ? "border-lagoon text-lagoon-deep"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          <span>2. คุยกับเจ้าของทรัพย์สิน (Owner Chat)</span>
          {summary.ownerUnread > 0 && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
              {summary.ownerUnread}
            </span>
          )}
        </button>
      </div>

      <div className="rounded-lg border border-line bg-surface p-3">
        {activeTab === "OWNER" ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select
              aria-label="เลือกเจ้าของทรัพย์สินเพื่อเปิดห้องแชท"
              value={selectedOwnerId || owners[0]?.id || ""}
              onChange={(e) => setSelectedOwnerId(e.target.value)}
              className="h-9 min-w-64 rounded border border-line px-2.5 text-sm"
            >
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.code} · {o.fullName} {o.phone ? `(${o.phone})` : ""}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="รหัสทรัพย์ที่ต้องการคุย (เช่น PR-000031)"
              value={newAssetCode}
              onChange={(e) => setNewAssetCode(e.target.value)}
              className="h-9 w-56 rounded border border-line px-3 text-sm"
            />
            <button
              type="button"
              disabled={startOwnerChat.isPending || owners.length === 0}
              onClick={() => startOwnerChat.mutate()}
              className="h-9 rounded bg-lagoon px-4 text-xs font-medium text-white hover:bg-lagoon-deep disabled:opacity-50"
            >
              + เปิดห้องแชทกับเจ้าของทรัพย์
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input
              type="text"
              placeholder="ชื่อลูกค้า / เบอร์ติดต่อ"
              value={newCustomerTitle}
              onChange={(e) => setNewCustomerTitle(e.target.value)}
              className="h-9 w-64 rounded border border-line px-3 text-sm"
            />
            <input
              type="text"
              placeholder="รหัสทรัพย์ที่สนใจ (เช่น PR-000031)"
              value={newAssetCode}
              onChange={(e) => setNewAssetCode(e.target.value)}
              className="h-9 w-52 rounded border border-line px-3 text-sm"
            />
            <button
              type="button"
              disabled={!newCustomerTitle.trim() || startCustomerChat.isPending}
              onClick={() => startCustomerChat.mutate()}
              className="h-9 rounded bg-lagoon px-4 text-xs font-medium text-white hover:bg-lagoon-deep disabled:opacity-50"
            >
              + เปิดห้องแชทลูกค้าใหม่
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="h-[560px] space-y-1.5 overflow-y-auto rounded-xl border border-line bg-surface p-2">
          {rooms.length === 0 ? (
            <div className="flex h-full items-center justify-center p-4 text-center text-xs text-ink-muted">
              ยังไม่มีรายการสนทนาในหมวดนี้
            </div>
          ) : (
            rooms.map((r) => {
              const active = r.id === selectedRoomId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRoomId(r.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    active ? "border-lagoon bg-paper" : "border-transparent hover:bg-paper/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{r.title}</span>
                    {r.unreadCount > 0 && (
                      <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {r.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-muted">
                    {r.assetCode && <span className="font-mono font-medium text-lagoon-deep">{r.assetCode}</span>}
                    {r.subtitle && <span className="truncate">{r.subtitle}</span>}
                  </div>
                  <p className="mt-1 truncate text-xs text-ink-muted">{r.lastMessagePreview ?? "-"}</p>
                </button>
              );
            })
          )}
        </div>

        <div>
          {selectedRoomId ? (
            <ChatThreadPanel roomId={selectedRoomId} />
          ) : (
            <div className="flex h-[560px] items-center justify-center rounded-xl border border-line bg-surface text-sm text-ink-muted">
              เลือกห้องแชททางซ้ายเพื่อดูข้อความและตอบกลับ
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
