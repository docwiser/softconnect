export interface User {
  id: string;
  name: string;
  isOnline: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
  type: 'text' | 'system';
}

export interface Chat {
  peerId: string;
  peerName: string;
  messages: Message[];
  lastMessage?: Message;
  unreadCount: number;
}

export interface CallState {
  isActive: boolean;
  isIncoming: boolean;
  isOutgoing: boolean;
  peerId: string;
  peerName: string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isMuted: boolean;
  isOnHold: boolean;
  currentAudioInput?: string;
  currentAudioOutput?: string;
  currentVideoInput?: string;
  playbackSpeed: number;
}

export interface PeerConfig {
  name: string;
  version: string;
}

export interface CallRejectMessage {
  reason: string;
  message?: string;
}