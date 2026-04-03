// src/stores/meeting.ts
import { defineStore } from 'pinia'
import { ref, computed, markRaw } from 'vue'
import Peer from 'peerjs'
import type { MediaConnection, DataConnection } from 'peerjs'
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
  type MeetingSettings
} from '../services/meetings'
import { auth } from '../services/firebase'

export interface RemoteStream {
  uid: string
  peerId: string
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

export const useMeetingStore = defineStore('meeting', () => {
  // ─── State ─────────────────────────────────────────────────────────────────
  const meeting = ref<Meeting | null>(null)
  const meetingId = ref<string | null>(null)
  const isInMeeting = ref(false)
  const isHost = ref(false)
  const isCoHost = ref(false)

  // Local media
  const localStream = ref<MediaStream | null>(null)
  const screenStream = ref<MediaStream | null>(null)
  const isAudioMuted = ref(false)
  const isVideoOff = ref(false)
  const isScreenSharing = ref(false)
  const isHandRaised = ref(false)
  const isSpeaking = ref(false)

  // Remote peers
  const remoteStreams = ref<Map<string, RemoteStream>>(new Map())
  const dataConnections = ref<Map<string, DataConnection>>(new Map())
  const mediaConnections = ref<Map<string, MediaConnection>>(new Map())

  // PeerJS
  const peer = ref<Peer | null>(null)
  const myPeerId = ref<string>('')

  // Chat
  const chatMessages = ref<MeetingChatMessage[]>([])
  const unreadChatCount = ref(0)
  const isChatOpen = ref(false)

  // UI state
  const layout = ref<'grid' | 'spotlight' | 'sidebar'>('grid')
  const spotlightUid = ref<string | null>(null)
  const notifications = ref<MeetingNotification[]>([])
  const isSettingsPanelOpen = ref(false)
  const isParticipantsPanelOpen = ref(false)
  const handRaisedQueue = ref<string[]>([])
  const isRecording = ref(false)
  const recordingChunks = ref<BlobPart[]>([])
  const mediaRecorder = ref<MediaRecorder | null>(null)

  // Devices
  const audioInputs = ref<MediaDeviceInfo[]>([])
  const audioOutputs = ref<MediaDeviceInfo[]>([])
  const videoInputs = ref<MediaDeviceInfo[]>([])
  const selectedAudioInput = ref<string>('')
  const selectedAudioOutput = ref<string>('')
  const selectedVideoInput = ref<string>('')
  const playbackSpeed = ref(1.0)

  // Subscriptions
  let unsubMeeting: (() => void) | null = null
  let unsubChat: (() => void) | null = null
  let speakingDetector: ReturnType<typeof setInterval> | null = null
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null

  // ─── Computed ─────────────────────────────────────────────────────────────
  const activeParticipants = computed(() => {
    if (!meeting.value) return []
    return Object.values(meeting.value.participants).filter(
      p => p.status === 'joined'
    )
  })

  const waitingParticipants = computed(() => {
    if (!meeting.value) return []
    return Object.values(meeting.value.participants).filter(
      p => p.status === 'waiting'
    )
  })

  const myParticipant = computed(() => {
    const uid = auth.currentUser?.uid
    if (!uid || !meeting.value) return null
    return meeting.value.participants[uid] || null
  })

  const remoteStreamsArray = computed(() => Array.from(remoteStreams.value.values()))

  const canManageParticipants = computed(() => isHost.value || isCoHost.value)

  // ─── Device Enumeration ────────────────────────────────────────────────────
  async function enumerateDevices(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      audioInputs.value = devices.filter(d => d.kind === 'audioinput')
      audioOutputs.value = devices.filter(d => d.kind === 'audiooutput')
      videoInputs.value = devices.filter(d => d.kind === 'videoinput')
      if (!selectedAudioInput.value && audioInputs.value[0]) {
        selectedAudioInput.value = audioInputs.value[0].deviceId
      }
      if (!selectedAudioOutput.value && audioOutputs.value[0]) {
        selectedAudioOutput.value = audioOutputs.value[0].deviceId
      }
      if (!selectedVideoInput.value && videoInputs.value[0]) {
        selectedVideoInput.value = videoInputs.value[0].deviceId
      }
    } catch (e) {
      console.warn('Could not enumerate devices:', e)
    }
  }

  // ─── Local Media ──────────────────────────────────────────────────────────
  async function getLocalMedia(options: {
    audio: boolean
    video: boolean
    audioDeviceId?: string
    videoDeviceId?: string
  }): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: options.audio
        ? { deviceId: options.audioDeviceId ? { ideal: options.audioDeviceId } : undefined }
        : false,
      video: options.video
        ? { deviceId: options.videoDeviceId ? { ideal: options.videoDeviceId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } }
        : false
    }
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    return stream
  }

  async function initLocalStream(audioEnabled: boolean, videoEnabled: boolean): Promise<void> {
    try {
      const stream = await getLocalMedia({
        audio: true,
        video: true,
        audioDeviceId: selectedAudioInput.value,
        videoDeviceId: selectedVideoInput.value
      })
      localStream.value = stream

      // Apply initial mute states
      stream.getAudioTracks().forEach(t => { t.enabled = audioEnabled })
      stream.getVideoTracks().forEach(t => { t.enabled = videoEnabled })

      isAudioMuted.value = !audioEnabled
      isVideoOff.value = !videoEnabled

      startSpeakingDetection(stream)
    } catch (e: any) {
      // Try audio-only if video fails
      try {
        const audioOnly = await getLocalMedia({ audio: true, video: false })
        localStream.value = audioOnly
        isAudioMuted.value = !audioEnabled
        isVideoOff.value = true
        startSpeakingDetection(audioOnly)
        addNotification('Camera not available — joined with audio only', 'warning')
      } catch {
        throw new Error('Could not access microphone')
      }
    }
  }

  function startSpeakingDetection(stream: MediaStream): void {
    try {
      audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      speakingDetector = setInterval(() => {
        if (!analyser) return
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        const speaking = avg > 15 && !isAudioMuted.value
        if (speaking !== isSpeaking.value) {
          isSpeaking.value = speaking
          if (meetingId.value && auth.currentUser) {
            updateParticipantState(meetingId.value, auth.currentUser.uid, { isSpeaking: speaking })
          }
        }
      }, 300)
    } catch {}
  }

  // ─── PeerJS Setup ──────────────────────────────────────────────────────────
  async function initPeer(uid: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (peer.value && !peer.value.destroyed) {
        resolve(myPeerId.value)
        return
      }

      const peerId = `sc_${uid}`
      const p = new Peer(peerId, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
              urls: 'turn:turn.speed.cloudflare.com:50000',
              username: '42e3c6df2be45b0bc95bfe58bd6fe8ee7a24577911658e690afedbb9c01889e3f5e086df4ccf543ecb6eaf2fe8402529eeb6d46a57bfdbf376aabd191f6d5947',
              credential: 'aba9b169546eb6dcc7bfb1cdf34544cf95b5161d602e3b5fa7c8342b2e9802fb'
            }
          ],
          sdpSemantics: 'unified-plan'
        }
      })

      const timeout = setTimeout(() => reject(new Error('Peer init timeout')), 15000)

      p.on('open', id => {
        clearTimeout(timeout)
        peer.value = markRaw(p)
        myPeerId.value = id
        setupPeerListeners()
        resolve(id)
      })

      p.on('error', err => {
        clearTimeout(timeout)
        // Handle duplicate ID by appending suffix
        if ((err as any).type === 'unavailable-id') {
          const fallback = new Peer(`sc_${uid}_${Date.now()}`, (p as any)._options)
          fallback.on('open', id => {
            peer.value = markRaw(fallback)
            myPeerId.value = id
            setupPeerListeners()
            resolve(id)
          })
          fallback.on('error', reject)
        } else {
          reject(err)
        }
      })
    })
  }

  function setupPeerListeners(): void {
    if (!peer.value) return

    // Incoming media call
    peer.value.on('call', (call: MediaConnection) => {
      if (!localStream.value) return
      call.answer(localStream.value)
      handleMediaConnection(call)
    })

    // Incoming data connection
    peer.value.on('connection', (conn: DataConnection) => {
      conn.on('open', () => {
        dataConnections.value.set(conn.peer, conn)
        conn.on('data', (data: unknown) => handleDataMessage(conn.peer, data as any))
        conn.on('close', () => dataConnections.value.delete(conn.peer))
      })
    })

    peer.value.on('disconnected', () => {
      setTimeout(() => peer.value?.reconnect(), 3000)
    })
  }

  function handleMediaConnection(call: MediaConnection): void {
    mediaConnections.value.set(call.peer, markRaw(call))

    call.on('stream', (stream: MediaStream) => {
      // Find participant by peerId
      const participant = findParticipantByPeerId(call.peer)
      if (!participant) return

      remoteStreams.value.set(participant.uid, {
        uid: participant.uid,
        peerId: call.peer,
        stream: markRaw(stream),
        displayName: participant.displayName,
        photoURL: participant.photoURL,
        isAudioMuted: participant.isAudioMuted,
        isVideoOff: participant.isVideoOff,
        isScreenSharing: participant.isScreenSharing,
        isHandRaised: participant.isHandRaised,
        isSpeaking: participant.isSpeaking
      })
    })

    call.on('close', () => {
      const participant = findParticipantByPeerId(call.peer)
      if (participant) remoteStreams.value.delete(participant.uid)
      mediaConnections.value.delete(call.peer)
    })

    call.on('error', () => {
      mediaConnections.value.delete(call.peer)
    })
  }

  function findParticipantByPeerId(peerId: string): MeetingParticipant | null {
    if (!meeting.value) return null
    return Object.values(meeting.value.participants).find(p => p.peerId === peerId) || null
  }

  // ─── Data Channel Messages ─────────────────────────────────────────────────
  type DataMsg =
    | { type: 'mute'; uid: string }
    | { type: 'unmute-request'; uid: string }
    | { type: 'remove'; uid: string }
    | { type: 'hand-lower'; uid: string }
    | { type: 'settings-update'; settings: Partial<MeetingSettings> }
    | { type: 'ping' }
    | { type: 'pong' }

  function handleDataMessage(fromPeerId: string, data: DataMsg): void {
    const myUid = auth.currentUser?.uid
    if (!myUid) return

    switch (data.type) {
      case 'mute':
        if (data.uid === myUid) {
          muteLocalAudio(true)
          addNotification('Host muted your microphone', 'info')
        }
        break
      case 'unmute-request':
        if (data.uid === myUid) {
          addNotification('Host is requesting you to unmute', 'info')
        }
        break
      case 'remove':
        if (data.uid === myUid) {
          addNotification('You were removed from the meeting', 'warning')
          leaveCurrentMeeting()
        }
        break
      case 'hand-lower':
        if (data.uid === myUid) {
          isHandRaised.value = false
          if (meetingId.value) updateParticipantState(meetingId.value, myUid, { isHandRaised: false })
        }
        break
      case 'ping':
        sendDataToAll({ type: 'pong' })
        break
    }
  }

  function sendDataToAll(data: DataMsg): void {
    dataConnections.value.forEach(conn => {
      if (conn.open) conn.send(data)
    })
  }

  function sendDataToPeer(peerId: string, data: DataMsg): void {
    const conn = dataConnections.value.get(peerId)
    if (conn?.open) conn.send(data)
  }

  // ─── Connect to existing participants ─────────────────────────────────────
  async function connectToParticipants(participants: MeetingParticipant[]): Promise<void> {
    const myUid = auth.currentUser?.uid
    if (!peer.value || !localStream.value) return

    for (const p of participants) {
      if (p.uid === myUid || p.status !== 'joined') continue
      if (dataConnections.value.has(p.peerId)) continue

      try {
        // Data connection
        const conn = peer.value.connect(p.peerId, { reliable: true })
        conn.on('open', () => {
          dataConnections.value.set(p.peerId, conn)
          conn.on('data', (data: unknown) => handleDataMessage(p.peerId, data as any))
          conn.on('close', () => dataConnections.value.delete(p.peerId))
        })

        // Media call
        if (localStream.value) {
          const call = peer.value.call(p.peerId, localStream.value)
          handleMediaConnection(call)
        }
      } catch (e) {
        console.warn(`Could not connect to participant ${p.displayName}:`, e)
      }
    }
  }

  // ─── Join/Leave ─────────────────────────────────────────────────────────────
  async function joinCurrentMeeting(
    mId: string,
    mData: Meeting,
    audioOn: boolean,
    videoOn: boolean
  ): Promise<void> {
    const user = auth.currentUser
    if (!user) throw new Error('Not authenticated')

    meetingId.value = mId
    meeting.value = mData
    isHost.value = mData.hostUid === user.uid
    isCoHost.value = mData.participants[user.uid]?.role === 'co-host'

    // Init peer & media
    await initPeer(user.uid)
    await initLocalStream(audioOn, videoOn)

    // Firestore join
    await joinMeeting(mId, {
      uid: user.uid,
      displayName: user.displayName || 'Attendee',
      photoURL: user.photoURL,
      peerId: myPeerId.value,
      isAudioMuted: !audioOn,
      isVideoOff: !videoOn
    })

    // Start meeting if host
    if (isHost.value && mData.status === 'scheduled') {
      await startMeeting(mId)
    }

    isInMeeting.value = true

    // Connect to others
    const others = Object.values(mData.participants).filter(
      p => p.uid !== user.uid && p.status === 'joined'
    )
    await connectToParticipants(others)

    // Listen for real-time updates
    unsubMeeting = listenToMeeting(mId, updatedMeeting => {
      meeting.value = updatedMeeting

      // Sync remote stream metadata from Firestore
      Object.values(updatedMeeting.participants).forEach(p => {
        if (p.uid === user.uid) return
        const rs = remoteStreams.value.get(p.uid)
        if (rs) {
          remoteStreams.value.set(p.uid, {
            ...rs,
            isAudioMuted: p.isAudioMuted,
            isVideoOff: p.isVideoOff,
            isScreenSharing: p.isScreenSharing,
            isHandRaised: p.isHandRaised,
            isSpeaking: p.isSpeaking
          })
        }

        // Connect to newly joined participants
        if (p.status === 'joined' && !dataConnections.value.has(p.peerId) && p.uid !== user.uid) {
          connectToParticipants([p])
        }

        // Hand raised queue
        if (p.isHandRaised && !handRaisedQueue.value.includes(p.uid)) {
          handRaisedQueue.value.push(p.uid)
        } else if (!p.isHandRaised) {
          handRaisedQueue.value = handRaisedQueue.value.filter(id => id !== p.uid)
        }
      })
    })

    unsubChat = listenToMeetingChat(mId, msgs => {
      const prev = chatMessages.value.length
      chatMessages.value = msgs
      if (!isChatOpen.value && msgs.length > prev) {
        unreadChatCount.value += msgs.length - prev
      }
    })
  }

  async function leaveCurrentMeeting(): Promise<void> {
    const user = auth.currentUser
    const mId = meetingId.value
    if (!mId || !user) return

    // If host, end meeting for everyone
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
    localStream.value = null
    screenStream.value = null

    // Close connections
    mediaConnections.value.forEach(c => c.close())
    dataConnections.value.forEach(c => c.close())
    mediaConnections.value.clear()
    dataConnections.value.clear()
    remoteStreams.value.clear()

    // Stop PeerJS
    if (peer.value && !peer.value.destroyed) peer.value.destroy()
    peer.value = null
    myPeerId.value = ''

    // Stop audio detection
    if (speakingDetector) { clearInterval(speakingDetector); speakingDetector = null }
    audioContext?.close()
    audioContext = null
    analyser = null

    // Stop recording
    if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
      mediaRecorder.value.stop()
    }
    isRecording.value = false

    // Unsub Firestore
    unsubMeeting?.()
    unsubChat?.()

    // Reset state
    isInMeeting.value = false
    isHost.value = false
    isCoHost.value = false
    meeting.value = null
    meetingId.value = null
    chatMessages.value = []
    unreadChatCount.value = 0
    isChatOpen.value = false
    isHandRaised.value = false
    isSpeaking.value = false
    isScreenSharing.value = false
    handRaisedQueue.value = []
    notifications.value = []
  }

  // ─── Audio/Video Controls ─────────────────────────────────────────────────
  function muteLocalAudio(muted: boolean): void {
    if (!localStream.value) return
    localStream.value.getAudioTracks().forEach(t => { t.enabled = !muted })
    isAudioMuted.value = muted
    if (meetingId.value && auth.currentUser) {
      updateParticipantState(meetingId.value, auth.currentUser.uid, { isAudioMuted: muted })
    }
  }

  function toggleAudio(): void {
    const newMuted = !isAudioMuted.value
    // Check if allowed
    if (!newMuted && myParticipant.value && !myParticipant.value.canUnmuteSelf && !isHost.value) {
      addNotification('The host has disabled your microphone', 'warning')
      return
    }
    muteLocalAudio(newMuted)
  }

  function toggleVideo(): void {
    if (!localStream.value) return
    const newOff = !isVideoOff.value
    // Check permission
    if (!newOff && myParticipant.value && !meeting.value?.settings.allowParticipantVideo && !isHost.value) {
      addNotification('The host has disabled participant video', 'warning')
      return
    }
    localStream.value.getVideoTracks().forEach(t => { t.enabled = !newOff })
    isVideoOff.value = newOff
    if (meetingId.value && auth.currentUser) {
      updateParticipantState(meetingId.value, auth.currentUser.uid, { isVideoOff: newOff })
    }
  }

  async function toggleScreenShare(): Promise<void> {
    if (!peer.value || !localStream.value) return
    if (!meeting.value?.settings.allowScreenShare && !isHost.value) {
      addNotification('The host has disabled screen sharing', 'warning')
      return
    }

    if (!isScreenSharing.value) {
      try {
        const sStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: true
        })
        screenStream.value = sStream
        isScreenSharing.value = true

        if (meetingId.value && auth.currentUser) {
          updateParticipantState(meetingId.value, auth.currentUser.uid, { isScreenSharing: true })
        }

        // Replace video track in all media connections
        const videoTrack = sStream.getVideoTracks()[0]
        mediaConnections.value.forEach(call => {
          call.peerConnection?.getSenders().forEach(sender => {
            if (sender.track?.kind === 'video') sender.replaceTrack(videoTrack)
          })
        })

        videoTrack.onended = () => stopScreenShare()
      } catch {
        addNotification('Screen share cancelled', 'info')
      }
    } else {
      stopScreenShare()
    }
  }

  function stopScreenShare(): void {
    screenStream.value?.getTracks().forEach(t => t.stop())
    screenStream.value = null
    isScreenSharing.value = false

    if (meetingId.value && auth.currentUser) {
      updateParticipantState(meetingId.value, auth.currentUser.uid, { isScreenSharing: false })
    }

    // Restore camera track
    const camTrack = localStream.value?.getVideoTracks()[0]
    if (camTrack) {
      mediaConnections.value.forEach(call => {
        call.peerConnection?.getSenders().forEach(sender => {
          if (sender.track?.kind === 'video') sender.replaceTrack(camTrack)
        })
      })
    }
  }

  async function switchAudioInput(deviceId: string): Promise<void> {
    selectedAudioInput.value = deviceId
    if (!localStream.value) return
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } }
      })
      const newTrack = newStream.getAudioTracks()[0]
      const oldTrack = localStream.value.getAudioTracks()[0]
      if (oldTrack) { localStream.value.removeTrack(oldTrack); oldTrack.stop() }
      localStream.value.addTrack(newTrack)
      newTrack.enabled = !isAudioMuted.value

      mediaConnections.value.forEach(call => {
        call.peerConnection?.getSenders().forEach(sender => {
          if (sender.track?.kind === 'audio') sender.replaceTrack(newTrack)
        })
      })
    } catch (e) {
      addNotification('Could not switch microphone', 'error')
    }
  }

  async function switchVideoInput(deviceId: string): Promise<void> {
    selectedVideoInput.value = deviceId
    if (!localStream.value) return
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } }
      })
      const newTrack = newStream.getVideoTracks()[0]
      const oldTrack = localStream.value.getVideoTracks()[0]
      if (oldTrack) { localStream.value.removeTrack(oldTrack); oldTrack.stop() }
      localStream.value.addTrack(newTrack)
      newTrack.enabled = !isVideoOff.value

      mediaConnections.value.forEach(call => {
        call.peerConnection?.getSenders().forEach(sender => {
          if (sender.track?.kind === 'video') sender.replaceTrack(newTrack)
        })
      })
    } catch (e) {
      addNotification('Could not switch camera', 'error')
    }
  }

  // ─── Hand Raise ────────────────────────────────────────────────────────────
  async function toggleHandRaise(): Promise<void> {
    const uid = auth.currentUser?.uid
    const mId = meetingId.value
    if (!uid || !mId) return
    const newVal = !isHandRaised.value
    isHandRaised.value = newVal
    await updateParticipantState(mId, uid, { isHandRaised: newVal })
    if (newVal) addNotification('You raised your hand', 'info')
  }

  // ─── Host Controls ────────────────────────────────────────────────────────
  async function hostMute(targetUid: string): Promise<void> {
    const mId = meetingId.value
    if (!mId || !canManageParticipants.value) return
    await hostMuteParticipant(mId, targetUid, true)
    // Signal via data channel
    const participant = meeting.value?.participants[targetUid]
    if (participant) sendDataToPeer(participant.peerId, { type: 'mute', uid: targetUid })
    addNotification('Participant muted', 'info')
  }

  async function hostRequestUnmute(targetUid: string): Promise<void> {
    const participant = meeting.value?.participants[targetUid]
    if (!participant) return
    sendDataToPeer(participant.peerId, { type: 'unmute-request', uid: targetUid })
    addNotification('Unmute request sent', 'info')
  }

  async function hostRemoveParticipant(targetUid: string): Promise<void> {
    const mId = meetingId.value
    if (!mId || !canManageParticipants.value) return
    const participant = meeting.value?.participants[targetUid]
    if (!participant) return
    sendDataToPeer(participant.peerId, { type: 'remove', uid: targetUid })
    await removeParticipant(mId, targetUid)
    addNotification(`${participant.displayName} removed`, 'info')
  }

  async function hostLowerHand(targetUid: string): Promise<void> {
    const mId = meetingId.value
    if (!mId || !canManageParticipants.value) return
    const participant = meeting.value?.participants[targetUid]
    if (!participant) return
    sendDataToPeer(participant.peerId, { type: 'hand-lower', uid: targetUid })
    await updateParticipantState(mId, targetUid, { isHandRaised: false })
  }

  async function hostMuteAll(): Promise<void> {
    const mId = meetingId.value
    if (!mId || !canManageParticipants.value || !meeting.value) return
    const uid = auth.currentUser?.uid
    const updates = Object.values(meeting.value.participants)
      .filter(p => p.uid !== uid && p.status === 'joined')
    for (const p of updates) {
      await hostMuteParticipant(mId, p.uid, true)
      sendDataToPeer(p.peerId, { type: 'mute', uid: p.uid })
    }
    addNotification('All participants muted', 'info')
  }

  async function hostSetPermission(
    targetUid: string,
    permission: 'canUnmuteSelf' | 'canShareScreen' | 'canChat',
    value: boolean
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
    sendDataToAll({ type: 'settings-update', settings })
  }

  // ─── Chat ─────────────────────────────────────────────────────────────────
  async function sendChat(content: string): Promise<void> {
    const user = auth.currentUser
    const mId = meetingId.value
    if (!user || !mId || !content.trim()) return
    if (!meeting.value?.settings.allowChat && !isHost.value) {
      addNotification('Chat is disabled by the host', 'warning')
      return
    }
    await sendMeetingChatMessage(mId, {
      uid: user.uid,
      displayName: user.displayName || 'Attendee',
      photoURL: user.photoURL
    }, content.trim())
  }

  function openChat(): void {
    isChatOpen.value = true
    unreadChatCount.value = 0
  }
  function closeChat(): void { isChatOpen.value = false }

  // ─── Recording ────────────────────────────────────────────────────────────
  async function toggleRecording(): Promise<void> {
    if (!isRecording.value) {
      try {
        const streams: MediaStream[] = []
        if (localStream.value) streams.push(localStream.value)
        remoteStreams.value.forEach(rs => streams.push(rs.stream))

        const combinedStream = new MediaStream()
        streams.forEach(s => s.getTracks().forEach(t => combinedStream.addTrack(t)))

        const recorder = new MediaRecorder(combinedStream, {
          mimeType: 'video/webm;codecs=vp9,opus'
        })
        recordingChunks.value = []
        recorder.ondataavailable = e => {
          if (e.data.size > 0) recordingChunks.value.push(e.data)
        }
        recorder.onstop = () => {
          const blob = new Blob(recordingChunks.value, { type: 'video/webm' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `meeting-${meetingId.value}-${Date.now()}.webm`
          a.click()
          URL.revokeObjectURL(url)
        }
        recorder.start(1000)
        mediaRecorder.value = markRaw(recorder)
        isRecording.value = true
        addNotification('Recording started', 'info')
      } catch {
        addNotification('Could not start recording', 'error')
      }
    } else {
      mediaRecorder.value?.stop()
      isRecording.value = false
      addNotification('Recording saved', 'success')
    }
  }

  // ─── Layout ───────────────────────────────────────────────────────────────
  function setLayout(l: 'grid' | 'spotlight' | 'sidebar'): void { layout.value = l }
  function setSpotlight(uid: string | null): void {
    spotlightUid.value = uid
    if (uid) layout.value = 'spotlight'
  }

  // ─── Notifications ────────────────────────────────────────────────────────
  function addNotification(message: string, type: MeetingNotification['type'] = 'info'): void {
    const id = Date.now().toString()
    notifications.value.push({ id, message, type })
    setTimeout(() => {
      notifications.value = notifications.value.filter(n => n.id !== id)
    }, 4000)
  }

  return {
    // State
    meeting, meetingId, isInMeeting, isHost, isCoHost,
    localStream, screenStream, isAudioMuted, isVideoOff,
    isScreenSharing, isHandRaised, isSpeaking,
    remoteStreams, remoteStreamsArray,
    peer, myPeerId,
    chatMessages, unreadChatCount, isChatOpen,
    layout, spotlightUid, notifications,
    isSettingsPanelOpen, isParticipantsPanelOpen,
    handRaisedQueue, isRecording,
    audioInputs, audioOutputs, videoInputs,
    selectedAudioInput, selectedAudioOutput, selectedVideoInput,
    playbackSpeed,
    // Computed
    activeParticipants, waitingParticipants, myParticipant, canManageParticipants,
    // Methods
    enumerateDevices, initLocalStream,
    initPeer, joinCurrentMeeting, leaveCurrentMeeting, cleanup,
    toggleAudio, toggleVideo, toggleScreenShare,
    switchAudioInput, switchVideoInput,
    toggleHandRaise,
    hostMute, hostRequestUnmute, hostRemoveParticipant,
    hostLowerHand, hostMuteAll,
    hostSetPermission, hostPromote, hostDemote, hostUpdateSettings,
    sendChat, openChat, closeChat,
    toggleRecording,
    setLayout, setSpotlight,
    addNotification
  }
})
