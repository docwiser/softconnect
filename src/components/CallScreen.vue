<template>
  <div class="call-screen" :class="{ 'incoming-mode': callState.isIncoming }">

    <!-- Incoming Call UI -->
    <div v-if="callState.isIncoming" class="incoming-overlay">
      <div class="incoming-content">
        <div class="ringing-avatar">
          <img v-if="callState.peerPhoto" :src="callState.peerPhoto" :alt="callState.peerName" />
          <span v-else>{{ callState.peerName.charAt(0).toUpperCase() }}</span>
          <div class="ring-pulse"></div>
        </div>
        <h1>{{ callState.peerName }}</h1>
        <p class="call-type-label">Incoming {{ callState.isVideoEnabled ? 'Video' : 'Voice' }} Call</p>

        <div v-if="showRejectOptions" class="reject-panel">
          <h3>Reply with message</h3>
          <div class="quick-replies">
            <button v-for="r in quickReplies" :key="r" @click="rejectWith(r)">{{ r }}</button>
          </div>
          <textarea v-model="customRejectMsg" placeholder="Custom message…" rows="2"></textarea>
          <div class="reject-actions">
            <button class="btn-outline" @click="showRejectOptions = false">Back</button>
            <button class="btn-danger-sm" @click="rejectWith('Custom', customRejectMsg)" :disabled="!customRejectMsg.trim()">Send & Reject</button>
          </div>
        </div>

        <div v-else class="incoming-actions">
          <button class="answer-btn voice-answer" @click="answer(false)" aria-label="Answer voice call">
            <span>📞</span>
          </button>
          <button v-if="callState.isVideoEnabled" class="answer-btn video-answer" @click="answer(true)" aria-label="Answer video call">
            <span>📹</span>
          </button>
          <button class="answer-btn reject-answer" @click="showRejectOptions = true" aria-label="Reject call">
            <span>📵</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Active Call UI -->
    <div v-else-if="callState.isActive" class="active-call">
      <header class="call-header">
        <button class="back-to-chat-btn" @click="backToChat">
          ← Chat
        </button>
        <div class="call-header-info">
          <span class="call-peer">{{ callState.peerName }}</span>
          <span class="call-status">{{ callStatusText }}</span>
        </div>
        <span class="call-timer">{{ timerDisplay }}</span>
      </header>

      <!-- Video / Audio Display -->
      <div class="media-area">
        <div v-if="callState.isVideoEnabled || hasRemoteVideo" class="video-container">
          <video ref="remoteVideoEl" class="remote-video" autoplay playsinline :aria-label="`Video from ${callState.peerName}`"></video>
          <video ref="localVideoEl" class="local-video" autoplay playsinline muted aria-label="Your video"></video>
          <div v-if="peerStore.isScreenSharing" class="screen-share-badge">📺 Sharing Screen</div>
        </div>
        <div v-else class="audio-display">
          <div class="audio-avatar">
            <img v-if="callState.peerPhoto" :src="callState.peerPhoto" :alt="callState.peerName" />
            <span v-else>{{ callState.peerName.charAt(0).toUpperCase() }}</span>
            <div v-if="!callState.isMuted" class="speaking-indicator"></div>
          </div>
          <p class="audio-peer-name">{{ callState.peerName }}</p>
          <p v-if="callState.isOnHold" class="hold-label">⏸ On Hold</p>
        </div>
      </div>

      <!-- Controls -->
      <div class="controls-bar" role="toolbar" aria-label="Call controls">
        <button
          :class="['ctrl-btn', { active: callState.isMuted }]"
          @click="peerStore.toggleMute()"
          :aria-label="callState.isMuted ? 'Unmute' : 'Mute'"
          :aria-pressed="callState.isMuted"
        >
          <span>{{ callState.isMuted ? '🔇' : '🎤' }}</span>
          <span class="ctrl-label">{{ callState.isMuted ? 'Unmute' : 'Mute' }}</span>
        </button>

        <button
          :class="['ctrl-btn', { active: callState.isVideoEnabled }]"
          @click="toggleVideo"
          :aria-label="callState.isVideoEnabled ? 'Camera off' : 'Camera on'"
        >
          <span>{{ callState.isVideoEnabled ? '📹' : '📷' }}</span>
          <span class="ctrl-label">Camera</span>
        </button>

        <button
          :class="['ctrl-btn', { active: peerStore.isScreenSharing }]"
          @click="peerStore.toggleScreenShare()"
          aria-label="Toggle screen share"
        >
          <span>🖥</span>
          <span class="ctrl-label">Screen</span>
        </button>

        <button
          :class="['ctrl-btn', { active: callState.isOnHold }]"
          @click="peerStore.toggleHold()"
          :aria-label="callState.isOnHold ? 'Resume' : 'Hold'"
        >
          <span>{{ callState.isOnHold ? '▶️' : '⏸' }}</span>
          <span class="ctrl-label">{{ callState.isOnHold ? 'Resume' : 'Hold' }}</span>
        </button>

        <button
          class="ctrl-btn settings-ctrl"
          @click="showSettings = !showSettings"
          :aria-pressed="showSettings"
          aria-label="Settings"
        >
          <span>⚙️</span>
          <span class="ctrl-label">Settings</span>
        </button>

        <button
          class="ctrl-btn end-ctrl"
          @click="endCall"
          aria-label="End call"
        >
          <span>📞</span>
          <span class="ctrl-label">End</span>
        </button>
      </div>

      <!-- Settings Panel -->
      <div v-if="showSettings" class="settings-panel" role="dialog" aria-label="Call Settings">
        <h3>Call Settings</h3>

        <label>Microphone
          <select :value="callState.currentAudioInput" @change="peerStore.changeAudioInput(($event.target as HTMLSelectElement).value)">
            <option v-for="d in audioInputs" :key="d.deviceId" :value="d.deviceId">{{ d.label || 'Microphone ' + d.deviceId.slice(0,6) }}</option>
          </select>
        </label>

        <label>Speaker
          <select :value="callState.currentAudioOutput" @change="changeOutput(($event.target as HTMLSelectElement).value)">
            <option v-for="d in audioOutputs" :key="d.deviceId" :value="d.deviceId">{{ d.label || 'Speaker ' + d.deviceId.slice(0,6) }}</option>
          </select>
        </label>

        <label v-if="callState.isVideoEnabled">Camera
          <select :value="callState.currentVideoInput" @change="peerStore.changeVideoInput(($event.target as HTMLSelectElement).value)">
            <option v-for="d in videoInputs" :key="d.deviceId" :value="d.deviceId">{{ d.label || 'Camera ' + d.deviceId.slice(0,6) }}</option>
          </select>
        </label>

        <label>Speed
          <div class="speed-row">
            <input type="range" min="0.5" max="3" step="0.1" :value="callState.playbackSpeed" @input="setSpeed" />
            <span>{{ callState.playbackSpeed.toFixed(1) }}x</span>
          </div>
        </label>

        <button class="close-settings-btn" @click="showSettings = false">Close</button>
      </div>
    </div>

    <!-- No call -->
    <div v-else class="no-call">
      <p>No active call</p>
      <RouterLink to="/dashboard" class="go-home-btn">Go to Dashboard</RouterLink>
    </div>

    <div aria-live="assertive" class="sr-only">{{ announcement }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { usePeerStore } from '../stores/peer'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const peerStore = usePeerStore()

const callState = computed(() => appStore.callState)
const announcement = ref('')
const showSettings = ref(false)
const showRejectOptions = ref(false)
const customRejectMsg = ref('')
const hasRemoteVideo = ref(false)
const callTimer = ref(0)
const callStartTime = ref(0)
const audioInputs = ref<MediaDeviceInfo[]>([])
const audioOutputs = ref<MediaDeviceInfo[]>([])
const videoInputs = ref<MediaDeviceInfo[]>([])

const remoteVideoEl = ref<HTMLVideoElement>()
const localVideoEl = ref<HTMLVideoElement>()

let timerInterval: ReturnType<typeof setInterval> | null = null

const quickReplies = ["Can't talk now", "In a meeting", "Will call back", "Driving"]

const callStatusText = computed(() => {
  if (callState.value.isOnHold) return 'On Hold'
  if (callState.value.isOutgoing && !peerStore.remoteStream) return 'Calling…'
  return 'Connected'
})

const timerDisplay = computed(() => {
  const s = Math.floor(callTimer.value / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}:${String(m % 60).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`
  return `${m}:${String(s % 60).padStart(2,'0')}`
})

onMounted(async () => {
  // Load devices
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    audioInputs.value = devices.filter(d => d.kind === 'audioinput')
    audioOutputs.value = devices.filter(d => d.kind === 'audiooutput')
    videoInputs.value = devices.filter(d => d.kind === 'videoinput')
  } catch {}

  if (callState.value.isActive && !callState.value.isIncoming) {
    startTimer()
    setupStreams()
  }

  if (callState.value.isIncoming) {
    announcement.value = `Incoming ${callState.value.isVideoEnabled ? 'video' : 'voice'} call from ${callState.value.peerName}`
  }
})

onUnmounted(() => {
  stopTimer()
})

watch(() => peerStore.remoteStream, (stream) => {
  if (stream && remoteVideoEl.value) {
    remoteVideoEl.value.srcObject = stream
    hasRemoteVideo.value = stream.getVideoTracks().length > 0
  }
})

watch(() => peerStore.localStream, (stream) => {
  if (stream && localVideoEl.value) {
    localVideoEl.value.srcObject = stream
  }
})

watch(() => callState.value.isActive, (active) => {
  if (active && !callState.value.isIncoming) {
    startTimer()
    nextTick(setupStreams)
  } else {
    stopTimer()
  }
})

function setupStreams() {
  if (peerStore.localStream && localVideoEl.value) {
    localVideoEl.value.srcObject = peerStore.localStream
  }
  if (peerStore.remoteStream && remoteVideoEl.value) {
    remoteVideoEl.value.srcObject = peerStore.remoteStream
    hasRemoteVideo.value = peerStore.remoteStream.getVideoTracks().length > 0
  }
}

function startTimer() {
  callStartTime.value = Date.now()
  timerInterval = setInterval(() => { callTimer.value = Date.now() - callStartTime.value }, 1000)
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
}

async function answer(withVideo: boolean) {
  await peerStore.answerCall(withVideo)
  startTimer()
  nextTick(setupStreams)
  announcement.value = 'Call answered'
}

function rejectWith(reason: string, msg?: string) {
  peerStore.rejectCall(reason, msg)
  router.push('/dashboard')
}

async function toggleVideo() {
  try {
    await peerStore.toggleVideo()
  } catch (e: any) {
    appStore.addNotification(e.message || 'Camera failed', 'error')
  }
}

function endCall() {
  peerStore.endCall()
  stopTimer()
  backToChat()
}

function backToChat() {
  const uid = callState.value.peerId
  if (uid) {
    const chat = appStore.chats.find(c => c.participants.includes(uid))
    if (chat) { router.push(`/chat/${chat.id}`); return }
  }
  router.push('/dashboard')
}

async function changeOutput(deviceId: string) {
  try {
    if (remoteVideoEl.value && 'setSinkId' in remoteVideoEl.value) {
      await (remoteVideoEl.value as any).setSinkId(deviceId)
      appStore.updateCallState({ currentAudioOutput: deviceId })
    }
  } catch {}
}

function setSpeed(e: Event) {
  const speed = parseFloat((e.target as HTMLInputElement).value)
  appStore.updateCallState({ playbackSpeed: speed })
  if (remoteVideoEl.value) remoteVideoEl.value.playbackRate = speed
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
* { box-sizing: border-box; }

.call-screen {
  min-height: 100vh;
  background: #060812;
  font-family: 'DM Sans', sans-serif;
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
}

/* Incoming */
.incoming-overlay {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #0c0e1f 0%, #1a0a2e 100%);
  padding: 2rem;
}
.incoming-content { text-align: center; max-width: 420px; width: 100%; }
.ringing-avatar {
  width: 120px; height: 120px; border-radius: 50%;
  background: linear-gradient(135deg, #5c3bff, #ff3b8c);
  display: flex; align-items: center; justify-content: center;
  font-size: 3rem; font-weight: 700; color: #fff;
  margin: 0 auto 1.5rem; position: relative; overflow: visible;
}
.ringing-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.ring-pulse {
  position: absolute; inset: -12px;
  border: 2px solid rgba(92,59,255,0.4);
  border-radius: 50%;
  animation: ringPulse 1.5s ease-out infinite;
}
@keyframes ringPulse {
  0% { transform: scale(1); opacity: 0.8; }
  100% { transform: scale(1.3); opacity: 0; }
}
.incoming-content h1 {
  font-family: 'Syne', sans-serif; font-size: 1.75rem; font-weight: 800;
  color: #fff; margin: 0 0 0.5rem;
}
.call-type-label { color: rgba(255,255,255,0.45); margin: 0 0 2rem; }

.incoming-actions { display: flex; justify-content: center; gap: 2rem; }
.answer-btn {
  width: 72px; height: 72px; border-radius: 50%; border: none;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.75rem; cursor: pointer; transition: all 0.2s;
}
.voice-answer { background: #34d399; box-shadow: 0 4px 20px rgba(52,211,153,0.4); }
.voice-answer:hover { transform: scale(1.1); }
.video-answer { background: #60a5fa; box-shadow: 0 4px 20px rgba(96,165,250,0.4); }
.video-answer:hover { transform: scale(1.1); }
.reject-answer { background: #ff3b5c; box-shadow: 0 4px 20px rgba(255,59,92,0.4); }
.reject-answer:hover { transform: scale(1.1); }

.reject-panel {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px; padding: 1.5rem; text-align: left; margin-top: 1rem;
}
.reject-panel h3 { color: rgba(255,255,255,0.7); font-size: 0.9rem; margin: 0 0 1rem; }
.quick-replies { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.quick-replies button {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; padding: 0.625rem 1rem;
  color: rgba(255,255,255,0.7); cursor: pointer; font-family: inherit; font-size: 0.875rem;
  text-align: left; transition: background 0.15s;
}
.quick-replies button:hover { background: rgba(255,255,255,0.1); }
.reject-panel textarea {
  width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; padding: 0.75rem; color: #e2e8f0; font-family: inherit; font-size: 0.875rem;
  resize: vertical; margin-bottom: 0.75rem;
}
.reject-panel textarea:focus { outline: none; border-color: rgba(92,59,255,0.4); }
.reject-panel textarea::placeholder { color: rgba(255,255,255,0.2); }
.reject-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
.btn-outline {
  background: transparent; border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px; padding: 0.5rem 1rem; color: rgba(255,255,255,0.6);
  cursor: pointer; font-family: inherit; font-size: 0.875rem;
}
.btn-danger-sm {
  background: rgba(255,59,92,0.2); border: 1px solid rgba(255,59,92,0.3);
  border-radius: 8px; padding: 0.5rem 1rem; color: #ff3b5c;
  cursor: pointer; font-family: inherit; font-size: 0.875rem; font-weight: 600;
}
.btn-danger-sm:disabled { opacity: 0.5; cursor: not-allowed; }

/* Active Call */
.active-call { height: 100vh; display: flex; flex-direction: column; }
.call-header {
  display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem;
  background: rgba(6,8,18,0.8); backdrop-filter: blur(20px);
}
.back-to-chat-btn {
  background: rgba(255,255,255,0.06); border: none; border-radius: 10px;
  padding: 0.5rem 1rem; color: rgba(255,255,255,0.7); cursor: pointer;
  font-family: inherit; font-size: 0.875rem; transition: background 0.2s;
}
.back-to-chat-btn:hover { background: rgba(255,255,255,0.1); }
.call-header-info { flex: 1; display: flex; flex-direction: column; }
.call-peer { font-weight: 600; color: #fff; }
.call-status { font-size: 0.8rem; color: rgba(255,255,255,0.4); }
.call-timer { font-family: monospace; font-size: 1rem; color: rgba(255,255,255,0.6); }

.media-area { flex: 1; position: relative; background: #000; min-height: 0; }
.video-container { width: 100%; height: 100%; position: relative; }
.remote-video { width: 100%; height: 100%; object-fit: cover; }
.local-video {
  position: absolute; top: 1rem; right: 1rem;
  width: 180px; height: 120px; border-radius: 12px;
  object-fit: cover; border: 2px solid rgba(255,255,255,0.2);
}
.screen-share-badge {
  position: absolute; top: 1rem; left: 50%; transform: translateX(-50%);
  background: rgba(92,59,255,0.8); color: #fff; padding: 0.375rem 0.875rem;
  border-radius: 999px; font-size: 0.8rem; font-weight: 600;
}

.audio-display {
  height: 100%;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem;
}
.audio-avatar {
  width: 120px; height: 120px; border-radius: 50%;
  background: linear-gradient(135deg, #5c3bff, #ff3b8c);
  display: flex; align-items: center; justify-content: center;
  font-size: 3rem; font-weight: 700; color: #fff;
  position: relative; overflow: hidden;
}
.audio-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.speaking-indicator {
  position: absolute; inset: -8px; border-radius: 50%;
  border: 2px solid rgba(92,59,255,0.5);
  animation: speaking 1s ease-in-out infinite alternate;
}
@keyframes speaking { 0% { opacity: 0.3; transform: scale(1); } 100% { opacity: 0.8; transform: scale(1.05); } }
.audio-peer-name { font-size: 1.25rem; font-weight: 600; color: #fff; margin: 0; }
.hold-label { color: #fbbf24; font-size: 1rem; font-weight: 600; margin: 0; }

.controls-bar {
  background: rgba(6,8,18,0.9); backdrop-filter: blur(20px);
  padding: 1.25rem;
  display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;
}
.ctrl-btn {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  background: rgba(255,255,255,0.07); border: none; border-radius: 50%;
  width: 64px; height: 64px; cursor: pointer; transition: all 0.2s;
  color: rgba(255,255,255,0.7); font-size: 0;
}
.ctrl-btn span:first-child { font-size: 1.4rem; }
.ctrl-label { font-size: 0.6rem; font-weight: 600; letter-spacing: 0.02em; }
.ctrl-btn:hover { background: rgba(255,255,255,0.12); }
.ctrl-btn.active { background: rgba(92,59,255,0.3); color: #a78bfa; }
.end-ctrl { background: rgba(255,59,92,0.25) !important; color: #ff3b5c !important; }
.end-ctrl:hover { background: rgba(255,59,92,0.4) !important; }

.settings-panel {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
  background: rgba(10,12,28,0.97); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px; padding: 2rem; max-width: 400px; width: 90%;
  backdrop-filter: blur(20px); z-index: 100;
  display: flex; flex-direction: column; gap: 1rem;
}
.settings-panel h3 { font-family: 'Syne', sans-serif; color: #fff; margin: 0; font-size: 1.1rem; }
.settings-panel label {
  display: flex; flex-direction: column; gap: 0.375rem;
  font-size: 0.8rem; color: rgba(255,255,255,0.5); font-weight: 500;
}
.settings-panel select {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px; padding: 0.625rem; color: #e2e8f0; font-family: inherit; font-size: 0.875rem;
}
.speed-row { display: flex; align-items: center; gap: 0.75rem; }
.speed-row input { flex: 1; }
.speed-row span { font-family: monospace; color: #e2e8f0; min-width: 35px; }
.close-settings-btn {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px; padding: 0.625rem; color: rgba(255,255,255,0.7);
  cursor: pointer; font-family: inherit; font-size: 0.875rem; margin-top: 0.5rem;
}

.no-call {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 100vh; gap: 1rem; color: rgba(255,255,255,0.4);
}
.go-home-btn {
  background: linear-gradient(135deg, #5c3bff, #7c3bff); color: #fff;
  padding: 0.625rem 1.5rem; border-radius: 10px; text-decoration: none;
  font-size: 0.9rem; font-weight: 600;
}

.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

@media (max-width: 640px) {
  .local-video { width: 120px; height: 80px; }
  .ctrl-btn { width: 52px; height: 52px; }
  .controls-bar { gap: 0.5rem; padding: 1rem; }
}
</style>
