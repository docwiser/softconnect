// src/stores/peer.ts
import { defineStore } from 'pinia'
import { ref, markRaw } from 'vue'
import Peer from 'peerjs'
import type { DataConnection, MediaConnection } from 'peerjs'
import { useAppStore } from './app'
import {
  db,
  createCallRecord,
  updateCallRecord,
  Timestamp
} from '../services/firebase'
import { doc, setDoc } from 'firebase/firestore'

export const usePeerStore = defineStore('peer', () => {
  const appStore = useAppStore()

  const peer = ref<Peer | null>(null)
  const myPeerConnectionId = ref<string>('')
  const connections = ref<Map<string, DataConnection>>(new Map())
  const mediaConnections = new Map<string, MediaConnection>()

  const localStream = ref<MediaStream | null>(null)
  const remoteStream = ref<MediaStream | null>(null)
  const screenStream = ref<MediaStream | null>(null)
  const isScreenSharing = ref(false)

  const ringtoneAudio = ref<HTMLAudioElement | null>(null)
  const holdAudio = ref<HTMLAudioElement | null>(null)

  // ─── Peer Initialization ───────────────────────────────────────────────────
  async function initializePeer(uid: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (peer.value && !peer.value.destroyed) {
        resolve(myPeerConnectionId.value)
        return
      }

      // Use UID-based peer ID for direct addressing
      const peerId = `sc_${uid}`
      const p = new Peer(peerId, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            {
              urls: 'turn:turn.speed.cloudflare.com:50000',
              username: '42e3c6df2be45b0bc95bfe58bd6fe8ee7a24577911658e690afedbb9c01889e3f5e086df4ccf543ecb6eaf2fe8402529eeb6d46a57bfdbf376aabd191f6d5947',
              credential: 'aba9b169546eb6dcc7bfb1cdf34544cf95b5161d602e3b5fa7c8342b2e9802fb'
            }
          ],
          sdpSemantics: 'unified-plan'
        }
      })

      p.on('open', async (id) => {
        peer.value = markRaw(p)
        myPeerConnectionId.value = id
        setupPeerListeners()
        // Store PeerJS ID in Firestore for lookup
        try {
          await setDoc(doc(db, 'peerIds', uid), { peerId: id, updatedAt: Timestamp.now() })
        } catch (e) { console.warn('Could not store peer ID', e) }
        resolve(id)
      })

      p.on('error', (err) => {
        console.error('PeerJS error:', err)
        if (err.type === 'unavailable-id') {
          // ID taken — append random suffix
          const fallback = `sc_${uid}_${Math.random().toString(36).slice(2, 7)}`
          const p2 = new Peer(fallback, (p as any)._options)
          p2.on('open', (id) => {
            peer.value = markRaw(p2)
            myPeerConnectionId.value = id
            setupPeerListeners()
            resolve(id)
          })
          p2.on('error', reject)
        } else {
          reject(err)
        }
      })
    })
  }

  function setupPeerListeners() {
    if (!peer.value) return
    peer.value.on('connection', handleIncomingConnection)
    peer.value.on('call', handleIncomingMediaCall)
    peer.value.on('disconnected', () => {
      setTimeout(() => peer.value?.reconnect(), 3000)
    })
  }

  function handleIncomingConnection(conn: DataConnection) {
    conn.on('open', () => {
      connections.value.set(conn.peer, conn)
      conn.on('data', (data: any) => handleDataMessage(conn.peer, data))
      conn.on('close', () => connections.value.delete(conn.peer))
      conn.on('error', (e) => console.warn('Connection error:', e))
    })
  }

  function handleDataMessage(fromPeerId: string, data: any) {
    switch (data.type) {
      case 'call-request':
        handleCallRequest(fromPeerId, data)
        break
      case 'call-reject':
        handleCallRejected(data.data)
        break
      case 'call-busy':
        handleCallBusy()
        break
      case 'call-end':
        endCall()
        break
      case 'hold':
        handleRemoteHold(data.data)
        break
      case 'message-notification':
        // lightweight ping for new message
        appStore.addNotification(`New message from ${data.data?.senderName}`)
        break
    }
  }

  // ─── Connection ─────────────────────────────────────────────────────────────
  async function connectToPeer(targetPeerId: string): Promise<DataConnection> {
    if (!peer.value) throw new Error('Peer not initialized')

    const existing = connections.value.get(targetPeerId)
    if (existing?.open) return existing

    return new Promise((resolve, reject) => {
      const conn = peer.value!.connect(targetPeerId, { reliable: true })
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 15000)

      conn.on('open', () => {
        clearTimeout(timeout)
        connections.value.set(targetPeerId, conn)
        conn.on('data', (data: any) => handleDataMessage(targetPeerId, data))
        conn.on('close', () => connections.value.delete(targetPeerId))
        resolve(conn)
      })
      conn.on('error', (e) => {
        clearTimeout(timeout)
        reject(e)
      })
    })
  }

  function sendDataToPeer(targetPeerId: string, data: any) {
    const conn = connections.value.get(targetPeerId)
    if (conn?.open) {
      conn.send(data)
    }
  }

  // ─── Calling ─────────────────────────────────────────────────────────────────
  async function startCall(targetUid: string, targetPeerConnectionId: string, withVideo: boolean) {
    if (appStore.callState.isActive || appStore.callState.isIncoming) {
      sendDataToPeer(targetPeerConnectionId, { type: 'call-busy' })
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: withVideo
      })
      localStream.value = stream

      // Signal call-request via data channel first
      await connectToPeer(targetPeerConnectionId)
      sendDataToPeer(targetPeerConnectionId, {
        type: 'call-request',
        data: {
          callerUid: appStore.currentUserProfile?.uid,
          callerName: appStore.currentUserProfile?.displayName,
          callerPhoto: appStore.currentUserProfile?.photoURL,
          callerPeerId: myPeerConnectionId.value,
          hasVideo: withVideo
        }
      })

      const call = peer.value!.call(targetPeerConnectionId, stream)
      if (call) {
        mediaConnections.set(targetPeerConnectionId, markRaw(call))
        setupCallListeners(call, targetPeerConnectionId)
      }

      // Create call record
      const callId = await createCallRecord({
        callerId: appStore.currentUserProfile!.uid,
        callerName: appStore.currentUserProfile!.displayName,
        callerPhoto: appStore.currentUserProfile?.photoURL || null,
        receiverId: targetUid,
        receiverName: appStore.callState.peerName,
        receiverPhoto: appStore.callState.peerPhoto,
        type: withVideo ? 'video' : 'voice',
        status: 'ongoing',
        startedAt: Timestamp.now(),
        endedAt: null,
        duration: 0
      })

      appStore.updateCallState({
        isActive: true,
        isOutgoing: true,
        peerId: targetUid,
        peerConnectionId: targetPeerConnectionId,
        isVideoEnabled: withVideo,
        callId,
        startedAt: Date.now()
      })
    } catch (err) {
      appStore.addNotification('Failed to access media devices', 'error')
      console.error('startCall error:', err)
    }
  }

  function handleIncomingMediaCall(call: MediaConnection) {
    // Managed by call-request data message
    mediaConnections.set(call.peer, markRaw(call))
  }

  function handleCallRequest(fromPeerId: string, data: any) {
    if (appStore.callState.isActive || appStore.callState.isIncoming) {
      sendDataToPeer(fromPeerId, { type: 'call-busy' })
      return
    }
    playRingtone()
    appStore.updateCallState({
      isActive: true,
      isIncoming: true,
      peerId: data.data.callerUid,
      peerName: data.data.callerName,
      peerPhoto: data.data.callerPhoto || null,
      peerConnectionId: fromPeerId,
      isVideoEnabled: data.data.hasVideo
    })
  }

  async function answerCall(withVideo: boolean) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: withVideo
      })
      localStream.value = stream

      const peerConnId = appStore.callState.peerConnectionId
      const call = mediaConnections.get(peerConnId)
      if (call) {
        call.answer(stream)
        setupCallListeners(call, peerConnId)
      }

      stopRingtone()
      appStore.updateCallState({
        isIncoming: false,
        isVideoEnabled: withVideo,
        startedAt: Date.now()
      })

      // Create call record for receiver
      const callId = await createCallRecord({
        callerId: appStore.callState.peerId,
        callerName: appStore.callState.peerName,
        callerPhoto: appStore.callState.peerPhoto,
        receiverId: appStore.currentUserProfile!.uid,
        receiverName: appStore.currentUserProfile!.displayName,
        receiverPhoto: appStore.currentUserProfile?.photoURL || null,
        type: withVideo ? 'video' : 'voice',
        status: 'answered',
        startedAt: Timestamp.now(),
        endedAt: null,
        duration: 0
      })
      appStore.updateCallState({ callId })
    } catch (err) {
      appStore.addNotification('Failed to access media devices', 'error')
    }
  }

  function rejectCall(reason = 'Rejected', customMessage?: string) {
    const peerConnId = appStore.callState.peerConnectionId
    sendDataToPeer(peerConnId, { type: 'call-reject', data: { reason, message: customMessage } })

    if (appStore.callState.callId) {
      updateCallRecord(appStore.callState.callId, {
        status: 'rejected',
        endedAt: Timestamp.now(),
        duration: 0
      })
    }

    stopRingtone()
    cleanupCall()
  }

  function handleCallRejected(data: any) {
    appStore.addNotification(`Call rejected: ${data?.reason || 'Unknown reason'}`)
    if (data?.message) appStore.addNotification(`Message: ${data.message}`)
    if (appStore.callState.callId) {
      updateCallRecord(appStore.callState.callId, {
        status: 'rejected',
        endedAt: Timestamp.now(),
        duration: 0
      })
    }
    cleanupCall()
  }

  function handleCallBusy() {
    appStore.addNotification('User is currently busy', 'warning')
    cleanupCall()
  }

  function handleRemoteHold(isOnHold: boolean) {
    appStore.addNotification(isOnHold ? 'You were put on hold' : 'Call resumed')
  }

  function endCall() {
    const peerConnId = appStore.callState.peerConnectionId
    sendDataToPeer(peerConnId, { type: 'call-end' })

    // Update call record
    if (appStore.callState.callId) {
      const duration = appStore.callState.startedAt
        ? Math.floor((Date.now() - appStore.callState.startedAt) / 1000)
        : 0
      updateCallRecord(appStore.callState.callId, {
        status: 'answered',
        endedAt: Timestamp.now(),
        duration
      })
    }
    cleanupCall()
  }

  function cleanupCall() {
    const peerConnId = appStore.callState.peerConnectionId
    const call = mediaConnections.get(peerConnId)
    if (call) { call.close(); mediaConnections.delete(peerConnId) }

    localStream.value?.getTracks().forEach(t => t.stop())
    screenStream.value?.getTracks().forEach(t => t.stop())
    localStream.value = null
    remoteStream.value = null
    screenStream.value = null
    isScreenSharing.value = false

    stopRingtone()
    stopHoldAudio()
    appStore.resetCallState()
  }

  function setupCallListeners(call: MediaConnection, peerConnId: string) {
    call.on('stream', (stream) => {
      remoteStream.value = stream
    })
    call.on('close', () => cleanupCall())
    call.on('error', (e) => {
      console.error('Call error:', e)
      appStore.addNotification('Call error occurred', 'error')
      cleanupCall()
    })
  }

  // ─── Call Controls ──────────────────────────────────────────────────────────
  function toggleMute() {
    if (!localStream.value) return
    const track = localStream.value.getAudioTracks()[0]
    if (track) {
      track.enabled = !track.enabled
      appStore.updateCallState({ isMuted: !track.enabled })
    }
  }

  async function toggleVideo() {
    if (!appStore.callState.isVideoEnabled) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      if (localStream.value) {
        localStream.value.getTracks().forEach(t => t.stop())
      }
      localStream.value = stream
      const peerConnId = appStore.callState.peerConnectionId
      const call = mediaConnections.get(peerConnId)
      if (call?.peerConnection) {
        const vTrack = stream.getVideoTracks()[0]
        const sender = call.peerConnection.getSenders().find(s => s.track?.kind === 'video')
        if (sender) await sender.replaceTrack(vTrack)
        else call.peerConnection.addTrack(vTrack, stream)
      }
      appStore.updateCallState({ isVideoEnabled: true })
    } else {
      const vTrack = localStream.value?.getVideoTracks()[0]
      if (vTrack) { vTrack.enabled = false; vTrack.stop() }
      appStore.updateCallState({ isVideoEnabled: false })
    }
  }

  async function toggleScreenShare() {
    if (!isScreenSharing.value) {
      try {
        const sStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        screenStream.value = sStream
        isScreenSharing.value = true
        const peerConnId = appStore.callState.peerConnectionId
        const call = mediaConnections.get(peerConnId)
        if (call?.peerConnection) {
          const vTrack = sStream.getVideoTracks()[0]
          const sender = call.peerConnection.getSenders().find(s => s.track?.kind === 'video')
          if (sender) await sender.replaceTrack(vTrack)
        }
        sStream.getVideoTracks()[0].onended = () => stopScreenShare()
      } catch { appStore.addNotification('Screen share failed', 'error') }
    } else {
      stopScreenShare()
    }
  }

  async function stopScreenShare() {
    screenStream.value?.getTracks().forEach(t => t.stop())
    screenStream.value = null
    isScreenSharing.value = false
    // Restore camera
    if (appStore.callState.isVideoEnabled && localStream.value) {
      const peerConnId = appStore.callState.peerConnectionId
      const call = mediaConnections.get(peerConnId)
      if (call?.peerConnection) {
        const vTrack = localStream.value.getVideoTracks()[0]
        const sender = call.peerConnection.getSenders().find(s => s.track?.kind === 'video')
        if (sender && vTrack) await sender.replaceTrack(vTrack)
      }
    }
  }

  function toggleHold() {
    const isOnHold = !appStore.callState.isOnHold
    localStream.value?.getAudioTracks().forEach(t => { t.enabled = !isOnHold })
    appStore.updateCallState({ isOnHold })
    sendDataToPeer(appStore.callState.peerConnectionId, { type: 'hold', data: isOnHold })
    if (isOnHold) playHoldAudio(); else stopHoldAudio()
  }

  async function changeAudioInput(deviceId: string) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId }, video: appStore.callState.isVideoEnabled })
    if (localStream.value) {
      const oldTrack = localStream.value.getAudioTracks()[0]
      localStream.value.removeTrack(oldTrack); oldTrack.stop()
      localStream.value.addTrack(stream.getAudioTracks()[0])
      const peerConnId = appStore.callState.peerConnectionId
      const call = mediaConnections.get(peerConnId)
      if (call?.peerConnection) {
        const sender = call.peerConnection.getSenders().find(s => s.track?.kind === 'audio')
        if (sender) await sender.replaceTrack(stream.getAudioTracks()[0])
      }
    }
    appStore.updateCallState({ currentAudioInput: deviceId })
  }

  async function changeVideoInput(deviceId: string) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { deviceId } })
    if (localStream.value) {
      const oldTrack = localStream.value.getVideoTracks()[0]
      localStream.value.removeTrack(oldTrack); oldTrack.stop()
      localStream.value.addTrack(stream.getVideoTracks()[0])
      const peerConnId = appStore.callState.peerConnectionId
      const call = mediaConnections.get(peerConnId)
      if (call?.peerConnection) {
        const sender = call.peerConnection.getSenders().find(s => s.track?.kind === 'video')
        if (sender) await sender.replaceTrack(stream.getVideoTracks()[0])
      }
    }
    appStore.updateCallState({ currentVideoInput: deviceId })
  }

  // ─── Audio ──────────────────────────────────────────────────────────────────
  function playRingtone() {
    if (!ringtoneAudio.value) {
      ringtoneAudio.value = new Audio('https://techassistantforblind.com/file/processing.mp3')
      ringtoneAudio.value.loop = true
    }
    ringtoneAudio.value.play().catch(() => {})
  }
  function stopRingtone() {
    ringtoneAudio.value?.pause()
    if (ringtoneAudio.value) ringtoneAudio.value.currentTime = 0
  }
  function playHoldAudio() {
    if (!holdAudio.value) {
      holdAudio.value = new Audio('https://techassistantforblind.com/file/processing.mp3')
      holdAudio.value.loop = true
    }
    holdAudio.value.play().catch(() => {})
  }
  function stopHoldAudio() {
    holdAudio.value?.pause()
    if (holdAudio.value) holdAudio.value.currentTime = 0
  }

  return {
    peer,
    myPeerConnectionId,
    connections,
    localStream,
    remoteStream,
    screenStream,
    isScreenSharing,
    initializePeer,
    connectToPeer,
    sendDataToPeer,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    toggleHold,
    changeAudioInput,
    changeVideoInput
  }
})
