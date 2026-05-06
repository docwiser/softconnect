<template>
  <div class="dashboard" id="main-content">
    <div class="main-area">
      <AppHeader />

      <div role="search" class="search-bar-wrap">
        <label for="chat-search" class="sr-only">Search chats</label>
        <input 
          id="chat-search" 
          v-model="chatSearch" 
          type="search" 
          placeholder="Search chats…" 
          class="search-input" 
          aria-label="Search chats" 
          autocomplete="off" 
          list="chat-suggestions"
        />
        <datalist id="chat-suggestions">
          <option v-for="chat in filteredChats" :key="chat.id" :value="getPeerName(chat)" />
        </datalist>
      </div>

      <main class="chats-region" aria-label="Conversations list">
        <div class="chats-list" role="list" :aria-label="filteredChats.length > 0 ? `${filteredChats.length} conversation${filteredChats.length !== 1 ? 's' : ''}` : 'No conversations'">
          <div v-if="filteredChats.length === 0" class="empty-state" role="status">
            <div class="empty-icon" aria-hidden="true">💬</div>
            <h2>No conversations yet</h2>
            <p>Start chatting by searching for someone</p>
            <button @click="router.push('/new-chat')" class="start-btn" aria-label="Search for users to chat with">Find Someone</button>
          </div>

          <article v-for="chat in filteredChats" :key="chat.id" class="chat-item-wrapper" role="listitem">
            <button class="chat-item" @click="openChat(chat)" :aria-label="getChatAriaLabel(chat)">
              <div class="chat-avatar-wrap">
                <div class="chat-avatar" aria-hidden="true">
                  <img v-if="getPeerPhoto(chat)" :src="getPeerPhoto(chat)!" :alt="getPeerName(chat)" />
                  <span v-else aria-hidden="true">{{ getPeerName(chat).charAt(0).toUpperCase() }}</span>
                </div>
                <span v-if="isUserOnline(chat)" class="presence-dot" aria-hidden="true" title="Online"></span>
              </div>
              <div class="chat-body">
                <div class="chat-top">
                  <span class="chat-name">{{ getPeerName(chat) }}</span>
                  <time class="chat-time" :datetime="getChatTimeISO(chat)">{{ formatTime(chat.lastMessage?.timestamp?.toMillis()) }}</time>
                </div>
                <div class="chat-bottom">
                  <span class="chat-preview" aria-hidden="true">{{ getPreview(chat) }}</span>
                  <span v-if="getUnreadCount(chat) > 0" class="unread-badge" :aria-label="`${getUnreadCount(chat)} unread message${getUnreadCount(chat) !== 1 ? 's' : ''}`">
                    {{ getUnreadCount(chat) > 99 ? '99+' : getUnreadCount(chat) }}
                  </span>
                </div>
              </div>
            </button>
          </article>
        </div>
      </main>
    </div>

    <div v-if="callState.isActive && !callState.isIncoming" class="active-call-bar" role="alert" aria-live="polite" aria-label="Active call in progress">
      <span class="call-pulse" aria-hidden="true">🔴</span>
      <span>Call with {{ callState.peerName }}</span>
      <button @click="router.push(`/call/${callState.peerId}`)" class="return-call-btn" :aria-label="`Return to call with ${callState.peerName}`">Return</button>
    </div>

    <div aria-live="polite" aria-atomic="true" class="sr-only" role="status">{{ announcement }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { auth } from '../services/firebase'
import AppHeader from './AppHeader.vue'
import type { Chat } from '../services/firebase'

const router = useRouter()
const appStore = useAppStore()
const chatSearch = ref('')
const announcement = ref('')

const profile = computed(() => appStore.currentUserProfile)
const callState = computed(() => appStore.callState)
const totalUnreadCount = computed(() => appStore.totalUnreadCount)

// Update document.title
watchEffect(() => {
  const username = profile.value?.username || 'User'
  const countStr = totalUnreadCount.value > 0 ? `(${totalUnreadCount.value}) ` : ''
  document.title = `${countStr}${username} | Soft Connect`
})

// Reset title when leaving
onUnmounted(() => {
  document.title = 'Soft Connect'
})

const filteredChats = computed(() => {
  const q = chatSearch.value.toLowerCase()
  return appStore.sortedChats.filter(chat => {
    if (!q) return true
    return getPeerName(chat).toLowerCase().includes(q) || getPreview(chat).toLowerCase().includes(q)
  })
})

function getPeerId(chat: Chat & { id: string }) { return chat.participants.find(uid => uid !== auth.currentUser?.uid) || '' }
function getPeerName(chat: Chat & { id: string }) { return chat.participantNames[getPeerId(chat)] || 'Unknown' }
function getPeerPhoto(chat: Chat & { id: string }) { return chat.participantPhotos?.[getPeerId(chat)] || null }
function getUnreadCount(chat: Chat & { id: string }) { return chat.unreadCounts?.[auth.currentUser?.uid || ''] || 0 }
function isUserOnline(_chat: Chat & { id: string }) { return false }
function getPreview(chat: Chat & { id: string }) {
  if (!chat.lastMessage) return 'No messages yet'
  const isOwn = chat.lastMessage.senderId === auth.currentUser?.uid
  const c = chat.lastMessage.content
  return (isOwn ? 'You: ' : '') + (c.length > 45 ? c.slice(0, 45) + '…' : c)
}
function getChatAriaLabel(chat: Chat & { id: string }) {
  const u = getUnreadCount(chat)
  return `${getPeerName(chat)}${u ? `, ${u} unread` : ''}. ${getPreview(chat)}`
}
function getChatTimeISO(chat: Chat & { id: string }) {
  const ts = chat.lastMessage?.timestamp?.toMillis()
  return ts ? new Date(ts).toISOString() : ''
}
function formatTime(ts?: number) {
  if (!ts) return ''
  const d = new Date(ts), now = new Date()
  const diffH = (now.getTime() - d.getTime()) / 36e5
  if (diffH < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffH < 168) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
function openChat(chat: Chat & { id: string }) {
  appStore.setActiveChatId(chat.id)
  router.push(`/chat/${chat.id}`)
  announcement.value = `Opening chat with ${getPeerName(chat)}`
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
* { box-sizing: border-box; }
.dashboard { display: block; height: 100vh; background: #070a14; font-family: 'DM Sans', sans-serif; color: #e2e8f0; position: relative; overflow: hidden; }
.main-area { width: 100%; height: 100%; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }

.search-bar-wrap { padding: 1rem 1.5rem 0.5rem; display: block; }
.search-input { width: 100%; background: rgba(255,255,255,0.05); border: 1.5px solid rgba(255,255,255,0.09); border-radius: 12px; padding: 0.75rem 1rem; color: #e2e8f0; font-size: 0.9rem; font-family: inherit; transition: all 0.2s; min-height: 48px; }
.search-input:focus { outline: none; border-color: rgba(92,59,255,0.6); background: rgba(92,59,255,0.06); box-shadow: 0 0 0 3px rgba(92,59,255,0.12); }
.search-input::placeholder { color: rgba(255,255,255,0.28); }
.chats-region { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.chats-list { flex: 1; overflow-y: auto; padding: 0.5rem 0; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; gap: 0.75rem; color: rgba(255,255,255,0.38); text-align: center; padding: 2rem; }
.empty-icon { font-size: 3rem; }
.empty-state h2 { color: rgba(255,255,255,0.65); font-size: 1.1rem; margin: 0; }
.empty-state p { font-size: 0.875rem; margin: 0; }
.start-btn { margin-top: 0.5rem; background: linear-gradient(135deg, #5c3bff, #7c3bff); color: #fff; padding: 0.75rem 1.5rem; border: none; border-radius: 10px; text-decoration: none; font-size: 0.9rem; font-weight: 600; transition: all 0.2s; min-height: 48px; display: inline-flex; align-items: center; cursor: pointer; }
.start-btn:hover { opacity: 0.85; transform: translateY(-1px); }
.start-btn:focus-visible { outline: 3px solid #a78bfa; outline-offset: 3px; }
.chat-item-wrapper { display: contents; }
.chat-item { display: flex; align-items: center; gap: 1rem; padding: 0.875rem 1.5rem; background: none; border: none; border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; color: inherit; font-family: inherit; text-align: left; width: 100%; transition: background 0.15s; min-height: 72px; }
.chat-item:hover { background: rgba(255,255,255,0.04); }
.chat-item:focus-visible { outline: 3px solid #7c6fff; outline-offset: -3px; background: rgba(92,59,255,0.06); }
.chat-avatar-wrap { position: relative; flex-shrink: 0; }
.chat-avatar { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #5c3bff40, #ff3b8c40); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 700; color: #a78bfa; overflow: hidden; }
.chat-avatar img { width: 100%; height: 100%; object-fit: cover; }
.presence-dot { position: absolute; bottom: 2px; right: 2px; width: 11px; height: 11px; background: #34d399; border-radius: 50%; border: 2px solid #070a14; }
.chat-body { flex: 1; min-width: 0; }
.chat-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.25rem; gap: 0.5rem; }
.chat-name { font-weight: 600; font-size: 0.95rem; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.chat-time { font-size: 0.75rem; color: rgba(255,255,255,0.35); flex-shrink: 0; }
.chat-bottom { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.chat-preview { font-size: 0.85rem; color: rgba(255,255,255,0.42); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.unread-badge { background: #5c3bff; color: #fff; font-size: 0.7rem; font-weight: 700; border-radius: 999px; padding: 2px 7px; flex-shrink: 0; min-width: 22px; text-align: center; }
.active-call-bar { position: fixed; bottom: 0; left: 0; right: 0; background: rgba(180,30,30,0.97); backdrop-filter: blur(10px); display: flex; align-items: center; gap: 1rem; padding: 0.875rem 1.5rem; color: #fff; font-weight: 600; z-index: 100; border-top: 1px solid rgba(255,100,100,0.3); }
.call-pulse { animation: pulse 1.5s infinite; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
.return-call-btn { margin-left: auto; background: rgba(255,255,255,0.2); border-radius: 8px; padding: 0.5rem 1.25rem; border: none; color: #fff; text-decoration: none; font-size: 0.875rem; font-weight: 700; transition: background 0.2s; min-height: 44px; display: flex; align-items: center; cursor: pointer; }
.return-call-btn:hover { background: rgba(255,255,255,0.3); }
.return-call-btn:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
</style>
