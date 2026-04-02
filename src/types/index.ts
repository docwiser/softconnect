// src/types/index.ts
export type { UserProfile, UserSettings, Message, Chat, CallRecord } from '../services/firebase'

export interface LocalCallState {
  isActive: boolean
  isIncoming: boolean
  isOutgoing: boolean
  peerId: string          // Firebase UID
  peerName: string
  peerPhoto: string | null
  peerConnectionId: string // PeerJS ID
  isAudioEnabled: boolean
  isVideoEnabled: boolean
  isMuted: boolean
  isOnHold: boolean
  currentAudioInput?: string
  currentAudioOutput?: string
  currentVideoInput?: string
  playbackSpeed: number
  callId?: string        // Firestore call record ID
  startedAt?: number
}

export interface PeerSignal {
  type: 'call-request' | 'call-reject' | 'call-busy' | 'call-end' | 'hold' | 'config' | 'message' | 'read-receipt'
  data?: any
  senderId?: string
}

export interface RouteAnnouncement {
  message: string
  timestamp: number
}
