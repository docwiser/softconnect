// src/services/meetings.ts
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  arrayUnion,
  arrayRemove,
  getDocs,
  limit
} from 'firebase/firestore'
import { auth } from './firebase'

const db = getFirestore()

// ─── Types ────────────────────────────────────────────────────────────────────

export type MeetingStatus = 'scheduled' | 'active' | 'ended'
export type ParticipantRole = 'host' | 'co-host' | 'attendee'
export type ParticipantStatus = 'waiting' | 'joined' | 'left' | 'removed'

export interface MeetingSettings {
  allowParticipantAudio: boolean       // participants can unmute themselves
  allowParticipantVideo: boolean       // participants can turn on camera
  allowScreenShare: boolean            // participants can share screen
  allowChat: boolean                   // in-meeting chat
  muteOnEntry: boolean                 // auto-mute when joining
  videoOffOnEntry: boolean             // camera off on join
  waitingRoom: boolean                 // host must admit participants
  allowReactions: boolean
  recordingEnabled: boolean
  maxParticipants: number              // 0 = unlimited
}

export interface MeetingParticipant {
  uid: string
  displayName: string
  photoURL: string | null
  role: ParticipantRole
  status: ParticipantStatus
  joinedAt: Timestamp | null
  leftAt: Timestamp | null
  peerId: string                       // PeerJS connection ID sc_{uid}
  isAudioMuted: boolean
  isVideoOff: boolean
  isHandRaised: boolean
  isScreenSharing: boolean
  isSpeaking: boolean
  canUnmuteSelf: boolean               // host override per-participant
  canShareScreen: boolean
  canChat: boolean
}

export interface Meeting {
  id: string
  title: string
  description: string
  hostUid: string
  hostName: string
  hostPhoto: string | null
  meetingCode: string                  // 10-char unique code
  status: MeetingStatus
  settings: MeetingSettings
  participants: Record<string, MeetingParticipant>  // uid -> participant
  scheduledAt: Timestamp | null
  startedAt: Timestamp | null
  endedAt: Timestamp | null
  createdAt: Timestamp
  inviteLink: string
  agenda: string
  tags: string[]
  allowedEmails: string[]             // empty = anyone with link
}

export interface MeetingChatMessage {
  id: string
  senderUid: string
  senderName: string
  senderPhoto: string | null
  content: string
  timestamp: Timestamp
  type: 'text' | 'system' | 'reaction'
  reaction?: string
}

// ─── Default Settings ──────────────────────────────────────────────────────────

export const defaultMeetingSettings: MeetingSettings = {
  allowParticipantAudio: true,
  allowParticipantVideo: true,
  allowScreenShare: true,
  allowChat: true,
  muteOnEntry: false,
  videoOffOnEntry: false,
  waitingRoom: false,
  allowReactions: true,
  recordingEnabled: false,
  maxParticipants: 0
}

// ─── Meeting Code Generator ────────────────────────────────────────────────────

function generateMeetingCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''
  for (let i = 0; i < 10; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  // Format as xxx-xxxx-xxx
  return code.slice(0, 3) + '-' + code.slice(3, 7) + '-' + code.slice(7)
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createMeeting(data: {
  title: string
  description: string
  agenda: string
  scheduledAt: Date | null
  settings: Partial<MeetingSettings>
  allowedEmails: string[]
  tags: string[]
}): Promise<Meeting> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')

  const meetingCode = generateMeetingCode()
  const meetingId = meetingCode // Use code as ID for easy lookup
  const inviteLink = `${window.location.origin}/join/${meetingCode}`

  const hostParticipant: MeetingParticipant = {
    uid: user.uid,
    displayName: user.displayName || 'Host',
    photoURL: user.photoURL,
    role: 'host',
    status: 'waiting',
    joinedAt: null,
    leftAt: null,
    peerId: `sc_${user.uid}`,
    isAudioMuted: false,
    isVideoOff: false,
    isHandRaised: false,
    isScreenSharing: false,
    isSpeaking: false,
    canUnmuteSelf: true,
    canShareScreen: true,
    canChat: true
  }

  const meeting: Meeting = {
    id: meetingId,
    title: data.title || 'My Meeting',
    description: data.description || '',
    hostUid: user.uid,
    hostName: user.displayName || 'Host',
    hostPhoto: user.photoURL,
    meetingCode,
    status: 'scheduled',
    settings: { ...defaultMeetingSettings, ...data.settings },
    participants: { [user.uid]: hostParticipant },
    scheduledAt: data.scheduledAt ? Timestamp.fromDate(data.scheduledAt) : null,
    startedAt: null,
    endedAt: null,
    createdAt: Timestamp.now(),
    inviteLink,
    agenda: data.agenda || '',
    tags: data.tags || [],
    allowedEmails: data.allowedEmails || []
  }

  await setDoc(doc(db, 'meetings', meetingId), meeting)
  return meeting
}

export async function getMeetingById(meetingId: string): Promise<Meeting | null> {
  const snap = await getDoc(doc(db, 'meetings', meetingId))
  return snap.exists() ? (snap.data() as Meeting) : null
}

export async function getMeetingByCode(code: string): Promise<Meeting | null> {
  // We use meetingCode as the document ID for direct lookup
  return getMeetingById(code)
}

export async function updateMeetingSettings(
  meetingId: string,
  settings: Partial<MeetingSettings>
): Promise<void> {
  const updates: Record<string, any> = {}
  for (const [key, val] of Object.entries(settings)) {
    updates[`settings.${key}`] = val
  }
  await updateDoc(doc(db, 'meetings', meetingId), updates)
}

export async function startMeeting(meetingId: string): Promise<void> {
  await updateDoc(doc(db, 'meetings', meetingId), {
    status: 'active',
    startedAt: Timestamp.now()
  })
}

export async function endMeeting(meetingId: string): Promise<void> {
  await updateDoc(doc(db, 'meetings', meetingId), {
    status: 'ended',
    endedAt: Timestamp.now()
  })
}

export async function deleteMeeting(meetingId: string): Promise<void> {
  await deleteDoc(doc(db, 'meetings', meetingId))
}

// ─── Participant Management ────────────────────────────────────────────────────

export async function joinMeeting(
  meetingId: string,
  participant: {
    uid: string
    displayName: string
    photoURL: string | null
    peerId: string
    isAudioMuted: boolean
    isVideoOff: boolean
  }
): Promise<void> {
  const p: MeetingParticipant = {
    uid: participant.uid,
    displayName: participant.displayName,
    photoURL: participant.photoURL,
    role: 'attendee',
    status: 'joined',
    joinedAt: Timestamp.now(),
    leftAt: null,
    peerId: participant.peerId,
    isAudioMuted: participant.isAudioMuted,
    isVideoOff: participant.isVideoOff,
    isHandRaised: false,
    isScreenSharing: false,
    isSpeaking: false,
    canUnmuteSelf: true,
    canShareScreen: true,
    canChat: true
  }

  // Check if host joining
  const meeting = await getMeetingById(meetingId)
  if (meeting?.hostUid === participant.uid) {
    p.role = 'host'
  }

  await updateDoc(doc(db, 'meetings', meetingId), {
    [`participants.${participant.uid}`]: p
  })
}

export async function leaveMeeting(meetingId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'meetings', meetingId), {
    [`participants.${uid}.status`]: 'left',
    [`participants.${uid}.leftAt`]: Timestamp.now()
  })
}

export async function updateParticipantState(
  meetingId: string,
  uid: string,
  updates: Partial<Pick<MeetingParticipant,
    'isAudioMuted' | 'isVideoOff' | 'isHandRaised' |
    'isScreenSharing' | 'isSpeaking' | 'status'
  >>
): Promise<void> {
  const firestoreUpdates: Record<string, any> = {}
  for (const [key, val] of Object.entries(updates)) {
    firestoreUpdates[`participants.${uid}.${key}`] = val
  }
  await updateDoc(doc(db, 'meetings', meetingId), firestoreUpdates)
}

export async function hostMuteParticipant(
  meetingId: string,
  targetUid: string,
  muted: boolean
): Promise<void> {
  await updateDoc(doc(db, 'meetings', meetingId), {
    [`participants.${targetUid}.isAudioMuted`]: muted,
    [`participants.${targetUid}.canUnmuteSelf`]: !muted
  })
}

export async function hostSetParticipantPermission(
  meetingId: string,
  targetUid: string,
  permission: 'canUnmuteSelf' | 'canShareScreen' | 'canChat',
  value: boolean
): Promise<void> {
  await updateDoc(doc(db, 'meetings', meetingId), {
    [`participants.${targetUid}.${permission}`]: value
  })
}

export async function removeParticipant(
  meetingId: string,
  targetUid: string
): Promise<void> {
  await updateDoc(doc(db, 'meetings', meetingId), {
    [`participants.${targetUid}.status`]: 'removed',
    [`participants.${targetUid}.leftAt`]: Timestamp.now()
  })
}

export async function promoteToCoHost(
  meetingId: string,
  targetUid: string
): Promise<void> {
  await updateDoc(doc(db, 'meetings', meetingId), {
    [`participants.${targetUid}.role`]: 'co-host'
  })
}

export async function demoteFromCoHost(
  meetingId: string,
  targetUid: string
): Promise<void> {
  await updateDoc(doc(db, 'meetings', meetingId), {
    [`participants.${targetUid}.role`]: 'attendee'
  })
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function sendMeetingChatMessage(
  meetingId: string,
  sender: { uid: string; displayName: string; photoURL: string | null },
  content: string
): Promise<void> {
  const msgRef = doc(collection(db, 'meetings', meetingId, 'chat'))
  const msg: MeetingChatMessage = {
    id: msgRef.id,
    senderUid: sender.uid,
    senderName: sender.displayName,
    senderPhoto: sender.photoURL,
    content,
    timestamp: Timestamp.now(),
    type: 'text'
  }
  await setDoc(msgRef, msg)
}

// ─── Real-time Listeners ──────────────────────────────────────────────────────

export function listenToMeeting(
  meetingId: string,
  callback: (meeting: Meeting) => void
): () => void {
  return onSnapshot(doc(db, 'meetings', meetingId), snap => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() } as Meeting)
  })
}

export function listenToMeetingChat(
  meetingId: string,
  callback: (messages: MeetingChatMessage[]) => void
): () => void {
  const q = query(
    collection(db, 'meetings', meetingId, 'chat'),
    orderBy('timestamp', 'asc'),
    limit(200)
  )
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as MeetingChatMessage)))
  })
}

export function listenToMyMeetings(
  uid: string,
  callback: (meetings: Meeting[]) => void
): () => void {
  const q = query(
    collection(db, 'meetings'),
    where('hostUid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(50)
  )
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Meeting)))
  })
}

export { db as meetingsDb }
