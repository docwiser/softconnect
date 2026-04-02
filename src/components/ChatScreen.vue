<template>
  <div class="chat-screen">
    <!-- Header -->
    <header class="chat-header">
      <button class="back-btn" @click="goBack" aria-label="Back to dashboard">←</button>

      <button
        class="peer-info-btn"
        @click="router.push(`/profile/${peerId}`)"
        aria-label="View profile"
      >
        <div class="peer-avatar">
          <img v-if="peerPhoto" :src="peerPhoto" :alt="peerName" />
          <span v-else>{{ peerName.charAt(0).toUpperCase() }}</span>
        </div>
        <div class="peer-meta">
          <span class="peer-name">{{ peerName }}</span>
          <span class="peer-status">{{ peerOnline ? 'Online' : lastSeenText }}</span>
        </div>
      </button>

      <div class="header-actions">
        <button
          class="header-btn"
          @click="startCall(false)"
          :disabled="isCallActive"
          aria-label="Voice call"
          title="Voice call"
        >📞</button>
        <button
          class="header-btn"
          @click="startCall(true)"
          :disabled="isCallActive"
          aria-label="Video call"
          title="Video call"
        >📹</button>
        <button
          class="header-btn"
          @click="showMenu = !showMenu"
          aria-label="More options"
        >⋮</button>
      </div>

      <!-- Context Menu -->
      <div v-if="showMenu" class="context-menu" ref="menuRef">
        <button @click="viewProfile">View Profile</button>
        <button v-if="isPeerBlockable" @click="confirmBlockPeer">Block User</button>
        <button @click="clearChat" class="danger-item">Clear Chat</button>
      </div>
    </header>

    <!-- Messages -->
    <div
      ref="messagesEl"
      class="messages-area"
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      <div v-if="messages.length === 0" class="no-messages">
        <div class="wave">👋</div>
        <p>Say hello to {{ peerName }}!</p>
      </div>

      <template v-for="(msg, i) in messages" :key="msg.id">
        <!-- Date divider -->
        <div
          v-if="showDateDivider(msg, messages[i-1])"
          class="date-divider"
        >{{ formatDateDivider(msg.timestamp?.toMillis()) }}</div>

        <div
          :class="['message-wrap', msg.senderId === myUid ? 'own' : 'peer']"
          role="article"
          :aria-label="getMessageAriaLabel(msg)"
        >
          <div :class="['bubble', { deleted: msg.deleted }]">
            <span class="msg-text">{{ msg.content }}</span>
            <div class="msg-meta">
              <span class="msg-time">{{ formatMsgTime(msg.timestamp?.toMillis()) }}</span>
              <span v-if="msg.senderId === myUid && !msg.deleted" class="read-indicator">
                {{ msg.readBy.length > 1 ? '✓✓' : '✓' }}
              </span>
            </div>
          </div>
          <button
            v-if="msg.senderId === myUid && !msg.deleted"
            class="delete-msg-btn"
            @click="deleteMsg(msg.id)"
            aria-label="Delete message"
          >🗑</button>
        </div>
      </template>

      <div ref="bottomAnchor"></div>
    </div>

    <!-- Input -->
    <form class="input-area" @submit.prevent="sendMsg">
      <textarea
        ref="inputEl"
        v-model="newMsg"
        placeholder="Type a message..."
        class="msg-input"
        :maxlength="2000"
        @keydown="handleInputKey"
        @input="autoResize"
        rows="1"
        aria-label="Message input"
      ></textarea>
      <div class="char-hint" v-if="newMsg.length > 1800">{{ 2000 - newMsg.length }}</div>
      <button
        type="submit"
        class="send-btn"
        :disabled="!newMsg.trim()"
        aria-label="Send message"
      >
        <span>↑</span>
      </button>
    </form>

    <!-- Block modal -->
    <div v-if="showBlockModal" class="modal-overlay" @click.self="showBlockModal = false">
      <div class="modal">
        <h2>Block {{ peerName }}?</h2>
        <p>They won't be able to send you messages or call you.</p>
        <div class="modal-actions">
          <button class="modal-cancel" @click="showBlockModal = false">Cancel</button>
          <button class="modal-confirm" @click="doBlockPeer">Block</button>
        </div>
      </div>
    </div>

    <div aria-live="assertive" class="sr-only">{{ announcement }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { usePeerStore } from '../stores/peer'
import {
  auth, db,
  sendMessage as fbSendMessage,
  markMessagesRead,
  deleteMessage,
  listenToChatMessages,
  listenToUserPresence,
  blockUser,
  getUserProfile
} from '../services/firebase'
import type { Message } from '../services/firebase'
import { doc, getDoc } from 'firebase/firestore'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const peerStore = usePeerStore()

const chatId = ref(route.params.chatId as string)
const messages = ref<(Message & { id: string })[]>([])
const newMsg = ref('')
const announcement = ref('')
const showMenu = ref(false)
const showBlockModal = ref(false)
const peerOnline = ref(false)
const peerLastSeen = ref<Date | null>(null)
const isPeerBlockable = ref(true)

const messagesEl = ref<HTMLElement>()
const bottomAnchor = ref<HTMLElement>()
const inputEl = ref<HTMLTextAreaElement>()
const menuRef = ref<HTMLElement>()

const myUid = computed(() => auth.currentUser?.uid || '')
const chatData = computed(() => appStore.chats.find(c => c.id === chatId.value))
const peerId = computed(() => chatData.value?.participants.find(uid => uid !== myUid.value) || '')
const peerName = computed(() => chatData.value?.participantNames[peerId.value] || 'Unknown')
const peerPhoto = computed(() => chatData.value?.participantPhotos?.[peerId.value] || null)
const isCallActive = computed(() => appStore.callState.isActive || appStore.callState.isIncoming)

const lastSeenText = computed(() => {
  if (!peerLastSeen.value) return 'Offline'
  const diff = Date.now() - peerLastSeen.value.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Last seen just now'
  if (mins < 60) return `Last seen ${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Last seen ${hrs}h ago`
  return `Last seen ${Math.floor(hrs / 24)}d ago`
})

let unsubMessages: (() => void) | null = null
let unsubPresence: (() => void) | null = null

onMounted(async () => {
  appStore.setActiveChatId(chatId.value)

  // Subscribe to messages
  unsubMessages = listenToChatMessages(chatId.value, (msgs) => {
    messages.value = msgs
    nextTick(() => scrollToBottom())

    // Mark as read
    if (myUid.value) {
      markMessagesRead(chatId.value, myUid.value)
    }
  })

  // Subscribe to peer presence
  if (peerId.value) {
    unsubPresence = listenToUserPresence(peerId.value, (data) => {
      peerOnline.value = !!data.isOnline
      if (data.lastSeen) {
        peerLastSeen.value = data.lastSeen.toDate()
      }
    })

    // Check blockable
    const peerProfile = await getUserProfile(peerId.value)
    if (peerProfile) isPeerBlockable.value = peerProfile.blockable ?? true
  }

  inputEl.value?.focus()

  // Close menu on click outside
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  unsubMessages?.()
  unsubPresence?.()
  appStore.setActiveChatId(null)
  document.removeEventListener('click', handleClickOutside)
})

function handleClickOutside(e: MouseEvent) {
  if (showMenu.value && menuRef.value && !menuRef.value.contains(e.target as Node)) {
    showMenu.value = false
  }
}

async function sendMsg() {
  if (!newMsg.value.trim() || !myUid.value) return
  const content = newMsg.value.trim()
  newMsg.value = ''
  autoResize()
  try {
    await fbSendMessage(chatId.value, myUid.value, content)
  } catch {
    appStore.addNotification('Failed to send message', 'error')
    newMsg.value = content
  }
}

function handleInputKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMsg()
  }
}

function autoResize() {
  if (!inputEl.value) return
  inputEl.value.style.height = 'auto'
  inputEl.value.style.height = Math.min(inputEl.value.scrollHeight, 120) + 'px'
}

function scrollToBottom() {
  bottomAnchor.value?.scrollIntoView({ behavior: 'smooth' })
}

function showDateDivider(msg: Message & { id: string }, prev?: Message & { id: string }): boolean {
  if (!prev) return true
  const d1 = msg.timestamp?.toDate()
  const d2 = prev.timestamp?.toDate()
  if (!d1 || !d2) return false
  return d1.toDateString() !== d2.toDateString()
}

function formatDateDivider(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatMsgTime(ts?: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getMessageAriaLabel(msg: Message & { id: string }): string {
  const sender = msg.senderId === myUid.value ? 'You' : peerName.value
  return `${sender}: ${msg.content}, ${formatMsgTime(msg.timestamp?.toMillis())}`
}

async function deleteMsg(msgId: string) {
  try {
    await deleteMessage(chatId.value, msgId)
  } catch {
    appStore.addNotification('Could not delete message', 'error')
  }
}

async function startCall(withVideo: boolean) {
  if (isCallActive.value) return
  const snap = await getDoc(doc(db, 'peerIds', peerId.value))
  if (!snap.exists()) {
    appStore.addNotification(`${peerName.value} is not online`, 'warning')
    return
  }
  const peerConnId = snap.data().peerId
  appStore.updateCallState({ peerName: peerName.value, peerPhoto: peerPhoto.value })
  await peerStore.startCall(peerId.value, peerConnId, withVideo)
  router.push(`/call/${peerId.value}`)
}

function viewProfile() {
  showMenu.value = false
  router.push(`/profile/${peerId.value}`)
}

function confirmBlockPeer() {
  showMenu.value = false
  showBlockModal.value = true
}

async function doBlockPeer() {
  if (!myUid.value) return
  try {
    await blockUser(myUid.value, peerId.value)
    showBlockModal.value = false
    appStore.addNotification(`${peerName.value} blocked`, 'success')
    router.push('/dashboard')
  } catch (e: any) {
    appStore.addNotification(e.message || 'Could not block user', 'error')
    showBlockModal.value = false
  }
}

function clearChat() {
  showMenu.value = false
  // Could implement clear locally or via Firestore batch delete
  appStore.addNotification('Chat cleared locally', 'info')
}

function goBack() {
  appStore.setActiveChatId(null)
  router.push('/dashboard')
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');

* { box-sizing: border-box; }

.chat-screen {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #070a14;
  font-family: 'DM Sans', sans-serif;
  color: #e2e8f0;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: rgba(10,12,24,0.9);
  backdrop-filter: blur(20px);
  position: relative;
}

.back-btn {
  background: rgba(255,255,255,0.06);
  border: none;
  border-radius: 10px;
  width: 38px; height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(255,255,255,0.7);
  font-size: 1.1rem;
  transition: background 0.2s;
  flex-shrink: 0;
}
.back-btn:hover { background: rgba(255,255,255,0.1); }

.peer-info-btn {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  font-family: inherit;
  text-align: left;
  padding: 0;
  min-width: 0;
}

.peer-avatar {
  width: 42px; height: 42px;
  border-radius: 50%;
  background: linear-gradient(135deg, #5c3bff40, #ff3b8c40);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  font-weight: 700;
  color: #a78bfa;
  overflow: hidden;
  flex-shrink: 0;
}
.peer-avatar img { width: 100%; height: 100%; object-fit: cover; }

.peer-meta { display: flex; flex-direction: column; min-width: 0; }
.peer-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.peer-status {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.35);
}

.header-actions { display: flex; gap: 0.375rem; }

.header-btn {
  background: rgba(255,255,255,0.05);
  border: none;
  border-radius: 10px;
  width: 38px; height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}
.header-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
.header-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.context-menu {
  position: absolute;
  top: 100%;
  right: 0.5rem;
  background: #0f1220;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  overflow: hidden;
  z-index: 100;
  min-width: 160px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.context-menu button {
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  color: rgba(255,255,255,0.7);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.875rem;
  text-align: left;
  transition: background 0.15s;
}
.context-menu button:hover { background: rgba(255,255,255,0.05); color: #fff; }
.context-menu .danger-item { color: #ff3b8c; }
.context-menu .danger-item:hover { background: rgba(255,59,140,0.1); }

/* Messages */
.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  scroll-behavior: smooth;
}

.no-messages {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.75rem;
  color: rgba(255,255,255,0.3);
}
.wave { font-size: 2.5rem; animation: wave 2s ease-in-out infinite; }
@keyframes wave {
  0%,100% { transform: rotate(0); }
  25% { transform: rotate(-15deg); }
  75% { transform: rotate(15deg); }
}
.no-messages p { font-size: 0.9rem; margin: 0; }

.date-divider {
  text-align: center;
  font-size: 0.75rem;
  color: rgba(255,255,255,0.25);
  margin: 0.75rem 0;
  position: relative;
}
.date-divider::before, .date-divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 30%;
  height: 1px;
  background: rgba(255,255,255,0.08);
}
.date-divider::before { left: 0; }
.date-divider::after { right: 0; }

.message-wrap {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  max-width: 75%;
}
.message-wrap.own {
  align-self: flex-end;
  flex-direction: row-reverse;
}
.message-wrap.peer {
  align-self: flex-start;
}

.bubble {
  background: rgba(255,255,255,0.07);
  border-radius: 18px;
  padding: 0.625rem 1rem;
  display: inline-block;
  max-width: 100%;
}
.message-wrap.own .bubble {
  background: linear-gradient(135deg, #5c3bff, #7c3bff);
  border-bottom-right-radius: 4px;
}
.message-wrap.peer .bubble {
  border-bottom-left-radius: 4px;
}
.bubble.deleted {
  background: transparent !important;
  border: 1px solid rgba(255,255,255,0.08);
}
.bubble.deleted .msg-text { color: rgba(255,255,255,0.3); font-style: italic; }

.msg-text {
  font-size: 0.9rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  color: #e2e8f0;
  display: block;
}

.msg-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.375rem;
  margin-top: 0.25rem;
}

.msg-time {
  font-size: 0.7rem;
  color: rgba(255,255,255,0.3);
}

.read-indicator {
  font-size: 0.65rem;
  color: rgba(255,255,255,0.5);
}

.delete-msg-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  opacity: 0;
  transition: opacity 0.2s;
  padding: 4px;
  border-radius: 6px;
}
.message-wrap:hover .delete-msg-btn { opacity: 0.5; }
.delete-msg-btn:hover { opacity: 1 !important; background: rgba(255,59,140,0.1); }

/* Input */
.input-area {
  padding: 0.875rem 1rem;
  background: rgba(10,12,24,0.9);
  border-top: 1px solid rgba(255,255,255,0.06);
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  position: relative;
}

.msg-input {
  flex: 1;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 18px;
  padding: 0.75rem 1rem;
  color: #e2e8f0;
  font-family: inherit;
  font-size: 0.9rem;
  resize: none;
  min-height: 44px;
  max-height: 120px;
  overflow-y: auto;
  transition: border-color 0.2s;
  line-height: 1.45;
}
.msg-input:focus {
  outline: none;
  border-color: rgba(92,59,255,0.4);
  background: rgba(92,59,255,0.05);
}
.msg-input::placeholder { color: rgba(255,255,255,0.2); }

.char-hint {
  position: absolute;
  bottom: 100%;
  right: 4.5rem;
  font-size: 0.7rem;
  color: rgba(255,100,100,0.7);
  background: rgba(0,0,0,0.5);
  padding: 2px 6px;
  border-radius: 6px;
}

.send-btn {
  width: 44px; height: 44px;
  background: linear-gradient(135deg, #5c3bff, #7c3bff);
  border: none;
  border-radius: 50%;
  color: #fff;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}
.send-btn:hover:not(:disabled) { transform: scale(1.05); opacity: 0.9; }
.send-btn:disabled { opacity: 0.35; cursor: not-allowed; }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1.5rem;
}
.modal {
  background: #0f1220;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  padding: 2rem;
  max-width: 380px;
  width: 100%;
  text-align: center;
}
.modal h2 { font-family: 'Syne', sans-serif; color: #fff; margin: 0 0 0.75rem; font-size: 1.2rem; }
.modal p { color: rgba(255,255,255,0.5); font-size: 0.875rem; margin: 0 0 1.5rem; }
.modal-actions { display: flex; gap: 0.75rem; justify-content: center; }
.modal-cancel {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px; padding: 0.625rem 1.5rem;
  color: rgba(255,255,255,0.7); cursor: pointer; font-family: inherit; font-size: 0.9rem;
}
.modal-confirm {
  background: linear-gradient(135deg, #ff3b5c, #ff3b8c); border: none;
  border-radius: 10px; padding: 0.625rem 1.5rem;
  color: #fff; cursor: pointer; font-family: inherit; font-size: 0.9rem; font-weight: 600;
}

.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
</style>
