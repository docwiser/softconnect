<template>
<div class="dashboard">
<header class="dashboard-header">
<div class="header-content">
<h1 class="dashboard-title">Soft connect</h1>
<div class="user-info">
<span class="user-name">{{ currentUser?.name }}</span>
<span class="user-id" :aria-label="`Your ID is ${currentUser?.id}`">
ID: {{ currentUser?.id }}
</span>
</div>
</div>
</header>
<div class="dashboard-content">
<div class="connect-section" role="region" aria-labelledby="connect-title">
<h2 id="connect-title" class="section-title">Connect to Someone</h2>
<form @submit.prevent="handleConnect" class="connect-form">
<div class="form-group">
<label for="peer-id" class="form-label">Enter 4-digit ID:</label>
<input 
id="peer-id"
ref="connectInput"
v-model="connectId" 
type="text" 
pattern="[0-9]{4}"
maxlength="4"
class="form-input"
placeholder="e.g., 1234"
:aria-describedby="connectError ? 'connect-error' : 'connect-help'"
:aria-invalid="!!connectError"
@input="clearConnectError"
/>
<div id="connect-help" class="help-text">
Enter the 4-digit ID shared by your contact
</div>
<div 
v-if="connectError" 
id="connect-error" 
class="error-message" 
role="alert"
aria-live="polite"
>
{{ connectError }}
</div>
</div>
<button 
type="submit" 
class="btn btn-primary"
:disabled="isConnecting || connectId.length !== 4"
>
<span v-if="isConnecting">Connecting...</span>
<span v-else>Connect</span>
</button>
</form>
</div>
<div class="chats-section" role="region" aria-labelledby="chats-title">
<h2 id="chats-title" class="section-title">
Your Chats
<span v-if="sortedChats.length" class="chat-count">
({{ sortedChats.length }})
</span>
</h2>
<div v-if="sortedChats.length === 0" class="empty-state">
<p>No chats yet. Connect to someone to start chatting!</p>
</div>
<div v-else class="chats-list" role="list">
<div 
v-for="chat in sortedChats" 
:key="chat.peerId"
class="chat-item"
role="listitem"
>
<button 
@click="openChat(chat.peerId)"
class="chat-button"
:aria-describedby="`chat-${chat.peerId}-desc`"
>
<div class="chat-avatar">
{{ chat.peerName.charAt(0).toUpperCase() }}
</div>
<div class="chat-content">
<div class="chat-header">
<h3 class="chat-name">{{ chat.peerName }}</h3>
<span class="chat-time">
{{ formatTime(chat.lastMessage?.timestamp) }}
</span>
</div>
<div class="chat-preview">
<p class="chat-last-message">
{{ getLastMessagePreview(chat) }}
</p>
<div 
v-if="chat.unreadCount > 0" 
class="unread-badge"
:aria-label="`${chat.unreadCount} unread messages`"
>
{{ chat.unreadCount }}
</div>
</div>
</div>
</button>
<div class="chat-actions">
<button 
@click="startVoiceCall(chat.peerId)"
class="action-btn voice-call-btn"
:aria-label="`Start voice call with ${chat.peerName}`"
title="Voice call"
>
<span class="icon">📞</span>
<span class="sr-only">Voice call</span>
</button>
<button 
@click="startVideoCall(chat.peerId)"
class="action-btn video-call-btn"
:aria-label="`Start video call with ${chat.peerName}`"
title="Video call"
>
<span class="icon">📹</span>
<span class="sr-only">Video call</span>
</button>
</div>
<div 
:id="`chat-${chat.peerId}-desc`" 
class="sr-only"
>
Chat with {{ chat.peerName }}, 
{{ chat.unreadCount > 0 ? `${chat.unreadCount} unread messages, ` : "" }}
last message: {{ getLastMessagePreview(chat) }},
{{ formatTime(chat.lastMessage?.timestamp) }}
</div>
</div>
</div>
</div>
</div>
<div 
v-if="callState.isActive && activeChat !== callState.peerId"
class="call-overlay-indicator"
>
<button 
@click="goToCall"
class="call-indicator-btn"
aria-label="Return to active call"
>
<span class="call-indicator-icon">📞</span>
<span class="call-indicator-text">
Call with {{ callState.peerName }} - Click to return
</span>
</button>
</div>
<div aria-live="polite" class="sr-only">
{{ announcement }}
</div>
</div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useAppStore } from "../stores/app";
import { usePeerStore } from "../stores/peer";
import type { Chat } from "../types";
const router = useRouter();
const appStore = useAppStore();
const peerStore = usePeerStore();
const connectId = ref("");
const isConnecting = ref(false);
const connectError = ref("");
const announcement = ref("");
const connectInput = ref<HTMLInputElement>();
const currentUser = computed(() => appStore.currentUser);
const sortedChats = computed(() => appStore.sortedChats);
const callState = computed(() => appStore.callState);
const activeChat = computed(() => appStore.activeChat);
onMounted(async () => {
await nextTick();
announcement.value = `Dashboard loaded. Welcome ${currentUser.value?.name}. Your ID is ${currentUser.value?.id}`;
});
async function handleConnect() {
if (connectId.value.length !== 4) {
connectError.value = "Please enter a 4-digit ID";
announcement.value = "Error: Please enter a 4-digit ID";
return;
}
if (connectId.value === currentUser.value?.id) {
connectError.value = "You cannot connect to yourself";
announcement.value = "Error: You cannot connect to yourself";
return;
}
const existingChat = sortedChats.value.find(chat => chat.peerId === connectId.value);
if (existingChat) {
openChat(connectId.value);
return;
}
isConnecting.value = true;
connectError.value = "";
announcement.value = `Connecting to ${connectId.value}...`;
try {
await peerStore.connectToPeer(connectId.value);
announcement.value = `Connected to ${connectId.value} successfully`;
connectId.value = "";
} catch (error) {
connectError.value = "Failed to connect. Please check the ID and try again.";
announcement.value = "Connection failed. Please check the ID and try again.";
} finally {
isConnecting.value = false;
}
}
function clearConnectError() {
connectError.value = "";
}
function openChat(peerId: string) {
appStore.setActiveChat(peerId);
router.push(`/chat/${peerId}`);
}
function startVoiceCall(peerId: string) {
announcement.value = "Starting voice call...";
peerStore.startCall(peerId, false);
router.push(`/call/${peerId}`);
}
function startVideoCall(peerId: string) {
announcement.value = "Starting video call...";
peerStore.startCall(peerId, true);
router.push(`/call/${peerId}`);
}
function goToCall() {
router.push(`/call/${callState.value.peerId}`);
}
function getLastMessagePreview(chat: Chat): string {
if (!chat.lastMessage) return "No messages yet";
const isOwn = chat.lastMessage.senderId === currentUser.value?.id;
const prefix = isOwn ? "You: " : "";
const content = chat.lastMessage.content;
return prefix + (content.length > 50 ? content.substring(0, 50) + "..." : content);
}
function formatTime(timestamp?: number): string {
if (!timestamp) return "";
const now = new Date();
const date = new Date(timestamp);
const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
if (diffInHours < 24) {
return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
} else if (diffInHours < 168) { // 7 days
return date.toLocaleDateString([], { weekday: "short" });
} else {
return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
}
</script>
<style scoped>
.dashboard {
min-height: 100vh;
background: #f7fafc;
}

.dashboard-header {
background: white;
border-bottom: 1px solid #e2e8f0;
padding: 1rem 0;
}

.header-content {
max-width: 800px;
margin: 0 auto;
padding: 0 1rem;
display: flex;
justify-content: space-between;
align-items: center;
}

.dashboard-title {
font-size: 1.5rem;
font-weight: 700;
color: #2d3748;
}

.user-info {
display: flex;
flex-direction: column;
align-items: flex-end;
gap: 0.25rem;
}

.user-name {
font-weight: 600;
color: #2d3748;
}

.user-id {
font-size: 0.875rem;
color: #718096;
font-family: monospace;
background: #edf2f7;
padding: 0.25rem 0.5rem;
border-radius: 4px;
}

.dashboard-content {
max-width: 800px;
margin: 0 auto;
padding: 2rem 1rem;
display: grid;
gap: 2rem;
}

.section-title {
font-size: 1.25rem;
font-weight: 600;
color: #2d3748;
margin-bottom: 1rem;
display: flex;
align-items: center;
gap: 0.5rem;
}

.chat-count {
font-size: 0.875rem;
color: #718096;
font-weight: normal;
}

.connect-section {
background: white;
border-radius: 12px;
padding: 1.5rem;
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.connect-form {
display: grid;
gap: 1rem;
}

.form-group {
display: grid;
gap: 0.5rem;
}

.form-label {
font-weight: 600;
color: #2d3748;
}

.form-input {
padding: 0.75rem;
border: 2px solid #e2e8f0;
border-radius: 8px;
font-size: 1rem;
transition: all 0.2s ease;
text-align: center;
font-family: monospace;
font-size: 1.25rem;
letter-spacing: 0.5rem;
}

.form-input:focus {
outline: none;
border-color: #667eea;
box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input[aria-invalid="true"] {
border-color: #e53e3e;
}

.help-text {
font-size: 0.875rem;
color: #718096;
}

.error-message {
color: #e53e3e;
font-size: 0.875rem;
font-weight: 500;
}

.btn {
padding: 0.75rem 1rem;
border: none;
border-radius: 8px;
font-size: 1rem;
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
transform: translateY(-1px);
}

.btn:disabled {
opacity: 0.6;
cursor: not-allowed;
transform: none;
}

.btn:focus {
outline: none;
box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
}

.chats-section {
background: white;
border-radius: 12px;
padding: 1.5rem;
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.empty-state {
text-align: center;
color: #718096;
padding: 2rem;
font-style: italic;
}

.chats-list {
display: grid;
gap: 0.5rem;
}

.chat-item {
display: flex;
align-items: center;
gap: 1rem;
border: 1px solid #e2e8f0;
border-radius: 8px;
padding: 1rem;
transition: all 0.2s ease;
}

.chat-item:hover {
border-color: #cbd5e0;
background: #f7fafc;
}

.chat-button {
flex: 1;
display: flex;
align-items: center;
gap: 1rem;
text-align: left;
border: none;
background: none;
cursor: pointer;
padding: 0;
min-width: 0;
}

.chat-button:focus {
outline: 2px solid #667eea;
outline-offset: 2px;
border-radius: 4px;
}

.chat-avatar {
width: 48px;
height: 48px;
border-radius: 50%;
background: #667eea;
color: white;
display: flex;
align-items: center;
justify-content: center;
font-weight: 600;
font-size: 1.25rem;
flex-shrink: 0;
}

.chat-content {
flex: 1;
min-width: 0;
}

.chat-header {
display: flex;
justify-content: space-between;
align-items: center;
margin-bottom: 0.25rem;
}

.chat-name {
font-weight: 600;
color: #2d3748;
margin: 0;
font-size: 1rem;
}

.chat-time {
font-size: 0.75rem;
color: #a0aec0;
flex-shrink: 0;
}

.chat-preview {
display: flex;
justify-content: space-between;
align-items: center;
gap: 0.5rem;
}

.chat-last-message {
color: #718096;
font-size: 0.875rem;
margin: 0;
overflow: hidden;
text-overflow: ellipsis;
white-space: nowrap;
flex: 1;
}

.unread-badge {
background: #e53e3e;
color: white;
border-radius: 50%;
width: 24px;
height: 24px;
display: flex;
align-items: center;
justify-content: center;
font-size: 0.75rem;
font-weight: 600;
flex-shrink: 0;
}

.chat-actions {
display: flex;
gap: 0.5rem;
flex-shrink: 0;
}

.action-btn {
width: 40px;
height: 40px;
border: 1px solid #e2e8f0;
background: white;
border-radius: 8px;
cursor: pointer;
display: flex;
align-items: center;
justify-content: center;
transition: all 0.2s ease;
}

.action-btn:hover {
border-color: #cbd5e0;
background: #f7fafc;
transform: translateY(-1px);
}

.action-btn:focus {
outline: 2px solid #667eea;
outline-offset: 2px;
}

.voice-call-btn:hover {
border-color: #48bb78;
background: #f0fff4;
}

.video-call-btn:hover {
border-color: #4299e1;
background: #ebf8ff;
}

.icon {
font-size: 1.25rem;
}

.call-overlay-indicator {
position: fixed;
top: 1rem;
right: 1rem;
z-index: 1000;
}

.call-indicator-btn {
background: #e53e3e;
color: white;
border: none;
border-radius: 8px;
padding: 0.75rem 1rem;
cursor: pointer;
display: flex;
align-items: center;
gap: 0.5rem;
font-weight: 600;
box-shadow: 0 4px 12px rgba(229, 62, 62, 0.3);
animation: pulse 2s infinite;
}

.call-indicator-btn:hover {
background: #c53030;
}

.call-indicator-btn:focus {
outline: 2px solid white;
outline-offset: 2px;
}

@keyframes pulse {
0%, 100% { opacity: 1; }
50% { opacity: 0.8; }
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
.header-content {
flex-direction: column;
gap: 1rem;
text-align: center;
}

.user-info {
align-items: center;
}

.dashboard-content {
padding: 1rem;
}

.chat-item {
flex-wrap: wrap;
}

.chat-actions {
order: 3;
width: 100%;
justify-content: flex-end;
}
}
</style>