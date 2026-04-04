<template>
  <div class="prejoin-screen" id="main-content" tabindex="-1">
    <div class="prejoin-bg" aria-hidden="true">
      <div class="bg-orb orb1"></div>
      <div class="bg-orb orb2"></div>
    </div>

    <div class="prejoin-layout">
      <!-- Left: Preview -->
      <div class="preview-col">
        <div class="video-preview-wrapper" aria-label="Camera preview">
          <video
            ref="previewVideoRef"
            class="preview-video"
            autoplay
            muted
            playsinline
            :class="{ hidden: isVideoOff || !hasVideoPermission }"
            aria-label="Your camera preview"
          ></video>
          <div v-if="isVideoOff || !hasVideoPermission" class="preview-avatar" aria-hidden="true">
            <div class="avatar-circle">
              <img v-if="currentUser?.photoURL" :src="currentUser.photoURL" :alt="currentUser.displayName || ''" />
              <span v-else>{{ (currentUser?.displayName || 'U').charAt(0).toUpperCase() }}</span>
            </div>
          </div>
          <div class="preview-name-tag" aria-hidden="true">{{ currentUser?.displayName || 'You' }}</div>

          <!-- Preview controls -->
          <div class="preview-controls" role="toolbar" aria-label="Device toggle controls">
            <button
              :class="['preview-ctrl-btn', { off: isMuted }]"
              @click="toggleMute"
              :aria-label="isMuted ? 'Microphone off (Ctrl+D)' : 'Microphone on (Ctrl+D)'"
              :aria-pressed="!isMuted"
              :title="isMuted ? 'Microphone off (Ctrl+D)' : 'Microphone on (Ctrl+D)'"
            >
              <svg v-if="!isMuted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v4M8 23h8"/></svg>
            </button>

            <button
              :class="['preview-ctrl-btn', { off: isVideoOff }]"
              @click="toggleVideo"
              :aria-label="isVideoOff ? 'Camera off (Ctrl+E)' : 'Camera on (Ctrl+E)'"
              :aria-pressed="!isVideoOff"
              :title="isVideoOff ? 'Camera off (Ctrl+E)' : 'Camera on (Ctrl+E)'"
            >
              <svg v-if="!isVideoOff" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>

            <!-- Speaker test -->
            <button
              class="preview-ctrl-btn"
              @click="testSpeaker"
              aria-label="Test speakers"
              title="Test speakers"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>
            </button>
          </div>
        </div>

        <!-- Permission status -->
        <div class="permission-status" role="status" aria-live="polite">
          <div class="perm-row">
            <span :class="['perm-dot', { ok: hasAudioPermission, warn: !hasAudioPermission }]" aria-hidden="true"></span>
            <span>Microphone: <strong>{{ hasAudioPermission ? 'Ready' : 'Permission needed' }}</strong></span>
          </div>
          <div class="perm-row">
            <span :class="['perm-dot', { ok: hasVideoPermission, warn: !hasVideoPermission }]" aria-hidden="true"></span>
            <span>Camera: <strong>{{ hasVideoPermission ? 'Ready' : 'Permission needed' }}</strong></span>
          </div>
        </div>
      </div>

      <!-- Right: Info + Settings -->
      <div class="info-col">
        <!-- Back -->
        <button class="back-link" @click="router.back()" aria-label="Go back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back
        </button>

        <!-- Loading state -->
        <div v-if="isLoadingMeeting" class="loading-state" role="status">
          <div class="spinner" aria-hidden="true"></div>
          <span>Finding meeting…</span>
        </div>

        <!-- Not found -->
        <div v-else-if="!meeting" class="not-found" role="alert">
          <div class="not-found-icon" aria-hidden="true">🔍</div>
          <h2>Meeting not found</h2>
          <p>The meeting code is invalid or this meeting has ended.</p>
          <button class="btn-primary" @click="router.push('/meetings')" aria-label="Go to meetings list">View My Meetings</button>
        </div>

        <!-- Meeting ended -->
        <div v-else-if="meeting.status === 'ended'" class="not-found" role="status">
          <div class="not-found-icon" aria-hidden="true">📅</div>
          <h2>Meeting Ended</h2>
          <p>This meeting has already ended.</p>
          <button class="btn-primary" @click="router.push('/meetings')">View My Meetings</button>
        </div>

        <!-- Normal prejoin -->
        <template v-else>
          <div class="meeting-info-card">
            <div class="meeting-host-row">
              <div class="host-avatar" aria-hidden="true">
                <img v-if="meeting.hostPhoto" :src="meeting.hostPhoto" :alt="meeting.hostName" />
                <span v-else>{{ meeting.hostName.charAt(0) }}</span>
              </div>
              <div>
                <span class="host-label">Hosted by</span>
                <span class="host-name">{{ meeting.hostName }}</span>
              </div>
            </div>
            <h1 class="meeting-title">{{ meeting.title }}</h1>
            <p v-if="meeting.description" class="meeting-desc">{{ meeting.description }}</p>
            <div v-if="meeting.agenda" class="meeting-agenda">
              <h3>Agenda</h3>
              <p>{{ meeting.agenda }}</p>
            </div>
            <div class="meeting-stats">
              <div class="stat" :aria-label="`${activeCount} participant${activeCount !== 1 ? 's' : ''} currently in meeting`">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                <span>{{ activeCount > 0 ? `${activeCount} in meeting` : 'No one yet' }}</span>
              </div>
              <div class="stat" v-if="meeting.scheduledAt">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>{{ formatDate(meeting.scheduledAt.toMillis()) }}</span>
              </div>
            </div>
          </div>

          <!-- Already in meeting notice -->
          <div v-if="activeCount > 0" class="in-meeting-notice" role="status">
            <span class="notice-dot" aria-hidden="true"></span>
            {{ activeCount }} participant{{ activeCount !== 1 ? 's' : '' }} already in the meeting
          </div>
          <div v-else class="waiting-notice" role="status">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Waiting for others to join
          </div>

          <!-- Device settings -->
          <details class="device-settings" :open="showDeviceSettings">
            <summary
              class="device-settings-summary"
              @click="showDeviceSettings = !showDeviceSettings"
              aria-label="Device settings and permissions"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>
              Device Settings
              <svg class="chevron" :class="{ open: showDeviceSettings }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
            </summary>

            <div class="device-rows">
              <div class="device-row" v-if="audioInputs.length > 0">
                <label for="pre-mic">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg>
                  Microphone
                </label>
                <select
                  id="pre-mic"
                  v-model="selectedMic"
                  @change="switchMicrophone"
                  aria-label="Select microphone"
                >
                  <option v-for="d in audioInputs" :key="d.deviceId" :value="d.deviceId">
                    {{ d.label || 'Microphone ' + (audioInputs.indexOf(d) + 1) }}
                  </option>
                </select>
              </div>

              <div class="device-row" v-if="videoInputs.length > 0">
                <label for="pre-cam">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                  Camera
                </label>
                <select
                  id="pre-cam"
                  v-model="selectedCamera"
                  @change="switchCamera"
                  aria-label="Select camera"
                >
                  <option v-for="d in videoInputs" :key="d.deviceId" :value="d.deviceId">
                    {{ d.label || 'Camera ' + (videoInputs.indexOf(d) + 1) }}
                  </option>
                </select>
              </div>

              <div class="device-row" v-if="audioOutputs.length > 0">
                <label for="pre-speaker">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg>
                  Speaker
                </label>
                <select
                  id="pre-speaker"
                  v-model="selectedSpeaker"
                  aria-label="Select speaker output"
                >
                  <option v-for="d in audioOutputs" :key="d.deviceId" :value="d.deviceId">
                    {{ d.label || 'Speaker ' + (audioOutputs.indexOf(d) + 1) }}
                  </option>
                </select>
              </div>

              <!-- Mic level indicator -->
              <div class="mic-level" aria-label="Microphone level indicator" aria-live="off">
                <span class="mic-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg>
                  Level
                </span>
                <div class="level-bars" aria-hidden="true">
                  <div
                    v-for="i in 12"
                    :key="i"
                    class="level-bar"
                    :class="{ active: i <= micLevel }"
                    :style="{ height: (4 + i * 2) + 'px' }"
                  ></div>
                </div>
              </div>
            </div>
          </details>

          <!-- Name input -->
          <div class="name-field">
            <label for="join-name">Your name in this meeting</label>
            <input
              id="join-name"
              v-model="displayName"
              type="text"
              placeholder="Your name"
              maxlength="50"
              aria-describedby="join-name-hint"
            />
            <span id="join-name-hint" class="field-hint">Visible to all participants</span>
          </div>

          <!-- Join button -->
          <button
            class="join-btn"
            @click="handleJoin"
            :disabled="isJoining || !hasAudioPermission"
            :aria-busy="isJoining"
            :aria-label="isJoining ? 'Joining meeting…' : 'Join meeting'"
          >
            <span v-if="isJoining" class="join-spinner" aria-hidden="true"></span>
            {{ isJoining ? 'Joining…' : 'Join Meeting' }}
          </button>

          <p v-if="!hasAudioPermission" class="perm-warning" role="alert">
            Microphone access is required to join. Please allow access in your browser.
          </p>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMeetingByCode, listenToMeeting, type Meeting } from '../services/meetings'
import { auth } from '../services/firebase'
import { useMeetingStore } from '../stores/meeting'

const route = useRoute()
const router = useRouter()
const meetingStore = useMeetingStore()

const meetingCode = computed(() => route.params.code as string)
const currentUser = computed(() => auth.currentUser)

const meeting = ref<Meeting | null>(null)
const isLoadingMeeting = ref(true)
const isJoining = ref(false)
const showDeviceSettings = ref(false)

// Local media state
const isMuted = ref(false)
const isVideoOff = ref(false)
const hasAudioPermission = ref(false)
const hasVideoPermission = ref(false)
const displayName = ref(auth.currentUser?.displayName || '')

// Devices
const audioInputs = ref<MediaDeviceInfo[]>([])
const audioOutputs = ref<MediaDeviceInfo[]>([])
const videoInputs = ref<MediaDeviceInfo[]>([])
const selectedMic = ref('')
const selectedCamera = ref('')
const selectedSpeaker = ref('')

// Audio level
const micLevel = ref(0)

const previewVideoRef = ref<HTMLVideoElement>()
let previewStream: MediaStream | null = null
let micAnalyser: AnalyserNode | null = null
let audioCtx: AudioContext | null = null
let levelInterval: ReturnType<typeof setInterval> | null = null
let unsubMeeting: (() => void) | null = null
let speakerTestAudio: HTMLAudioElement | null = null

const activeCount = computed(() => {
  if (!meeting.value) return 0
  return Object.values(meeting.value.participants).filter(p => p.status === 'joined').length
})

onMounted(async () => {
  // Load meeting
  try {
    const m = await getMeetingByCode(meetingCode.value)
    meeting.value = m
    if (m) {
      // Real-time updates for participant count
      unsubMeeting = listenToMeeting(m.id, updated => { meeting.value = updated })
      document.title = `Join: ${m.title} | Soft Connect`
    } else {
      document.title = 'Meeting Not Found | Soft Connect'
    }
  } catch {
    document.title = 'Meeting Not Found | Soft Connect'
  }
  isLoadingMeeting.value = false

  // Get devices
  await requestPermissionsAndDevices()
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  stopPreview()
  unsubMeeting?.()
  if (levelInterval) clearInterval(levelInterval)
  audioCtx?.close();
  (speakerTestAudio as HTMLAudioElement | null)?.pause()
  window.removeEventListener('keydown', handleGlobalKeydown)
})

function handleGlobalKeydown(e: KeyboardEvent) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey

  if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return

  if (cmdOrCtrl && e.key.toLowerCase() === 'd') {
    e.preventDefault()
    toggleMute()
    return
  }
  if (cmdOrCtrl && e.key.toLowerCase() === 'e') {
    e.preventDefault()
    toggleVideo()
    return
  }
}

async function requestPermissionsAndDevices() {
  try {
    // Request both permissions at once for enumeration to work
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
    hasAudioPermission.value = true
    hasVideoPermission.value = true
    previewStream = stream
    setupPreviewStream(stream)
    await enumerateDevices()
    startMicLevel(stream)
  } catch (e: any) {
    // Try audio only
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      hasAudioPermission.value = true
      previewStream = audioStream
      startMicLevel(audioStream)
      await enumerateDevices()
    } catch {
      // No permissions
    }
  }
}

function setupPreviewStream(stream: MediaStream) {
  if (previewVideoRef.value) {
    previewVideoRef.value.srcObject = stream
  }
}

async function enumerateDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices()
  audioInputs.value = devices.filter(d => d.kind === 'audioinput')
  audioOutputs.value = devices.filter(d => d.kind === 'audiooutput')
  videoInputs.value = devices.filter(d => d.kind === 'videoinput')
  if (audioInputs.value[0]) selectedMic.value = audioInputs.value[0].deviceId
  if (videoInputs.value[0]) selectedCamera.value = videoInputs.value[0].deviceId
  if (audioOutputs.value[0]) selectedSpeaker.value = audioOutputs.value[0].deviceId
}

function startMicLevel(stream: MediaStream) {
  try {
    audioCtx = new AudioContext()
    const source = audioCtx.createMediaStreamSource(stream)
    micAnalyser = audioCtx.createAnalyser()
    micAnalyser.fftSize = 256
    source.connect(micAnalyser)
    const data = new Uint8Array(micAnalyser.frequencyBinCount)
    levelInterval = setInterval(() => {
      if (!micAnalyser) return
      micAnalyser.getByteFrequencyData(data)
      const avg = data.reduce((a, b) => a + b, 0) / data.length
      micLevel.value = Math.min(12, Math.round(avg / 8))
    }, 100)
  } catch {}
}

function stopPreview() {
  previewStream?.getTracks().forEach(t => t.stop())
  previewStream = null
}

function toggleMute() {
  isMuted.value = !isMuted.value
  previewStream?.getAudioTracks().forEach(t => { t.enabled = !isMuted.value })
}

function toggleVideo() {
  isVideoOff.value = !isVideoOff.value
  previewStream?.getVideoTracks().forEach(t => { t.enabled = !isVideoOff.value })
}

async function switchMicrophone() {
  if (!selectedMic.value || !previewStream) return
  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: selectedMic.value } }
    })
    const oldAudio = previewStream.getAudioTracks()[0]
    if (oldAudio) { previewStream.removeTrack(oldAudio); oldAudio.stop() }
    previewStream.addTrack(newStream.getAudioTracks()[0])
    startMicLevel(previewStream)
  } catch {}
}

async function switchCamera() {
  if (!selectedCamera.value || !previewStream) return
  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: selectedCamera.value } }
    })
    const oldVideo = previewStream.getVideoTracks()[0]
    if (oldVideo) { previewStream.removeTrack(oldVideo); oldVideo.stop() }
    previewStream.addTrack(newStream.getVideoTracks()[0])
    if (previewVideoRef.value) previewVideoRef.value.srcObject = previewStream
  } catch {}
}

function testSpeaker() {
  if (!speakerTestAudio) {
    // Generate a simple beep using Web Audio
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 440
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    osc.start()
    osc.stop(ctx.currentTime + 0.8)
  }
}

async function handleJoin() {
  if (!meeting.value || isJoining.value) return
  isJoining.value = true

  // Update display name in Auth profile if changed
  const user = auth.currentUser
  if (!user) { isJoining.value = false; return }

  // Store device preferences in meeting store
  meetingStore.selectedAudioInput = selectedMic.value
  meetingStore.selectedVideoInput = selectedCamera.value
  meetingStore.selectedAudioOutput = selectedSpeaker.value

  // Stop preview — the room will start its own streams
  stopPreview()
  if (levelInterval) { clearInterval(levelInterval); levelInterval = null }

  try {
    await meetingStore.joinCurrentMeeting(
      meeting.value.id,
      meeting.value,
      !isMuted.value,
      !isVideoOff.value
    )
    router.replace(`/meeting/room/${meeting.value.meetingCode}`)
  } catch (e: any) {
    meetingStore.addNotification(e.message || 'Could not join meeting', 'error')
    isJoining.value = false
    // Restart preview
    await requestPermissionsAndDevices()
  }
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
* { box-sizing: border-box; }

.prejoin-screen {
  min-height: 100vh; background: #070a14;
  font-family: 'DM Sans', sans-serif; color: #e2e8f0;
  display: flex; align-items: center; justify-content: center;
  position: relative; overflow: hidden; padding: 2rem 1rem;
}

.prejoin-bg { position: fixed; inset: 0; pointer-events: none; }
.bg-orb {
  position: absolute; border-radius: 50%;
  filter: blur(100px); opacity: 0.2;
}
.orb1 { width: 500px; height: 500px; background: #5c3bff; top: -100px; left: -100px; }
.orb2 { width: 400px; height: 400px; background: #ff3b8c; bottom: -100px; right: -50px; }

.prejoin-layout {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 2.5rem; max-width: 960px; width: 100%; position: relative; z-index: 1; align-items: start;
}

/* ── Video Preview ─────────────────────────────────────────────────────────── */
.preview-col { display: flex; flex-direction: column; gap: 1rem; }
.video-preview-wrapper {
  aspect-ratio: 16/9; background: #0c0e1f; border-radius: 20px;
  position: relative; overflow: hidden;
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.preview-video {
  width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);
}
.preview-video.hidden { display: none; }
.preview-avatar {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #0e1028, #1a0a2e);
}
.avatar-circle {
  width: 80px; height: 80px; border-radius: 50%;
  background: linear-gradient(135deg, #5c3bff, #ff3b8c);
  display: flex; align-items: center; justify-content: center;
  font-size: 2rem; font-weight: 700; color: #fff; overflow: hidden;
}
.avatar-circle img { width: 100%; height: 100%; object-fit: cover; }
.preview-name-tag {
  position: absolute; bottom: 0.75rem; left: 0.75rem;
  background: rgba(0,0,0,0.65); backdrop-filter: blur(8px);
  padding: 0.25rem 0.625rem; border-radius: 6px;
  font-size: 0.78rem; font-weight: 500; color: #fff;
}
.preview-controls {
  position: absolute; bottom: 0.75rem; right: 0.75rem;
  display: flex; gap: 0.5rem;
}
.preview-ctrl-btn {
  width: 40px; height: 40px; border-radius: 50%; border: none;
  background: rgba(0,0,0,0.65); backdrop-filter: blur(8px);
  color: #fff; display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s;
}
.preview-ctrl-btn:hover { background: rgba(255,255,255,0.2); }
.preview-ctrl-btn.off { background: rgba(255,59,92,0.8); }
.preview-ctrl-btn:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }

.permission-status {
  display: flex; gap: 1rem; flex-wrap: wrap;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px; padding: 0.875rem 1rem;
}
.perm-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: rgba(255,255,255,0.65); }
.perm-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.perm-dot.ok { background: #34d399; }
.perm-dot.warn { background: #fbbf24; animation: pulse 1.5s infinite; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

/* ── Info Col ─────────────────────────────────────────────────────────────── */
.info-col { display: flex; flex-direction: column; gap: 1.25rem; }
.back-link {
  display: inline-flex; align-items: center; gap: 0.375rem;
  background: none; border: none; color: rgba(255,255,255,0.5);
  font-family: inherit; font-size: 0.85rem; cursor: pointer; padding: 0;
  transition: color 0.2s; width: fit-content;
}
.back-link:hover { color: #fff; }
.back-link:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; border-radius: 4px; }

.loading-state { display: flex; align-items: center; gap: 1rem; color: rgba(255,255,255,0.5); padding: 2rem 0; }
.spinner { width: 28px; height: 28px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #5c3bff; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.not-found { text-align: center; padding: 2rem 0; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.not-found-icon { font-size: 3rem; }
.not-found h2 { font-family: 'Syne', sans-serif; color: #fff; margin: 0; }
.not-found p { color: rgba(255,255,255,0.5); font-size: 0.875rem; margin: 0; }
.btn-primary {
  background: linear-gradient(135deg, #5c3bff, #7c3bff); border: none;
  border-radius: 10px; padding: 0.75rem 1.5rem; color: #fff;
  font-family: inherit; font-size: 0.9rem; font-weight: 700; cursor: pointer; min-height: 48px;
}
.btn-primary:focus-visible { outline: 3px solid #a78bfa; outline-offset: 3px; }

.meeting-info-card {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px; padding: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem;
}
.meeting-host-row { display: flex; align-items: center; gap: 0.75rem; }
.host-avatar {
  width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #5c3bff, #ff3b8c);
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem; font-weight: 700; color: #fff; overflow: hidden; flex-shrink: 0;
}
.host-avatar img { width: 100%; height: 100%; object-fit: cover; }
.host-label { display: block; font-size: 0.72rem; color: rgba(255,255,255,0.4); }
.host-name { font-size: 0.875rem; font-weight: 600; color: #e2e8f0; }
.meeting-title { font-family: 'Syne', sans-serif; font-size: 1.35rem; font-weight: 800; color: #fff; margin: 0; }
.meeting-desc { font-size: 0.875rem; color: rgba(255,255,255,0.55); margin: 0; line-height: 1.5; }
.meeting-agenda h3 { font-size: 0.78rem; font-weight: 600; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 0.375rem; }
.meeting-agenda p { font-size: 0.85rem; color: rgba(255,255,255,0.6); margin: 0; line-height: 1.5; }
.meeting-stats { display: flex; gap: 1rem; flex-wrap: wrap; }
.stat { display: flex; align-items: center; gap: 0.375rem; font-size: 0.8rem; color: rgba(255,255,255,0.5); }

.in-meeting-notice, .waiting-notice {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.75rem 1rem; border-radius: 10px; font-size: 0.85rem;
}
.in-meeting-notice {
  background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.2); color: #34d399;
}
.notice-dot { width: 8px; height: 8px; border-radius: 50%; background: #34d399; animation: pulse 1.5s infinite; }
.waiting-notice {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); color: rgba(255,255,255,0.5);
}

/* Device settings */
.device-settings {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px;
}
.device-settings-summary {
  display: flex; align-items: center; gap: 0.5rem; padding: 0.875rem 1rem;
  cursor: pointer; font-size: 0.875rem; font-weight: 500; color: rgba(255,255,255,0.65);
  list-style: none; user-select: none;
}
.device-settings-summary::-webkit-details-marker { display: none; }
.device-settings-summary:focus-visible { outline: 3px solid #7c6fff; outline-offset: -3px; border-radius: 12px; }
.chevron { margin-left: auto; transition: transform 0.2s; }
.chevron.open { transform: rotate(180deg); }
.device-rows { padding: 0 1rem 1rem; display: flex; flex-direction: column; gap: 0.875rem; }

.device-row { display: flex; flex-direction: column; gap: 0.375rem; }
.device-row label {
  font-size: 0.78rem; font-weight: 600; color: rgba(255,255,255,0.5);
  display: flex; align-items: center; gap: 0.375rem; letter-spacing: 0.04em;
}
.device-row select {
  background: rgba(255,255,255,0.07); border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 8px; padding: 0.5rem 0.875rem; color: #e2e8f0;
  font-family: inherit; font-size: 0.875rem; min-height: 40px;
}
.device-row select:focus { outline: none; border-color: rgba(92,59,255,0.6); box-shadow: 0 0 0 3px rgba(92,59,255,0.12); }

.mic-level { display: flex; align-items: center; gap: 0.75rem; }
.mic-label { display: flex; align-items: center; gap: 0.375rem; font-size: 0.78rem; color: rgba(255,255,255,0.5); width: 55px; flex-shrink: 0; }
.level-bars { display: flex; align-items: flex-end; gap: 2px; height: 28px; }
.level-bar { width: 4px; border-radius: 2px; background: rgba(255,255,255,0.15); transition: background 0.1s; }
.level-bar.active { background: #34d399; }

/* Name + Join */
.name-field { display: flex; flex-direction: column; gap: 0.375rem; }
.name-field label { font-size: 0.82rem; font-weight: 600; color: rgba(255,255,255,0.62); letter-spacing: 0.04em; }
.name-field input {
  background: rgba(255,255,255,0.07); border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 10px; padding: 0.75rem 1rem; color: #e2e8f0;
  font-family: inherit; font-size: 0.95rem; min-height: 48px;
}
.name-field input:focus { outline: none; border-color: rgba(92,59,255,0.6); box-shadow: 0 0 0 3px rgba(92,59,255,0.12); background: rgba(92,59,255,0.06); }
.field-hint { font-size: 0.72rem; color: rgba(255,255,255,0.35); }

.join-btn {
  width: 100%; padding: 0.875rem; min-height: 56px;
  background: linear-gradient(135deg, #5c3bff, #7c3bff); border: none; border-radius: 14px;
  color: #fff; font-family: inherit; font-size: 1.05rem; font-weight: 700;
  cursor: pointer; transition: all 0.2s;
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  letter-spacing: 0.02em;
}
.join-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 8px 28px rgba(92,59,255,0.45); }
.join-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
.join-btn:focus-visible { outline: 3px solid #a78bfa; outline-offset: 3px; }
.join-spinner {
  width: 20px; height: 20px; border: 2.5px solid rgba(255,255,255,0.3);
  border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;
}
.perm-warning {
  font-size: 0.8rem; color: #fbbf24; text-align: center; margin: 0;
  padding: 0.625rem; background: rgba(251,191,36,0.1); border-radius: 8px;
  border: 1px solid rgba(251,191,36,0.2);
}

@media (max-width: 768px) {
  .prejoin-layout { grid-template-columns: 1fr; max-width: 500px; }
}
</style>
