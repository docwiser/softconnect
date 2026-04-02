<template>
  <div class="dashboard">
    <!-- Sidebar -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-header">
        <div class="app-brand">
          <span class="brand-icon">◈</span>
          <span class="brand-name">Soft Connect</span>
        </div>
        <button class="sidebar-close" @click="sidebarOpen = false" aria-label="Close menu">✕</button>
      </div>

      <nav class="sidebar-nav" role="navigation">
        <button class="nav-item active" aria-current="page">
          <span class="nav-icon">💬</span> Chats
        </button>
        <RouterLink class="nav-item" to="/new-chat">
          <span class="nav-icon">✏️</span> New Chat
        </RouterLink>
        <RouterLink class="nav-item" to="/call-history">
          <span class="nav-icon">📋</span> Call History
        </RouterLink>
        <RouterLink class="nav-item" :to="`/profile/${currentUser?.uid}`">
          <span class="nav-icon">👤</span> My Profile
        </RouterLink>
        <RouterLink class="nav-item" to="/settings">
          <span class="nav-icon">⚙️</span> Settings
        </RouterLink>
        <button class="nav-item logout-btn" @click="handleLogout">
          <span class="nav-icon">🚪</span> Sign Out
        </button>
      </nav>

      <!-- My Card -->
      <div class="my-card">
        <div class="my-avatar" @click="router.push(`/profile/${currentUser?.uid}`)">
          <img v-if="profile?.photoURL" :src="profile.photoURL" :alt="profile.displayName" />
          <span v-else>{{ profile?.displayName?.charAt(0)?.toUpperCase() }}</span>
          <span class="online-dot"></span>
        </div>
        <div class="my-info">
          <strong>{{ profile?.displayName }}</strong>
          <span class="my-username">@{{ profile?.username }}</span>
        </div>
      </div>
    </aside>

    <!-- Main Area -->
    <main class="main-area">
      <!-- Top Bar -->
      <header class="topbar">
        <button class="menu-btn" @click="sidebarOpen = !sidebarOpen" aria-label="Toggle menu">☰</button>
        <h1 class="page-title">Messages</h1>
        <div class="topbar-actions">
          <RouterLink to="/new-chat" class="new-chat-btn" aria-label="New chat">
            <span>✏️</span>
          </RouterLink>
        </div>
      </header>

      <!-- Search Chats -->
      <div class="search-bar-wrap">
        <input
          v-model="chatSearch"
          type="search"
          placeholder="Search conversations..."
          class="search-input"
          aria-label="Search chats"
        />
      </div>

      <!-- Chats List -->
      <div class="chats-list" role="list">
        <div v-if="filteredChats.length === 0" class="empty-state">
          <div class="empty-icon">💬</div>
          <h2>No conversations yet</h2>
          <p>Start chatting by searching for someone</p>
          <RouterLink to="/new-chat" class="start-btn">Find Someone</RouterLink>
        </div>

        <button
          v-for="chat in filteredChats"
          :key="chat.id"
          class="chat-item"
          role="listitem"
          @click="openChat(chat)"
          :aria-label="getChatAriaLabel(chat)"
        >
          <div class="chat-avatar-wrap">
            <div class="chat-avatar">
              <img
                v-if="getPeerPhoto(chat)"
                :src="getPeerPhoto(chat)!"
                :alt="getPeerName(chat)"
              />
              <span v-else>{{ getPeerName(chat).charAt(0).toUpperCase() }}</span>
            </div>
            <span v-if="isUserOnline(chat)" class="presence-dot"></span>
          </div>

          <div class="chat-body">
            <div class="chat-top">
              <span class="chat-name">{{ getPeerName(chat) }}</span>
              <span class="chat-time">{{ formatTime(chat.lastMessage?.timestamp?.toMillis()) }}</span>
            </div>
            <div class="chat-bottom">
              <span class="chat-preview">{{ getPreview(chat) }}</span>
              <span v-if="getUnreadCount(chat) > 0" class="unread-badge">
                {{ getUnreadCount(chat) > 99 ? '99+' : getUnreadCount(chat) }}
              </span>
            </div>
          </div>
        </button>
      </div>
    </main>

    <!-- Active Call Bar -->
    <div v-if="callState.isActive && !callState.isIncoming" class="active-call-bar">
      <span class="call-pulse">🔴</span>
      <span>Call with {{ callState.peerName }}</span>
      <RouterLink :to="`/call/${callState.peerId}`" class="return-call-btn">Return</RouterLink>
    </div>

    <div aria-live="polite" class="sr-only">{{ announcement }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { logoutUser } from '../services/firebase'
import { auth } from '../services/firebase'
import type { Chat } from '../services/firebase'

const router = useRouter()
const appStore = useAppStore()

const sidebarOpen = ref(false)
const chatSearch = ref('')
const announcement = ref('')

const profile = computed(() => appStore.currentUserProfile)
const currentUser = computed(() => auth.currentUser)
const callState = computed(() => appStore.callState)

const filteredChats = computed(() => {
  const q = chatSearch.value.toLowerCase()
  return appStore.sortedChats.filter(chat => {
    if (!q) return true
    const name = getPeerName(chat).toLowerCase()
    const preview = getPreview(chat).toLowerCase()
    return name.includes(q) || preview.includes(q)
  })
})

function getPeerId(chat: Chat & { id: string }): string {
  return chat.participants.find(uid => uid !== auth.currentUser?.uid) || ''
}
function getPeerName(chat: Chat & { id: string }): string {
  const peerId = getPeerId(chat)
  return chat.participantNames[peerId] || 'Unknown'
}
function getPeerPhoto(chat: Chat & { id: string }): string | null {
  const peerId = getPeerId(chat)
  return chat.participantPhotos?.[peerId] || null
}
function getUnreadCount(chat: Chat & { id: string }): number {
  return chat.unreadCounts?.[auth.currentUser?.uid || ''] || 0
}
function isUserOnline(_chat: Chat & { id: string }): boolean {
  return false // Would need real-time subscription per user
}
function getPreview(chat: Chat & { id: string }): string {
  if (!chat.lastMessage) return 'No messages yet'
  const isOwn = chat.lastMessage.senderId === auth.currentUser?.uid
  const prefix = isOwn ? 'You: ' : ''
  const content = chat.lastMessage.content
  return prefix + (content.length > 45 ? content.slice(0, 45) + '…' : content)
}
function getChatAriaLabel(chat: Chat & { id: string }): string {
  const unread = getUnreadCount(chat)
  return `${getPeerName(chat)}${unread ? `, ${unread} unread messages` : ''}: ${getPreview(chat)}`
}
function formatTime(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diffH = (now.getTime() - d.getTime()) / 36e5
  if (diffH < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffH < 168) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function openChat(chat: Chat & { id: string }) {
  appStore.setActiveChatId(chat.id)
  router.push(`/chat/${chat.id}`)
}

async function handleLogout() {
  try {
    await logoutUser()
    router.push('/auth')
  } catch (e) {
    appStore.addNotification('Failed to sign out', 'error')
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');

* { box-sizing: border-box; }

.dashboard {
  display: flex;
  height: 100vh;
  background: #070a14;
  font-family: 'DM Sans', sans-serif;
  color: #e2e8f0;
  position: relative;
  overflow: hidden;
}

/* ── Sidebar ──────────────────────────────── */
.sidebar {
  width: 260px;
  background: rgba(10, 12, 24, 0.95);
  border-right: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  padding: 1.5rem 1rem;
  gap: 0.5rem;
  flex-shrink: 0;
  backdrop-filter: blur(20px);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.app-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.brand-icon {
  font-size: 1.4rem;
  background: linear-gradient(135deg, #5c3bff, #ff3b8c);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.brand-name {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: 1.1rem;
  color: #fff;
}

.sidebar-close {
  display: none;
  background: none;
  border: none;
  color: rgba(255,255,255,0.5);
  cursor: pointer;
  font-size: 1.1rem;
  padding: 4px;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  color: rgba(255,255,255,0.55);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.15s;
  text-decoration: none;
  font-family: inherit;
  width: 100%;
  text-align: left;
}
.nav-item:hover, .nav-item.active, .router-link-active.nav-item {
  background: rgba(92,59,255,0.15);
  color: #a78bfa;
}
.nav-icon { font-size: 1.1rem; }

.logout-btn {
  margin-top: auto;
  color: rgba(255,100,100,0.6);
}
.logout-btn:hover { background: rgba(255,59,140,0.1); color: #ff3b8c; }

.my-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(255,255,255,0.04);
  border-radius: 12px;
  padding: 0.875rem;
  margin-top: 1rem;
}

.my-avatar {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #5c3bff, #ff3b8c);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
  color: #fff;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
}
.my-avatar img { width: 100%; height: 100%; object-fit: cover; }
.online-dot {
  position: absolute;
  bottom: 0; right: 0;
  width: 10px; height: 10px;
  background: #34d399;
  border-radius: 50%;
  border: 2px solid #0a0c18;
}

.my-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.my-info strong {
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.my-username {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.35);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Main Area ─────────────────────────────── */
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: rgba(7,10,20,0.8);
  backdrop-filter: blur(20px);
}

.menu-btn {
  display: none;
  background: none;
  border: none;
  color: rgba(255,255,255,0.7);
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0;
}

.page-title {
  flex: 1;
  font-family: 'Syne', sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.new-chat-btn {
  width: 38px; height: 38px;
  background: rgba(92,59,255,0.2);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  text-decoration: none;
  transition: all 0.2s;
  border: 1px solid rgba(92,59,255,0.3);
}
.new-chat-btn:hover { background: rgba(92,59,255,0.35); }

.search-bar-wrap {
  padding: 1rem 1.5rem 0.5rem;
}
.search-input {
  width: 100%;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  color: #e2e8f0;
  font-size: 0.9rem;
  font-family: inherit;
  transition: all 0.2s;
}
.search-input:focus {
  outline: none;
  border-color: rgba(92,59,255,0.5);
  background: rgba(92,59,255,0.05);
}
.search-input::placeholder { color: rgba(255,255,255,0.25); }

.chats-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  gap: 0.75rem;
  color: rgba(255,255,255,0.35);
  text-align: center;
  padding: 2rem;
}
.empty-icon { font-size: 3rem; }
.empty-state h2 { color: rgba(255,255,255,0.6); font-size: 1.1rem; margin: 0; }
.empty-state p { font-size: 0.875rem; margin: 0; }
.start-btn {
  margin-top: 0.5rem;
  background: linear-gradient(135deg, #5c3bff, #7c3bff);
  color: #fff;
  padding: 0.625rem 1.5rem;
  border-radius: 10px;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s;
}
.start-btn:hover { opacity: 0.85; transform: translateY(-1px); }

.chat-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1.5rem;
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  font-family: inherit;
  text-align: left;
  width: 100%;
  transition: background 0.15s;
}
.chat-item:hover { background: rgba(255,255,255,0.04); }

.chat-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.chat-avatar {
  width: 48px; height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #5c3bff40, #ff3b8c40);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
  color: #a78bfa;
  overflow: hidden;
}
.chat-avatar img { width: 100%; height: 100%; object-fit: cover; }

.presence-dot {
  position: absolute;
  bottom: 2px; right: 2px;
  width: 11px; height: 11px;
  background: #34d399;
  border-radius: 50%;
  border: 2px solid #070a14;
}

.chat-body { flex: 1; min-width: 0; }

.chat-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.25rem;
}

.chat-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: #e2e8f0;
}

.chat-time {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.3);
  flex-shrink: 0;
}

.chat-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.chat-preview {
  font-size: 0.85rem;
  color: rgba(255,255,255,0.4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.unread-badge {
  background: #5c3bff;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  border-radius: 999px;
  padding: 2px 7px;
  flex-shrink: 0;
  min-width: 20px;
  text-align: center;
}

/* Active Call Bar */
.active-call-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(229, 62, 62, 0.95);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  color: #fff;
  font-weight: 600;
  z-index: 100;
}
.call-pulse { animation: pulse 1.5s infinite; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
.return-call-btn {
  margin-left: auto;
  background: rgba(255,255,255,0.2);
  border-radius: 8px;
  padding: 0.375rem 1rem;
  color: #fff;
  text-decoration: none;
  font-size: 0.875rem;
  transition: background 0.2s;
}
.return-call-btn:hover { background: rgba(255,255,255,0.3); }

.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: -100%;
    top: 0; bottom: 0;
    z-index: 200;
    width: 280px;
    transition: left 0.3s ease;
    padding-top: 1rem;
  }
  .sidebar.open { left: 0; }
  .sidebar-close { display: block; }
  .menu-btn { display: block; }
}
</style>
