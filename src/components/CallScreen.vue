<template>
<div class="call-screen" :class="{ 'call-incoming': callState.isIncoming }">
<div v-if="callState.isIncoming" class="incoming-call-container" role="complementary" aria-label="Incoming call">
<div class="incoming-call-content">
<div class="caller-info">
<div class="caller-avatar">
{{ callState.peerName.charAt(0).toUpperCase() }}
</div>
<h1 class="caller-name">{{ callState.peerName }}</h1>
<p class="call-type">{{ callState.isVideoEnabled ? 'Video' : 'Voice' }} Call</p>
</div>
<div class="incoming-call-actions">
<button 
@click="answerCall(false)"
class="action-btn answer-audio-btn"
aria-label="Answer voice call"
title="Answer (Audio only)"
ref="answerAudioBtn"
>
<span class="btn-icon">📞</span>
<span class="btn-text">Answer</span>
</button>
<button 
v-if="callState.isVideoEnabled"
@click="answerCall(true)"
class="action-btn answer-video-btn"
aria-label="Answer video call"
title="Answer with Video"
>
<span class="btn-icon">📹</span>
<span class="btn-text">Video</span>
</button>
<button 
@click="showRejectOptions = !showRejectOptions"
class="action-btn reject-btn"
:aria-pressed="showRejectOptions"
aria-label="Reject call or show reject options"
title="Reject Call"
>
<span class="btn-icon">📵</span>
<span class="btn-text">Reject</span>
</button>
</div>
<div v-if="showRejectOptions" class="reject-options-widget" ref="rejectOptionsWidget" role="group" aria-label="Reject call widget">
<h2 class="reject-title">Reject with message</h2>
<div class="quick-replies">
<button 
v-for="reply in quickReplies" 
:key="reply"
@click="rejectCall(reply)"
class="quick-reply-btn"
ref="quickReplyBtns"
>
{{ reply }}
</button>
</div>
<div class="custom-reply">
<label for="custom-message" class="form-label">Custom rejection message</label>
<textarea
id="custom-message"
ref="customMessageInput"
v-model="customMessage"
placeholder="Type a custom message..."
class="custom-message-input"
rows="2"
maxlength="200"
></textarea>
<div class="custom-reply-actions">
<button 
@click="rejectCall('Custom', customMessage)"
class="btn btn-primary"
:disabled="!customMessage.trim()"
>
Send & Reject
</button>
<button 
@click="hideRejectOptions"
class="btn btn-secondary"
>
Cancel
</button>
</div>
</div>
</div>
</div>
</div>
<div v-else-if="callState.isActive" class="active-call">
<header class="call-header">
<button 
@click="goBack"
class="back-btn"
aria-label="Go back to chat"
title="Back to Chat"
>
← Back
</button>
<div class="call-info">
<h1 class="peer-name">{{ callState.peerName }}</h1>
<p class="call-status">
{{ getCallStatus() }}
</p>
</div>
<div class="call-timer">
{{ formatCallDuration() }}
</div>
</header>
<div class="video-container" v-if="callState.isVideoEnabled || hasRemoteVideo">
<video 
ref="remoteVideo"
class="remote-video"
autoplay
playsinline
:aria-label="`Video from ${callState.peerName}`"
></video>
<video 
ref="localVideo"
class="local-video"
autoplay
playsinline
muted
aria-label="Your video"
></video>
</div>
<div v-else class="audio-call-display">
<div class="peer-avatar">
{{ callState.peerName.charAt(0).toUpperCase() }}
</div>
<p class="audio-call-label">Audio Call</p>
<p v-if="callState.isOnHold" class="hold-status">Call on Hold</p>
</div>
<div class="call-controls" role="toolbar" aria-label="Call controls">
<button 
@click="toggleMute"
:class="['control-btn', { 'active': callState.isMuted }]"
:aria-label="callState.isMuted ? 'Unmute microphone' : 'Mute microphone'"
:title="`${callState.isMuted ? 'Unmute' : 'Mute'} (Ctrl+M)`"
:aria-pressed="callState.isMuted"
>
<span class="control-icon">{{ callState.isMuted ? '🔇' : '🎤' }}</span>
<span class="control-label">{{ callState.isMuted ? 'Unmuted' : 'Mute' }}</span>
</button>
<button 
@click="toggleVideo"
:class="['control-btn', { 'active': !callState.isVideoEnabled }]"
:aria-label="callState.isVideoEnabled ? 'Turn off camera' : 'Turn on camera'"
:title="`${callState.isVideoEnabled ? 'Turn off' : 'Turn on'} camera (Ctrl+V)`"
:aria-pressed="callState.isVideoEnabled"
>
<span class="control-icon">{{ callState.isVideoEnabled ? '📹' : '📵' }}</span>
<span class="control-label">{{ callState.isVideoEnabled ? 'Camera' : 'No Camera' }}</span>
</button>
<button 
@click="toggleHold"
:class="['control-btn', { 'active': callState.isOnHold }]"
:aria-label="callState.isOnHold ? 'Resume call' : 'Hold call'"
:title="`${callState.isOnHold ? 'Resume' : 'Hold'} call (Ctrl+H)`"
:aria-pressed="callState.isOnHold"
>
<span class="control-icon">{{ callState.isOnHold ? '⏸️' : '⏯️' }}</span>
<span class="control-label">{{ callState.isOnHold ? 'Resume' : 'Hold' }}</span>
</button>
<button 
@click="toggleSettings"
class="control-btn"
:aria-pressed="showSettings"
aria-label="Show call settings"
title="Settings (Ctrl+S)"
>
<span class="control-icon">⚙️</span>
<span class="control-label">Settings</span>
</button>
<button 
@click="endCall"
class="control-btn end-call-btn"
aria-label="End call"
title="End call (Ctrl+E)"
>
<span class="control-icon">📞</span>
<span class="control-label">End</span>
</button>
</div>
<div v-if="showSettings" class="settings-widget" ref="settingsWidget" role="group" aria-label="Call Settings">
<h2 class="settings-title">Call Settings</h2>
<div class="settings-group">
<label for="audio-input-select" class="settings-label">Microphone:</label>
<select 
id="audio-input-select"
:value="callState.currentAudioInput"
@change="changeAudioInput(($event.target as HTMLSelectElement).value)"
class="settings-select"
ref="audioInputSelect"
>
<option selected disabled value="">Choose a microphone...</option>
<option v-for="device in availableAudioInputs" :key="device.deviceId" :value="device.deviceId">
{{ device.label || `Microphone ${device.deviceId.substring(0, 8)}` }}
</option>
</select>
</div>
<div class="settings-group">
<label for="audio-output-select" class="settings-label">Speaker:</label>
<select 
id="audio-output-select"
:value="callState.currentAudioOutput"
@change="changeAudioOutput(($event.target as HTMLSelectElement).value)"
class="settings-select"
>
<option selected disabled value="">Choose a speaker...</option>
<option v-for="device in availableAudioOutputs" :key="device.deviceId" :value="device.deviceId">
{{ device.label || `Speaker ${device.deviceId.substring(0, 8)}` }}
</option>
</select>
</div>
<div v-if="callState.isVideoEnabled" class="settings-group">
<label for="video-input-select" class="settings-label">Camera:</label>
<select 
id="video-input-select"
:value="callState.currentVideoInput"
@change="changeVideoInput(($event.target as HTMLSelectElement).value)"
class="settings-select"
>
<option selected disabled value="">Choose a camera...</option>
<option v-for="device in availableVideoInputs" :key="device.deviceId" :value="device.deviceId">
{{ device.label || `Camera ${device.deviceId.substring(0, 8)}` }}
</option>
</select>
</div>
<div class="settings-group">
<label for="playback-speed" class="settings-label">Playback Speed:</label>
<input 
id="playback-speed"
type="range"
min="0.5"
max="3"
step="0.1"
:value="callState.playbackSpeed"
@input="changePlaybackSpeed(($event.target as HTMLInputElement).value)"
class="settings-range"
:aria-label="`Playback speed: ${callState.playbackSpeed}x`"
/>
<span class="speed-value">{{ callState.playbackSpeed.toFixed(1) }}x</span>
</div>
<button 
@click="hideSettings"
class="btn btn-secondary settings-close"
>
Close Settings
</button>
</div>
<div v-if="showKeyboardHelp" class="keyboard-help-widget" ref="keyboardHelpWidget">
<h2>Keyboard Shortcuts</h2>
<ul class="shortcuts-list">
<li><kbd>Ctrl + M</kbd> - Mute/Unmute</li>
<li><kbd>Ctrl + V</kbd> - Toggle Camera</li>
<li><kbd>Ctrl + H</kbd> - Hold/Resume</li>
<li><kbd>Ctrl + S</kbd> - Settings</li>
<li><kbd>Ctrl + E</kbd> - End Call</li>
<li><kbd>Ctrl + P</kbd> - Playback Speed</li>
<li><kbd>Ctrl + Shift + M</kbd> - Change Microphone</li>
<li><kbd>Ctrl + ?</kbd> - Show/Hide Help</li>
</ul>
<button @click="hideKeyboardHelp" class="btn btn-secondary">Close Help</button>
</div>
</div>
<div aria-live="assertive" class="sr-only">
{{ announcement }}
</div>
</div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAppStore } from "../stores/app";
import { usePeerStore } from "../stores/peer";
const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const peerStore = usePeerStore();
const peerId = ref<string>(route.params.id as string);
const showRejectOptions = ref(false);
const showSettings = ref(false);
const showKeyboardHelp = ref(false);
const customMessage = ref('');
const announcement = ref('');
const callStartTime = ref<number>(0);
const callTimer = ref<number>(0);
const hasRemoteVideo = ref(false);
const answerAudioBtn = ref<HTMLButtonElement>();
const rejectOptionsWidget = ref<HTMLElement>();
const quickReplyBtns = ref<HTMLButtonElement[]>([]);
const customMessageInput = ref<HTMLTextAreaElement>();
const settingsWidget = ref<HTMLElement>();
const audioInputSelect = ref<HTMLSelectElement>();
const keyboardHelpWidget = ref<HTMLElement>();
const remoteVideo = ref<HTMLVideoElement>();
const localVideo = ref<HTMLVideoElement>();
const callState = computed(() => appStore.callState);
const availableAudioInputs = computed(() => appStore.availableAudioInputs);
const availableAudioOutputs = computed(() => appStore.availableAudioOutputs);
const availableVideoInputs = computed(() => appStore.availableVideoInputs);
const quickReplies = [
"I'm busy right now",
"Can't talk now, I'll call back",
"In a meeting",
"Driving",
"Will call you later"
];
let timerInterval: number | null = null;
onMounted(async () => {
await loadMediaDevices();
setupKeyboardShortcuts();
if (callState.value.isActive) {
callStartTime.value = Date.now();
startCallTimer();
setupVideoStreams();
}
if (callState.value.isIncoming) {
await nextTick();
answerAudioBtn.value?.focus();
announcement.value = `Incoming ${callState.value.isVideoEnabled ? 'video' : 'voice'} call from ${callState.value.peerName}`;
} else {
announcement.value = `Call with ${callState.value.peerName} started`;
}
});
onUnmounted(() => {
stopCallTimer();
removeKeyboardShortcuts();
});
watch(() => peerStore.remoteStream, (stream) => {
if (stream && remoteVideo.value) {
remoteVideo.value.srcObject = stream;
hasRemoteVideo.value = stream.getVideoTracks().length > 0;
}
});
watch(() => peerStore.localStream, (stream) => {
if (stream && localVideo.value) {
localVideo.value.srcObject = stream;
}
});
watch(showRejectOptions, async (show) => {
if (show) {
await nextTick();
if (quickReplyBtns.value?.[0]) {
quickReplyBtns.value[0].focus();
}
}
});
watch(showSettings, async (show) => {
if (show) {
await nextTick();
// audioInputSelect.value?.focus();
}
});
watch(showKeyboardHelp, async (show) => {
if (show) {
await nextTick();
keyboardHelpWidget.value?.focus();
}
});
async function loadMediaDevices() {
try {
const devices = await navigator.mediaDevices.enumerateDevices();
appStore.availableAudioInputs = devices.filter(d => d.kind === 'audioinput');
appStore.availableAudioOutputs = devices.filter(d => d.kind === 'audiooutput');
appStore.availableVideoInputs = devices.filter(d => d.kind === 'videoinput');
} catch (error) {
console.error('Error loading media devices:', error);
}
}
function setupVideoStreams() {
nextTick(() => {
if (peerStore.localStream && localVideo.value) {
localVideo.value.srcObject = peerStore.localStream;
}
if (peerStore.remoteStream && remoteVideo.value) {
remoteVideo.value.srcObject = peerStore.remoteStream;
hasRemoteVideo.value = peerStore.remoteStream.getVideoTracks().length > 0;
}
});
}
function startCallTimer() {
timerInterval = window.setInterval(() => {
callTimer.value = Date.now() - callStartTime.value;
}, 1000);
}
function stopCallTimer() {
if (timerInterval) {
clearInterval(timerInterval);
timerInterval = null;
}
}
function setupKeyboardShortcuts() {
document.addEventListener('keydown', handleKeyboardShortcuts);
}
function removeKeyboardShortcuts() {
document.removeEventListener('keydown', handleKeyboardShortcuts);
}
function handleKeyboardShortcuts(event: KeyboardEvent) {
if (!callState.value.isActive || callState.value.isIncoming) return;
if (event.ctrlKey) {
let handled = true;
switch (event.key.toLowerCase()) {
case 'm':
event.preventDefault();
if (event.shiftKey) {
cycleAudioInput();
} else {
toggleMute();
}
break;
case 'v':
event.preventDefault();
toggleVideo();
break;
case 'h':
event.preventDefault();
toggleHold();
break;
case 's':
event.preventDefault();
toggleSettings();
break;
case 'e':
event.preventDefault();
endCall();
break;
case 'p':
event.preventDefault();
cyclePlaybackSpeed();
break;
case '/':
if (event.shiftKey) {
event.preventDefault();
showKeyboardHelp.value = !showKeyboardHelp.value;
} else {
handled = false;
}
break;
default:
handled = false;
}
if (handled) {
announcement.value = `Keyboard shortcut activated: ${event.key}`;
}
}
}
async function answerCall(withVideo: boolean) {
announcement.value = withVideo ? 'Answering video call...' : 'Answering voice call...';
await peerStore.answerCall(withVideo);
callStartTime.value = Date.now();
startCallTimer();
setupVideoStreams();
announcement.value = 'Call answered';
}
function rejectCall(reason: string, customMsg?: string) {
announcement.value = `Call rejected: ${reason}`;
peerStore.rejectCall(reason, customMsg);
goBack();
}
function hideRejectOptions() {
showRejectOptions.value = false;
answerAudioBtn.value?.focus();
}
function toggleMute() {
peerStore.toggleMute();
announcement.value = callState.value.isMuted ? 'Muted' : 'Unmuted';
}
async function toggleVideo() {
try {
await peerStore.toggleVideo();
announcement.value = callState.value.isVideoEnabled ? 'Camera on' : 'Camera off';
} catch (error) {
if (error instanceof Error && error.name === 'NotAllowedError') {
appStore.addNotification('Camera permission denied. Please allow camera access in your browser settings.');
announcement.value = 'Camera permission denied';
} else {
appStore.addNotification('Failed to access camera');
announcement.value = 'Failed to access camera';
}
}
}
function toggleHold() {
peerStore.toggleHold();
announcement.value = callState.value.isOnHold ? 'Call on hold' : 'Call resumed';
}
function toggleSettings() {
showSettings.value = !showSettings.value;
}
function hideSettings() {
showSettings.value = false;
}
function hideKeyboardHelp() {
showKeyboardHelp.value = false;
}
function endCall() {
announcement.value = 'Call ended';
peerStore.endCall();
stopCallTimer();
goBack();
}
function goBack() {
router.push(`/chat/${peerId.value}`);
}
async function changeAudioInput(deviceId: string) {
await peerStore.changeAudioInput(deviceId);
announcement.value = 'Microphone changed';
}
async function changeAudioOutput(deviceId: string) {
try {
if (remoteVideo.value && 'setSinkId' in remoteVideo.value) {
await (remoteVideo.value as any).setSinkId(deviceId);
appStore.updateCallState({ currentAudioOutput: deviceId });
announcement.value = 'Speaker changed';
}
} catch (error) {
appStore.addNotification('Failed to change speaker');
}
}
async function changeVideoInput(deviceId: string) {
await peerStore.changeVideoInput(deviceId);
announcement.value = 'Camera changed';
}
function changePlaybackSpeed(speed: string) {
const speedValue = parseFloat(speed);
appStore.updateCallState({ playbackSpeed: speedValue });
if (remoteVideo.value) {
remoteVideo.value.playbackRate = speedValue;
}
announcement.value = `Playback speed set to ${speedValue}x`;
}
function cycleAudioInput() {
const current = availableAudioInputs.value.findIndex(d => d.deviceId === callState.value.currentAudioInput);
const next = (current + 1) % availableAudioInputs.value.length;
const nextDevice = availableAudioInputs.value[next];
if (nextDevice) {
changeAudioInput(nextDevice.deviceId);
}
}
function cyclePlaybackSpeed() {
const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const currentIndex = speeds.indexOf(callState.value.playbackSpeed);
const nextIndex = (currentIndex + 1) % speeds.length;
changePlaybackSpeed(speeds[nextIndex].toString());
}
function getCallStatus(): string {
if (callState.value.isOnHold) return 'On Hold';
if (callState.value.isOutgoing && !peerStore.remoteStream) return 'Calling...';
return 'Connected';
}
function formatCallDuration(): string {
const seconds = Math.floor(callTimer.value / 1000);
const minutes = Math.floor(seconds / 60);
const hours = Math.floor(minutes / 60);
if (hours > 0) {
return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
} else {
return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
}
</script>
<style scoped>
.call-screen {
min-height: 100vh;
background: #1a202c;
color: white;
display: flex;
flex-direction: column;
}

.call-incoming {
background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
}

.incoming-call-container {
min-height: 100vh;
display: flex;
align-items: center;
justify-content: center;
padding: 2rem;
}

.incoming-call-content {
text-align: center;
max-width: 500px;
width: 100%;
}

.caller-info {
margin-bottom: 3rem;
}

.caller-avatar {
width: 120px;
height: 120px;
border-radius: 50%;
background: #667eea;
display: flex;
align-items: center;
justify-content: center;
font-size: 3rem;
font-weight: 600;
margin: 0 auto 1rem;
animation: pulse 2s infinite;
}

@keyframes pulse {
0%, 100% { transform: scale(1); }
50% { transform: scale(1.05); }
}

.caller-name {
font-size: 2rem;
font-weight: 600;
margin: 0 0 0.5rem 0;
}

.call-type {
font-size: 1.125rem;
color: #a0aec0;
margin: 0;
}

.incoming-call-actions {
display: flex;
justify-content: center;
gap: 1.5rem;
margin-bottom: 2rem;
}

.action-btn {
display: flex;
flex-direction: column;
align-items: center;
gap: 0.5rem;
background: none;
border: 2px solid;
border-radius: 50%;
width: 80px;
height: 80px;
cursor: pointer;
transition: all 0.2s ease;
color: white;
}

.answer-audio-btn {
border-color: #48bb78;
background: rgba(72, 187, 120, 0.1);
}

.answer-audio-btn:hover {
background: #48bb78;
transform: scale(1.1);
}

.answer-video-btn {
border-color: #4299e1;
background: rgba(66, 153, 225, 0.1);
}

.answer-video-btn:hover {
background: #4299e1;
transform: scale(1.1);
}

.reject-btn {
border-color: #e53e3e;
background: rgba(229, 62, 62, 0.1);
}

.reject-btn:hover {
background: #e53e3e;
transform: scale(1.1);
}

.action-btn:focus {
outline: 3px solid rgba(255, 255, 255, 0.5);
outline-offset: 2px;
}

.btn-icon {
font-size: 1.5rem;
}

.btn-text {
font-size: 0.75rem;
font-weight: 600;
}

.reject-options-widget {
background: rgba(45, 55, 72, 0.95);
border: 2px solid #4a5568;
border-radius: 12px;
padding: 1.5rem;
text-align: left;
margin-top: 1rem;
backdrop-filter: blur(10px);
}

.reject-title {
font-size: 1.25rem;
margin: 0 0 1rem 0;
}

.quick-replies {
display: grid;
gap: 0.5rem;
margin-bottom: 1rem;
}

.quick-reply-btn {
background: rgba(102, 126, 234, 0.1);
border: 1px solid #667eea;
color: white;
padding: 0.75rem;
border-radius: 8px;
cursor: pointer;
text-align: left;
transition: all 0.2s ease;
}

.quick-reply-btn:hover {
background: rgba(102, 126, 234, 0.2);
}

.quick-reply-btn:focus {
outline: 2px solid #667eea;
outline-offset: 2px;
}

.custom-reply {
margin-top: 1rem;
}

.form-label {
display: block;
margin-bottom: 0.5rem;
font-weight: 600;
}

.custom-message-input {
width: 100%;
background: rgba(45, 55, 72, 0.8);
border: 1px solid #4a5568;
color: white;
padding: 0.75rem;
border-radius: 8px;
resize: vertical;
font-family: inherit;
margin-bottom: 1rem;
}

.custom-message-input:focus {
outline: none;
border-color: #667eea;
}

.custom-message-input::placeholder {
color: #a0aec0;
}

.custom-reply-actions {
display: flex;
gap: 1rem;
}

.btn {
padding: 0.75rem 1rem;
border: none;
border-radius: 8px;
font-weight: 600;
cursor: pointer;
transition: all 0.2s ease;
}

.btn-primary {
background: #667eea;
color: white;
}

.btn-primary:hover:not(:disabled) {
background: #5a67d8;
}

.btn-secondary {
background: rgba(74, 85, 104, 0.8);
color: white;
}

.btn-secondary:hover {
background: #4a5568;
}

.btn:disabled {
opacity: 0.5;
cursor: not-allowed;
}

.btn:focus {
outline: 2px solid rgba(255, 255, 255, 0.5);
outline-offset: 2px;
}

.active-call {
height: 100vh;
display: flex;
flex-direction: column;
}

.call-header {
background: rgba(45, 55, 72, 0.9);
padding: 1rem;
display: flex;
align-items: center;
gap: 1rem;
backdrop-filter: blur(10px);
}

.back-btn {
background: rgba(74, 85, 104, 0.8);
border: 1px solid #4a5568;
color: white;
padding: 0.5rem 1rem;
border-radius: 8px;
cursor: pointer;
transition: all 0.2s ease;
}

.back-btn:hover {
background: #4a5568;
}

.back-btn:focus {
outline: 2px solid white;
outline-offset: 2px;
}

.call-info {
flex: 1;
}

.peer-name {
font-size: 1.25rem;
font-weight: 600;
margin: 0;
}

.call-status {
color: #a0aec0;
margin: 0;
font-size: 0.875rem;
}

.call-timer {
font-family: monospace;
font-size: 1.125rem;
font-weight: 600;
}

.video-container {
flex: 1;
position: relative;
background: #000;
}

.remote-video {
width: 100%;
height: 100%;
object-fit: cover;
}

.local-video {
position: absolute;
top: 1rem;
right: 1rem;
width: 200px;
height: 150px;
border-radius: 8px;
object-fit: cover;
border: 2px solid rgba(255, 255, 255, 0.3);
}

.audio-call-display {
flex: 1;
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
gap: 1rem;
}

.peer-avatar {
width: 200px;
height: 200px;
border-radius: 50%;
background: #667eea;
display: flex;
align-items: center;
justify-content: center;
font-size: 4rem;
font-weight: 600;
}

.audio-call-label {
font-size: 1.5rem;
color: #a0aec0;
}

.hold-status {
font-size: 1.25rem;
color: #f6ad55;
font-weight: 600;
}

.call-controls {
background: rgba(45, 55, 72, 0.9);
padding: 1.5rem;
display: flex;
justify-content: center;
gap: 1rem;
backdrop-filter: blur(10px);
}

.control-btn {
display: flex;
flex-direction: column;
align-items: center;
gap: 0.25rem;
background: rgba(74, 85, 104, 0.8);
border: 1px solid #4a5568;
color: white;
width: 60px;
height: 60px;
border-radius: 50%;
cursor: pointer;
transition: all 0.2s ease;
}

.control-btn:hover {
background: #4a5568;
transform: translateY(-2px);
}

.control-btn:focus {
outline: 2px solid white;
outline-offset: 2px;
}

.control-btn.active {
background: #e53e3e;
border-color: #e53e3e;
}

.end-call-btn {
background: #e53e3e !important;
border-color: #e53e3e !important;
}

.end-call-btn:hover {
background: #c53030 !important;
}

.control-icon {
font-size: 1.25rem;
}

.control-label {
font-size: 0.625rem;
font-weight: 600;
text-align: center;
}

.settings-widget {
position: fixed;
top: 50%;
left: 50%;
transform: translate(-50%, -50%);
background: rgba(45, 55, 72, 0.95);
border: 2px solid #4a5568;
border-radius: 12px;
padding: 2rem;
max-width: 400px;
width: 90%;
backdrop-filter: blur(10px);
z-index: 1000;
}

.settings-title {
font-size: 1.5rem;
margin: 0 0 1.5rem 0;
}

.settings-group {
margin-bottom: 1.5rem;
}

.settings-label {
display: block;
margin-bottom: 0.5rem;
font-weight: 600;
}

.settings-select {
width: 100%;
background: rgba(74, 85, 104, 0.8);
border: 1px solid #4a5568;
color: white;
padding: 0.75rem;
border-radius: 8px;
}

.settings-select:focus {
outline: none;
border-color: #667eea;
}

.settings-range {
width: calc(100% - 60px);
margin-right: 1rem;
}

.speed-value {
font-family: monospace;
font-weight: 600;
}

.settings-close {
width: 100%;
margin-top: 1rem;
}

.keyboard-help-widget {
position: fixed;
top: 50%;
left: 50%;
transform: translate(-50%, -50%);
background: rgba(45, 55, 72, 0.95);
border: 2px solid #4a5568;
border-radius: 12px;
padding: 2rem;
max-width: 500px;
width: 90%;
backdrop-filter: blur(10px);
z-index: 1000;
outline: none;
}

.shortcuts-list {
list-style: none;
padding: 0;
margin: 0 0 1.5rem 0;
}

.shortcuts-list li {
display: flex;
justify-content: space-between;
padding: 0.5rem 0;
border-bottom: 1px solid rgba(74, 85, 104, 0.3);
}

.shortcuts-list li:last-child {
border-bottom: none;
}

kbd {
background: rgba(74, 85, 104, 0.8);
border: 1px solid #4a5568;
border-radius: 4px;
padding: 0.25rem 0.5rem;
font-family: monospace;
font-size: 0.875rem;
}

.sr-only {
position: absolute;
width: 1px;
height: 1px;
padding: 0;
margin: -1px;
overflow: hidden;
clip: rect(0, 0, 0, 0);
white-space: nowrap;
border: 0;
}

@media (max-width: 640px) {
.incoming-call-actions {
flex-direction: column;
align-items: center;
}

.call-controls {
flex-wrap: wrap;
gap: 0.5rem;
}

.control-btn {
width: 50px;
height: 50px;
}

.local-video {
width: 120px;
height: 90px;
}

.settings-widget,
.keyboard-help-widget {
width: 95%;
padding: 1rem;
}
}
</style>