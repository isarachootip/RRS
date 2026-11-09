"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, type FormEvent, useState } from "react";
import { api, uploadEntityFile } from "@/lib/api";
import type { ChatRoomDetailResponse } from "./chat.types";

export function ChatThreadPanel({ roomId }: { roomId: string }) {
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [assetCode, setAssetCode] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["chat-room-detail", roomId],
    queryFn: () => api<ChatRoomDetailResponse>(`/api/v1/chat/rooms/${roomId}`),
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      api(`/api/v1/chat/rooms/${roomId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: content.trim(),
          imageUrl,
          assetCode: assetCode.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      setContent("");
      setImageUrl(null);
      void qc.invalidateQueries({ queryKey: ["chat-room-detail", roomId] });
      void qc.invalidateQueries({ queryKey: ["chat-rooms"] });
    },
  });

  const handleImagePick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadEntityFile(file, "chat", roomId);
      setImageUrl(`/api/v1/files/${uploaded.id}/content`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleCopyWebLink = (token: string) => {
    const url = `${window.location.origin}/public-chat/${token}`;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !imageUrl) return;
    sendMutation.mutate();
  };

  const room = detailQuery.data;
  if (!room) {
    return (
      <div className="flex h-[560px] items-center justify-center rounded-xl border border-line bg-surface text-sm text-ink-muted">
        กำลังโหลดประวัติการสนทนา...
      </div>
    );
  }

  return (
    <div className="flex h-[560px] flex-col rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-ink">{room.title}</h2>
            {room.assetCode && (
              <span className="rounded bg-lagoon/15 px-2 py-0.5 font-mono text-xs font-medium text-lagoon-deep">
                {room.assetCode}
              </span>
            )}
            {room.lineUserId && (
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                เชื่อม LINE OA แล้ว
              </span>
            )}
          </div>
          <p className="text-xs text-ink-muted">{room.subtitle ?? "ห้องสนทนา"}</p>
        </div>

        <button
          type="button"
          onClick={() => handleCopyWebLink(room.publicToken)}
          className="rounded border border-lagoon/40 bg-white px-3 py-1.5 text-xs font-medium text-lagoon-deep hover:bg-lagoon hover:text-white"
        >
          {copied ? "✓ คัดลอกลิงก์ห้องแชทแล้ว" : "คัดลอกลิงก์ห้องแชทส่งให้คู่สนทนา"}
        </button>
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
          const isStaff = m.senderType === "STAFF";
          return (
            <div key={m.id} className={`flex flex-col ${isStaff ? "items-end" : "items-start"}`}>
              <span className="mb-1 text-[11px] text-ink-muted">
                {m.senderName} · {new Date(m.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                {m.assetCode ? ` · [${m.assetCode}]` : ""}
              </span>
              <div
                className={`max-w-[78%] rounded-xl px-3.5 py-2 text-sm ${
                  isStaff ? "bg-lagoon text-white" : "border border-line bg-paper text-ink"
                }`}
              >
                {m.imageUrl && (
                  <img
                    src={m.imageUrl}
                    alt="ไฟล์แนบในแชท"
                    className="mb-2 max-h-48 rounded-lg border border-white/20 object-cover"
                  />
                )}
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-line bg-paper p-3">
        {imageUrl && (
          <div className="mb-2 flex items-center gap-2 text-xs text-lagoon-deep">
            <span>แนบรูปภาพพร้อมส่งแล้ว</span>
            <button type="button" onClick={() => setImageUrl(null)} className="text-red-600 underline">
              ยกเลิกรูป
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="รหัสทรัพย์ (เช่น PR-000031)"
            value={assetCode}
            onChange={(e) => setAssetCode(e.target.value)}
            className="h-9 w-36 rounded border border-line bg-white px-2.5 text-xs"
          />
          <label className="flex h-9 cursor-pointer items-center rounded border border-line bg-white px-2.5 text-xs text-ink hover:bg-surface">
            {uploading ? "กำลังย่อรูป..." : "+ รูปภาพ"}
            <input type="file" accept="image/*" onChange={handleImagePick} className="hidden" />
          </label>
          <input
            type="text"
            required={!imageUrl}
            placeholder="พิมพ์ข้อความตอบกลับ (ส่งเข้าเว็บแชท และ LINE OA อัตโนมัติ)..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="h-9 flex-1 rounded border border-line bg-white px-3 text-sm"
          />
          <button
            type="submit"
            disabled={sendMutation.isPending || uploading}
            className="h-9 rounded bg-lagoon px-4 text-xs font-medium text-white hover:bg-lagoon-deep disabled:opacity-50"
          >
            {sendMutation.isPending ? "กำลังส่ง..." : "ส่งข้อความ"}
          </button>
        </div>
      </form>
    </div>
  );
}
