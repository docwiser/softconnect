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
  getDocs,
  limit,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { auth } from './firebase'

const db = getFirestore()

// ─── Types ────────────────────────────────────────────────────────────────────

export type MeetingStatus = 'scheduled' | 'active' | 'ended'
export type ParticipantRole = 'host' | 'co-host' | 'attendee'
export type ParticipantStatus = 'waiting' | 'joined' | 'left' | 'removed' | 'denied'

export interface MeetingSettings {
  allowParticipantAudio: boolean
  allowParticipantVideo: boolean
  allowScreenShare: boolean
  allowChat: boolean
  muteOnEntry: boolean
  videoOffOnEntry: boolean
  waitingRoom: boolean          // ← enforced: joins land in 'waiting', host admits
  allowReactions: boolean
  recordingEnabled: boolean
  maxParticipants: number       // 0 = unlimited
}

export interface MeetingParticipant {
  uid: string
  displayName: string
  photoURL: string | null
  role: ParticipantRole
  status: ParticipantStatus
  joinedAt: Timestamp | null
  leftAt: Timestamp | null
  peerId: string
  isAudioMuted: boolean
  isVideoOff: boolean
  isHandRaised: boolean
  isScreenSharing: boolean
  isSpeaking: boolean
  canUnmuteSelf: boolean
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
  meetingCode: string
  status: MeetingStatus
  settings: MeetingSettings
  participants: Record<string, MeetingParticipant>
  scheduledAt: Timestamp | null
  startedAt: Timestamp | null
  endedAt: Timestamp | null
  createdAt: Timestamp
  inviteLink: string
  agenda: string
  tags: string[]
  allowedEmails: string[]
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

// ─── New: Reaction broadcast type ────────────────────────────────────────────
export interface MeetingReaction {
  id: string
  senderUid: string
  senderName: string
  emoji: string
  timestamp: Timestamp
}

// ─── Default Settings ─────────────────────────────────────────────────────────

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
  maxParticipants: 0,
}

// ─── Code Generator ───────────────────────────────────────────────────────────

function generateMeetingCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''
  for (let i = 0; i < 10; i++) code += chars[Math.floor(Math.random() * chars.length)]
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
  const meetingId = meetingCode
  const inviteLink = `${window.location.origin}/join/${meetingCode}`

  const mergedSettings: MeetingSettings = { ...defaultMeetingSettings, ...data.settings }

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
    canChat: true,
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
    settings: mergedSettings,
    participants: { [user.uid]: hostParticipant },
    scheduledAt: data.scheduledAt ? Timestamp.fromDate(data.scheduledAt) : null,
    startedAt: null,
    endedAt: null,
    createdAt: Timestamp.now(),
    inviteLink,
    agenda: data.agenda || '',
    tags: data.tags || [],
    allowedEmails: data.allowedEmails || [],
  }

  await setDoc(doc(db, 'meetings', meetingId), meeting)
  return meeting
}

export async function getMeetingById(meetingId: string): Promise<Meeting | null> {
  const snap = await getDoc(doc(db, 'meetings', meetingId))
  return snap.exists() ? (snap.data() as Meeting) : null
}

export async function getMeetingByCode(code: string): Promise<Meeting | null> {
  return getMeetingById(code)
}

export async function updateMeetingSettings(
  meetingId: string,
  settings: Partial<MeetingSettings>
): Promise<void> {
  const updates: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(settings)) {
    updates[`settings.${key}`] = val
  }
  await updateDoc(doc(db, 'meetings', meetingId), updates)
}

export async function startMeeting(meetingId: string): Promise<void> {
  await updateDoc(doc(db, 'meetings', meetingId), {
    status: 'active',
    startedAt: Timestamp.now(),
  })
}

export async function endMeeting(meetingId: string): Promise<void> {
  await updateDoc(doc(db, 'meetings', meetingId), {
    status: 'ended',
    endedAt: Timestamp.now(),
  })
}

export async function deleteMeeting(meetingId: string): Promise<void> {
  await deleteDoc(doc(db, 'meetings', meetingId))
}

// ─── Participant Management ───────────────────────────────────────────────────

/**
 * joinMeeting — respects waitingRoom setting.
 *
 * If waitingRoom is ON  → status = 'waiting'  (host must admit via admitParticipant)
 * If waitingRoom is OFF → status = 'joined'   (immediate access, media constraints applied)
 *
 * muteOnEntry and videoOffOnEntry from MeetingSettings are applied here so the
 * participant document is already correct before the store reads it.
 *
 * allowParticipantAudio / allowParticipantVideo control canUnmuteSelf / canShareScreen
 * at the document level — the store reads these and enforces them locally.
 */
export async function joinMeeting(
  meetingId: string,
  participant: {
    uid: string
    displayName: string
    photoURL: string | null
    peerId: string
    isAudioMuted: boolean   // caller's preferred state (may be overridden)
    isVideoOff: boolean     // caller's preferred state (may be overridden)
  }
): Promise<{ status: ParticipantStatus; isAudioMuted: boolean; isVideoOff: boolean }> {
  const meeting = await getMeetingById(meetingId)
  if (!meeting) throw new Error('Meeting not found')

  const s = meeting.settings
  const isHost = meeting.hostUid === participant.uid

  // Determine target status
  const targetStatus: ParticipantStatus =
    s.waitingRoom && !isHost ? 'waiting' : 'joined'

  // Enforce entry constraints (host is exempt)
  const forcedAudioMuted = !isHost && (s.muteOnEntry || !s.allowParticipantAudio)
    ? true
    : participant.isAudioMuted

  const forcedVideoOff = !isHost && (s.videoOffOnEntry || !s.allowParticipantVideo)
    ? true
    : participant.isVideoOff

  // Derive permissions
  const canUnmuteSelf = isHost || (s.allowParticipantAudio && !s.muteOnEntry)
  const canShareScreen = isHost || s.allowScreenShare
  const canChat = isHost || s.allowChat

  // Re-use existing role if the participant already has one (e.g. co-host rejoining)
  const existingRole = meeting.participants[participant.uid]?.role
  const role: ParticipantRole = isHost
    ? 'host'
    : existingRole === 'co-host'
      ? 'co-host'
      : 'attendee'

  const p: MeetingParticipant = {
    uid: participant.uid,
    displayName: participant.displayName,
    photoURL: participant.photoURL,
    role,
    status: targetStatus,
    joinedAt: targetStatus === 'joined' ? Timestamp.now() : null,
    leftAt: null,
    peerId: participant.peerId,
    isAudioMuted: forcedAudioMuted,
    isVideoOff: forcedVideoOff,
    isHandRaised: false,
    isScreenSharing: false,
    isSpeaking: false,
    canUnmuteSelf,
    canShareScreen,
    canChat,
  }

  await updateDoc(doc(db, 'meetings', meetingId), {
    [`participants.${participant.uid}`]: p,
  })

  return {
    status: targetStatus,
    isAudioMuted: forcedAudioMuted,
    isVideoOff: forcedVideoOff,
  }
}

/**
 * admitParticipant — host moves a 'waiting' participant to 'joined'.
 * Applies entry constraints at this point (same logic as joinMeeting).
 */
export async function admitParticipant(
  meetingId: string,
  targetUid: string
): Promise<void> {
  const meeting = await getMeetingById(meetingId)
  if (!meeting) throw new Error('Meeting not found')

  const s = meeting.settings
  const p = meeting.participants[targetUid]
  if (!p) throw new Error('Participant not found')

  const forcedAudioMuted = s.muteOnEntry || !s.allowParticipantAudio
  const forcedVideoOff   = s.videoOffOnEntry || !s.allowParticipantVideo
  const canUnmuteSelf    = s.allowParticipantAudio && !s.muteOnEntry
  const canShareScreen   = s.allowScreenShare
  const canChat          = s.allowChat

  await updateDoc(doc(db, 'meetings', meetingId), {
    [`participants.${targetUid}.status`]:        'joined',
    [`participants.${targetUid}.joinedAt`]:       Timestamp.now(),
    [`participants.${targetUid}.isAudioMuted`]:  forcedAudioMuted,
    [`participants.${targetUid}.isVideoOff`]:    forcedVideoOff,
    [`participants.${targetUid}.canUnmuteSelf`]: canUnmuteSelf,
    [`participants.${targetUid}.canShareScreen`]:canShareScreen,
    [`participants.${targetUid}.canChat`]:       canChat,
  })
}

/**
 * denyParticipant — host rejects a waiting participant.
 */
export async function denyParticipant(
  meetingId: string,
  targetUid: string
): Promise<void> {
  await updateDoc(doc(db, 'meetings', meetingId), {
    [`participants.${targetUid}.status`]: 'denied',
    [`participants.${targetUid}.leftAt`]: Timestamp.now(),
  })
}

export async function leaveMeeting(meetingId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'meetings', meetingId), {
    [`participants.${uid}.status`]: 'left',
    [`participants.${uid}.leftAt`]: Timestamp.now(),
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
  const firestoreUpdates: Record<string, unknown> = {}
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
    [`participants.${targetUid}.isAudioMuted`]:  muted,
    [`participants.${targetUid}.canUnmuteSelf`]: !muted,
  })
}

export async function hostSetParticipantPermission(
  meetingId: string,
  targetUid: string,
  permission: 'canUnmuteSelf' | 'canShareScreen' | 'canChat',
  value: boolean
): Promise<void> {
  await updateDoc(doc(db, 'meetings', meetingId), {
    [`participants.${targetUid}.${permission}`]: value,
  })
}

export async function removeParticipant(
  meetingId: string,
  targetUid: string
): Promise<void> {
  await updateDoc(doc(db, 'meetings', meetingId), {
    [`participants.${targetUid}.status`]: 'removed',
    [`participants.${targetUid}.leftAt`]: Timestamp.now(),
  })
}

export async function promoteToCoHost(
  meetingId: string,
  targetUid: string
): Promise<void> {
  await updateDoc(doc(db, 'meetings', meetingId), {
    [`participants.${targetUid}.role`]:         'co-host',
    [`participants.${targetUid}.canUnmuteSelf`]: true,
    [`participants.${targetUid}.canShareScreen`]:true,
    [`participants.${targetUid}.canChat`]:       true,
  })
}

export async function demoteFromCoHost(
  meetingId: string,
  targetUid: string
): Promise<void> {
  const meeting = await getMeetingById(meetingId)
  if (!meeting) return
  const s = meeting.settings
  await updateDoc(doc(db, 'meetings', meetingId), {
    [`participants.${targetUid}.role`]:          'attendee',
    [`participants.${targetUid}.canUnmuteSelf`]:  s.allowParticipantAudio && !s.muteOnEntry,
    [`participants.${targetUid}.canShareScreen`]: s.allowScreenShare,
    [`participants.${targetUid}.canChat`]:        s.allowChat,
  })
}

export async function updateParticipantProfile(
  meetingId: string,
  uid: string,
  updates: Partial<Pick<MeetingParticipant, 'displayName' | 'photoURL'>>
): Promise<void> {
  const firestoreUpdates: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(updates)) {
    firestoreUpdates[`participants.${uid}.${key}`] = val
  }
  await updateDoc(doc(db, 'meetings', meetingId), firestoreUpdates)
}

// ─── Host: bulk permission enforcement when a setting is toggled ──────────────

/**
 * When host toggles a global setting (e.g. allowParticipantAudio → false),
 * this propagates the change to all currently joined participants immediately.
 */
export async function propagateSettingToParticipants(
  meetingId: string,
  setting: keyof MeetingSettings,
  value: boolean | number
): Promise<void> {
  const meeting = await getMeetingById(meetingId)
  if (!meeting) return

  const batch = writeBatch(db)
  const mRef  = doc(db, 'meetings', meetingId)

  // Update the setting itself
  batch.update(mRef, { [`settings.${setting}`]: value })

  // Derive per-participant consequences
  const joined = Object.values(meeting.participants).filter(
    p => p.status === 'joined' && p.role === 'attendee'
  )

  for (const p of joined) {
    if (setting === 'allowParticipantAudio' && value === false) {
      // Lock everyone out — mute and remove self-unmute ability
      batch.update(mRef, {
        [`participants.${p.uid}.isAudioMuted`]:  true,
        [`participants.${p.uid}.canUnmuteSelf`]: false,
      })
    }
    if (setting === 'allowParticipantAudio' && value === true) {
      // Restore self-unmute unless muteOnEntry is set
      const canUnmute = !meeting.settings.muteOnEntry
      batch.update(mRef, { [`participants.${p.uid}.canUnmuteSelf`]: canUnmute })
    }
    if (setting === 'muteOnEntry' && value === true) {
      // muteOnEntry newly ON → mute everyone currently in the room
      batch.update(mRef, {
        [`participants.${p.uid}.isAudioMuted`]:  true,
        [`participants.${p.uid}.canUnmuteSelf`]: false,
      })
    }
    if (setting === 'muteOnEntry' && value === false) {
      // muteOnEntry newly OFF → restore self-unmute (if audio is allowed globally)
      if (meeting.settings.allowParticipantAudio) {
        batch.update(mRef, { [`participants.${p.uid}.canUnmuteSelf`]: true })
      }
    }
    if (setting === 'allowParticipantVideo' && value === false) {
      batch.update(mRef, { [`participants.${p.uid}.isVideoOff`]: true })
    }
    if (setting === 'allowScreenShare' && value === false) {
      batch.update(mRef, { [`participants.${p.uid}.canShareScreen`]: false })
    }
    if (setting === 'allowScreenShare' && value === true) {
      batch.update(mRef, { [`participants.${p.uid}.canShareScreen`]: true })
    }
    if (setting === 'allowChat' && value === false) {
      batch.update(mRef, { [`participants.${p.uid}.canChat`]: false })
    }
    if (setting === 'allowChat' && value === true) {
      batch.update(mRef, { [`participants.${p.uid}.canChat`]: true })
    }
  }

  await batch.commit()
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
    type: 'text',
  }
  await setDoc(msgRef, msg)
}

// ─── Reactions subcollection ──────────────────────────────────────────────────

/**
 * Broadcasts a reaction to ALL participants via Firestore.
 * Each reaction is a short-lived document (TTL handled client-side via timestamp).
 * MeetingRoomScreen listens to this collection and renders floating emoji for all.
 */
export async function broadcastReaction(
  meetingId: string,
  sender: { uid: string; displayName: string },
  emoji: string
): Promise<void> {
  const rRef = doc(collection(db, 'meetings', meetingId, 'reactions'))
  const reaction: MeetingReaction = {
    id: rRef.id,
    senderUid: sender.uid,
    senderName: sender.displayName,
    emoji,
    timestamp: Timestamp.now(),
  }
  await setDoc(rRef, reaction)
}

// ─── Real-time listeners ──────────────────────────────────────────────────────

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

/**
 * Listens to the reactions subcollection.
 * Automatically filters out reactions older than 8 seconds (client-side TTL).
 */
export function listenToMeetingReactions(
  meetingId: string,
  callback: (reactions: MeetingReaction[]) => void
): () => void {
  const q = query(
    collection(db, 'meetings', meetingId, 'reactions'),
    orderBy('timestamp', 'desc'),
    limit(50)
  )
  return onSnapshot(q, snap => {
    const now = Date.now()
    const live = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as MeetingReaction))
      .filter(r => now - r.timestamp.toMillis() < 8000)
    callback(live)
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
