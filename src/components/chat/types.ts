export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  isMaster?: boolean;
  text: string;
  timestamp: number;
}

export interface ChatRoomData {
  roomId: string;
  messages: ChatMessage[];
}

export interface ChatUser {
  id: string;
  name: string;
  avatar?: string;
  isMaster?: boolean;
}

export interface MessageGroupData {
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  isMaster?: boolean;
  isSelf: boolean;
  messages: ChatMessage[];
  timestamp: number;
}

export type SyncStatus = "connected" | "connecting" | "offline" | "error";
