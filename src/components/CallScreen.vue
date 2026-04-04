<template>
  <div class="call-screen" :class="{ 'incoming-mode': callState.isIncoming }" id="main-content" tabindex="-1">

    <!-- Incoming Call UI -->
    <div
      v-if="callState.isIncoming"
      class="incoming-overlay"
      role="alertdialog"
      aria-modal="true"
      :aria-label="`Incoming ${callState.isVideoEnabled ? 'video' : 'voice'} call from ${callState.peerName}`"
      aria-live="assertive"
    >
      <div class="incoming-content">
        <div
          class="ringing-avatar"
          role="img"
          :aria-label="`${callState.peerName}'s avatar`"
        >
          <img v-if="callState.peerPhoto" :src="callState.peerPhoto" :alt="callState.peerName" />
          <span v-else aria-hidden="true">{{ callState.peerName.charAt(0).toUpperCase() }}</span>
          <div class="ring-pulse" aria-hidden="true"></div>
        </div>
        <h1>{{ callState.peerName }}</h1>
        <p class="call-type-label">
          Incoming {{ callState.isVideoEnabled ? 'Video' : 'Voice' }} Call
        </p>

        <div v-if="showRejectOptions" class="reject-panel" role="region" aria-label="Reply and reject options">
          <h2>Reply with message</h2>
          <ul class="quick-replies" role="list">
            <li v-for="r in quickReplies" :key="r" role="listitem">
              <button
                @click="rejectWith(r)"
                :aria-label="`Reject call and reply: ${r}`"
              >{{ r }}</button>
            </li>
          </ul>
          <label for="custom-reject-msg" class="sr-only">Custom reply message</label>
          <textarea
            id="custom-reject-msg"
            v-model="customRejectMsg"
            placeholder="Custom message…"
            rows="2"
            aria-describedby="custom-msg-hint"
          ></textarea>
          <span id="custom-msg-hint" class="sr-only">Type a custom message to send when rejecting the call</span>
          <div class="reject-actions">
            <button
              class="btn-outline"
              @click="showRejectOptions = false"
              aria-label="Go back to call answer options"
            >Back</button>
            <button
              class="btn-danger-sm"
              @click="rejectWith('Custom', customRejectMsg)"
              :disabled="!customRejectMsg.trim()"
              :aria-disabled="!customRejectMsg.trim()"
              aria-label="Send custom message and reject call"
            >Send &amp; Reject</button>
          </div>
        </div>

        <div v-else class="incoming-actions" role="group" aria-label="Answer or reject call">
          <button
            class="answer-btn voice-answer"
            @click="answer(false)"
            aria-label="Answer with voice only"
          >
            <span aria-hidden="true">📞</span>
          </button>
          <button
            v-if="callState.isVideoEnabled"
            class="answer-btn video-answer"
            @click="answer(true)"
            aria-label="Answer with video"
          >
            <span aria-hidden="true">📹</span>
          </button>
          <button
            class="answer-btn reject-answer"
            @click="showRejectOptions = true"
            aria-label="Reject call or reply with a message"
          >
            <span aria-hidden="true">📵</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Active Call UI -->
    <div v-else-if="callState.isActive" class="active-call">
      <header class="call-header" role="banner">
        <button
          class="back-to-chat-btn"
          @click="backToChat"
          aria-label="Return to chat conversation"
        >
          ← Chat
        </button>
        <div class="call-header-info">
          <span class="call-peer">{{ callState.peerName }}</span>
          <span class="call-status" role="status" aria-live="polite">{{ callStatusText }}</span>
        </div>
        <time
          class="call-timer"
          :aria-label="`Call duration: ${timerDisplay}`"
          aria-live="off"
        >{{ timerDisplay }}</time>
      </header>

      <!-- Video / Audio Display -->
      <main class="media-area" aria-label="Call media">
        <!-- Remote Video/Audio Element — MUST always be present for audio to play -->
        <video
          ref="remoteVideoEl"
          :class="['remote-video', { 'hidden-video': !callState.isVideoEnabled && !hasRemoteVideo }]"
          autoplay
          playsinline
          :aria-label="`Video from ${callState.peerName}`"
        ></video>

        <div v-if="callState.isVideoEnabled || hasRemoteVideo" class="video-container">
          <video
            ref="localVideoEl"
            class="local-video"
            autoplay
            playsinline
            muted
            aria-label="Your local video preview"
          ></video>
          <div
            v-if="peerStore.isScreenSharing"
            class="screen-share-badge"
            role="status"
            aria-live="polite"
          >
            <span aria-hidden="true">📺</span> Sharing Screen
          </div>
        </div>
        <div v-else class="audio-display" aria-label="Voice call in progress">
          <div
            class="audio-avatar"
            role="img"
            :aria-label="`${callState.peerName}${callState.isMuted ? '' : ', speaking'}`"
          >
            <img v-if="callState.peerPhoto" :src="callState.peerPhoto" :alt="callState.peerName" />
            <span v-else aria-hidden="true">{{ callState.peerName.charAt(0).toUpperCase() }}</span>
            <div
              v-if="!callState.isMuted"
              class="speaking-indicator"
              aria-hidden="true"
            ></div>
          </div>
          <p class="audio-peer-name">{{ callState.peerName }}</p>
          <p
            v-if="callState.isOnHold"
            class="hold-label"
            role="status"
            aria-live="polite"
          >
            <span aria-hidden="true">⏸</span> On Hold
          </p>
        </div>
      </main>

      <!-- Controls -->
      <nav class="controls-bar" role="toolbar" aria-label="Call controls">
        <button
          :class="['ctrl-btn', { active: callState.isMuted }]"
          @click="peerStore.toggleMute()"
          :aria-label="callState.isMuted ? 'Unmute microphone' : 'Mute microphone'"
          :aria-pressed="callState.isMuted"
        >
          <span aria-hidden="true">{{ callState.isMuted ? '🔇' : '🎤' }}</span>
          <span class="ctrl-label" aria-hidden="true">{{ callState.isMuted ? 'Unmute' : 'Mute' }}</span>
        </button>

        <button
          :class="['ctrl-btn', { active: callState.isVideoEnabled }]"
          @click="toggleVideo"
          :aria-label="callState.isVideoEnabled ? 'Turn camera off' : 'Turn camera on'"
          :aria-pressed="callState.isVideoEnabled"
        >
          <span aria-hidden="true">{{ callState.isVideoEnabled ? '📹' : '📷' }}</span>
          <span class="ctrl-label" aria-hidden="true">Camera</span>
        </button>

        <button
          :class="['ctrl-btn', { active: peerStore.isScreenSharing }]"
          @click="peerStore.toggleScreenShare()"
          :aria-label="peerStore.isScreenSharing ? 'Stop sharing screen' : 'Share screen'"
          :aria-pressed="peerStore.isScreenSharing"
        >
          <span aria-hidden="true">🖥</span>
          <span class="ctrl-label" aria-hidden="true">Screen</span>
        </button>

        <button
          :class="['ctrl-btn', { active: callState.isOnHold }]"
          @click="peerStore.toggleHold()"
          :aria-label="callState.isOnHold ? 'Resume call from hold' : 'Put call on hold'"
          :aria-pressed="callState.isOnHold"
        >
          <span aria-hidden="true">{{ callState.isOnHold ? '▶️' : '⏸' }}</span>
          <span class="ctrl-label" aria-hidden="true">{{ callState.isOnHold ? 'Resume' : 'Hold' }}</span>
        </button>

        <button
          class="ctrl-btn settings-ctrl"
          @click="toggleSettings"
          :aria-pressed="showSettings"
          :aria-expanded="showSettings"
          aria-haspopup="dialog"
          aria-label="Open call settings"
        >
          <span aria-hidden="true">⚙️</span>
          <span class="ctrl-label" aria-hidden="true">Settings</span>
        </button>

        <button
          class="ctrl-btn end-ctrl"
          @click="endCall"
          aria-label="End call"
        >
          <span aria-hidden="true">📞</span>
          <span class="ctrl-label" aria-hidden="true">End</span>
        </button>
      </nav>

      <!-- Settings Panel — auto-opens and focuses when toggled -->
      <Transition name="settings-slide">
        <div
          v-if="showSettings"
          class="settings-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Call Settings"
          @keydown.escape="showSettings = false"
        >
          <div class="settings-panel-header">
            <h2>Call Settings</h2>
            <button
              class="settings-close-btn"
              @click="showSettings = false"
              aria-label="Close call settings"
              ref="settingsCloseRef"
            >✕</button>
          </div>

          <label for="mic-select">
            Microphone
          </label>
          <select
            id="mic-select"
            :value="callState.currentAudioInput"
            @change="peerStore.changeAudioInput(($event.target as HTMLSelectElement).value)"
            aria-label="Select microphone"
          >
            <option v-for="d in audioInputs" :key="d.deviceId" :value="d.deviceId">
              {{ d.label || 'Microphone ' + d.deviceId.slice(0,6) }}
            </option>
          </select>

          <label for="speaker-select">
            Speaker
          </label>
          <select
            id="speaker-select"
            :value="callState.currentAudioOutput"
            @change="changeOutput(($event.target as HTMLSelectElement).value)"
            aria-label="Select speaker output"
          >
            <option v-for="d in audioOutputs" :key="d.deviceId" :value="d.deviceId">
              {{ d.label || 'Speaker ' + d.deviceId.slice(0,6) }}
            </option>
          </select>

          <label v-if="callState.isVideoEnabled" for="camera-select">
            Camera
          </label>
          <select
            v-if="callState.isVideoEnabled"
            id="camera-select"
            :value="callState.currentVideoInput"
            @change="peerStore.changeVideoInput(($event.target as HTMLSelectElement).value)"
            aria-label="Select camera"
          >
            <option v-for="d in videoInputs" :key="d.deviceId" :value="d.deviceId">
              {{ d.label || 'Camera ' + d.deviceId.slice(0,6) }}
            </option>
          </select>

          <div class="speed-field">
            <label for="playback-speed">
              Playback Speed
              <span class="speed-value" aria-live="polite">{{ callState.playbackSpeed.toFixed(1) }}×</span>
            </label>
            <input
              id="playback-speed"
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              :value="callState.playbackSpeed"
              @input="setSpeed"
              :aria-valuemin="0.5"
              :aria-valuemax="3"
              :aria-valuenow="callState.playbackSpeed"
              :aria-valuetext="`${callState.playbackSpeed.toFixed(1)} times speed`"
              aria-label="Playback speed"
            />
          </div>

          <button class="close-settings-btn" @click="showSettings = false" aria-label="Close settings panel">
            Close
          </button>
        </div>
      </Transition>
    </div>

    <!-- No call -->
    <div v-else class="no-call" role="status">
      <p>No active call</p>
      <RouterLink to="/dashboard" class="go-home-btn" aria-label="Go to Messages dashboard">Go to Dashboard</RouterLink>
    </div>

    <div aria-live="assertive" aria-atomic="true" class="sr-only" role="alert">{{ announcement }}</div>
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
const settingsCloseRef = ref<HTMLButtonElement>()

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

// Auto-focus settings close button when settings panel opens
watch(showSettings, async (open) => {
  if (open) {
    await nextTick()
    settingsCloseRef.value?.focus()
  }
})

onMounted(async () => {
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
    announcement.value = `Incoming ${callState.value.isVideoEnabled ? 'video' : 'voice'} call from ${callState.value.peerName}. Use the buttons to answer or reject.`
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
  announcement.value = `Call answered with ${withVideo ? 'video' : 'voice only'}`
}

function rejectWith(reason: string, msg?: string) {
  peerStore.rejectCall(reason, msg)
  announcement.value = 'Call rejected'
  router.push('/dashboard')
}

async function toggleVideo() {
  try {
    await peerStore.toggleVideo()
    announcement.value = callState.value.isVideoEnabled ? 'Camera turned on' : 'Camera turned off'
  } catch (e: any) {
    appStore.addNotification(e.message || 'Camera failed', 'error')
  }
}

async function toggleSettings() {
  showSettings.value = !showSettings.value
}

function endCall() {
  peerStore.endCall()
  stopTimer()
  announcement.value = 'Call ended'
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

/* ── Incoming ───────────────────────────────────────────────────────────────── */
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
  border: 2px solid rgba(92,59,255,0.45);
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
.call-type-label { color: rgba(255,255,255,0.47); margin: 0 0 2rem; }

.incoming-actions { display: flex; justify-content: center; gap: 2rem; flex-wrap: wrap; }
.answer-btn {
  width: 72px; height: 72px; border-radius: 50%; border: none;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.75rem; cursor: pointer; transition: all 0.2s;
}
.answer-btn:focus-visible { outline: 4px solid #fff; outline-offset: 4px; }
.voice-answer { background: #34d399; box-shadow: 0 4px 20px rgba(52,211,153,0.45); }
.voice-answer:hover { transform: scale(1.1); }
.video-answer { background: #60a5fa; box-shadow: 0 4px 20px rgba(96,165,250,0.45); }
.video-answer:hover { transform: scale(1.1); }
.reject-answer { background: #ff3b5c; box-shadow: 0 4px 20px rgba(255,59,92,0.45); }
.reject-answer:hover { transform: scale(1.1); }

.reject-panel {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);
  border-radius: 16px; padding: 1.5rem; text-align: left; margin-top: 1rem;
}
.reject-panel h2 { color: rgba(255,255,255,0.72); font-size: 0.9rem; margin: 0 0 1rem; }
.quick-replies { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; list-style: none; padding: 0; }
.quick-replies button {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.09);
  border-radius: 10px; padding: 0.625rem 1rem;
  color: rgba(255,255,255,0.72); cursor: pointer; font-family: inherit; font-size: 0.875rem;
  text-align: left; transition: background 0.15s; min-height: 44px; width: 100%;
}
.quick-replies button:hover { background: rgba(255,255,255,0.11); }
.quick-replies button:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }
.reject-panel textarea {
  width: 100%; background: rgba(255,255,255,0.05); border: 1.5px solid rgba(255,255,255,0.09);
  border-radius: 10px; padding: 0.75rem; color: #e2e8f0; font-family: inherit; font-size: 0.875rem;
  resize: vertical; margin-bottom: 0.75rem;
}
.reject-panel textarea:focus { outline: none; border-color: rgba(92,59,255,0.5); box-shadow: 0 0 0 3px rgba(92,59,255,0.12); }
.reject-panel textarea::placeholder { color: rgba(255,255,255,0.22); }
.reject-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
.btn-outline {
  background: transparent; border: 1px solid rgba(255,255,255,0.22);
  border-radius: 8px; padding: 0.5rem 1rem; color: rgba(255,255,255,0.65);
  cursor: pointer; font-family: inherit; font-size: 0.875rem; min-height: 40px;
}
.btn-outline:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }
.btn-danger-sm {
  background: rgba(255,59,92,0.22); border: 1px solid rgba(255,59,92,0.35);
  border-radius: 8px; padding: 0.5rem 1rem; color: #ff6b8a;
  cursor: pointer; font-family: inherit; font-size: 0.875rem; font-weight: 600; min-height: 40px;
}
.btn-danger-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-danger-sm:focus-visible { outline: 3px solid #ff9bb5; outline-offset: 2px; }

/* ── Active Call ─────────────────────────────────────────────────────────────── */
.active-call { height: 100vh; display: flex; flex-direction: column; }
.call-header {
  display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem;
  background: rgba(6,8,18,0.85); backdrop-filter: blur(20px);
}
.back-to-chat-btn {
  background: rgba(255,255,255,0.07); border: none; border-radius: 10px;
  padding: 0.5rem 1rem; color: rgba(255,255,255,0.72); cursor: pointer;
  font-family: inherit; font-size: 0.875rem; transition: background 0.2s; min-height: 40px;
}
.back-to-chat-btn:hover { background: rgba(255,255,255,0.12); }
.back-to-chat-btn:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }
.call-header-info { flex: 1; display: flex; flex-direction: column; }
.call-peer { font-weight: 600; color: #fff; }
.call-status { font-size: 0.8rem; color: rgba(255,255,255,0.42); }
.call-timer { font-family: monospace; font-size: 1rem; color: rgba(255,255,255,0.62); }

.media-area { flex: 1; position: relative; background: #000; min-height: 0; }
.remote-video.hidden-video {
  position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none;
}
.video-container { width: 100%; height: 100%; position: relative; }
.remote-video { width: 100%; height: 100%; object-fit: cover; }
.local-video {
  position: absolute; top: 1rem; right: 1rem;
  width: 180px; height: 120px; border-radius: 12px;
  object-fit: cover; border: 2px solid rgba(255,255,255,0.22);
}
.screen-share-badge {
  position: absolute; top: 1rem; left: 50%; transform: translateX(-50%);
  background: rgba(92,59,255,0.85); color: #fff; padding: 0.375rem 0.875rem;
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
  background: rgba(6,8,18,0.92); backdrop-filter: blur(20px);
  padding: 1.25rem;
  display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;
}
.ctrl-btn {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  background: rgba(255,255,255,0.08); border: none; border-radius: 50%;
  width: 64px; height: 64px; cursor: pointer; transition: all 0.2s;
  color: rgba(255,255,255,0.72); font-size: 0; padding: 0;
}
.ctrl-btn span:first-child { font-size: 1.4rem; }
.ctrl-label { font-size: 0.6rem; font-weight: 600; letter-spacing: 0.02em; }
.ctrl-btn:hover { background: rgba(255,255,255,0.14); }
.ctrl-btn:focus-visible { outline: 3px solid #7c6fff; outline-offset: 4px; }
.ctrl-btn.active { background: rgba(92,59,255,0.32); color: #a78bfa; }
.end-ctrl { background: rgba(255,59,92,0.27) !important; color: #ff6b8a !important; }
.end-ctrl:hover { background: rgba(255,59,92,0.42) !important; }

/* Settings Panel */
.settings-panel {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
  background: rgba(10,12,28,0.98); border: 1px solid rgba(255,255,255,0.11);
  border-radius: 20px; padding: 2rem; max-width: 400px; width: 90%;
  backdrop-filter: blur(20px); z-index: 100;
  display: flex; flex-direction: column; gap: 1rem;
  box-shadow: 0 20px 64px rgba(0,0,0,0.7);
}
.settings-panel-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.25rem;
}
.settings-panel h2 { font-family: 'Syne', sans-serif; color: #fff; margin: 0; font-size: 1.1rem; }
.settings-close-btn {
  background: rgba(255,255,255,0.07); border: none; border-radius: 8px;
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: rgba(255,255,255,0.55); font-size: 0.85rem;
}
.settings-close-btn:hover { background: rgba(255,255,255,0.13); color: #fff; }
.settings-close-btn:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }

.settings-panel label {
  display: flex; flex-direction: column; gap: 0.375rem;
  font-size: 0.82rem; color: rgba(255,255,255,0.52); font-weight: 600;
  letter-spacing: 0.04em;
}
.settings-panel select {
  background: rgba(255,255,255,0.07); border: 1.5px solid rgba(255,255,255,0.11);
  border-radius: 8px; padding: 0.625rem; color: #e2e8f0; font-family: inherit;
  font-size: 0.875rem; min-height: 44px;
}
.settings-panel select:focus { outline: none; border-color: rgba(92,59,255,0.6); box-shadow: 0 0 0 3px rgba(92,59,255,0.12); }

.speed-field { display: flex; flex-direction: column; gap: 0.375rem; }
.speed-field label {
  display: flex; justify-content: space-between; align-items: center;
}
.speed-value { font-family: monospace; color: #a78bfa; font-weight: 700; }
.speed-field input[type=range] { width: 100%; accent-color: #5c3bff; }
.speed-field input[type=range]:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; border-radius: 4px; }

.close-settings-btn {
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.11);
  border-radius: 10px; padding: 0.625rem; color: rgba(255,255,255,0.72);
  cursor: pointer; font-family: inherit; font-size: 0.875rem; margin-top: 0.5rem; min-height: 44px;
}
.close-settings-btn:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }

.settings-slide-enter-active, .settings-slide-leave-active { transition: all 0.2s ease; }
.settings-slide-enter-from, .settings-slide-leave-to { opacity: 0; transform: translate(-50%, -45%) scale(0.97); }

.no-call {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 100vh; gap: 1rem; color: rgba(255,255,255,0.42);
}
.go-home-btn {
  background: linear-gradient(135deg, #5c3bff, #7c3bff); color: #fff;
  padding: 0.75rem 1.5rem; border-radius: 10px; text-decoration: none;
  font-size: 0.9rem; font-weight: 600; min-height: 48px; display: inline-flex; align-items: center;
}
.go-home-btn:focus-visible { outline: 3px solid #a78bfa; outline-offset: 3px; }

.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

@media (max-width: 640px) {
  .local-video { width: 120px; height: 80px; }
  .ctrl-btn { width: 54px; height: 54px; }
  .controls-bar { gap: 0.5rem; padding: 1rem; }
}
</style>
