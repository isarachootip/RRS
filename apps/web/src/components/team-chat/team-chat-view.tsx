"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { TeamChatComposer } from "./team-chat-composer";
import { TeamChatMessageList } from "./team-chat-message-list";
import { TeamChatSidebar } from "./team-chat-sidebar";
import type {
  TeamChatAttachment,
  TeamChatChannelItem,
  TeamChatChannelsResponse,
  TeamChatMessagesResponse,
} from "./team-chat.types";

export function TeamChatView() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const currentUserId = user?.id ?? "";

  const [selectedChannelId, setSelectedChannelId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("channelId") ?? "";
    }
    return "";
  });

  const channelsQuery = useQuery({
    queryKey: ["team-chat-channels"],
    queryFn: () => api<TeamChatChannelsResponse>("/api/v1/team-chat/channels"),
    refetchInterval: 5000,
  });

  const channels = useMemo(() => channelsQuery.data?.channels ?? [], [channelsQuery.data?.channels]);
  const users = useMemo(() => channelsQuery.data?.users ?? [], [channelsQuery.data?.users]);

  useEffect(() => {
    if (channels.length > 0 && (!selectedChannelId || !channels.some((c) => c.id === selectedChannelId))) {
      setSelectedChannelId(channels[0]!.id);
    }
  }, [channels, selectedChannelId]);

  const messagesQuery = useQuery({
    queryKey: ["team-chat-messages", selectedChannelId],
    queryFn: () => api<TeamChatMessagesResponse>(`/api/v1/team-chat/channels/${selectedChannelId}/messages`),
    enabled: Boolean(selectedChannelId),
    refetchInterval: 5000,
  });

  const createChannelMutation = useMutation({
    mutationFn: (input: { name: string; description?: string; memberIds: string[] }) =>
      api<TeamChatChannelItem>("/api/v1/team-chat/channels", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["team-chat-channels"] });
      setSelectedChannelId(created.id);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (payload: {
      content: string;
      attachments: TeamChatAttachment[];
      mentionedUserIds: string[];
    }) =>
      api(`/api/v1/team-chat/channels/${selectedChannelId}/messages`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["team-chat-messages", selectedChannelId] });
      void qc.invalidateQueries({ queryKey: ["team-chat-channels"] });
    },
  });

  const selectedChannel = channels.find((c) => c.id === selectedChannelId);
  const channelMembers = useMemo(() => {
    if (!selectedChannel) return [];
    return users.filter((u) => selectedChannel.memberIds.includes(u.id));
  }, [selectedChannel, users]);

  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col gap-4">
      <div>
        <h1 className="bg-gradient-to-r from-cyan-400 to-teal-300 bg-clip-text text-2xl font-bold text-transparent">
          Team Chat
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          Collaborate and discuss with your project & team members (แชทประสานงานภายในทีม พิมพ์ @ เพื่อกล่าวถึงเพื่อนร่วมงาน)
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-xl lg:flex-row">
        <TeamChatSidebar
          channels={channels}
          users={users}
          currentUserId={currentUserId}
          selectedChannelId={selectedChannelId}
          onSelectChannel={setSelectedChannelId}
          onCreateChannel={async (input) => {
            await createChannelMutation.mutateAsync(input);
          }}
          creating={createChannelMutation.isPending}
        />

        <div className="flex min-h-0 flex-1 flex-col">
          {selectedChannel ? (
            <>
              <TeamChatMessageList
                channel={selectedChannel}
                messages={messagesQuery.data?.items ?? []}
                users={users}
                currentUserId={currentUserId}
                loading={messagesQuery.isLoading}
              />
              <TeamChatComposer
                channel={selectedChannel}
                channelMembers={channelMembers}
                onSendMessage={async (payload) => {
                  await sendMessageMutation.mutateAsync(payload);
                }}
                sending={sendMessageMutation.isPending}
              />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-slate-500">
              <MessageSquare className="mb-3 size-12 opacity-20" />
              <h3 className="text-base font-medium">Select a channel</h3>
              <p className="text-xs">Choose a channel from the sidebar to start chatting.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
