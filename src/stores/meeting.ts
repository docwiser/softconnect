// src/stores/meeting.ts
// ─────────────────────────────────────────────────────────────────────────────
// Soft Connect — Meeting Store (Cloudflare Realtime SFU)
//
// New in this version:
//   • Waiting room enforced — joinCurrentMeeting returns early with isWaiting=true
//     when the participant lands in 'waiting' status.  The store watches the
//     participant's own document and auto-advances to 'joined' when admitted.
//   • Reactions broadcast — sendReaction() writes to Firestore reactions
//     subcollection; listenToMeetingReactions() feeds a live reactions array
//     that MeetingRoomScreen renders as floating emoji for all participants.
//   • Media constraints applied on join — muteOnEntry / videoOffOnEntry /
//     allowParticipantAudio / allowParticipantVideo are read from the participant
//     doc returned by joinMeeting() and applied to local tracks immediately.
//   • Live setting propagation — hostUpdateSettings() calls
//     propagateSettingToParticipants() so toggling a setting in the host UI
//     instantly updates every attendee's Firestore doc and their local tracks.
// ─────────────────────────────────────────────────────────────────────────────

import { defineStore } from 'pinia'
import { ref, computed, markRaw, nextTick } from 'vue'
import {
  sfuCreateSession,
  sfuAddTracks,
  sfuRenegotiate,
  SFU_ICE_SERVERS,
  type SfuTrackDescriptor,
} from '../services/cloudflare-sfu'
import {
  joinMeeting,
  admitParticipant,
  denyParticipant,
  leaveMeeting,
  updateParticipantState,
  hostMuteParticipant,
  hostSetParticipantPermission,
  removeParticipant,
  promoteToCoHost,
  demoteFromCoHost,
  startMeeting,
  endMeeting,
  updateMeetingSettings,
  propagateSettingToParticipants,
  updateParticipantProfile,
  sendMeetingChatMessage,
  broadcastReaction,
  listenToMeeting,
  listenToMeetingChat,
  listenToMeetingReactions,
  type Meeting,
  type MeetingParticipant,
  type MeetingChatMessage,
  type MeetingReaction,
  type MeetingSettings,
} from '../services/meetings'
import { auth } from '../services/firebase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RemoteStream {
  uid: string
  stream: MediaStream
  displayName: string
  photoURL: string | null
  isAudioMuted: boolean
  isVideoOff: boolean
  isScreenSharing: boolean
  isHandRaised: boolean
  isSpeaking: boolean
}

export interface MeetingNotification {
  id: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
}

// Floating reaction shown in the UI
export interface FloatingReaction {
  id: string
  emoji: string
  senderName: string
  x: number          // % from left
  expiresAt: number  // ms timestamp
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useMeetingStore = defineStore('meeting', () => {

  // ── Meeting state ─────────────────────────────────────────────────────────
  const meeting       = ref<Meeting | null>(null)
  const meetingId     = ref<string | null>(null)
  const isInMeeting   = ref(false)
  const isHost        = ref(false)
  const isCoHost      = ref(false)

  // NEW: waiting room state
  const isWaiting     = ref(false)   // true while in 'waiting' status

  // ── Local media ───────────────────────────────────────────────────────────
  const localStream     = ref<MediaStream | null>(null)
  const screenStream    = ref<MediaStream | null>(null)
  const isAudioMuted    = ref(false)
  const isVideoOff      = ref(false)
  const isScreenSharing = ref(false)
  const isHandRaised    = ref(false)
  const isSpeaking      = ref(false)

  // ── SFU ───────────────────────────────────────────────────────────────────
  const sfuSessionId    = ref('')
  let   pc: RTCPeerConnection | null = null
  const myAudioTrackName  = ref('')
  const myVideoTrackName  = ref('')
  const myScreenTrackName = ref('')
  const midMap = ref<Map<string, { uid: string; kind: 'audio' | 'video' }>>(new Map())
  const remotePulled = ref<Set<string>>(new Set())

  // ── Remote streams ────────────────────────────────────────────────────────
  const remoteStreams = ref<Map<string, RemoteStream>>(new Map())

  // ── Chat ──────────────────────────────────────────────────────────────────
  const chatMessages    = ref<MeetingChatMessage[]>([])
  const unreadChatCount = ref(0)
  const isChatOpen      = ref(false)

  // ── Reactions (NEW) ───────────────────────────────────────────────────────
  const floatingReactions = ref<FloatingReaction[]>([])
  let reactionCleanupInterval: ReturnType<typeof setInterval> | null = null

  // ── UI ────────────────────────────────────────────────────────────────────
  const layout                   = ref<'grid' | 'spotlight' | 'sidebar'>('grid')
  const spotlightUid             = ref<string | null>(null)
  const notifications            = ref<MeetingNotification[]>([])
  const screenReaderAnnouncement = ref('')
  const isSettingsPanelOpen      = ref(false)
  const isParticipantsPanelOpen  = ref(false)
  const handRaisedQueue          = ref<string[]>([])
  const isRecording              = ref(false)

  // Devices
  const audioInputs        = ref<MediaDeviceInfo[]>([])
  const audioOutputs       = ref<MediaDeviceInfo[]>([])
  const videoInputs        = ref<MediaDeviceInfo[]>([])
  const selectedAudioInput  = ref('')
  const selectedAudioOutput = ref('')
  const selectedVideoInput  = ref('')
  const playbackSpeed       = ref(1.0)

  // Recording
  let mediaRecorder: MediaRecorder | null = null
  let recordingChunks: BlobPart[] = []

  // Firestore unsubs
  let unsubMeeting:   (() => void) | null = null
  let unsubChat:      (() => void) | null = null
  let unsubReactions: (() => void) | null = null

  // Speaking detection
  let audioCtx: AudioContext | null = null
  let analyserNode: AnalyserNode | null = null
  let speakingInterval: ReturnType<typeof setInterval> | null = null

  // State debounce
  let stateFlushTimer: ReturnType<typeof setTimeout> | null = null

  // ── Computed ──────────────────────────────────────────────────────────────
  const activeParticipants = computed(() => {
    if (!meeting.value) return []
    return Object.values(meeting.value.participants).filter(p => p.status === 'joined')
  })

  const waitingParticipants = computed(() => {
    if (!meeting.value) return []
    return Object.values(meeting.value.participants).filter(p => p.status === 'waiting')
  })

  const myParticipant = computed<MeetingParticipant | null>(() => {
    const uid = auth.currentUser?.uid
    if (!uid || !meeting.value) return null
    return meeting.value.participants[uid] ?? null
  })

  const remoteStreamsArray = computed(() => Array.from(remoteStreams.value.values()))
  const canManageParticipants = computed(() => isHost.value || isCoHost.value)

  // ── Device enumeration ────────────────────────────────────────────────────
  async function enumerateDevices(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      audioInputs.value  = devices.filter(d => d.kind === 'audioinput')
      audioOutputs.value = devices.filter(d => d.kind === 'audiooutput')
      videoInputs.value  = devices.filter(d => d.kind === 'videoinput')
      if (!selectedAudioInput.value && audioInputs.value[0])
        selectedAudioInput.value = audioInputs.value[0].deviceId
      if (!selectedAudioOutput.value && audioOutputs.value[0])
        selectedAudioOutput.value = audioOutputs.value[0].deviceId
      if (!selectedVideoInput.value && videoInputs.value[0])
        selectedVideoInput.value = videoInputs.value[0].deviceId
    } catch (e) {
      console.warn('[SFU] Could not enumerate devices:', e)
    }
  }

  // ── Local media ───────────────────────────────────────────────────────────
  async function initLocalStream(audioEnabled: boolean, videoEnabled: boolean): Promise<void> {
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: selectedAudioInput.value ? { ideal: selectedAudioInput.value } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: videoEnabled
        ? {
            deviceId: selectedVideoInput.value ? { ideal: selectedVideoInput.value } : undefined,
            width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 },
          }
        : false,
    }
    try {
      localStream.value = await navigator.mediaDevices.getUserMedia(constraints)
    } catch {
      localStream.value = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      isVideoOff.value = true
      addNotification('Camera unavailable — joined with audio only', 'warning')
    }
    // Apply forced states (already decided by joinMeeting on the server)
    localStream.value.getAudioTracks().forEach(t => { t.enabled = audioEnabled })
    localStream.value.getVideoTracks().forEach(t => { t.enabled = videoEnabled })
    isAudioMuted.value = !audioEnabled
    isVideoOff.value   = !videoEnabled
    startSpeakingDetection(localStream.value)
  }

  function startSpeakingDetection(stream: MediaStream): void {
    try {
      audioCtx     = new AudioContext()
      const src    = audioCtx.createMediaStreamSource(stream)
      analyserNode = audioCtx.createAnalyser()
      analyserNode.fftSize = 512
      src.connect(analyserNode)
      const data   = new Uint8Array(analyserNode.frequencyBinCount)
      speakingInterval = setInterval(() => {
        if (!analyserNode) return
        analyserNode.getByteFrequencyData(data)
        const avg     = data.reduce((a, b) => a + b, 0) / data.length
        const speaking = avg > 15 && !isAudioMuted.value
        if (speaking !== isSpeaking.value) {
          isSpeaking.value = speaking
          scheduleStateFlush()
        }
      }, 300)
    } catch {}
  }

  // ── SFU helpers ───────────────────────────────────────────────────────────
  function createPeerConnection(): RTCPeerConnection {
    const newPc = new RTCPeerConnection({ iceServers: SFU_ICE_SERVERS })

    newPc.ontrack = (event) => {
      const mid  = event.transceiver.mid
      if (!mid) return
      const info = midMap.value.get(mid)
      if (!info) return
      updateOrCreateRemoteStream(info.uid, event.track, info.kind)
    }

    newPc.onconnectionstatechange = () => {
      if (newPc.connectionState === 'failed') {
        addNotification('SFU connection lost — reconnecting…', 'warning')
        setTimeout(() => republishTracks(), 3000)
      }
    }
    return newPc
  }

  function updateOrCreateRemoteStream(
    uid: string, track: MediaStreamTrack, kind: 'audio' | 'video'
  ): void {
    if (uid === auth.currentUser?.uid) return
    const existing = remoteStreams.value.get(uid)
    if (existing) {
      existing.stream.addTrack(track)
    } else {
      const stream      = new MediaStream([track])
      const participant = meeting.value?.participants[uid]
      remoteStreams.value.set(uid, {
        uid,
        stream: markRaw(stream),
        displayName: participant?.displayName ?? uid,
        photoURL:    participant?.photoURL    ?? null,
        isAudioMuted:    participant?.isAudioMuted    ?? false,
        isVideoOff:      participant?.isVideoOff      ?? false,
        isScreenSharing: participant?.isScreenSharing ?? false,
        isHandRaised:    participant?.isHandRaised    ?? false,
        isSpeaking:      participant?.isSpeaking      ?? false,
      })
    }
  }

  async function publishLocalTracks(): Promise<void> {
    if (!pc || !localStream.value || !sfuSessionId.value) return
    const uid = auth.currentUser?.uid
    if (!uid) return

    const tracksToAdd:   SfuTrackDescriptor[]  = []
    const transceivers:  RTCRtpTransceiver[]   = []

    const audioTrack = localStream.value.getAudioTracks()[0]
    if (audioTrack) {
      myAudioTrackName.value = `${uid}:audio`
      transceivers.push(pc.addTransceiver(audioTrack, { direction: 'sendonly' }))
    }

    const videoTrack = localStream.value.getVideoTracks()[0]
    if (videoTrack) {
      myVideoTrackName.value = `${uid}:video`
      transceivers.push(pc.addTransceiver(videoTrack, { direction: 'sendonly' }))
    }

    if (transceivers.length === 0) return

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await waitForIceGathering(pc)

    transceivers.forEach(tx => {
      const kind      = tx.sender.track?.kind
      const trackName = kind === 'audio' ? myAudioTrackName.value : myVideoTrackName.value
      if (trackName) tracksToAdd.push({ location: 'local', mid: tx.mid!, trackName })
    })

    const res = await sfuAddTracks(sfuSessionId.value, tracksToAdd, pc.localDescription!)

    if (res.tracks) {
      res.tracks.forEach(t => {
        const [u, k] = (t.trackName || '').split(':')
        if (u && k) midMap.value.set(t.mid, { uid: u, kind: k as 'audio' | 'video' })
      })
    }
    if (res.sessionDescription) {
      await pc.setRemoteDescription(res.sessionDescription as RTCSessionDescriptionInit)
    }
  }

  async function republishTracks(): Promise<void> {
    if (!sfuSessionId.value || !localStream.value) return
    await initSfuConnection()
  }

  async function pullRemoteTracks(remoteUid: string, remoteSessionId: string): Promise<void> {
    if (!pc || !sfuSessionId.value) return
    if (remotePulled.value.has(remoteUid)) return
    remotePulled.value.add(remoteUid)

    const tracksToAdd: SfuTrackDescriptor[] = [
      { location: 'remote', sessionId: remoteSessionId, trackName: `${remoteUid}:audio` },
      { location: 'remote', sessionId: remoteSessionId, trackName: `${remoteUid}:video` },
    ]

    const res = await sfuAddTracks(sfuSessionId.value, tracksToAdd)

    if (res.tracks) {
      res.tracks.forEach(t => {
        const [u, k] = (t.trackName || '').split(':')
        if (u && k) midMap.value.set(t.mid, { uid: u, kind: k as 'audio' | 'video' })
      })
    }

    if (res.requiresImmediateRenegotiation && res.sessionDescription) {
      await pc.setRemoteDescription(res.sessionDescription as RTCSessionDescriptionInit)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await waitForIceGathering(pc)
      await sfuRenegotiate(sfuSessionId.value, pc.localDescription!)
    }
  }

  async function initSfuConnection(): Promise<void> {
    if (pc) { pc.close(); pc = null }
    pc = createPeerConnection()
    const { sessionId } = await sfuCreateSession()
    sfuSessionId.value  = sessionId
    await publishLocalTracks()
  }

  // ── JOIN / LEAVE ──────────────────────────────────────────────────────────

  /**
   * joinCurrentMeeting
   *
   * 1. Writes participant to Firestore via joinMeeting() which enforces:
   *    - waitingRoom (→ status 'waiting')
   *    - muteOnEntry / videoOffOnEntry
   *    - allowParticipantAudio / allowParticipantVideo
   *
   * 2. Initialises local stream with the SERVER-decided muted/video state.
   *
   * 3. If status === 'waiting', sets isWaiting=true and watches for the host
   *    to admit via the meeting onSnapshot listener — only then starts SFU.
   *
   * 4. Returns { isWaiting } so PreJoinScreen can show a lobby UI.
   */
  async function joinCurrentMeeting(
    mId: string,
    mData: Meeting,
    audioOn: boolean,
    videoOn: boolean,
  ): Promise<{ isWaiting: boolean }> {
    const user = auth.currentUser
    if (!user) throw new Error('Not authenticated')

    meetingId.value  = mId
    meeting.value    = mData
    isHost.value     = mData.hostUid === user.uid
    isCoHost.value   = mData.participants[user.uid]?.role === 'co-host'
    remotePulled.value.clear()

    // Write to Firestore — server enforces constraints
    const { status, isAudioMuted: forcedMuted, isVideoOff: forcedVideo } =
      await joinMeeting(mId, {
        uid:          user.uid,
        displayName:  user.displayName ?? 'Attendee',
        photoURL:     user.photoURL,
        peerId:       sfuSessionId.value || `sc_${user.uid}`,
        isAudioMuted: !audioOn,
        isVideoOff:   !videoOn,
      })

    // Apply server-decided constraints to local tracks
    const effectiveAudio = !forcedMuted
    const effectiveVideo = !forcedVideo

    await initLocalStream(effectiveAudio, effectiveVideo)

    if (isHost.value && mData.status === 'scheduled') {
      await startMeeting(mId)
    }

    // Start meeting listener BEFORE returning so the store is live
    _startMeetingListener(mId, user.uid)

    if (status === 'waiting') {
      // Don't start SFU yet — wait for host to admit
      isWaiting.value  = true
      isInMeeting.value = true
      addNotification('Waiting for the host to admit you…', 'info')
      addScreenReaderAnnouncement('You are in the waiting room. Waiting for the host to admit you.')
      return { isWaiting: true }
    }

    // Admitted immediately
    isWaiting.value   = false
    isInMeeting.value = true
    await _finishJoining(mId, mData, user.uid)
    addScreenReaderAnnouncement(`You joined the meeting: ${mData.title}`)

    return { isWaiting: false }
  }

  /** Starts the Firestore meeting listener (roster + waiting room watcher) */
  function _startMeetingListener(mId: string, myUid: string): void {
    unsubMeeting = listenToMeeting(mId, updatedMeeting => {
      const prevParticipants = meeting.value?.participants || {}
      meeting.value = updatedMeeting

      // ── Waiting room: detect when THIS user is admitted ─────────────────
      if (isWaiting.value) {
        const me = updatedMeeting.participants[myUid]
        if (me?.status === 'joined') {
          isWaiting.value = false
          addNotification('You have been admitted to the meeting', 'success')
          addScreenReaderAnnouncement('The host admitted you. Joining the meeting now.')
          _finishJoining(mId, updatedMeeting, myUid)
        } else if (me?.status === 'denied') {
          isWaiting.value = false
          addNotification('The host declined your request to join', 'error')
          addScreenReaderAnnouncement('The host declined your request to join this meeting.')
          cleanup()
        }
        return // don't process rest of roster while still waiting
      }

      // ── Sync settings changes to local tracks ────────────────────────────
      const me = updatedMeeting.participants[myUid]
      if (me) {
        // Host toggled allowParticipantAudio → false → our canUnmuteSelf became false
        if (me.isAudioMuted !== isAudioMuted.value && me.isAudioMuted) {
          isAudioMuted.value = true
          localStream.value?.getAudioTracks().forEach(t => { t.enabled = false })
          addNotification('The host muted your microphone', 'warning')
        }
        if (!me.canUnmuteSelf && !isAudioMuted.value && !isHost.value) {
          isAudioMuted.value = true
          localStream.value?.getAudioTracks().forEach(t => { t.enabled = false })
        }
        // Host toggled allowParticipantVideo → false
        if (me.isVideoOff && !isVideoOff.value && !isHost.value) {
          isVideoOff.value = true
          localStream.value?.getVideoTracks().forEach(t => { t.enabled = false })
          addNotification('The host turned off your camera', 'warning')
        }
        // Hand lowered by host
        if (!me.isHandRaised && isHandRaised.value) {
          isHandRaised.value = false
          addNotification('The host lowered your hand', 'info')
        }
      }

      // ── Roster changes ───────────────────────────────────────────────────
      Object.values(updatedMeeting.participants).forEach(p => {
        const prevP = prevParticipants[p.uid]

        // Announce join / leave
        if (!prevP && p.status === 'joined')
          addScreenReaderAnnouncement(`${p.displayName} joined the meeting`)
        else if (prevP?.status === 'joined' && (p.status === 'left' || p.status === 'removed'))
          addScreenReaderAnnouncement(`${p.displayName} left the meeting`)

        if (p.uid === myUid) return

        // Sync remote stream display flags
        const rs = remoteStreams.value.get(p.uid)
        if (rs) {
          remoteStreams.value.set(p.uid, {
            ...rs,
            isAudioMuted:    p.isAudioMuted,
            isVideoOff:      p.isVideoOff,
            isScreenSharing: p.isScreenSharing,
            isHandRaised:    p.isHandRaised,
            isSpeaking:      p.isSpeaking,
          })
        }

        // Pull tracks for newly joined
        if (p.status === 'joined' && p.peerId && !remotePulled.value.has(p.uid)) {
          pullRemoteTracks(p.uid, p.peerId).catch(() => {})
        }

        // Remove streams for departed participants
        if ((p.status === 'left' || p.status === 'removed') && remoteStreams.value.has(p.uid)) {
          remotePulled.value.delete(p.uid)
          remoteStreams.value.delete(p.uid)
        }

        // Hand-raise queue
        if (p.isHandRaised && !handRaisedQueue.value.includes(p.uid))
          handRaisedQueue.value.push(p.uid)
        else if (!p.isHandRaised)
          handRaisedQueue.value = handRaisedQueue.value.filter(id => id !== p.uid)
      })

      // Pull tracks for participants already in the room
      Object.values(updatedMeeting.participants).forEach(p => {
        if (p.uid !== myUid && p.status === 'joined' && p.peerId && !remotePulled.value.has(p.uid))
          pullRemoteTracks(p.uid, p.peerId).catch(() => {})
      })
    })
  }

  /** Called once the user is definitively 'joined' (immediately or after admit) */
  async function _finishJoining(mId: string, mData: Meeting, myUid: string): Promise<void> {
    await initSfuConnection()

    // Pull tracks for already-present participants
    Object.values(mData.participants).forEach(p => {
      if (p.uid !== myUid && p.status === 'joined' && p.peerId)
        pullRemoteTracks(p.uid, p.peerId).catch(() => {})
    })

    // Start reaction listener
    _startReactionListener(mId)
  }

  // ── Reactions listener ────────────────────────────────────────────────────

  function _startReactionListener(mId: string): void {
    unsubReactions = listenToMeetingReactions(mId, (reactions) => {
      // Merge new reactions into floatingReactions, avoiding duplicates
      const existing = new Set(floatingReactions.value.map(r => r.id))
      reactions.forEach(r => {
        if (!existing.has(r.id)) {
          floatingReactions.value.push({
            id:         r.id,
            emoji:      r.emoji,
            senderName: r.senderName,
            x:          15 + Math.random() * 70, // % position
            expiresAt:  r.timestamp.toMillis() + 6000,
          })
        }
      })
    })

    // Clean up expired reactions every 2 s
    reactionCleanupInterval = setInterval(() => {
      const now = Date.now()
      floatingReactions.value = floatingReactions.value.filter(r => r.expiresAt > now)
    }, 2000)
  }

  // ── Leave ─────────────────────────────────────────────────────────────────

  async function leaveCurrentMeeting(): Promise<void> {
    const user = auth.currentUser
    const mId  = meetingId.value
    if (!mId || !user) return

    if (isHost.value) await endMeeting(mId)
    else               await leaveMeeting(mId, user.uid)
    cleanup()
  }

  function cleanup(): void {
    localStream.value?.getTracks().forEach(t => t.stop())
    screenStream.value?.getTracks().forEach(t => t.stop())
    localStream.value  = null
    screenStream.value = null

    if (pc) { pc.close(); pc = null }
    sfuSessionId.value = ''
    remotePulled.value.clear()
    remoteStreams.value.clear()
    midMap.value.clear()

    if (speakingInterval)        { clearInterval(speakingInterval); speakingInterval = null }
    if (audioCtx)                { audioCtx.close(); audioCtx = null }
    analyserNode = null

    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop()
    isRecording.value = false
    mediaRecorder     = null

    if (reactionCleanupInterval) { clearInterval(reactionCleanupInterval); reactionCleanupInterval = null }

    unsubMeeting?.();   unsubMeeting   = null
    unsubChat?.();      unsubChat      = null
    unsubReactions?.(); unsubReactions = null

    if (stateFlushTimer) { clearTimeout(stateFlushTimer); stateFlushTimer = null }

    isInMeeting.value   = false
    isWaiting.value     = false
    isHost.value        = false
    isCoHost.value      = false
    meeting.value       = null
    meetingId.value     = null
    chatMessages.value  = []
    unreadChatCount.value = 0
    isChatOpen.value    = false
    isHandRaised.value  = false
    isSpeaking.value    = false
    isScreenSharing.value = false
    handRaisedQueue.value = []
    notifications.value   = []
    floatingReactions.value = []
    myAudioTrackName.value  = ''
    myVideoTrackName.value  = ''
    myScreenTrackName.value = ''
  }

  // ── Audio / Video controls ────────────────────────────────────────────────

  function scheduleStateFlush(): void {
    if (stateFlushTimer) clearTimeout(stateFlushTimer)
    stateFlushTimer = setTimeout(flushStateToFirestore, 300)
  }

  async function flushStateToFirestore(): Promise<void> {
    const uid = auth.currentUser?.uid
    const mId = meetingId.value
    if (!uid || !mId || !isInMeeting.value || isWaiting.value) return
    await updateParticipantState(mId, uid, {
      isAudioMuted:    isAudioMuted.value,
      isVideoOff:      isVideoOff.value,
      isHandRaised:    isHandRaised.value,
      isScreenSharing: isScreenSharing.value,
      isSpeaking:      isSpeaking.value,
    })
  }

  function toggleAudio(): void {
    if (!localStream.value) return
    const me = myParticipant.value
    // If host disabled audio globally, canUnmuteSelf is false
    if (!isAudioMuted.value && me && !me.canUnmuteSelf && !isHost.value && !isCoHost.value) {
      addNotification('The host has disabled your microphone', 'warning')
      return
    }
    const newMuted = !isAudioMuted.value
    localStream.value.getAudioTracks().forEach(t => { t.enabled = !newMuted })
    isAudioMuted.value = newMuted
    scheduleStateFlush()
    addScreenReaderAnnouncement(newMuted ? 'Microphone off' : 'Microphone on')
  }

  function toggleVideo(): void {
    if (!localStream.value) return
    const me = myParticipant.value
    if (!isVideoOff.value && me && !meeting.value?.settings.allowParticipantVideo && !isHost.value && !isCoHost.value) {
      addNotification('The host has disabled participant video', 'warning')
      return
    }
    const newOff = !isVideoOff.value
    localStream.value.getVideoTracks().forEach(t => { t.enabled = !newOff })
    isVideoOff.value = newOff
    scheduleStateFlush()
    addScreenReaderAnnouncement(newOff ? 'Camera off' : 'Camera on')
  }

  async function toggleScreenShare(): Promise<void> {
    const me = myParticipant.value
    if (!isScreenSharing.value && me && !me.canShareScreen && !isHost.value) {
      addNotification('The host has disabled screen sharing', 'warning')
      return
    }
    if (!isScreenSharing.value) {
      try {
        const sStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: true })
        screenStream.value = markRaw(sStream)
        isScreenSharing.value = true
        scheduleStateFlush()
        const screenTrack = sStream.getVideoTracks()[0]
        if (pc && screenTrack) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video')
          if (sender) await sender.replaceTrack(screenTrack)
        }
        screenTrack.onended = () => stopScreenShareInternal()
        addNotification('Screen sharing started', 'info')
        addScreenReaderAnnouncement('You started sharing your screen')
      } catch {
        addNotification('Screen share cancelled', 'info')
      }
    } else {
      stopScreenShareInternal()
    }
  }

  function stopScreenShareInternal(): void {
    screenStream.value?.getTracks().forEach(t => t.stop())
    screenStream.value    = null
    isScreenSharing.value = false
    scheduleStateFlush()
    const camTrack = localStream.value?.getVideoTracks()[0]
    if (pc && camTrack) {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video')
      if (sender) sender.replaceTrack(camTrack).catch(() => {})
    }
    addNotification('Screen sharing stopped', 'info')
    addScreenReaderAnnouncement('You stopped sharing your screen')
  }

  async function switchAudioInput(deviceId: string): Promise<void> {
    selectedAudioInput.value = deviceId
    if (!localStream.value || !pc) return
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } })
      const newTrack = s.getAudioTracks()[0]
      const oldTrack = localStream.value.getAudioTracks()[0]
      if (oldTrack) { localStream.value.removeTrack(oldTrack); oldTrack.stop() }
      localStream.value.addTrack(newTrack)
      newTrack.enabled = !isAudioMuted.value
      const sender = pc.getSenders().find(s => s.track?.kind === 'audio')
      if (sender) await sender.replaceTrack(newTrack)
    } catch { addNotification('Could not switch microphone', 'error') }
  }

  async function switchVideoInput(deviceId: string): Promise<void> {
    selectedVideoInput.value = deviceId
    if (!localStream.value || !pc) return
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } })
      const newTrack = s.getVideoTracks()[0]
      const oldTrack = localStream.value.getVideoTracks()[0]
      if (oldTrack) { localStream.value.removeTrack(oldTrack); oldTrack.stop() }
      localStream.value.addTrack(newTrack)
      newTrack.enabled = !isVideoOff.value
      const sender = pc.getSenders().find(s => s.track?.kind === 'video')
      if (sender) await sender.replaceTrack(newTrack)
    } catch { addNotification('Could not switch camera', 'error') }
  }

  // ── Hand raise ────────────────────────────────────────────────────────────
  async function toggleHandRaise(): Promise<void> {
    isHandRaised.value = !isHandRaised.value
    scheduleStateFlush()
    if (isHandRaised.value) {
      addNotification('You raised your hand ✋', 'info')
      addScreenReaderAnnouncement('You raised your hand')
    } else {
      addScreenReaderAnnouncement('You lowered your hand')
    }
  }

  // ── Reactions (NEW) ───────────────────────────────────────────────────────

  /**
   * sendReaction — broadcasts an emoji to ALL participants via Firestore.
   * Replaces the old local-only floats.
   */
  async function sendReaction(emoji: string): Promise<void> {
    const user = auth.currentUser
    const mId  = meetingId.value
    if (!user || !mId) return

    const s = meeting.value?.settings
    if (s && !s.allowReactions && !isHost.value) {
      addNotification('Reactions are disabled by the host', 'warning')
      return
    }

    await broadcastReaction(
      mId,
      { uid: user.uid, displayName: user.displayName ?? 'Attendee' },
      emoji,
    )
  }

  // ── Host controls ─────────────────────────────────────────────────────────

  async function hostMute(targetUid: string): Promise<void> {
    const mId = meetingId.value
    if (!mId || !canManageParticipants.value) return
    await hostMuteParticipant(mId, targetUid, true)
    const p = meeting.value?.participants[targetUid]
    if (p) addScreenReaderAnnouncement(`You muted ${p.displayName}`)
  }

  async function hostRequestUnmute(_targetUid: string): Promise<void> {
    addNotification('Unmute request sent', 'info')
  }

  async function hostRemoveParticipant(targetUid: string): Promise<void> {
    const mId = meetingId.value
    if (!mId || !canManageParticipants.value) return
    const participant = meeting.value?.participants[targetUid]
    if (!participant) return
    await removeParticipant(mId, targetUid)
    addNotification(`${participant.displayName} removed`, 'info')
    addScreenReaderAnnouncement(`You removed ${participant.displayName} from the meeting`)
  }

  async function hostLowerHand(targetUid: string): Promise<void> {
    const mId = meetingId.value
    if (!mId || !canManageParticipants.value) return
    const p = meeting.value?.participants[targetUid]
    await updateParticipantState(mId, targetUid, { isHandRaised: false })
    if (p) addScreenReaderAnnouncement(`You lowered ${p.displayName}'s hand`)
  }

  async function hostMuteAll(): Promise<void> {
    const mId   = meetingId.value
    const myUid = auth.currentUser?.uid
    if (!mId || !canManageParticipants.value || !meeting.value) return
    const others = Object.values(meeting.value.participants)
      .filter(p => p.uid !== myUid && p.status === 'joined')
    for (const p of others) await hostMuteParticipant(mId, p.uid, true)
    addNotification('All participants muted', 'info')
    addScreenReaderAnnouncement('You muted everyone in the meeting')
  }

  async function hostSetPermission(
    targetUid: string,
    permission: 'canUnmuteSelf' | 'canShareScreen' | 'canChat',
    value: boolean,
  ): Promise<void> {
    const mId = meetingId.value
    if (!mId || !canManageParticipants.value) return
    await hostSetParticipantPermission(mId, targetUid, permission, value)
  }

  async function hostPromote(targetUid: string): Promise<void> {
    const mId = meetingId.value
    if (!mId || !isHost.value) return
    const p = meeting.value?.participants[targetUid]
    await promoteToCoHost(mId, targetUid)
    if (p) addScreenReaderAnnouncement(`You promoted ${p.displayName} to co-host`)
  }

  async function hostDemote(targetUid: string): Promise<void> {
    const mId = meetingId.value
    if (!mId || !isHost.value) return
    const p = meeting.value?.participants[targetUid]
    await demoteFromCoHost(mId, targetUid)
    if (p) addScreenReaderAnnouncement(`You demoted ${p.displayName} from co-host`)
  }

  /**
   * hostUpdateSettings — updates a setting AND propagates it to all participants.
   *
   * This is the key new behaviour: toggling allowParticipantAudio immediately
   * mutes every attendee and sets canUnmuteSelf=false on their doc, which in turn
   * triggers the onSnapshot listener in every client to mute their local track.
   */
  async function hostUpdateSettings(settings: Partial<MeetingSettings>): Promise<void> {
    const mId = meetingId.value
    if (!mId || !canManageParticipants.value) return

    for (const [key, value] of Object.entries(settings)) {
      await propagateSettingToParticipants(
        mId,
        key as keyof MeetingSettings,
        value as boolean | number,
      )
    }
  }

  // ── Waiting room controls (host) ──────────────────────────────────────────

  async function admitWaitingParticipant(targetUid: string): Promise<void> {
    const mId = meetingId.value
    if (!mId || !canManageParticipants.value) return
    const p = meeting.value?.participants[targetUid]
    await admitParticipant(mId, targetUid)
    if (p) {
      addNotification(`${p.displayName} admitted`, 'success')
      addScreenReaderAnnouncement(`${p.displayName} has been admitted to the meeting`)
    }
  }

  async function denyWaitingParticipant(targetUid: string): Promise<void> {
    const mId = meetingId.value
    if (!mId || !canManageParticipants.value) return
    const p = meeting.value?.participants[targetUid]
    await denyParticipant(mId, targetUid)
    if (p) {
      addNotification(`${p.displayName} denied`, 'warning')
      addScreenReaderAnnouncement(`${p.displayName} was denied entry`)
    }
  }

  // ── Display name ─────────────────────────────────────────────────────────
  async function updateMyDisplayName(name: string): Promise<void> {
    const uid = auth.currentUser?.uid
    const mId = meetingId.value
    if (!uid || !mId || !name.trim()) return
    await updateParticipantProfile(mId, uid, { displayName: name.trim() })
    addNotification('Display name updated', 'success')
    addScreenReaderAnnouncement(`Display name updated to ${name}`)
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  function openChat(): void {
    isChatOpen.value      = true
    unreadChatCount.value = 0
    if (!unsubChat && meetingId.value) {
      unsubChat = listenToMeetingChat(meetingId.value, msgs => {
        const prev = chatMessages.value.length
        chatMessages.value = msgs
        if (!isChatOpen.value && msgs.length > prev) unreadChatCount.value += msgs.length - prev
      })
    }
  }
  function closeChat(): void { isChatOpen.value = false }

  async function sendChat(content: string): Promise<void> {
    const user = auth.currentUser
    const mId  = meetingId.value
    if (!user || !mId || !content.trim()) return
    const me = myParticipant.value
    if (me && !me.canChat && !isHost.value) {
      addNotification('Chat is disabled by the host', 'warning')
      return
    }
    await sendMeetingChatMessage(
      mId,
      { uid: user.uid, displayName: user.displayName ?? 'Attendee', photoURL: user.photoURL },
      content.trim(),
    )
  }

  // ── Recording ─────────────────────────────────────────────────────────────
  async function toggleRecording(): Promise<void> {
    if (!isRecording.value) {
      try {
        const streams: MediaStream[] = []
        if (localStream.value) streams.push(localStream.value)
        remoteStreams.value.forEach(rs => streams.push(rs.stream))
        const combined = new MediaStream()
        streams.forEach(s => s.getTracks().forEach(t => combined.addTrack(t)))
        recordingChunks = []
        mediaRecorder = new MediaRecorder(combined, { mimeType: 'video/webm;codecs=vp9,opus' })
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordingChunks.push(e.data) }
        mediaRecorder.onstop = () => {
          const blob = new Blob(recordingChunks, { type: 'video/webm' })
          const url  = URL.createObjectURL(blob)
          const a    = document.createElement('a')
          a.href = url
          a.download = `meeting-${meetingId.value}-${Date.now()}.webm`
          a.click()
          URL.revokeObjectURL(url)
        }
        mediaRecorder.start(1000)
        isRecording.value = true
        addNotification('Recording started', 'info')
      } catch { addNotification('Could not start recording', 'error') }
    } else {
      mediaRecorder?.stop()
      isRecording.value = false
      addNotification('Recording saved', 'success')
    }
  }

  // ── Layout ────────────────────────────────────────────────────────────────
  function setLayout(l: 'grid' | 'spotlight' | 'sidebar'): void { layout.value = l }
  function setSpotlight(uid: string | null): void {
    spotlightUid.value = uid
    if (uid) layout.value = 'spotlight'
  }

  // ── Notifications & announcements ─────────────────────────────────────────
  function addNotification(message: string, type: MeetingNotification['type'] = 'info'): void {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 5)
    notifications.value.push({ id, message, type })
    setTimeout(() => { notifications.value = notifications.value.filter(n => n.id !== id) }, 4000)
  }

  function addScreenReaderAnnouncement(message: string): void {
    screenReaderAnnouncement.value = ''
    nextTick(() => { screenReaderAnnouncement.value = message })
  }

  // ── ICE gathering ─────────────────────────────────────────────────────────
  async function waitForIceGathering(peerConn: RTCPeerConnection, timeoutMs = 4000): Promise<void> {
    if (peerConn.iceGatheringState === 'complete') return
    return new Promise<void>(resolve => {
      const timer = setTimeout(resolve, timeoutMs)
      peerConn.addEventListener('icegatheringstatechange', function handler() {
        if (peerConn.iceGatheringState === 'complete') {
          clearTimeout(timer)
          peerConn.removeEventListener('icegatheringstatechange', handler)
          resolve()
        }
      })
    })
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    // State
    meeting, meetingId, isInMeeting, isWaiting, isHost, isCoHost,
    localStream, screenStream, isAudioMuted, isVideoOff,
    isScreenSharing, isHandRaised, isSpeaking,
    remoteStreams, remoteStreamsArray,
    chatMessages, unreadChatCount, isChatOpen,
    floatingReactions,   // NEW
    layout, spotlightUid, notifications, screenReaderAnnouncement,
    isSettingsPanelOpen, isParticipantsPanelOpen,
    handRaisedQueue, isRecording,
    audioInputs, audioOutputs, videoInputs,
    selectedAudioInput, selectedAudioOutput, selectedVideoInput,
    playbackSpeed,
    // Computed
    activeParticipants, waitingParticipants, myParticipant, canManageParticipants,
    // Methods
    enumerateDevices,
    initLocalStream,
    joinCurrentMeeting,
    leaveCurrentMeeting,
    cleanup,
    toggleAudio, toggleVideo, toggleScreenShare,
    switchAudioInput, switchVideoInput,
    toggleHandRaise,
    sendReaction,         // NEW
    admitWaitingParticipant,  // NEW
    denyWaitingParticipant,   // NEW
    hostMute, hostRequestUnmute, hostRemoveParticipant,
    hostLowerHand, hostMuteAll,
    hostSetPermission, hostPromote, hostDemote, hostUpdateSettings,
    updateMyDisplayName,
    openChat, closeChat, sendChat,
    toggleRecording,
    setLayout, setSpotlight,
    addNotification, addScreenReaderAnnouncement,
  }
})
