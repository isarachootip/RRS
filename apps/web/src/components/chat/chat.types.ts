export type ChatRoomType = "CUSTOMER" | "OWNER";
export type ChatSenderType = "STAFF" | "CUSTOMER" | "OWNER" | "SYSTEM";

export interface ChatRoomItem {
  id: string;
  type: ChatRoomType;
  publicToken: string;
  title: string;
  subtitle: string | null;
  lineUserId: string | null;
  leadId: string | null;
  ownerId: string | null;
  assetCode: string | null;
  assignedAgentId: string | null;
  unreadCount: number;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageItem {
  id: string;
  roomId: string;
  senderType: ChatSenderType;
  senderUserId: string | null;
  senderName: string;
  content: string;
  imageUrl: string | null;
  assetCode: string | null;
  createdAt: string;
}

export interface ChatRoomsResponse {
  items: ChatRoomItem[];
  unreadSummary: {
    customerUnread: number;
    ownerUnread: number;
    totalUnread: number;
  };
}

export interface ChatRoomDetailResponse extends ChatRoomItem {
  messages: ChatMessageItem[];
}

export interface OwnerListItem {
  id: string;
  code: string;
  fullName: string;
  phone: string | null;
  lineId: string | null;
}
