"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { ChatRoomDetailResponse } from "@/components/chat/chat.types";

export default function PublicChatRoomPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token ?? "");
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [senderName, setSenderName] = useState("");

  const roomQuery = useQuery({
    queryKey: ["public-chat-room", token],
    queryFn: async () => {
      const res = await fetch(`/api/v1/public/chat/${token}`);
      if (!res.ok) throw new Error("ไม่พบลิงก์ห้องแชทนี้");
      return (await res.json()) as ChatRoomDetailResponse;
    },
    enabled: Boolean(token),
    refetchInterval: 4000,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/public/chat/${token}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          senderName: senderName.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("ส่งข้อความไม่สำเร็จ");
      return res.json();
    },
    onSuccess: () => {
      setContent("");
      void qc.invalidateQueries({ queryKey: ["public-chat-room", token] });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    sendMutation.mutate();
  };

  if (roomQuery.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper p-4 text-sm text-ink-muted">
        กำลังเชื่อมต่อห้องแชท RRS...
      </div>
    );
  }

  const room = roomQuery.data;
  if (!room) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper p-4 text-sm text-red-600">
        ไม่พบห้องแชท หรือลิงก์ไม่ถูกต้อง
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col bg-paper p-4">
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
        <div className="border-b border-line bg-lagoon px-5 py-4 text-white">
          <p className="text-xs text-lagoon-soft/90">
            {room.type === "OWNER" ? "ห้องแชทสำหรับเจ้าของทรัพย์สิน · RRS" : "ห้องแชทติดต่อเจ้าหน้าที่ · RRS"}
          </p>
          <h1 className="mt-0.5 text-base font-semibold">
            {room.title} {room.assetCode ? `(${room.assetCode})` : ""}
          </h1>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {room.messages.map((m) => {
            if (m.senderType === "SYSTEM") {
              return (
                <div key={m.id} className="text-center">
                  <span className="inline-block rounded-full bg-paper px-3 py-1 text-xs text-ink-muted">
                    {m.content}
                  </span>
                </div>
              );
            }
            const isMe = m.senderType !== "STAFF";
            return (
              <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <span className="mb-1 text-[11px] text-ink-muted">
                  {m.senderType === "STAFF" ? `เจ้าหน้าที่ (${m.senderName})` : m.senderName} ·{" "}
                  {new Date(m.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <div
                  className={`max-w-[80%] rounded-xl px-3.5 py-2 text-sm ${
                    isMe ? "bg-lagoon text-white" : "border border-line bg-paper text-ink"
                  }`}
                >
                  {m.imageUrl && (
                    <img
                      src={m.imageUrl}
                      alt="รูปภาพแนบ"
                      className="mb-2 max-h-48 rounded-lg object-cover"
                    />
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-2 border-t border-line bg-paper p-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={`ชื่อผู้ส่ง (ค่าเริ่มต้น: ${room.title})`}
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="h-8 w-44 rounded border border-line bg-white px-2.5 text-xs"
            />
            <input
              type="text"
              required
              placeholder="พิมพ์ข้อความถึงเจ้าหน้าที่ RRS..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="h-9 flex-1 rounded border border-line bg-white px-3 text-sm"
            />
            <button
              type="submit"
              disabled={sendMutation.isPending}
              className="h-9 rounded bg-lagoon px-4 text-xs font-medium text-white hover:bg-lagoon-deep disabled:opacity-50"
            >
              ส่งข้อความ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
