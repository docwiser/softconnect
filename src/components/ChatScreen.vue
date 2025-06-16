<template>
<div class="chat-screen" role="main">
<header class="chat-header">
<button 
@click="goBack"
class="back-btn"
aria-label="Go back to dashboard"
>
← Back
</button>
<div class="peer-info">
<h1 class="peer-name">{{ chatData?.peerName || "Unknown" }}</h1>
<span class="peer-id">ID: {{ peerId }}</span>
</div>
<div class="call-actions">
<button 
@click="shareChat"
class="share-btn"
aria-label="Share chat link"
title="Share chat link"
>
🔗
</button>
<button 
@click="startVoiceCall"
class="call-btn voice-call"
:aria-label="`Start voice call with ${chatData?.peerName}`"
title="Voice call"
:disabled="isCallInProgress"
>
📞
</button>
<button 
@click="startVideoCall"
class="call-btn video-call"
:aria-label="`Start video call with ${chatData?.peerName}`"
title="Video call"
:disabled="isCallInProgress"
>
📹
</button>
</div>
</header>
<div class="messages-container" role="log" aria-live="polite" aria-label="Chat messages">
<div 
ref="messagesArea"
class="messages-area"
tabindex="0"
role="log"
aria-label="Message history"
@keydown="handleMessagesKeydown"
>
<div v-if="!chatData || chatData.messages.length === 0" class="empty-messages">
<p>No messages yet. Start the conversation!</p>
</div>
<div 
v-for="message in chatData?.messages || []" 
:key="message.id"
:class="['message', {
'message-own': message.senderId === currentUser?.id,
'message-peer': message.senderId !== currentUser?.id,
'message-system': message.type === 'system'
}]"
role="article"
:aria-label="getMessageAriaLabel(message)"
>
<div class="message-content">
{{ message.content }}
</div>
<div class="message-time">
{{ formatMessageTime(message.timestamp) }}
</div>
</div>
</div>
</div>
<form @submit.prevent="sendMessage" class="message-form">
<div class="message-input-container">
<textarea
id="message-input"
ref="messageInput"
v-model="newMessage"
placeholder="Type a message..."
class="message-input"
rows="1"
:aria-describedby="newMessage.length > 500 ? 'char-count' : undefined"
@keydown="handleInputKeydown"
@input="adjustTextareaHeight"
></textarea>
<div 
v-if="newMessage.length > 500" 
id="char-count" 
class="char-count"
:class="{ 'char-limit-exceeded': newMessage.length > 1000 }"
aria-live="polite"
>
{{ newMessage.length }}/1000
</div>
</div>
<button 
type="submit"
class="send-btn"
:disabled="!newMessage.trim() || newMessage.length > 1000"
:aria-label="newMessage.trim() ? 'Send message' : 'Enter a message to send'"
>
Send
</button>
</form>
<div 
v-if="callState.isActive && callState.peerId !== peerId"
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
<div v-if="showShareWidget" class="share-widget" ref="shareWidget" role="toolbar" aria-label="Share Widget">
<h2 class="share-title">Share Chat Link</h2>
<p class="share-description">Share this link with others to start chatting:</p>
<div class="share-link-container">
<input 
ref="shareLinkInput"
:value="shareLink"
readonly
class="share-link-input"
aria-label="Chat share link"
/>
<button 
@click="copyShareLink"
class="copy-btn"
:aria-label="linkCopied ? 'Link copied!' : 'Copy link to clipboard'"
>
{{ linkCopied ? "✓" : "📋" }}
</button>
</div>
<div class="share-actions">
<button @click="hideShareWidget" class="btn btn-secondary">
Close
</button>
</div>
</div>
<div aria-live="assertive" class="sr-only">
{{ announcement }}
</div>
</div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAppStore } from "../stores/app";
import { usePeerStore } from "../stores/peer";
import type { Message } from "../types";
const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const peerStore = usePeerStore();
const peerId = ref<string>(route.params.id as string);
const newMessage = ref("");
const announcement = ref("");
const showShareWidget = ref(false);
const linkCopied = ref(false);
const messageInput = ref<HTMLTextAreaElement>();
const messagesArea = ref<HTMLElement>();
const shareWidget = ref<HTMLElement>();
const shareLinkInput = ref<HTMLInputElement>();
const currentUser = computed(() => appStore.currentUser);
const chatData = computed(() => appStore.activeChatData);
const callState = computed(() => appStore.callState);
const isCallInProgress = computed(() => callState.value.isActive || callState.value.isIncoming);
const shareLink = computed(() => {
return `${window.location.origin}/chat/${peerId.value}`;
});
watch(showShareWidget, async (show) => {
if (show) {
await nextTick();
shareLinkInput.value?.focus();
shareLinkInput.value?.select();
}
});
onMounted(async () => {
appStore.setActiveChat(peerId.value);
await nextTick();
messageInput.value?.focus();
scrollToBottom();
const peerName = chatData.value?.peerName || peerId.value;
announcement.value = `Chat with ${peerName} opened. ${chatData.value?.messages.length || 0} messages in history.`;
});
watch(() => chatData.value?.messages.length, (newLength, oldLength) => {
if (newLength && oldLength && newLength > oldLength) {
nextTick(() => {
scrollToBottom();
const lastMessage = chatData.value?.messages[chatData.value.messages.length - 1];
if (lastMessage && lastMessage.senderId !== currentUser.value?.id) {
announcement.value = `New message from ${chatData.value?.peerName}: ${lastMessage.content}`;
}
});
}
});
function goBack() {
appStore.setActiveChat(null);
router.push("/dashboard");
}
function sendMessage() {
if (!newMessage.value.trim() || newMessage.value.length > 1000) return;
const message = newMessage.value.trim();
peerStore.sendMessage(peerId.value, message);
announcement.value = `Message sent: ${message}`;
newMessage.value = "";
nextTick(() => {
adjustTextareaHeight();
scrollToBottom();
});
}
function startVoiceCall() {
if (isCallInProgress.value) {
announcement.value = "Cannot start call - another call is in progress";
return;
}
announcement.value = "Starting voice call...";
peerStore.startCall(peerId.value, false);
router.push(`/call/${peerId.value}`);
}
function startVideoCall() {
if (isCallInProgress.value) {
announcement.value = "Cannot start call - another call is in progress";
return;
}
announcement.value = "Starting video call...";
peerStore.startCall(peerId.value, true);
router.push(`/call/${peerId.value}`);
}
function goToCall() {
router.push(`/call/${callState.value.peerId}`);
}
function shareChat() {
showShareWidget.value = true;
announcement.value = "Share widget opened";
}
function hideShareWidget() {
showShareWidget.value = false;
linkCopied.value = false;
messageInput.value?.focus();
}
async function copyShareLink() {
try {
await navigator.clipboard.writeText(shareLink.value);
linkCopied.value = true;
announcement.value = "Chat link copied to clipboard";
setTimeout(() => {
linkCopied.value = false;
}, 2000);
} catch (error) {
shareLinkInput.value?.select();
document.execCommand("copy");
linkCopied.value = true;
announcement.value = "Chat link copied to clipboard";
setTimeout(() => {
linkCopied.value = false;
}, 2000);
}
}
function handleInputKeydown(event: KeyboardEvent) {
if (event.key === "Enter" && !event.shiftKey) {
event.preventDefault();
sendMessage();
}
}
function handleMessagesKeydown(event: KeyboardEvent) {
if (event.key === "ArrowUp" || event.key === "ArrowDown") {
event.preventDefault();
}
}
function adjustTextareaHeight() {
if (messageInput.value) {
messageInput.value.style.height = "auto";
const scrollHeight = messageInput.value.scrollHeight;
const maxHeight = 120;
messageInput.value.style.height = Math.min(scrollHeight, maxHeight) + "px";
}
}
function scrollToBottom() {
if (messagesArea.value) {
messagesArea.value.scrollTop = messagesArea.value.scrollHeight;
}
}
function getMessageAriaLabel(message: Message): string {
const isOwn = message.senderId === currentUser.value?.id;
const sender = isOwn ? "You" : (chatData.value?.peerName || "Peer");
const time = formatMessageTime(message.timestamp);
return `${sender} at ${time}: ${message.content}`;
}
function formatMessageTime(timestamp: number): string {
const date = new Date(timestamp);
const now = new Date();
if (date.toDateString() === now.toDateString()) {
return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
} else {
return date.toLocaleString([], { 
month: "short", 
day: "numeric", 
hour: "2-digit", 
minute: "2-digit" 
});
}
}
</script>
<style scoped>
.chat-screen {
display: flex;
flex-direction: column;
height: 100vh;
background: #f7fafc;
}

.chat-header {
background: white;
border-bottom: 1px solid #e2e8f0;
padding: 1rem;
display: flex;
align-items: center;
gap: 1rem;
}

.back-btn {
background: none;
border: 1px solid #e2e8f0;
border-radius: 8px;
padding: 0.5rem 1rem;
cursor: pointer;
font-weight: 500;
color: #4a5568;
transition: all 0.2s ease;
}

.back-btn:hover {
border-color: #cbd5e0;
background: #f7fafc;
}

.back-btn:focus {
outline: 2px solid #667eea;
outline-offset: 2px;
}

.peer-info {
flex: 1;
min-width: 0;
}

.peer-name {
font-size: 1.25rem;
font-weight: 600;
color: #2d3748;
margin: 0 0 0.25rem 0;
}

.peer-id {
font-size: 0.875rem;
color: #718096;
font-family: monospace;
}

.call-actions {
display: flex;
gap: 0.5rem;
}

.share-btn,
.call-btn {
width: 44px;
height: 44px;
border: 1px solid #e2e8f0;
background: white;
border-radius: 8px;
cursor: pointer;
display: flex;
align-items: center;
justify-content: center;
font-size: 1.25rem;
transition: all 0.2s ease;
}

.share-btn:hover {
border-color: #667eea;
background: #ebf4ff;
}

.call-btn:hover:not(:disabled) {
transform: translateY(-1px);
}

.call-btn:disabled {
opacity: 0.5;
cursor: not-allowed;
transform: none;
}

.call-btn:focus,
.share-btn:focus {
outline: 2px solid #667eea;
outline-offset: 2px;
}

.voice-call:hover:not(:disabled) {
border-color: #48bb78;
background: #f0fff4;
}

.video-call:hover:not(:disabled) {
border-color: #4299e1;
background: #ebf8ff;
}

.messages-container {
flex: 1;
overflow: hidden;
display: flex;
flex-direction: column;
}

.messages-area {
flex: 1;
overflow-y: auto;
padding: 1rem;
display: flex;
flex-direction: column;
gap: 1rem;
}

.messages-area:focus {
outline: 2px solid #667eea;
outline-offset: -2px;
}

.empty-messages {
display: flex;
align-items: center;
justify-content: center;
height: 100%;
color: #718096;
font-style: italic;
}

.message {
display: flex;
flex-direction: column;
max-width: 70%;
word-wrap: break-word;
}

.message-own {
align-self: flex-end;
align-items: flex-end;
}

.message-peer {
align-self: flex-start;
align-items: flex-start;
}

.message-system {
align-self: center;
max-width: 90%;
text-align: center;
}

.message-content {
background: white;
padding: 0.75rem 1rem;
border-radius: 18px;
box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
white-space: pre-wrap;
line-height: 1.4;
}

.message-own .message-content {
background: #667eea;
color: white;
border-bottom-right-radius: 6px;
}

.message-peer .message-content {
background: white;
color: #2d3748;
border-bottom-left-radius: 6px;
}

.message-system .message-content {
background: #edf2f7;
color: #4a5568;
border-radius: 12px;
font-style: italic;
font-size: 0.875rem;
}

.message-time {
font-size: 0.75rem;
color: #a0aec0;
margin-top: 0.25rem;
padding: 0 0.5rem;
}

.message-form {
background: white;
border-top: 1px solid #e2e8f0;
padding: 1rem;
display: flex;
gap: 1rem;
align-items: flex-end;
}

.message-input-container {
flex: 1;
position: relative;
}

.message-input {
width: 100%;
min-height: 44px;
max-height: 120px;
padding: 0.75rem 1rem;
border: 2px solid #e2e8f0;
border-radius: 22px;
font-size: 1rem;
font-family: inherit;
resize: none;
transition: all 0.2s ease;
line-height: 1.4;
}

.message-input:focus {
outline: none;
border-color: #667eea;
box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.char-count {
position: absolute;
right: 1rem;
bottom: -1.5rem;
font-size: 0.75rem;
color: #718096;
}

.char-limit-exceeded {
color: #e53e3e;
font-weight: 600;
}

.send-btn {
background: #667eea;
color: white;
border: none;
border-radius: 22px;
padding: 0.75rem 1.5rem;
font-size: 1rem;
font-weight: 600;
cursor: pointer;
transition: all 0.2s ease;
white-space: nowrap;
}

.send-btn:hover:not(:disabled) {
background: #5a67d8;
transform: translateY(-1px);
}

.send-btn:disabled {
opacity: 0.5;
cursor: not-allowed;
transform: none;
}

.send-btn:focus {
outline: none;
box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
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

.share-widget {
position: fixed;
top: 50%;
left: 50%;
transform: translate(-50%, -50%);
background: white;
border: 2px solid #e2e8f0;
border-radius: 12px;
padding: 2rem;
max-width: 500px;
width: 90%;
box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
z-index: 1000;
}

.share-title {
font-size: 1.5rem;
font-weight: 600;
margin: 0 0 0.5rem 0;
color: #2d3748;
}

.share-description {
color: #718096;
margin: 0 0 1.5rem 0;
}

.share-link-container {
display: flex;
gap: 0.5rem;
margin-bottom: 1.5rem;
}

.share-link-input {
flex: 1;
padding: 0.75rem;
border: 2px solid #e2e8f0;
border-radius: 8px;
font-family: monospace;
font-size: 0.875rem;
background: #f7fafc;
}

.share-link-input:focus {
outline: none;
border-color: #667eea;
}

.copy-btn {
background: #667eea;
color: white;
border: none;
border-radius: 8px;
padding: 0.75rem 1rem;
cursor: pointer;
font-size: 1rem;
transition: all 0.2s ease;
}

.copy-btn:hover {
background: #5a67d8;
}

.copy-btn:focus {
outline: 2px solid #667eea;
outline-offset: 2px;
}

.share-actions {
display: flex;
justify-content: flex-end;
}

.btn {
padding: 0.75rem 1rem;
border: none;
border-radius: 8px;
font-weight: 600;
cursor: pointer;
transition: all 0.2s ease;
}

.btn-secondary {
background: #e2e8f0;
color: #4a5568;
}

.btn-secondary:hover {
background: #cbd5e0;
}

.btn:focus {
outline: 2px solid #667eea;
outline-offset: 2px;
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
.chat-header {
padding: 1rem 0.5rem;
}

.message {
max-width: 85%;
}

.message-form {
padding: 1rem 0.5rem;
}

.messages-area {
padding: 1rem 0.5rem;
}

.share-widget {
width: 95%;
padding: 1.5rem;
}
}
</style>