"use client";

import { Clock, FileText, Paperclip, Send, X } from "lucide-react";
import { type ChangeEvent, type FormEvent, type KeyboardEvent, useRef, useState } from "react";
import { uploadEntityFile } from "@/lib/api";
import type { TeamChatAttachment, TeamChatChannelItem, TeamChatUser } from "./team-chat.types";

interface TeamChatComposerProps {
  channel: TeamChatChannelItem;
  channelMembers: TeamChatUser[];
  onSendMessage: (payload: {
    content: string;
    attachments: TeamChatAttachment[];
    mentionedUserIds: string[];
  }) => Promise<void>;
  sending: boolean;
}

export function TeamChatComposer({ channel, channelMembers, onSendMessage, sending }: TeamChatComposerProps) {
  const [inputValue, setInputValue] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [showMentionsDropdown, setShowMentionsDropdown] = useState(false);
  const [mentionSearchQuery, setMentionSearchQuery] = useState("");
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState(-1);
  const [selectedMentionUserIndex, setSelectedMentionUserIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredMentionUsers = channelMembers.filter((u) =>
    u.fullName.toLowerCase().includes(mentionSearchQuery.toLowerCase()),
  );

  const selectMentionUser = (user: TeamChatUser) => {
    const textBefore = inputValue.slice(0, mentionTriggerIndex);
    const textAfter = inputValue.slice(mentionTriggerIndex + 1 + mentionSearchQuery.length);
    setInputValue(`${textBefore}@${user.fullName} ${textAfter}`);
    setShowMentionsDropdown(false);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const nextPos = mentionTriggerIndex + user.fullName.length + 2;
        inputRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 0);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    const textBeforeCursor = value.slice(0, e.target.selectionStart ?? value.length);
    const lastAtIdx = textBeforeCursor.lastIndexOf("@");

    if (lastAtIdx !== -1) {
      const query = textBeforeCursor.slice(lastAtIdx + 1);
      const charBeforeAt = lastAtIdx > 0 ? textBeforeCursor[lastAtIdx - 1] : "";
      if (!query.includes(" ") && !query.includes("\n") && (charBeforeAt === "" || charBeforeAt === " " || charBeforeAt === "\n")) {
        setShowMentionsDropdown(true);
        setMentionSearchQuery(query);
        setMentionTriggerIndex(lastAtIdx);
        setSelectedMentionUserIndex(0);
        return;
      }
    }
    setShowMentionsDropdown(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showMentionsDropdown || filteredMentionUsers.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedMentionUserIndex((prev) => (prev + 1) % filteredMentionUsers.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedMentionUserIndex((prev) => (prev - 1 + filteredMentionUsers.length) % filteredMentionUsers.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const picked = filteredMentionUsers[selectedMentionUserIndex];
      if (picked) selectMentionUser(picked);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowMentionsDropdown(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() && !selectedFile) return;

    const attachments: TeamChatAttachment[] = [];
    if (selectedFile) {
      setUploading(true);
      try {
        const uploaded = await uploadEntityFile(selectedFile, "team_chat", channel.id);
        attachments.push({ name: uploaded.originalName, url: `/api/v1/files/${uploaded.id}/raw`, mimeType: uploaded.mimeType });
      } finally {
        setUploading(false);
      }
    }

    const mentionedUserIds = channelMembers.filter((m) => inputValue.includes(`@${m.fullName}`)).map((m) => m.id);
    const contentToSend = inputValue;
    setInputValue("");
    setSelectedFile(null);
    setShowMentionsDropdown(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    await onSendMessage({ content: contentToSend, attachments, mentionedUserIds });
  };

  const canSend = (Boolean(inputValue.trim()) || Boolean(selectedFile)) && !uploading && !sending;

  return (
    <div className="relative border-t border-slate-800 bg-slate-900/50 p-4">
      {showMentionsDropdown && filteredMentionUsers.length > 0 && (
        <div className="absolute bottom-full left-5 z-50 mb-2 max-h-52 w-64 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/95 py-1 shadow-2xl backdrop-blur-md">
          {filteredMentionUsers.map((u, idx) => (
            <button
              key={u.id}
              type="button"
              data-testid={`mention-option-${u.id}`}
              onClick={() => selectMentionUser(u)}
              onMouseEnter={() => setSelectedMentionUserIndex(idx)}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left text-xs transition ${
                idx === selectedMentionUserIndex ? "bg-cyan-600 text-white" : "text-slate-200 hover:bg-slate-800"
              }`}
            >
              <div className="flex size-6 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold">
                {u.fullName.charAt(0)}
              </div>
              <span className="truncate font-medium">{u.fullName}</span>
            </button>
          ))}
        </div>
      )}

      {selectedFile && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-200">
          <FileText className="size-4 text-cyan-400" />
          <span className="max-w-[220px] truncate">{selectedFile.name}</span>
          <button
            type="button"
            onClick={() => {
              setSelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="text-slate-400 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
          }}
        />
        <button
          type="button"
          aria-label="แนบไฟล์"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
        >
          <Paperclip className="size-5" />
        </button>

        <div className="flex flex-1 items-center rounded-lg border border-slate-800 bg-slate-950/90 px-4 py-2.5 focus-within:border-cyan-500/60">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channel.name}...`}
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
          />
        </div>

        <button
          type="submit"
          aria-label="ส่งข้อความ"
          disabled={!canSend}
          className={`flex size-11 items-center justify-center rounded-lg transition ${
            canSend ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : "cursor-not-allowed bg-slate-800 text-slate-500"
          }`}
        >
          {uploading ? <Clock className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
    </div>
  );
}
