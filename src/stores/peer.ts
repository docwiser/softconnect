// src/stores/peer.ts
import { defineStore } from 'pinia'
import { ref, markRaw } from 'vue'
import Peer from 'peerjs'
import type { MediaConnection, DataConnection} from 'peerjs'
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
  // Fix TS2739: use the actual return type of peer.connect()
  const connections = ref(new Map<string, DataConnection>())
  const mediaConnections = new Map<string, MediaConnection>()

  const localStream = ref<MediaStream | null>(null)
  const remoteStream = ref<MediaStream | null>(null)
  const screenStream = ref<MediaStream | null>(null)
  const isScreenSharing = ref(false)

  // Connection status tracking
  const peerConnectionStatus = ref<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected')
  const remotePeerOnline = ref(false)

  const ringtoneAudio = ref<HTMLAudioElement | null>(null)
  const holdAudio = ref<HTMLAudioElement | null>(null)

  // ─── Peer Initialization ───────────────────────────────────────────────────
  async function initializePeer(uid: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Destroy existing peer if any
      if (peer.value && !peer.value.destroyed) {
        resolve(myPeerConnectionId.value)
        return
      }

      const peerId = `sc_${uid}`
      const peerInstance = new Peer(peerId, {
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

      const timeout = setTimeout(() => {
        reject(new Error('PeerJS init timeout'))
      }, 15000)

      peerInstance.on('open', async (id) => {
        clearTimeout(timeout)
        peer.value = markRaw(peerInstance)
        myPeerConnectionId.value = id
        peerConnectionStatus.value = 'connected'
        setupPeerListeners()
        try {
          await setDoc(doc(db, 'peerIds', uid), { peerId: id, updatedAt: Timestamp.now() })
        } catch (e) { console.warn('Could not store peer ID', e) }
        resolve(id)
      })

      peerInstance.on('error', (err) => {
        clearTimeout(timeout)
        console.error('PeerJS error:', err)
        if ((err as any).type === 'unavailable-id') {
          // ID taken — try fallback with random suffix
          const fallbackId = `sc_${uid}_${Math.random().toString(36).slice(2, 7)}`
          const fallbackPeer = new Peer(fallbackId, (peerInstance as any)._options)
          fallbackPeer.on('open', async (id) => {
            peer.value = markRaw(fallbackPeer)
            myPeerConnectionId.value = id
            peerConnectionStatus.value = 'connected'
            setupPeerListeners()
            try {
              await setDoc(doc(db, 'peerIds', uid), { peerId: id, updatedAt: Timestamp.now() })
            } catch {}
            resolve(id)
          })
          fallbackPeer.on('error', reject)
        } else {
          peerConnectionStatus.value = 'failed'
          reject(err)
        }
      })

      peerInstance.on('disconnected', () => {
        peerConnectionStatus.value = 'disconnected'
        // Auto-reconnect after 3s
        setTimeout(() => {
          if (peer.value && !peer.value.destroyed) {
            peer.value.reconnect()
            peerConnectionStatus.value = 'connecting'
          }
        }, 3000)
      })
    })
  }

  function setupPeerListeners() {
    if (!peer.value) return
    peer.value.on('connection', handleIncomingConnection)
    peer.value.on('call', handleIncomingMediaCall)
  }

  function handleIncomingConnection(conn: DataConnection) {
    conn.on('open', () => {
      connections.value.set(conn.peer, conn)
      conn.on('data', (data: unknown) => handleDataMessage(conn.peer, data as any))
      conn.on('close', () => connections.value.delete(conn.peer))
      conn.on('error', (e: Error) => console.warn('Connection error:', e))
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
        appStore.addNotification(`New message from ${data.data?.senderName}`)
        break
      case 'ping':
        // respond to connectivity check
        sendDataToPeer(fromPeerId, { type: 'pong' })
        break
    }
  }

  // ─── Connection ─────────────────────────────────────────────────────────────
  async function connectToPeer(targetPeerId: string, timeoutMs = 10000): Promise<DataConnection> {
    if (!peer.value) throw new Error('Peer not initialized')

    const existing = connections.value.get(targetPeerId)
    if (existing?.open) return existing as DataConnection
    return new Promise((resolve, reject) => {
      const conn = peer.value!.connect(targetPeerId, { reliable: true })
      const timer = setTimeout(() => {
        reject(new Error('Connection timeout'))
      }, timeoutMs)

      conn.on('open', () => {
        clearTimeout(timer)
        connections.value.set(targetPeerId, conn)
        conn.on('data', (data: unknown) => handleDataMessage(targetPeerId, data as any))
        conn.on('close', () => connections.value.delete(targetPeerId))
        resolve(conn)
      })
      conn.on('error', (e: Error) => {
        clearTimeout(timer)
        reject(e)
      })
    })
  }

  /**
   * Check if a remote peer is reachable. Returns true if connected.
   */
  async function checkPeerOnline(targetPeerConnectionId: string): Promise<boolean> {
    if (!peer.value) return false
    try {
      await connectToPeer(targetPeerConnectionId, 5000)
      remotePeerOnline.value = true
      return true
    } catch {
      remotePeerOnline.value = false
      return false
    }
  }

  function sendDataToPeer(targetPeerId: string, data: any) {
    const conn = connections.value.get(targetPeerId)
    if (conn?.open) {
      conn.send(data)
    }
  }

  // ─── Calling ─────────────────────────────────────────────────────────────────
  async function startCall(targetUid: string, targetPeerConnectionId: string, withVideo: boolean): Promise<boolean> {
    if (appStore.callState.isActive || appStore.callState.isIncoming) {
      sendDataToPeer(targetPeerConnectionId, { type: 'call-busy' })
      return false
    }

    try {
      // First check if peer is reachable
      let conn: DataConnection
      try {
        conn = await connectToPeer(targetPeerConnectionId, 6000)
      } catch {
        appStore.addNotification(`${appStore.callState.peerName || 'User'} can't take the call right now. You can leave them a message.`, 'warning')
        return false
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: withVideo
      })
      localStream.value = stream

      // Signal call-request via data channel
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
        isIncoming: false,
        peerId: targetUid,
        peerConnectionId: targetPeerConnectionId,
        isVideoEnabled: withVideo,
        callId,
        startedAt: Date.now()
      })

      return true
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        appStore.addNotification('Microphone/Camera permission denied', 'error')
      } else if (err?.name === 'NotFoundError') {
        appStore.addNotification('No microphone found', 'error')
      } else {
        appStore.addNotification('Failed to start call', 'error')
      }
      console.error('startCall error:', err)
      cleanupCall()
      return false
    }
  }

  function handleIncomingMediaCall(call: MediaConnection) {
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
      isOutgoing: false,
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
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        appStore.addNotification('Camera/Microphone permission denied', 'error')
      } else {
        appStore.addNotification('Failed to access media devices', 'error')
      }
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
    if (data?.message) {
      appStore.addNotification(`Message: "${data.message}"`, 'info')
    } else {
      appStore.addNotification(`Call declined: ${data?.reason || 'No answer'}`, 'warning')
    }
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
    appStore.addNotification('User is currently in another call', 'warning')
    cleanupCall()
  }

  function handleRemoteHold(isOnHold: boolean) {
    // When the other person puts US on hold, we stop hearing THEM (their stream tracks should already be disabled by them)
    // but we also mute locally to be sure and play hold music
    remoteStream.value?.getAudioTracks().forEach(t => { t.enabled = !isOnHold })
    
    appStore.updateCallState({ isOnHold })
    appStore.addNotification(isOnHold ? 'You were put on hold' : 'Call resumed')
    
    if (isOnHold) playHoldAudio(); else stopHoldAudio()
  }

  function endCall() {
    const peerConnId = appStore.callState.peerConnectionId
    sendDataToPeer(peerConnId, { type: 'call-end' })

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
    remotePeerOnline.value = false

    stopRingtone()
    stopHoldAudio()
    appStore.resetCallState()
  }

  function setupCallListeners(call: MediaConnection, peerConnId: string) {
    call.on('stream', (stream) => {
      remoteStream.value = stream
    })
    
    // Add ontrack listener to catch added tracks (like video added later)
    if (call.peerConnection) {
      call.peerConnection.ontrack = (event) => {
        if (remoteStream.value) {
          if (!remoteStream.value.getTracks().includes(event.track)) {
            remoteStream.value.addTrack(event.track)
          }
        } else {
          remoteStream.value = event.streams[0]
        }
      }
    }

    call.on('close', () => {
      appStore.addNotification('Call ended', 'info')
      cleanupCall()
    })
    call.on('error', (e: Error) => {
      console.error('Call error:', e)
      appStore.addNotification('Call connection error', 'error')
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
      try {
        // Try to get video track only if we already have audio
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        const vTrack = stream.getVideoTracks()[0]
        
        if (localStream.value) {
          localStream.value.addTrack(vTrack)
        } else {
          localStream.value = stream
        }

        const peerConnId = appStore.callState.peerConnectionId
        const call = mediaConnections.get(peerConnId)
        if (call?.peerConnection) {
          const sender = call.peerConnection.getSenders().find(s => s.track?.kind === 'video')
          if (sender) {
            await sender.replaceTrack(vTrack)
          } else {
            // If no video sender exists, we have to add it.
            // Note: PeerJS might not automatically re-negotiate here.
            call.peerConnection.addTrack(vTrack, localStream.value!)
            // Some PeerJS versions/browsers need a manual renegotiation hint or just work if using Unified Plan
          }
        }
        appStore.updateCallState({ isVideoEnabled: true })
      } catch (err: any) {
        console.error('toggleVideo error:', err)
        throw new Error('Camera access denied or failed')
      }
    } else {
      const vTrack = localStream.value?.getVideoTracks()[0]
      if (vTrack) {
        vTrack.enabled = false
        vTrack.stop()
        localStream.value?.removeTrack(vTrack)
      }
      appStore.updateCallState({ isVideoEnabled: false })
      // Inform the other side we stopped video
      sendDataToPeer(appStore.callState.peerConnectionId, { type: 'config', data: { video: false } })
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
      } catch {
        appStore.addNotification('Screen share cancelled or failed', 'warning')
      }
    } else {
      stopScreenShare()
    }
  }

  async function stopScreenShare() {
    screenStream.value?.getTracks().forEach(t => t.stop())
    screenStream.value = null
    isScreenSharing.value = false
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
    
    // Mute our microphone so they don't hear us
    localStream.value?.getAudioTracks().forEach(t => { t.enabled = !isOnHold })
    
    // Mute their incoming audio so we don't hear them
    remoteStream.value?.getAudioTracks().forEach(t => { t.enabled = !isOnHold })

    appStore.updateCallState({ isOnHold })
    sendDataToPeer(appStore.callState.peerConnectionId, { type: 'hold', data: isOnHold })
    
    if (isOnHold) playHoldAudio(); else stopHoldAudio()
  }

  async function changeAudioInput(deviceId: string) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId },
        video: appStore.callState.isVideoEnabled
      })
      if (localStream.value) {
        const oldTrack = localStream.value.getAudioTracks()[0]
        if (oldTrack) { localStream.value.removeTrack(oldTrack); oldTrack.stop() }
        localStream.value.addTrack(stream.getAudioTracks()[0])
        const peerConnId = appStore.callState.peerConnectionId
        const call = mediaConnections.get(peerConnId)
        if (call?.peerConnection) {
          const sender = call.peerConnection.getSenders().find(s => s.track?.kind === 'audio')
          if (sender) await sender.replaceTrack(stream.getAudioTracks()[0])
        }
      }
      appStore.updateCallState({ currentAudioInput: deviceId })
    } catch { appStore.addNotification('Could not switch microphone', 'error') }
  }

  async function changeVideoInput(deviceId: string) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { deviceId } })
      if (localStream.value) {
        const oldTrack = localStream.value.getVideoTracks()[0]
        if (oldTrack) { localStream.value.removeTrack(oldTrack); oldTrack.stop() }
        localStream.value.addTrack(stream.getVideoTracks()[0])
        const peerConnId = appStore.callState.peerConnectionId
        const call = mediaConnections.get(peerConnId)
        if (call?.peerConnection) {
          const sender = call.peerConnection.getSenders().find(s => s.track?.kind === 'video')
          if (sender) await sender.replaceTrack(stream.getVideoTracks()[0])
        }
      }
      appStore.updateCallState({ currentVideoInput: deviceId })
    } catch { appStore.addNotification('Could not switch camera', 'error') }
  }

  // ─── Audio Helpers ──────────────────────────────────────────────────────────
  function playRingtone() {
    if (!ringtoneAudio.value) {
      ringtoneAudio.value = new Audio('/sounds/ringtone.mp3')
      ringtoneAudio.value.loop = true
      ringtoneAudio.value.volume = 0.7
    }
    ringtoneAudio.value.play().catch(() => {})
  }
  function stopRingtone() {
    ringtoneAudio.value?.pause()
    if (ringtoneAudio.value) ringtoneAudio.value.currentTime = 0
  }
  function playHoldAudio() {
    if (!holdAudio.value) {
      holdAudio.value = new Audio('/sounds/hold.mp3')
      holdAudio.value.loop = true
      holdAudio.value.volume = 0.4
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
    peerConnectionStatus,
    remotePeerOnline,
    initializePeer,
    connectToPeer,
    checkPeerOnline,
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
