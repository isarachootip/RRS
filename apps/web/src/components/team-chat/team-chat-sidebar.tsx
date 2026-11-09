"use client";

import { Hash, MessageSquare, Plus, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { TeamChatChannelItem, TeamChatUser } from "./team-chat.types";

interface TeamChatSidebarProps {
  channels: TeamChatChannelItem[];
  users: TeamChatUser[];
  currentUserId: string;
  selectedChannelId: string;
  onSelectChannel: (channelId: string) => void;
  onCreateChannel: (input: { name: string; description?: string; memberIds: string[] }) => Promise<void>;
  creating: boolean;
}

export function TeamChatSidebar({
  channels,
  users,
  currentUserId,
  selectedChannelId,
  onSelectChannel,
  onCreateChannel,
  creating,
}: TeamChatSidebarProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const toggleMember = (uid: string) => {
    setSelectedMemberIds((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onCreateChannel({
      name: name.trim(),
      description: description.trim() || undefined,
      memberIds: selectedMemberIds,
    });
    setName("");
    setDescription("");
    setSelectedMemberIds([]);
    setModalOpen(false);
  };

  return (
    <div className="flex w-full flex-col border-b border-slate-800 bg-slate-950/60 lg:w-[280px] lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <MessageSquare className="size-4 text-cyan-400" />
          <span>Your Channels</span>
        </h3>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-xs font-medium text-cyan-300 transition hover:bg-slate-700"
        >
          <Plus className="size-3.5" />
          <span>+ สร้างห้อง</span>
        </button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-3">
        {channels.length === 0 ? (
          <div className="mt-8 text-center text-xs text-slate-500">ยังไม่มีห้องแชทที่คุณเป็นสมาชิก</div>
        ) : (
          channels.map((ch) => {
            const active = ch.id === selectedChannelId;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => onSelectChannel(ch.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm transition-all ${
                  active
                    ? "bg-slate-800/90 font-semibold text-white shadow-sm"
                    : "font-normal text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`}
              >
                <Hash className={`size-4 shrink-0 ${active ? "text-cyan-400" : "text-slate-500"}`} />
                <span className="flex-1 truncate">{ch.name}</span>
                {ch.unreadCount > 0 && (
                  <span className="min-w-[20px] rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[11px] font-bold text-white">
                    {ch.unreadCount}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-base font-semibold">สร้างห้องแชทใหม่ (#Channel)</h4>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-300">ชื่อห้องแชท</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น ดีลคอนโดสุขุมวิท, ทีมการตลาด..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-300">รายละเอียดห้อง (ไม่บังคับ)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="อธิบายจุดประสงค์ของห้องแชท..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-300">เลือกสมาชิกเข้าห้อง</label>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-2">
                  {users
                    .filter((u) => u.id !== currentUserId)
                    .map((u) => (
                      <label
                        key={u.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-slate-900"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMemberIds.includes(u.id)}
                          onChange={() => toggleMember(u.id)}
                          className="rounded border-slate-600"
                        />
                        <span>{u.fullName}</span>
                        {u.nickname && <span className="text-slate-400">({u.nickname})</span>}
                      </label>
                    ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-700 px-3.5 py-2 text-xs text-slate-300 hover:bg-slate-800"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
              >
                {creating ? "กำลังสร้าง..." : "สร้างห้องแชท"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
