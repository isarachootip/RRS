export interface TeamChatAttachment {
  name: string;
  url: string;
  mimeType: string;
}

export interface TeamChatUser {
  id: string;
  fullName: string;
  nickname: string | null;
  email: string;
  teamId: string | null;
}

export interface TeamChatChannelItem {
  id: string;
  name: string;
  description: string | null;
  isGeneral: boolean;
  teamId: string | null;
  memberIds: string[];
  memberCount: number;
  unreadCount: number;
  updatedAt: string;
}

export interface TeamChatMessageItem {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  content: string;
  attachments: TeamChatAttachment[];
  mentionedUserIds: string[];
  createdAt: string;
}

export interface TeamChatChannelsResponse {
  channels: TeamChatChannelItem[];
  users: TeamChatUser[];
  totalUnread: number;
}

export interface TeamChatMessagesResponse {
  items: TeamChatMessageItem[];
}
