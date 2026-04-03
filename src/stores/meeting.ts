// src/stores/meeting.ts
// ─────────────────────────────────────────────────────────────────────────────
// Soft Connect — Meeting Store (Cloudflare Realtime SFU edition)
//
// Media (audio + video):   Cloudflare Realtime SFU (WebRTC, 1 PeerConnection per client)
// Control state (rapid):   Firestore updateDoc (mute/video/hand/speaking/screenShare)
//                          — batched with 300 ms debounce to minimise writes
// Chat + roster + presence: Firestore onSnapshot (opened only when panel is open,
//                            roster always open while in-meeting)
// ─────────────────────────────────────────────────────────────────────────────

import { defineStore } from 'pinia'
import { ref, computed, markRaw, nextTick } from 'vue'
import {
  sfuCreateSession,
  sfuAddTracks,
  sfuRenegotiate,
  sfuCloseTracks,
  SFU_ICE_SERVERS,
  type SfuTrackDescriptor,
  type SfuTracksResponse,
} from '../services/cloudflare-sfu'
import {
  joinMeeting,
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
  sendMeetingChatMessage,
  listenToMeeting,
  listenToMeetingChat,
  type Meeting,
  type MeetingParticipant,
  type MeetingChatMessage,
  type MeetingSettings,
} from '../services/meetings'
import { auth } from '../services/firebase'

// ── Types ────────────────────────────────────────────────────────────────────

export interface RemoteStream {
  uid: string
  stream: MediaStream
  displayName: string
  photoURL: string | null
  // These mirror Firestore participant state (updated via onSnapshot)
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

// ── Store ─────────────────────────────────────────────────────────────────────

export const useMeetingStore = defineStore('meeting', () => {

  // ── Persistent meeting state ───────────────────────────────────────────────
  const meeting       = ref<Meeting | null>(null)
  const meetingId     = ref<string | null>(null)
  const isInMeeting   = ref(false)
  const isHost        = ref(false)
  const isCoHost      = ref(false)

  // ── Local media state ──────────────────────────────────────────────────────
  const localStream     = ref<MediaStream | null>(null)
  const screenStream    = ref<MediaStream | null>(null)
  const isAudioMuted    = ref(false)
  const isVideoOff      = ref(false)
  const isScreenSharing = ref(false)
  const isHandRaised    = ref(false)
  const isSpeaking      = ref(false)

  // ── SFU PeerConnection ────────────────────────────────────────────────────
  const sfuSessionId = ref<string>('')
  let   pc: RTCPeerConnection | null = null

  // published track names (used to pull remote tracks later)
  const myAudioTrackName = ref('')
  const myVideoTrackName = ref('')
  const myScreenTrackName = ref('')

  // map: mid -> { uid, kind }
  const midMap = ref<Map<string, { uid: string, kind: 'audio' | 'video' }>>(new Map())

  // map: uid → { audioTrackName, videoTrackName }

  // Written to Firestore participant doc so peers know what to pull
  // Read from Firestore participant docs of other users
  const remotePulled = ref<Set<string>>(new Set()) // uids we have pulled tracks for

  // ── Remote streams ────────────────────────────────────────────────────────
  const remoteStreams = ref<Map<string, RemoteStream>>(new Map())

  // ── Chat ──────────────────────────────────────────────────────────────────
  const chatMessages    = ref<MeetingChatMessage[]>([])
  const unreadChatCount = ref(0)
  const isChatOpen      = ref(false)

  // ── UI state ──────────────────────────────────────────────────────────────
  const layout                  = ref<'grid' | 'spotlight' | 'sidebar'>('grid')
  const spotlightUid            = ref<string | null>(null)
  const notifications           = ref<MeetingNotification[]>([])
  const screenReaderAnnouncement = ref('')
  const isSettingsPanelOpen     = ref(false)
  const isParticipantsPanelOpen = ref(false)
  const handRaisedQueue         = ref<string[]>([])
  const isRecording             = ref(false)

  // Devices
  const audioInputs       = ref<MediaDeviceInfo[]>([])
  const audioOutputs      = ref<MediaDeviceInfo[]>([])
  const videoInputs       = ref<MediaDeviceInfo[]>([])
  const selectedAudioInput  = ref('')
  const selectedAudioOutput = ref('')
  const selectedVideoInput  = ref('')
  const playbackSpeed       = ref(1.0)

  // ── Recording ─────────────────────────────────────────────────────────────
  let mediaRecorder: MediaRecorder | null = null
  let recordingChunks: BlobPart[] = []

  // ── Firestore unsubs ──────────────────────────────────────────────────────
  let unsubMeeting: (() => void) | null = null
  let unsubChat:    (() => void) | null = null

  // ── Speaking detection ────────────────────────────────────────────────────
  let audioCtx: AudioContext | null = null
  let analyserNode: AnalyserNode | null = null
  let speakingInterval: ReturnType<typeof setInterval> | null = null

  // ── State debounce timer ──────────────────────────────────────────────────
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

  // ── Local media init ──────────────────────────────────────────────────────
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
      // Fallback: audio only
      localStream.value = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      isVideoOff.value = true
      addNotification('Camera unavailable — joined with audio only', 'warning')
    }
    localStream.value.getAudioTracks().forEach(t => { t.enabled = audioEnabled })
    localStream.value.getVideoTracks().forEach(t => { t.enabled = videoEnabled })
    isAudioMuted.value = !audioEnabled
    isVideoOff.value   = !videoEnabled
    startSpeakingDetection(localStream.value)
  }

  function startSpeakingDetection(stream: MediaStream): void {
    try {
      audioCtx = new AudioContext()
      const src = audioCtx.createMediaStreamSource(stream)
      analyserNode = audioCtx.createAnalyser()
      analyserNode.fftSize = 512
      src.connect(analyserNode)
      const data = new Uint8Array(analyserNode.frequencyBinCount)
      speakingInterval = setInterval(() => {
        if (!analyserNode) return
        analyserNode.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        const speaking = avg > 15 && !isAudioMuted.value
        if (speaking !== isSpeaking.value) {
          isSpeaking.value = speaking
          scheduleStateFlush()
        }
      }, 300)
    } catch {}
  }

  // ── SFU PeerConnection setup ──────────────────────────────────────────────

  function createPeerConnection(): RTCPeerConnection {
    const newPc = new RTCPeerConnection({ iceServers: SFU_ICE_SERVERS })

    // Gather all remote tracks into per-uid MediaStreams
    newPc.ontrack = (event) => {
      const mid = event.transceiver.mid
      if (!mid) return
      
      const info = midMap.value.get(mid)
      if (!info) {
        console.warn('[SFU] ontrack: No midMap info for MID', mid)
        return
      }

      updateOrCreateRemoteStream(info.uid, event.track, info.kind)
    }

    newPc.onicecandidate = () => {
      // ICE candidates are handled transparently by Cloudflare (no trickle needed)
    }

    newPc.onconnectionstatechange = () => {
      if (newPc.connectionState === 'failed') {
        addNotification('SFU connection lost — attempting to reconnect…', 'warning')
        // Simple reconnect: re-publish tracks
        setTimeout(() => republishTracks(), 3000)
      }
    }

    return newPc
  }

  function updateOrCreateRemoteStream(uid: string, track: MediaStreamTrack, kind: 'audio' | 'video'): void {
    if (uid === auth.currentUser?.uid) return // skip own tracks echoed back
    const existing = remoteStreams.value.get(uid)
    if (existing) {
      existing.stream.addTrack(track)
    } else {
      const stream = new MediaStream([track])
      const participant = meeting.value?.participants[uid]
      remoteStreams.value.set(uid, {
        uid,
        stream: markRaw(stream),
        displayName: participant?.displayName ?? uid,
        photoURL: participant?.photoURL ?? null,
        isAudioMuted: participant?.isAudioMuted ?? false,
        isVideoOff:   participant?.isVideoOff ?? false,
        isScreenSharing: participant?.isScreenSharing ?? false,
        isHandRaised: participant?.isHandRaised ?? false,
        isSpeaking:   participant?.isSpeaking ?? false,
      })
    }
  }

  // ── Publish local tracks to SFU ───────────────────────────────────────────

  async function publishLocalTracks(): Promise<void> {
    if (!pc || !localStream.value || !sfuSessionId.value) return
    const uid = auth.currentUser?.uid
    if (!uid) return

    const tracksToAdd: SfuTrackDescriptor[] = []
    const transceivers: RTCRtpTransceiver[] = []

    // Audio track
    const audioTrack = localStream.value.getAudioTracks()[0]
    if (audioTrack) {
      const audioTrackName = `${uid}:audio`
      myAudioTrackName.value = audioTrackName
      const tx = pc.addTransceiver(audioTrack, { direction: 'sendonly' })
      transceivers.push(tx)
    }

    // Video track
    const videoTrack = localStream.value.getVideoTracks()[0]
    if (videoTrack) {
      const videoTrackName = `${uid}:video`
      myVideoTrackName.value = videoTrackName
      const tx = pc.addTransceiver(videoTrack, { direction: 'sendonly' })
      transceivers.push(tx)
    }

    if (transceivers.length === 0) return

    // Create offer
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    // Wait for ICE gathering
    await waitForIceGathering(pc)

    // NOW capture MIDs (they are assigned after setLocalDescription)
    transceivers.forEach(tx => {
      const kind = tx.sender.track?.kind
      const trackName = kind === 'audio' ? myAudioTrackName.value : myVideoTrackName.value
      if (trackName) {
        tracksToAdd.push({
          location: 'local',
          mid: tx.mid!,
          trackName
        })
      }
    })

    const res = await sfuAddTracks(
      sfuSessionId.value,
      tracksToAdd,
      pc.localDescription!,
    )

    if (res.tracks) {
      res.tracks.forEach(t => {
        const [uid, kind] = (t.trackName || '').split(':')
        if (uid && kind) {
          midMap.value.set(t.mid, { uid, kind: kind as 'audio' | 'video' })
        }
      })
    }

    if (res.sessionDescription) {
      await pc.setRemoteDescription(res.sessionDescription as RTCSessionDescriptionInit)
    }
  }

  async function republishTracks(): Promise<void> {
    if (!sfuSessionId.value || !localStream.value) return
    // Just close and re-init full connection on failure
    await initSfuConnection()
  }

  // ── Pull remote tracks from SFU ───────────────────────────────────────────

  async function pullRemoteTracks(remoteUid: string, remoteSessionId: string): Promise<void> {
    if (!pc || !sfuSessionId.value) return
    if (remotePulled.value.has(remoteUid)) return
    remotePulled.value.add(remoteUid)

    const tracksToAdd: SfuTrackDescriptor[] = [
      { location: 'remote', sessionId: remoteSessionId, trackName: `${remoteUid}:audio` },
      { location: 'remote', sessionId: remoteSessionId, trackName: `${remoteUid}:video` },
    ]

    const res = await sfuAddTracks(sfuSessionId.value, tracksToAdd)

    // Populate midMap so ontrack can identify these tracks
    if (res.tracks) {
      res.tracks.forEach(t => {
        const [uid, kind] = (t.trackName || '').split(':')
        if (uid && kind) {
          midMap.value.set(t.mid, { uid, kind: kind as 'audio' | 'video' })
        }
      })
    }

    if (res.requiresImmediateRenegotiation && res.sessionDescription) {
      // SFU sent an offer — set it and reply with answer
      await pc.setRemoteDescription(res.sessionDescription as RTCSessionDescriptionInit)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await waitForIceGathering(pc)
      await sfuRenegotiate(sfuSessionId.value, pc.localDescription!)
    }
  }

  // ── Init full SFU connection ──────────────────────────────────────────────

  async function initSfuConnection(): Promise<void> {
    if (pc) {
      pc.close()
      pc = null
    }
    pc = createPeerConnection()

    // Create session on Cloudflare
    const { sessionId } = await sfuCreateSession()
    sfuSessionId.value = sessionId

    // Publish our tracks
    await publishLocalTracks()
  }

  // ── Join/Leave ────────────────────────────────────────────────────────────

  async function joinCurrentMeeting(
    mId: string,
    mData: Meeting,
    audioOn: boolean,
    videoOn: boolean,
  ): Promise<void> {
    const user = auth.currentUser
    if (!user) throw new Error('Not authenticated')

    meetingId.value = mId
    meeting.value   = mData
    isHost.value    = mData.hostUid === user.uid
    isCoHost.value  = mData.participants[user.uid]?.role === 'co-host'
    remotePulled.value.clear()

    // Init local media
    await initLocalStream(audioOn, videoOn)

    // Init SFU connection (creates session + publishes local tracks)
    await initSfuConnection()

    // Update Firestore: mark as joined + store our SFU sessionId so others can pull
    await joinMeeting(mId, {
      uid: user.uid,
      displayName: user.displayName ?? 'Attendee',
      photoURL: user.photoURL,
      peerId: sfuSessionId.value,   // reusing peerId field for SFU sessionId
      isAudioMuted: !audioOn,
      isVideoOff: !videoOn,
    })

    if (isHost.value && mData.status === 'scheduled') {
      await startMeeting(mId)
    }

    isInMeeting.value = true

    // Listen to meeting document for participant roster changes
    unsubMeeting = listenToMeeting(mId, updatedMeeting => {
      const prevParticipants = meeting.value?.participants || {}
      meeting.value = updatedMeeting

      const myUid = auth.currentUser?.uid
      if (!myUid) return

      Object.values(updatedMeeting.participants).forEach(p => {
        // Announce join/leave
        const prevP = prevParticipants[p.uid]
        if (!prevP && p.status === 'joined') {
          addScreenReaderAnnouncement(`${p.displayName} joined the meeting`)
        } else if (prevP?.status === 'joined' && (p.status === 'left' || p.status === 'removed')) {
          addScreenReaderAnnouncement(`${p.displayName} left the meeting`)
        }

        if (p.uid === myUid) {
          // Sync local state if changed by host (e.g. host lower hand, host mute)
          if (p.isHandRaised !== isHandRaised.value) {
            isHandRaised.value = p.isHandRaised
            if (!p.isHandRaised) addNotification('The host lowered your hand', 'info')
          }
          if (p.isAudioMuted !== isAudioMuted.value) {
            isAudioMuted.value = p.isAudioMuted
            if (localStream.value) {
              localStream.value.getAudioTracks().forEach(t => t.enabled = !p.isAudioMuted)
            }
            if (p.isAudioMuted) addNotification('The host muted you', 'warning')
          }
          return
        }

        // Sync remote stream display state from Firestore
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

        // Pull tracks for newly joined participants
        if (p.status === 'joined' && p.peerId && !remotePulled.value.has(p.uid)) {
          pullRemoteTracks(p.uid, p.peerId).catch(e =>
            console.warn('[SFU] pullRemoteTracks failed for', p.uid, e)
          )
        }

        // Remove stream for participants that left
        if ((p.status === 'left' || p.status === 'removed') && remoteStreams.value.has(p.uid)) {
          remotePulled.value.delete(p.uid)
          remoteStreams.value.delete(p.uid)
        }

        // Hand-raise queue
        if (p.isHandRaised && !handRaisedQueue.value.includes(p.uid)) {
          handRaisedQueue.value.push(p.uid)
        } else if (!p.isHandRaised) {
          handRaisedQueue.value = handRaisedQueue.value.filter(id => id !== p.uid)
        }
      })

      // Pull tracks for already-joined participants we haven't pulled yet
      // (handles the case where we joined after others)
      Object.values(updatedMeeting.participants).forEach(p => {
        if (p.uid !== myUid && p.status === 'joined' && p.peerId && !remotePulled.value.has(p.uid)) {
          pullRemoteTracks(p.uid, p.peerId).catch(() => {})
        }
      })
    })

    // Also pull tracks for participants already in the meeting
    Object.values(mData.participants).forEach(p => {
      const myUid = user.uid
      if (p.uid !== myUid && p.status === 'joined' && p.peerId) {
        pullRemoteTracks(p.uid, p.peerId).catch(() => {})
      }
    })
  }

  async function leaveCurrentMeeting(): Promise<void> {
    const user = auth.currentUser
    const mId  = meetingId.value
    if (!mId || !user) return

    if (isHost.value) {
      await endMeeting(mId)
    } else {
      await leaveMeeting(mId, user.uid)
    }
    cleanup()
  }

  function cleanup(): void {
    // Stop local streams
    localStream.value?.getTracks().forEach(t => t.stop())
    screenStream.value?.getTracks().forEach(t => t.stop())
    localStream.value  = null
    screenStream.value = null

    // Close PeerConnection
    if (pc) { pc.close(); pc = null }
    sfuSessionId.value = ''
    remotePulled.value.clear()
    remoteStreams.value.clear()
    midMap.value.clear()

    // Stop speaking detection
    if (speakingInterval) { clearInterval(speakingInterval); speakingInterval = null }
    if (audioCtx) { audioCtx.close(); audioCtx = null }
    analyserNode = null

    // Stop recording
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop()
    isRecording.value = false
    mediaRecorder = null

    // Unsub Firestore
    unsubMeeting?.(); unsubMeeting = null
    unsubChat?.();    unsubChat    = null

    // Clear pending flush
    if (stateFlushTimer) { clearTimeout(stateFlushTimer); stateFlushTimer = null }

    // Reset state
    isInMeeting.value   = false
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
    notifications.value = []
    myAudioTrackName.value = ''
    myVideoTrackName.value = ''
    myScreenTrackName.value = ''
  }

  // ── Audio/Video Controls ──────────────────────────────────────────────────

  /** Debounced flush: only write to Firestore after 300 ms of inactivity */
  function scheduleStateFlush(): void {
    if (stateFlushTimer) clearTimeout(stateFlushTimer)
    stateFlushTimer = setTimeout(flushStateToFirestore, 300)
  }

  async function flushStateToFirestore(): Promise<void> {
    const uid = auth.currentUser?.uid
    const mId = meetingId.value
    if (!uid || !mId || !isInMeeting.value) return
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
    if (!isAudioMuted.value && myParticipant.value && !myParticipant.value.canUnmuteSelf && !isHost.value) {
      addNotification('The host has disabled your microphone', 'warning')
      return
    }
    const newMuted = !isAudioMuted.value
    localStream.value.getAudioTracks().forEach(t => { t.enabled = !newMuted })
    isAudioMuted.value = newMuted
    scheduleStateFlush()
  }

  function toggleVideo(): void {
    if (!localStream.value) return
    if (!isVideoOff.value && !meeting.value?.settings.allowParticipantVideo && !isHost.value) {
      addNotification('The host has disabled participant video', 'warning')
      return
    }
    const newOff = !isVideoOff.value
    localStream.value.getVideoTracks().forEach(t => { t.enabled = !newOff })
    isVideoOff.value = newOff
    scheduleStateFlush()
  }

  async function toggleScreenShare(): Promise<void> {
    if (!meeting.value?.settings.allowScreenShare && !isHost.value) {
      addNotification('The host has disabled screen sharing', 'warning')
      return
    }
    if (!isScreenSharing.value) {
      try {
        const sStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: true,
        })
        screenStream.value = markRaw(sStream)
        isScreenSharing.value = true
        scheduleStateFlush()

        // Replace video transceiver track in PeerConnection
        const screenTrack = sStream.getVideoTracks()[0]
        if (pc && screenTrack) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video')
          if (sender) await sender.replaceTrack(screenTrack)
        }

        screenTrack.onended = () => stopScreenShareInternal()
        addNotification('Screen sharing started', 'info')
      } catch {
        addNotification('Screen share cancelled', 'info')
      }
    } else {
      stopScreenShareInternal()
    }
  }

  function stopScreenShareInternal(): void {
    screenStream.value?.getTracks().forEach(t => t.stop())
    screenStream.value = null
    isScreenSharing.value = false
    scheduleStateFlush()

    // Restore camera track
    const camTrack = localStream.value?.getVideoTracks()[0]
    if (pc && camTrack) {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video')
      if (sender) sender.replaceTrack(camTrack).catch(() => {})
    }
    addNotification('Screen sharing stopped', 'info')
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
    } catch {
      addNotification('Could not switch microphone', 'error')
    }
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
    } catch {
      addNotification('Could not switch camera', 'error')
    }
  }

  // ── Hand raise ────────────────────────────────────────────────────────────

  async function toggleHandRaise(): Promise<void> {
    isHandRaised.value = !isHandRaised.value
    scheduleStateFlush()
    if (isHandRaised.value) addNotification('You raised your hand ✋', 'info')
  }

  // ── Host controls ─────────────────────────────────────────────────────────

  async function hostMute(targetUid: string): Promise<void> {
    const mId = meetingId.value
    if (!mId || !canManageParticipants.value) return
    await hostMuteParticipant(mId, targetUid, true)
    addNotification('Participant muted', 'info')
  }

  async function hostRequestUnmute(targetUid: string): Promise<void> {
    addNotification('Unmute request sent', 'info')
    // Signalling via Firestore: host sets a temporary field; participant's onSnapshot picks it up
    // (simpler than a dedicated channel — this is an infrequent action)
  }

  async function hostRemoveParticipant(targetUid: string): Promise<void> {
    const mId = meetingId.value
    if (!mId || !canManageParticipants.value) return
    const participant = meeting.value?.participants[targetUid]
    if (!participant) return
    await removeParticipant(mId, targetUid)
    addNotification(`${participant.displayName} removed`, 'info')
  }

  async function hostLowerHand(targetUid: string): Promise<void> {
    const mId = meetingId.value
    if (!mId || !canManageParticipants.value) return
    await updateParticipantState(mId, targetUid, { isHandRaised: false })
  }

  async function hostMuteAll(): Promise<void> {
    const mId = meetingId.value
    const myUid = auth.currentUser?.uid
    if (!mId || !canManageParticipants.value || !meeting.value) return
    const others = Object.values(meeting.value.participants)
      .filter(p => p.uid !== myUid && p.status === 'joined')
    for (const p of others) {
      await hostMuteParticipant(mId, p.uid, true)
    }
    addNotification('All participants muted', 'info')
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
    await promoteToCoHost(mId, targetUid)
  }

  async function hostDemote(targetUid: string): Promise<void> {
    const mId = meetingId.value
    if (!mId || !isHost.value) return
    await demoteFromCoHost(mId, targetUid)
  }

  async function hostUpdateSettings(settings: Partial<MeetingSettings>): Promise<void> {
    const mId = meetingId.value
    if (!mId || !canManageParticipants.value) return
    await updateMeetingSettings(mId, settings)
  }

  // ── Chat ──────────────────────────────────────────────────────────────────

  function openChat(): void {
    isChatOpen.value = true
    unreadChatCount.value = 0
    // Lazy-open Firestore chat listener only when panel is opened
    if (!unsubChat && meetingId.value) {
      unsubChat = listenToMeetingChat(meetingId.value, msgs => {
        const prev = chatMessages.value.length
        chatMessages.value = msgs
        if (!isChatOpen.value && msgs.length > prev) {
          unreadChatCount.value += msgs.length - prev
        }
      })
    }
  }

  function closeChat(): void {
    isChatOpen.value = false
    // Keep listener open so unread count increments while closed
  }

  async function sendChat(content: string): Promise<void> {
    const user = auth.currentUser
    const mId  = meetingId.value
    if (!user || !mId || !content.trim()) return
    if (!meeting.value?.settings.allowChat && !isHost.value) {
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
      } catch {
        addNotification('Could not start recording', 'error')
      }
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

  // ── Notifications ─────────────────────────────────────────────────────────
  function addNotification(message: string, type: MeetingNotification['type'] = 'info'): void {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 5)
    notifications.value.push({ id, message, type })
    setTimeout(() => { notifications.value = notifications.value.filter(n => n.id !== id) }, 4000)
  }

  function addScreenReaderAnnouncement(message: string): void {
    screenReaderAnnouncement.value = ''
    nextTick(() => { screenReaderAnnouncement.value = message })
  }

  // ── ICE-gathering helper ──────────────────────────────────────────────────
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
    meeting, meetingId, isInMeeting, isHost, isCoHost,
    localStream, screenStream, isAudioMuted, isVideoOff,
    isScreenSharing, isHandRaised, isSpeaking,
    remoteStreams, remoteStreamsArray,
    chatMessages, unreadChatCount, isChatOpen,
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
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    switchAudioInput,
    switchVideoInput,
    toggleHandRaise,
    hostMute, hostRequestUnmute, hostRemoveParticipant,
    hostLowerHand, hostMuteAll,
    hostSetPermission, hostPromote, hostDemote, hostUpdateSettings,
    openChat, closeChat, sendChat,
    toggleRecording,
    setLayout, setSpotlight,
    addNotification, addScreenReaderAnnouncement,
  }
})
