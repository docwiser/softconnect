<template>
  <div class="new-chat-screen">
    <header class="screen-header">
      <button class="back-btn" @click="router.back()" aria-label="Go back">←</button>
      <h1>New Conversation</h1>
    </header>

    <div class="search-section">
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input
          ref="searchInput"
          v-model="query"
          type="search"
          placeholder="Search by username..."
          class="search-field"
          aria-label="Search users by username"
          @input="debouncedSearch"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
        />
        <span v-if="isSearching" class="search-loader"></span>
      </div>
    </div>

    <div class="results-area">
      <!-- Blocked note -->
      <p v-if="query && !isSearching && results.length === 0" class="no-results">
        No users found for "{{ query }}"
      </p>

      <p v-if="!query" class="search-hint">
        Type a username to find people to chat with
      </p>

      <div v-for="user in results" :key="user.uid" class="user-card">
        <div class="user-avatar-wrap">
          <div class="user-avatar">
            <img v-if="user.photoURL" :src="user.photoURL" :alt="user.displayName" />
            <span v-else>{{ user.displayName.charAt(0).toUpperCase() }}</span>
          </div>
          <span v-if="user.isOnline" class="online-indicator"></span>
        </div>

        <div class="user-info">
          <span class="user-name">{{ user.displayName }}</span>
          <span class="user-username">@{{ user.username }}</span>
          <span v-if="user.bio" class="user-bio">{{ user.bio }}</span>
        </div>

        <div class="user-actions">
          <button
            v-if="isBlocked(user.uid)"
            class="action-btn unblock-btn"
            @click="handleUnblock(user.uid)"
          >Unblock</button>
          <template v-else>
            <button
              class="action-btn chat-btn"
              @click="startChat(user)"
              :disabled="isStarting === user.uid"
            >
              <span v-if="isStarting === user.uid" class="mini-spinner"></span>
              <span v-else>Chat</span>
            </button>
            <button
              class="action-btn call-btn"
              @click="startCall(user, false)"
              title="Voice call"
            >📞</button>
            <button
              class="action-btn call-btn"
              @click="startCall(user, true)"
              title="Video call"
            >📹</button>
            <button
              v-if="user.blockable"
              class="action-btn block-btn"
              @click="confirmBlock(user)"
              title="Block user"
            >🚫</button>
          </template>
        </div>
      </div>
    </div>

    <!-- Block confirm modal -->
    <div v-if="blockTarget" class="modal-overlay" @click.self="blockTarget = null">
      <div class="modal" role="dialog" aria-modal="true" :aria-label="`Block ${blockTarget.displayName}`">
        <h2>Block @{{ blockTarget.username }}?</h2>
        <p>They won't be able to message or call you. You can unblock them later.</p>
        <div class="modal-actions">
          <button class="modal-cancel" @click="blockTarget = null">Cancel</button>
          <button class="modal-confirm" @click="handleBlock">Block</button>
        </div>
      </div>
    </div>

    <div aria-live="polite" class="sr-only">{{ announcement }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { usePeerStore } from '../stores/peer'
import {
  searchUsers,
  getOrCreateChat,
  blockUser,
  unblockUser,
  getUserProfile,
  auth
} from '../services/firebase'
import type { UserProfile } from '../services/firebase'

const router = useRouter()
const appStore = useAppStore()
const peerStore = usePeerStore()

const query = ref('')
const results = ref<UserProfile[]>([])
const isSearching = ref(false)
const isStarting = ref<string | null>(null)
const blockTarget = ref<UserProfile | null>(null)
const announcement = ref('')
const searchInput = ref<HTMLInputElement>()

let searchTimer: ReturnType<typeof setTimeout>

onMounted(() => {
  searchInput.value?.focus()
})

function debouncedSearch() {
  clearTimeout(searchTimer)
  if (!query.value.trim()) { results.value = []; return }
  searchTimer = setTimeout(doSearch, 350)
}

async function doSearch() {
  if (!query.value.trim() || !auth.currentUser) return
  isSearching.value = true
  try {
    const found = await searchUsers(query.value, auth.currentUser.uid)
    // Filter out blocked users from results
    const blocked = appStore.myBlockedUsers
    results.value = found.filter(u => !blocked.includes(u.uid))
    announcement.value = `${results.value.length} users found`
  } catch (e) {
    appStore.addNotification('Search failed', 'error')
  } finally {
    isSearching.value = false
  }
}

function isBlocked(uid: string): boolean {
  return appStore.myBlockedUsers.includes(uid)
}

async function startChat(user: UserProfile) {
  if (!auth.currentUser || !appStore.currentUserProfile) return
  isStarting.value = user.uid
  try {
    const profiles: Record<string, UserProfile> = {
      [auth.currentUser.uid]: appStore.currentUserProfile,
      [user.uid]: user
    }
    const chatId = await getOrCreateChat(auth.currentUser.uid, user.uid, profiles)
    appStore.setActiveChatId(chatId)
    router.push(`/chat/${chatId}`)
  } catch (e) {
    appStore.addNotification('Could not start chat', 'error')
  } finally {
    isStarting.value = null
  }
}

async function startCall(user: UserProfile, withVideo: boolean) {
  // Get their peer connection ID from Firestore
  const { doc, getDoc } = await import('firebase/firestore')
  const { db } = await import('../services/firebase')
  const snap = await getDoc(doc(db, 'peerIds', user.uid))
  if (!snap.exists()) {
    appStore.addNotification(`${user.displayName} is not online`, 'warning')
    return
  }
  const peerConnId = snap.data().peerId
  appStore.updateCallState({
    peerId: user.uid,
    peerName: user.displayName,
    peerPhoto: user.photoURL
  })
  await peerStore.startCall(user.uid, peerConnId, withVideo)
  router.push(`/call/${user.uid}`)
}

function confirmBlock(user: UserProfile) {
  blockTarget.value = user
}

async function handleBlock() {
  if (!blockTarget.value || !auth.currentUser) return
  try {
    await blockUser(auth.currentUser.uid, blockTarget.value.uid)
    results.value = results.value.filter(u => u.uid !== blockTarget.value!.uid)
    announcement.value = `${blockTarget.value.displayName} blocked`
    appStore.addNotification(`@${blockTarget.value.username} blocked`, 'success')
    blockTarget.value = null
  } catch (e: any) {
    appStore.addNotification(e.message || 'Could not block user', 'error')
    blockTarget.value = null
  }
}

async function handleUnblock(uid: string) {
  if (!auth.currentUser) return
  try {
    await unblockUser(auth.currentUser.uid, uid)
    appStore.addNotification('User unblocked', 'success')
    await doSearch()
  } catch {
    appStore.addNotification('Could not unblock user', 'error')
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');

* { box-sizing: border-box; }

.new-chat-screen {
  min-height: 100vh;
  background: #070a14;
  font-family: 'DM Sans', sans-serif;
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
}

.screen-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: rgba(7,10,20,0.8);
  backdrop-filter: blur(20px);
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
}
.back-btn:hover { background: rgba(255,255,255,0.1); }

.screen-header h1 {
  font-family: 'Syne', sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.search-section {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 1rem;
  font-size: 1rem;
  pointer-events: none;
}

.search-field {
  width: 100%;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 14px;
  padding: 0.875rem 1rem 0.875rem 2.75rem;
  color: #e2e8f0;
  font-size: 0.95rem;
  font-family: inherit;
  transition: all 0.2s;
}
.search-field:focus {
  outline: none;
  border-color: rgba(92,59,255,0.5);
  background: rgba(92,59,255,0.05);
  box-shadow: 0 0 0 3px rgba(92,59,255,0.1);
}
.search-field::placeholder { color: rgba(255,255,255,0.25); }

.search-loader {
  position: absolute;
  right: 1rem;
  width: 18px; height: 18px;
  border: 2px solid rgba(255,255,255,0.1);
  border-top-color: #5c3bff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.results-area {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
}

.no-results, .search-hint {
  text-align: center;
  color: rgba(255,255,255,0.3);
  padding: 3rem 2rem;
  font-size: 0.9rem;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  transition: background 0.15s;
}
.user-card:hover { background: rgba(255,255,255,0.03); }

.user-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.user-avatar {
  width: 50px; height: 50px;
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
.user-avatar img { width: 100%; height: 100%; object-fit: cover; }

.online-indicator {
  position: absolute;
  bottom: 1px; right: 1px;
  width: 12px; height: 12px;
  background: #34d399;
  border-radius: 50%;
  border: 2px solid #070a14;
}

.user-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.user-name {
  font-weight: 600;
  color: #e2e8f0;
  font-size: 0.95rem;
}
.user-username {
  font-size: 0.8rem;
  color: rgba(255,255,255,0.35);
}
.user-bio {
  font-size: 0.8rem;
  color: rgba(255,255,255,0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.action-btn {
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  min-width: 36px; height: 36px;
}

.chat-btn {
  background: rgba(92,59,255,0.2);
  color: #a78bfa;
  border: 1px solid rgba(92,59,255,0.3);
  min-width: 70px;
}
.chat-btn:hover:not(:disabled) {
  background: rgba(92,59,255,0.35);
  color: #fff;
}
.chat-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.call-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  font-size: 1rem;
}
.call-btn:hover { background: rgba(255,255,255,0.1); }

.block-btn {
  background: rgba(255,59,140,0.1);
  border: 1px solid rgba(255,59,140,0.15);
  font-size: 1rem;
}
.block-btn:hover { background: rgba(255,59,140,0.2); }

.unblock-btn {
  background: rgba(52,211,153,0.1);
  color: #34d399;
  border: 1px solid rgba(52,211,153,0.2);
  min-width: 80px;
}
.unblock-btn:hover { background: rgba(52,211,153,0.2); }

.mini-spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
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
.modal h2 {
  font-family: 'Syne', sans-serif;
  color: #fff;
  margin: 0 0 0.75rem;
  font-size: 1.25rem;
}
.modal p {
  color: rgba(255,255,255,0.5);
  font-size: 0.9rem;
  margin: 0 0 1.5rem;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.modal-cancel {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 0.625rem 1.5rem;
  color: rgba(255,255,255,0.7);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
}
.modal-cancel:hover { background: rgba(255,255,255,0.1); }

.modal-confirm {
  background: linear-gradient(135deg, #ff3b5c, #ff3b8c);
  border: none;
  border-radius: 10px;
  padding: 0.625rem 1.5rem;
  color: #fff;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s;
}
.modal-confirm:hover { opacity: 0.85; }

.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
</style>
