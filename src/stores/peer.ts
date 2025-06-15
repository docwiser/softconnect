import { defineStore } from 'pinia';
import { ref } from 'vue';
import Peer from 'peerjs';
import type { DataConnection, MediaConnection } from 'peerjs';
import { useAppStore } from './app';
import type { PeerConfig, CallRejectMessage } from '../types';

export const usePeerStore = defineStore('peer', () => {
  const appStore = useAppStore();
  
  const peer = ref<Peer | null>(null);
  const connections = ref<Map<string, DataConnection>>(new Map());
  const mediaConnections = ref<Map<string, MediaConnection>>(new Map());
  const localStream = ref<MediaStream | null>(null);
  const remoteStream = ref<MediaStream | null>(null);
  const ringtoneAudio = ref<HTMLAudioElement | null>(null);
  const holdAudio = ref<HTMLAudioElement | null>(null);
  
  function generatePeerId(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }
  
  async function initializePeer(userName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const peerId = generatePeerId();
      
      peer.value = new Peer(peerId, {
        debug: 2,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });
      
      peer.value.on('open', (id) => {
        appStore.setCurrentUser({
          id,
          name: userName,
          isOnline: true
        });
        setupPeerEventListeners();
        resolve(id);
      });
      
      peer.value.on('error', (error) => {
        console.error('PeerJS error:', error);
        reject(error);
      });
    });
  }
  
  function setupPeerEventListeners() {
    if (!peer.value) return;
    
    peer.value.on('connection', handleIncomingConnection);
    peer.value.on('call', handleIncomingCall);
  }
  
  function handleIncomingConnection(conn: DataConnection) {
    conn.on('open', () => {
      connections.value.set(conn.peer, conn);
      
      // Send our config
      const config: PeerConfig = {
        name: appStore.currentUser?.name || 'Unknown',
        version: '1.0'
      };
      conn.send({ type: 'config', data: config });
      
      setupConnectionListeners(conn);
    });
  }
  
  function setupConnectionListeners(conn: DataConnection) {
    conn.on('data', (data: any) => {
      handleIncomingData(conn.peer, data);
    });
    
    conn.on('close', () => {
      connections.value.delete(conn.peer);
    });
  }
  
  function handleIncomingData(peerId: string, data: any) {
    switch (data.type) {
      case 'config':
        appStore.addChat(peerId, data.data.name);
        appStore.addNotification(`${data.data.name} connected`);
        break;
        
      case 'message':
        const chat = appStore.chats.find(c => c.peerId === peerId);
        if (chat) {
          appStore.addMessage(peerId, {
            id: Date.now().toString(),
            senderId: peerId,
            content: data.data,
            timestamp: Date.now(),
            type: 'text'
          });
          appStore.addNotification(`New message from ${chat.peerName}`);
        }
        break;
        
      case 'call-request':
        handleCallRequest(peerId, data.data);
        break;
        
      case 'call-reject':
        handleCallReject(data.data);
        break;
        
      case 'call-busy':
        handleCallBusy();
        break;
        
      case 'hold':
        handleRemoteHold(data.data);
        break;
    }
  }
  
  async function connectToPeer(peerId: string): Promise<void> {
    if (!peer.value) throw new Error('Peer not initialized');
    
    const conn = peer.value.connect(peerId);
    
    return new Promise((resolve, reject) => {
      conn.on('open', () => {
        connections.value.set(peerId, conn);
        
        // Send our config
        const config: PeerConfig = {
          name: appStore.currentUser?.name || 'Unknown',
          version: '1.0'
        };
        conn.send({ type: 'config', data: config });
        
        setupConnectionListeners(conn);
        resolve();
      });
      
      conn.on('error', (error) => {
        appStore.addNotification(`Failed to connect to ${peerId}`);
        reject(error);
      });
    });
  }
  
  function sendMessage(peerId: string, message: string) {
    const conn = connections.value.get(peerId);
    if (conn) {
      conn.send({ type: 'message', data: message });
      
      appStore.addMessage(peerId, {
        id: Date.now().toString(),
        senderId: appStore.currentUser?.id || '',
        content: message,
        timestamp: Date.now(),
        type: 'text'
      });
    }
  }
  
  async function startCall(peerId: string, video: boolean = false) {
    // Check if already in a call
    if (appStore.callState.isActive || appStore.callState.isIncoming) {
      const conn = connections.value.get(peerId);
      if (conn) {
        conn.send({ type: 'call-busy' });
      }
      appStore.addNotification('Cannot start call - another call is in progress');
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: video
      });
      
      localStream.value = stream;
      
      const call = peer.value?.call(peerId, stream);
      if (call) {
        mediaConnections.value.set(peerId, call);
        setupCallListeners(call);
        
        appStore.updateCallState({
          isActive: true,
          isOutgoing: true,
          peerId,
          peerName: appStore.chats.find(c => c.peerId === peerId)?.peerName || 'Unknown',
          isVideoEnabled: video
        });
        
        // Send call request notification
        const conn = connections.value.get(peerId);
        if (conn) {
          conn.send({ 
            type: 'call-request', 
            data: { 
              callerName: appStore.currentUser?.name,
              hasVideo: video 
            } 
          });
        }
      }
    } catch (error) {
      appStore.addNotification('Failed to access media devices');
      console.error('Error starting call:', error);
    }
  }
  
  function handleIncomingCall(call: MediaConnection) {
    // Check if already in a call
    if (appStore.callState.isActive || appStore.callState.isIncoming) {
      call.close();
      const conn = connections.value.get(call.peer);
      if (conn) {
        conn.send({ type: 'call-busy' });
      }
      return;
    }
    
    appStore.updateCallState({
      isActive: true,
      isIncoming: true,
      peerId: call.peer,
      peerName: appStore.chats.find(c => c.peerId === call.peer)?.peerName || 'Unknown'
    });
    
    // Play ringtone
    playRingtone();
    
    mediaConnections.value.set(call.peer, call);
  }
  
  function handleCallRequest(peerId: string, data: any) {
    // This is handled by the incoming call event
  }
  
  function handleCallReject(data: CallRejectMessage) {
    appStore.updateCallState({
      isActive: false,
      isIncoming: false,
      isOutgoing: false
    });
    
    appStore.addNotification(`Call rejected: ${data.reason}`);
    if (data.message) {
      appStore.addNotification(`Message: ${data.message}`);
    }
    
    stopRingtone();
    endCall();
  }
  
  function handleCallBusy() {
    appStore.updateCallState({
      isActive: false,
      isIncoming: false,
      isOutgoing: false
    });
    
    appStore.addNotification('User is busy - another call is in progress');
    stopRingtone();
    endCall();
  }
  
  function handleRemoteHold(isOnHold: boolean) {
    // Remote hold doesn't affect local hold state
    if (isOnHold) {
      appStore.addNotification('Remote party put the call on hold');
    } else {
      appStore.addNotification('Remote party resumed the call');
    }
  }
  
  async function answerCall(withVideo: boolean = false) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: withVideo
      });
      
      localStream.value = stream;
      
      const call = mediaConnections.value.get(appStore.callState.peerId);
      if (call) {
        call.answer(stream);
        setupCallListeners(call);
        
        appStore.updateCallState({
          isIncoming: false,
          isVideoEnabled: withVideo
        });
        
        stopRingtone();
      }
    } catch (error) {
      appStore.addNotification('Failed to access media devices');
      console.error('Error answering call:', error);
    }
  }
  
  function rejectCall(reason: string, customMessage?: string) {
    const conn = connections.value.get(appStore.callState.peerId);
    if (conn) {
      conn.send({ 
        type: 'call-reject', 
        data: { reason, message: customMessage } 
      });
    }
    
    appStore.updateCallState({
      isActive: false,
      isIncoming: false,
      isOutgoing: false
    });
    
    stopRingtone();
    endCall();
  }
  
  function setupCallListeners(call: MediaConnection) {
    call.on('stream', (stream) => {
      remoteStream.value = stream;
    });
    
    call.on('close', () => {
      endCall();
    });
    
    call.on('error', (error) => {
      appStore.addNotification('Call error occurred');
      console.error('Call error:', error);
      endCall();
    });
  }
  
  function endCall() {
    const peerId = appStore.callState.peerId;
    const call = mediaConnections.value.get(peerId);
    
    if (call) {
      call.close();
      mediaConnections.value.delete(peerId);
    }
    
    if (localStream.value) {
      localStream.value.getTracks().forEach(track => track.stop());
      localStream.value = null;
    }
    
    remoteStream.value = null;
    
    appStore.updateCallState({
      isActive: false,
      isIncoming: false,
      isOutgoing: false,
      isOnHold: false
    });
    
    stopRingtone();
    stopHoldAudio();
  }
  
  function toggleMute() {
    if (localStream.value) {
      const audioTrack = localStream.value.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        appStore.updateCallState({ isMuted: !audioTrack.enabled });
        appStore.addNotification(audioTrack.enabled ? 'Unmuted' : 'Muted');
      }
    }
  }
  
  async function toggleVideo() {
    if (!appStore.callState.isVideoEnabled) {
      // Turning on video - request permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true
        });
        
        // Replace the current stream
        if (localStream.value) {
          localStream.value.getTracks().forEach(track => track.stop());
        }
        
        localStream.value = stream;
        
        // Update the peer connection with new stream
        const call = mediaConnections.value.get(appStore.callState.peerId);
        if (call && call.peerConnection) {
          const videoTrack = stream.getVideoTracks()[0];
          const sender = call.peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          
          if (sender) {
            await sender.replaceTrack(videoTrack);
          } else {
            call.peerConnection.addTrack(videoTrack, stream);
          }
        }
        
        appStore.updateCallState({ isVideoEnabled: true });
        appStore.addNotification('Camera turned on');
      } catch (error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Camera permission denied');
        } else {
          throw new Error('Failed to access camera');
        }
      }
    } else {
      // Turning off video
      if (localStream.value) {
        const videoTrack = localStream.value.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = false;
          appStore.updateCallState({ isVideoEnabled: false });
          appStore.addNotification('Camera turned off');
        }
      }
    }
  }
  
  function toggleHold() {
    const isOnHold = !appStore.callState.isOnHold;
    appStore.updateCallState({ isOnHold });
    
    if (isOnHold) {
      // Mute local stream when on hold
      if (localStream.value) {
        localStream.value.getAudioTracks().forEach(track => track.enabled = false);
      }
      playHoldAudio();
      appStore.addNotification('Call on hold');
    } else {
      // Unmute local stream when resuming
      if (localStream.value) {
        localStream.value.getAudioTracks().forEach(track => track.enabled = true);
      }
      stopHoldAudio();
      appStore.addNotification('Call resumed');
    }
  }
  
  function playRingtone() {
    if (!ringtoneAudio.value) {
      ringtoneAudio.value = new Audio('https://techassistantforblind.com/file/processing.mp3');
      ringtoneAudio.value.loop = true;
    }
    ringtoneAudio.value.play().catch(console.error);
  }
  
  function stopRingtone() {
    if (ringtoneAudio.value) {
      ringtoneAudio.value.pause();
      ringtoneAudio.value.currentTime = 0;
    }
  }
  
  function playHoldAudio() {
    if (!holdAudio.value) {
      holdAudio.value = new Audio('https://techassistantforblind.com/file/processing.mp3');
      holdAudio.value.loop = true;
    }
    holdAudio.value.play().catch(console.error);
  }
  
  function stopHoldAudio() {
    if (holdAudio.value) {
      holdAudio.value.pause();
      holdAudio.value.currentTime = 0;
    }
  }
  
  async function changeAudioInput(deviceId: string) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId },
        video: appStore.callState.isVideoEnabled
      });
      
      // Replace audio track in existing stream
      if (localStream.value) {
        const audioTrack = stream.getAudioTracks()[0];
        const oldAudioTrack = localStream.value.getAudioTracks()[0];
        
        if (oldAudioTrack) {
          localStream.value.removeTrack(oldAudioTrack);
          oldAudioTrack.stop();
        }
        
        localStream.value.addTrack(audioTrack);
        
        // Update peer connection
        const call = mediaConnections.value.get(appStore.callState.peerId);
        if (call && call.peerConnection) {
          const sender = call.peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'audio'
          );
          if (sender) {
            await sender.replaceTrack(audioTrack);
          }
        }
      }
      
      appStore.updateCallState({ currentAudioInput: deviceId });
      appStore.addNotification('Audio input changed');
    } catch (error) {
      appStore.addNotification('Failed to change audio input');
      console.error('Error changing audio input:', error);
    }
  }
  
  async function changeVideoInput(deviceId: string) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { deviceId }
      });
      
      // Replace video track in existing stream
      if (localStream.value) {
        const videoTrack = stream.getVideoTracks()[0];
        const oldVideoTrack = localStream.value.getVideoTracks()[0];
        
        if (oldVideoTrack) {
          localStream.value.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }
        
        localStream.value.addTrack(videoTrack);
        
        // Update peer connection
        const call = mediaConnections.value.get(appStore.callState.peerId);
        if (call && call.peerConnection) {
          const sender = call.peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          if (sender) {
            await sender.replaceTrack(videoTrack);
          }
        }
      }
      
      appStore.updateCallState({ currentVideoInput: deviceId });
      appStore.addNotification('Camera changed');
    } catch (error) {
      appStore.addNotification('Failed to change camera');
      console.error('Error changing video input:', error);
    }
  }
  
  return {
    // State
    peer,
    connections,
    mediaConnections,
    localStream,
    remoteStream,
    
    // Actions
    generatePeerId,
    initializePeer,
    connectToPeer,
    sendMessage,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleHold,
    changeAudioInput,
    changeVideoInput
  };
});