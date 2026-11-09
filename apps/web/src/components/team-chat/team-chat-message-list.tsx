"use client";

import { Download, FileText, Hash, MessageSquare, User as UserIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import type { TeamChatChannelItem, TeamChatMessageItem, TeamChatUser } from "./team-chat.types";

interface TeamChatMessageListProps {
  channel: TeamChatChannelItem;
  messages: TeamChatMessageItem[];
  users: TeamChatUser[];
  currentUserId: string;
  loading: boolean;
}

function renderMessageText(text: string, users: TeamChatUser[], isMine: boolean): ReactNode {
  if (!text) return "";
  const sortedUsers = [...users].sort((a, b) => b.fullName.length - a.fullName.length);
  let parts: Array<string | ReactNode> = [text];

  for (const user of sortedUsers) {
    const mentionStr = `@${user.fullName}`;
    const nextParts: Array<string | ReactNode> = [];
    for (const part of parts) {
      if (typeof part !== "string") {
        nextParts.push(part);
        continue;
      }
      let idx = part.indexOf(mentionStr);
      let currentText = part;
      while (idx !== -1) {
        const before = currentText.slice(0, idx);
        const mention = currentText.slice(idx, idx + mentionStr.length);
        currentText = currentText.slice(idx + mentionStr.length);
        if (before) nextParts.push(before);
        nextParts.push(
          <span
            key={`${user.id}-${idx}`}
            className={`inline-block rounded px-1.5 py-0.5 font-semibold ${
              isMine
                ? "border border-white/35 bg-white/20 text-white"
                : "border border-cyan-400/30 bg-cyan-500/15 text-cyan-300"
            }`}
          >
            {mention}
          </span>,
        );
        idx = currentText.indexOf(mentionStr);
      }
      if (currentText) nextParts.push(currentText);
    }
    parts = nextParts;
  }
  return parts;
}

const formatTime = (iso: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");
const formatDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";

export function TeamChatMessageList({ channel, messages, users, currentUserId, loading }: TeamChatMessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, channel.id]);

  const grouped: Record<string, TeamChatMessageItem[]> = {};
  for (const m of messages) {
    const d = formatDate(m.createdAt);
    (grouped[d] ??= []).push(m);
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-slate-800 p-2">
            <Hash className="size-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">{channel.name}</h2>
            <div className="mt-0.5 text-xs text-slate-400">{channel.memberCount} members</div>
          </div>
        </div>
        {channel.description && <span className="hidden text-xs text-slate-400 md:inline">{channel.description}</span>}
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {loading && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
            <MessageSquare className="size-12 opacity-20" />
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          Object.keys(grouped).map((date) => {
            const dayMessages = grouped[date] ?? [];
            return (
              <div key={date} className="space-y-4">
                <div className="my-2 flex items-center gap-4">
                  <div className="h-px flex-1 bg-slate-800" />
                  <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{date}</span>
                  <div className="h-px flex-1 bg-slate-800" />
                </div>

                {dayMessages.map((msg, index) => {
                  const isMine = msg.senderId === currentUserId;
                  const showAvatar = !dayMessages[index - 1] || dayMessages[index - 1]!.senderId !== msg.senderId;

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-3.5 ${isMine ? "flex-row-reverse" : "flex-row"} ${showAvatar ? "mt-2" : ""}`}
                    >
                      <div className={`size-9 shrink-0 ${showAvatar ? "opacity-100" : "opacity-0"}`}>
                        {showAvatar && (
                          <div className="flex size-full items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-cyan-300">
                            {msg.senderName.charAt(0).toUpperCase() || <UserIcon className="size-4" />}
                          </div>
                        )}
                      </div>

                      <div className={`flex max-w-[72%] flex-col ${isMine ? "items-end" : "items-start"}`}>
                        {showAvatar && (
                          <div className="mb-1 flex items-baseline gap-2">
                            <span className="text-xs font-semibold text-slate-200">{isMine ? "You" : msg.senderName}</span>
                            <span className="text-[11px] text-slate-500">{formatTime(msg.createdAt)}</span>
                          </div>
                        )}

                        <div
                          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap shadow-md ${
                            isMine ? "rounded-tr-xs bg-cyan-600 text-white" : "rounded-tl-xs bg-slate-800 text-slate-100"
                          }`}
                        >
                          {msg.content.trim() ? renderMessageText(msg.content, users, isMine) : null}

                          {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                            <div className={`${msg.content.trim() ? "mt-2.5" : ""} flex flex-col gap-2`}>
                              {msg.attachments.map((att, i) =>
                                att.mimeType.startsWith("image/") ? (
                                  <a key={i} href={att.url} download={att.name} className="block">
                                    <img src={att.url} alt={att.name} className="max-h-52 max-w-full rounded-lg object-cover" />
                                  </a>
                                ) : (
                                  <a
                                    key={i}
                                    href={att.url}
                                    download={att.name}
                                    className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-xs text-inherit no-underline hover:bg-black/30"
                                  >
                                    <FileText className="size-4 shrink-0" />
                                    <span className="flex-1 truncate">{att.name}</span>
                                    <Download className="size-4 shrink-0" />
                                  </a>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
    </>
  );
}
