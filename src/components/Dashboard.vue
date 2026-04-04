<template>
  <div class="dashboard" id="main-content">
    <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false" aria-hidden="true"></div>

    <nav class="sidebar" :class="{ open: sidebarOpen }" aria-label="Primary" :aria-hidden="!sidebarOpen && isMobile ? 'true' : undefined">
      <div class="sidebar-header">
        <div class="app-brand" role="img" aria-label="Soft Connect">
          <span class="brand-icon" aria-hidden="true">◈</span>
          <span class="brand-name">Soft Connect</span>
        </div>
        <button class="sidebar-close" @click="sidebarOpen = false" aria-label="Close navigation menu">
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <ul class="sidebar-nav" role="list">
        <li role="listitem">
          <button class="nav-item active" aria-current="page" aria-label="Chats, current page">
            <span class="nav-icon" aria-hidden="true">💬</span> Chats
          </button>
        </li>
        <li role="listitem">
          <RouterLink class="nav-item" to="/new-chat" aria-label="Start new conversation">
            <span class="nav-icon" aria-hidden="true">✏️</span> New Chat
          </RouterLink>
        </li>
        <li role="listitem">
          <RouterLink class="nav-item" to="/meetings" aria-label="Meetings">
            <span class="nav-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
            </span>
            Meetings
          </RouterLink>
        </li>
        <li role="listitem">
          <RouterLink class="nav-item" to="/call-history" aria-label="View call history">
            <span class="nav-icon" aria-hidden="true">📋</span> Call History
          </RouterLink>
        </li>
        <li role="listitem">
          <RouterLink class="nav-item" to="/blocklist" aria-label="View blocklist">
            <span class="nav-icon" aria-hidden="true">🛡️</span> Blocklist
          </RouterLink>
        </li>
        <li role="listitem">
          <RouterLink class="nav-item" :to="`/profile/${currentUser?.uid}`" aria-label="View my profile">
            <span class="nav-icon" aria-hidden="true">👤</span> My Profile
          </RouterLink>
        </li>
        <li role="listitem">
          <RouterLink class="nav-item" to="/settings" aria-label="Open settings">
            <span class="nav-icon" aria-hidden="true">⚙️</span> Settings
          </RouterLink>
        </li>
        <li role="listitem">
          <button class="nav-item logout-btn" @click="handleLogout" aria-label="Sign out of your account">
            <span class="nav-icon" aria-hidden="true">🚪</span> Sign Out
          </button>
        </li>
      </ul>

      <div class="my-card" aria-label="Your account">
        <button class="my-avatar" @click="router.push(`/profile/${currentUser?.uid}`)" :aria-label="`View your profile: ${profile?.displayName}`">
          <img v-if="profile?.photoURL" :src="profile.photoURL" :alt="profile.displayName" />
          <span v-else aria-hidden="true">{{ profile?.displayName?.charAt(0)?.toUpperCase() }}</span>
          <span class="online-dot" aria-hidden="true"></span>
          <span class="sr-only">You are online</span>
        </button>
        <div class="my-info">
          <strong>{{ profile?.displayName }}</strong>
          <span class="my-username" aria-label="Your username">@{{ profile?.username }}</span>
        </div>
      </div>
    </nav>

    <div class="main-area">
      <header class="dashboard-header" role="banner">
        <div class="brand-section">
          <div class="app-brand" role="img" aria-label="Soft Connect">
            <span class="brand-icon" aria-hidden="true">◈</span>
            <span class="brand-name">Soft Connect</span>
          </div>
          <button class="menu-btn" @click="sidebarOpen = !sidebarOpen" :aria-label="sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'" :aria-expanded="sidebarOpen">
            <span aria-hidden="true">☰</span>
          </button>
        </div>

        <div class="nav-tabs" role="tablist">
          <button role="tab" aria-selected="true" class="tab-item active">Chats</button>
          <button role="tab" aria-selected="false" class="tab-item" @click="router.push('/meetings')">Meetings</button>
          <button role="tab" aria-selected="false" class="tab-item" @click="router.push('/call-history')">Call History</button>
        </div>

        <div class="action-buttons">
          <button role="button" class="action-btn" @click="router.push('/new-chat')">New Chat</button>
          <button role="button" class="action-btn" @click="router.push('/meetings')">Join meeting with a code or link</button>
          <div class="more-options-wrap">
            <button role="button" class="action-btn more-btn" @click="moreOptionsOpen = !moreOptionsOpen" :aria-expanded="moreOptionsOpen">
              More options <span aria-hidden="true">▼</span>
            </button>
            <div v-if="moreOptionsOpen" class="more-menu" role="menu">
              <RouterLink to="/about" class="menu-link" role="menuitem">About</RouterLink>
              <RouterLink to="/help-support" class="menu-link" role="menuitem">Help & Support</RouterLink>
              <RouterLink to="/privacy-policy" class="menu-link" role="menuitem">Privacy Policy</RouterLink>
              <RouterLink to="/terms-of-use" class="menu-link" role="menuitem">Terms of Use</RouterLink>
              <RouterLink to="/ugc-disclosure" class="menu-link" role="menuitem">UGC Disclosure</RouterLink>
            </div>
          </div>
        </div>
      </header>

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
            <RouterLink to="/new-chat" class="start-btn" aria-label="Search for users to chat with">Find Someone</RouterLink>
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
      <RouterLink :to="`/call/${callState.peerId}`" class="return-call-btn" :aria-label="`Return to call with ${callState.peerName}`">Return</RouterLink>
    </div>

    <div aria-live="polite" aria-atomic="true" class="sr-only" role="status">{{ announcement }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { logoutUser, auth } from '../services/firebase'
import type { Chat } from '../services/firebase'

const router = useRouter()
const appStore = useAppStore()
const sidebarOpen = ref(false)
const moreOptionsOpen = ref(false)
const chatSearch = ref('')
const announcement = ref('')
const isMobile = ref(false)

const profile = computed(() => appStore.currentUserProfile)
const currentUser = computed(() => auth.currentUser)
const callState = computed(() => appStore.callState)

const filteredChats = computed(() => {
  const q = chatSearch.value.toLowerCase()
  return appStore.sortedChats.filter(chat => {
    if (!q) return true
    return getPeerName(chat).toLowerCase().includes(q) || getPreview(chat).toLowerCase().includes(q)
  })
})

function checkMobile() { isMobile.value = window.innerWidth < 768 }
onMounted(() => { checkMobile(); window.addEventListener('resize', checkMobile) })
onUnmounted(() => window.removeEventListener('resize', checkMobile))

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
async function handleLogout() {
  try { await logoutUser(); router.push('/auth') }
  catch { appStore.addNotification('Failed to sign out', 'error') }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
* { box-sizing: border-box; }
.dashboard { display: flex; height: 100vh; background: #070a14; font-family: 'DM Sans', sans-serif; color: #e2e8f0; position: relative; overflow: hidden; }
.sidebar-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 150; backdrop-filter: blur(2px); }
.sidebar { width: 260px; background: rgba(10,12,24,0.97); border-right: 1px solid rgba(255,255,255,0.07); display: flex; flex-direction: column; padding: 1.5rem 1rem; gap: 0.5rem; flex-shrink: 0; backdrop-filter: blur(20px); z-index: 160; }
.sidebar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.app-brand { display: flex; align-items: center; gap: 0.5rem; }
.brand-icon { font-size: 1.4rem; background: linear-gradient(135deg, #5c3bff, #ff3b8c); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.brand-name { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.1rem; color: #fff; }
.sidebar-close { display: none; background: rgba(255,255,255,0.06); border: none; border-radius: 8px; color: rgba(255,255,255,0.6); cursor: pointer; font-size: 1rem; width: 32px; height: 32px; align-items: center; justify-content: center; }
.sidebar-close:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }
.sidebar-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; list-style: none; padding: 0; margin: 0; }
.nav-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 10px; color: rgba(255,255,255,0.55); background: none; border: none; cursor: pointer; font-size: 0.9rem; font-weight: 500; transition: all 0.15s; text-decoration: none; font-family: inherit; width: 100%; text-align: left; min-height: 48px; }
.nav-item:hover, .nav-item.active, .router-link-active.nav-item { background: rgba(92,59,255,0.15); color: #a78bfa; }
.nav-item:focus-visible { outline: 3px solid #7c6fff; outline-offset: -2px; border-radius: 10px; }
.nav-icon { font-size: 1.1rem; flex-shrink: 0; display: flex; align-items: center; }
.logout-btn { color: rgba(255,100,100,0.65); }
.logout-btn:hover { background: rgba(255,59,140,0.1); color: #ff3b8c; }
.my-card { display: flex; align-items: center; gap: 0.75rem; background: rgba(255,255,255,0.04); border-radius: 12px; padding: 0.875rem; margin-top: 1rem; border: 1px solid rgba(255,255,255,0.05); }
.my-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #5c3bff, #ff3b8c); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem; color: #fff; cursor: pointer; position: relative; flex-shrink: 0; overflow: hidden; border: none; }
.my-avatar:focus-visible { outline: 3px solid #7c6fff; outline-offset: 3px; }
.my-avatar img { width: 100%; height: 100%; object-fit: cover; }
.online-dot { position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; background: #34d399; border-radius: 50%; border: 2px solid #0a0c18; }
.my-info { display: flex; flex-direction: column; min-width: 0; }
.my-info strong { font-size: 0.9rem; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.my-username { font-size: 0.75rem; color: rgba(255,255,255,0.38); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.main-area { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }

.dashboard-header {
  padding: 1.5rem;
  background: rgba(7, 10, 20, 0.9);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.brand-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-tabs {
  display: flex;
  gap: 2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tab-item {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  padding: 0.75rem 0;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
}

.tab-item.active {
  color: #a78bfa;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 3px;
  background: #a78bfa;
  border-radius: 3px 3px 0 0;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.action-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.more-options-wrap {
  position: relative;
}

.more-menu {
  position: absolute;
  top: 110%;
  left: 0;
  background: #1a1c2e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 100;
  min-width: 180px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
}

.menu-link {
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  padding: 0.6rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.menu-link:hover {
  background: rgba(92, 59, 255, 0.15);
  color: #a78bfa;
}

.admin-link {
  color: #fbbf24;
  font-weight: 600;
  border-bottom: 1px solid rgba(251, 191, 36, 0.1);
  margin-bottom: 4px;
}

.topbar { display: none; }
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
.start-btn { margin-top: 0.5rem; background: linear-gradient(135deg, #5c3bff, #7c3bff); color: #fff; padding: 0.75rem 1.5rem; border-radius: 10px; text-decoration: none; font-size: 0.9rem; font-weight: 600; transition: all 0.2s; min-height: 48px; display: inline-flex; align-items: center; }
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
.return-call-btn { margin-left: auto; background: rgba(255,255,255,0.2); border-radius: 8px; padding: 0.5rem 1.25rem; color: #fff; text-decoration: none; font-size: 0.875rem; font-weight: 700; transition: background 0.2s; min-height: 44px; display: flex; align-items: center; }
.return-call-btn:hover { background: rgba(255,255,255,0.3); }
.return-call-btn:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
@media (max-width: 768px) {
  .sidebar { position: fixed; left: -100%; top: 0; bottom: 0; z-index: 200; width: 280px; transition: left 0.3s ease; padding-top: 1rem; }
  .sidebar.open { left: 0; }
  .sidebar-close { display: flex; }
  .menu-btn { display: flex; }
}
</style>
