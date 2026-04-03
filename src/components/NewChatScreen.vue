<template>
  <div class="new-chat-screen" id="main-content" tabindex="-1">
    <header class="screen-header" role="banner">
      <button class="back-btn" @click="router.back()" aria-label="Go back to previous page">
        <span aria-hidden="true">←</span>
      </button>
      <h1>New Conversation</h1>
    </header>

    <search class="search-section" aria-label="Find users">
      <label for="user-search" class="sr-only">Search users by username</label>
      <div class="search-wrap">
        <span class="search-icon" aria-hidden="true">🔍</span>
        <input
          id="user-search"
          ref="searchInput"
          v-model="query"
          type="search"
          placeholder="Search by username…"
          class="search-field"
          aria-label="Search users by username"
          aria-describedby="search-hint"
          :aria-busy="isSearching"
          @input="debouncedSearch"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
        />
        <span id="search-hint" class="sr-only">Type at least 2 characters to search</span>
        <span v-if="isSearching" class="search-loader" aria-hidden="true"></span>
      </div>
    </search>

    <main class="results-area" aria-label="Search results" aria-live="polite" aria-atomic="false">
      <p
        v-if="!query"
        class="search-hint"
        role="status"
      >
        Type a username to find people to chat with
      </p>

      <p
        v-if="query && !isSearching && results.length === 0"
        class="no-results"
        role="status"
        aria-live="polite"
      >
        No users found for "{{ query }}"
      </p>

      <div
        v-if="results.length > 0"
        class="results-count sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ results.length }} user{{ results.length !== 1 ? 's' : '' }} found
      </div>

      <ul class="user-list" role="list" aria-label="Found users">
        <li
          v-for="user in results"
          :key="user.uid"
          class="user-card"
          role="listitem"
        >
          <div class="user-avatar-wrap">
            <div class="user-avatar" aria-hidden="true">
              <img v-if="user.photoURL" :src="user.photoURL" :alt="user.displayName" />
              <span v-else>{{ user.displayName.charAt(0).toUpperCase() }}</span>
            </div>
            <span
              v-if="user.isOnline"
              class="online-indicator"
              aria-hidden="true"
              title="Online"
            ></span>
          </div>

          <div class="user-info">
            <span class="user-name">{{ user.displayName }}</span>
            <span class="user-username" aria-label="Username: @{{ user.username }}">@{{ user.username }}</span>
            <span v-if="user.bio" class="user-bio">{{ user.bio }}</span>
          </div>

          <div class="user-actions" role="group" :aria-label="`Actions for ${user.displayName}`">
            <template v-if="isBlocked(user.uid)">
              <button
                class="action-btn unblock-btn"
                @click="handleUnblock(user.uid)"
                :aria-label="`Unblock ${user.displayName}`"
              >Unblock</button>
            </template>
            <template v-else>
              <button
                class="action-btn chat-btn"
                @click="startChat(user)"
                :disabled="isStarting === user.uid"
                :aria-busy="isStarting === user.uid"
                :aria-label="`Start chat with ${user.displayName}`"
              >
                <span v-if="isStarting === user.uid" class="mini-spinner" aria-hidden="true"></span>
                <span>{{ isStarting === user.uid ? 'Opening…' : 'Chat' }}</span>
              </button>
              <button
                class="action-btn call-btn"
                @click="startCall(user, false)"
                :aria-label="`Voice call ${user.displayName}`"
                title="Voice call"
              >
                <span aria-hidden="true">📞</span>
              </button>
              <button
                class="action-btn call-btn"
                @click="startCall(user, true)"
                :aria-label="`Video call ${user.displayName}`"
                title="Video call"
              >
                <span aria-hidden="true">📹</span>
              </button>
              <button
                v-if="user.blockable"
                class="action-btn block-btn"
                @click="confirmBlock(user)"
                :aria-label="`Block ${user.displayName}`"
                title="Block user"
              >
                <span aria-hidden="true">🚫</span>
              </button>
            </template>
          </div>
        </li>
      </ul>
    </main>

    <!-- Block confirm dialog — auto-opens when blockTarget is set -->
    <Transition name="modal-fade">
      <div
        v-if="blockTarget"
        class="modal-overlay"
        @click.self="blockTarget = null"
        role="presentation"
      >
        <dialog
          open
          class="modal"
          :aria-label="`Block ${blockTarget.displayName}`"
          @keydown.escape="blockTarget = null"
        >
          <h2 id="block-heading">Block @{{ blockTarget.username }}?</h2>
          <p id="block-desc">They won't be able to message or call you. You can unblock them later.</p>
          <div class="modal-actions">
            <button
              class="modal-cancel"
              @click="blockTarget = null"
              ref="cancelBlockRef"
            >Cancel</button>
            <button
              class="modal-confirm"
              @click="handleBlock"
              :aria-label="`Confirm blocking ${blockTarget.displayName}`"
            >Block</button>
          </div>
        </dialog>
      </div>
    </Transition>

    <div aria-live="polite" aria-atomic="true" class="sr-only" role="status">{{ announcement }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { usePeerStore } from '../stores/peer'
import {
  searchUsers,
  getOrCreateChat,
  blockUser,
  unblockUser,
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
const cancelBlockRef = ref<HTMLButtonElement>()

let searchTimer: ReturnType<typeof setTimeout>

// Auto-focus cancel button when block dialog opens
watch(blockTarget, async (target) => {
  if (target) {
    announcement.value = `Block ${target.displayName} dialog opened. Press Escape to cancel.`
    await nextTick()
    cancelBlockRef.value?.focus()
  }
})

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
    const blocked = appStore.myBlockedUsers
    results.value = found.filter(u => !blocked.includes(u.uid))
    announcement.value = `${results.value.length} users found`
  } catch (e) {
    appStore.addNotification('Search failed', 'error')
    announcement.value = 'Search failed'
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
  const { doc, getDoc } = await import('firebase/firestore')
  const { db } = await import('../services/firebase')
  const snap = await getDoc(doc(db, 'peerIds', user.uid))
  if (!snap.exists()) {
    appStore.addNotification(`${user.displayName} is not online`, 'warning')
    announcement.value = `${user.displayName} is not available for a call`
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
  const targetName = blockTarget.value.displayName
  try {
    await blockUser(auth.currentUser.uid, blockTarget.value.uid)
    results.value = results.value.filter(u => u.uid !== blockTarget.value!.uid)
    announcement.value = `${targetName} has been blocked`
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
    announcement.value = 'User unblocked'
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
  border-bottom: 1px solid rgba(255,255,255,0.07);
  background: rgba(7,10,20,0.85);
  backdrop-filter: blur(20px);
}

.back-btn {
  background: rgba(255,255,255,0.07);
  border: none;
  border-radius: 10px;
  width: 40px; height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(255,255,255,0.7);
  font-size: 1.1rem;
  transition: background 0.2s;
}
.back-btn:hover { background: rgba(255,255,255,0.11); }
.back-btn:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }

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
  display: block;
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
  background: rgba(255,255,255,0.07);
  border: 1.5px solid rgba(255,255,255,0.11);
  border-radius: 14px;
  padding: 0.875rem 1rem 0.875rem 2.75rem;
  color: #e2e8f0;
  font-size: 0.95rem;
  font-family: inherit;
  transition: all 0.2s;
  min-height: 52px;
}
.search-field:focus {
  outline: none;
  border-color: rgba(92,59,255,0.6);
  background: rgba(92,59,255,0.06);
  box-shadow: 0 0 0 3px rgba(92,59,255,0.12);
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
  color: rgba(255,255,255,0.33);
  padding: 3rem 2rem;
  font-size: 0.9rem;
}

.user-list {
  list-style: none;
  padding: 0;
  margin: 0;
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
  color: rgba(255,255,255,0.38);
}
.user-bio {
  font-size: 0.8rem;
  color: rgba(255,255,255,0.47);
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
  min-width: 40px; min-height: 40px;
}
.action-btn:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }

.chat-btn {
  background: rgba(92,59,255,0.2);
  color: #a78bfa;
  border: 1px solid rgba(92,59,255,0.35);
  min-width: 74px;
}
.chat-btn:hover:not(:disabled) { background: rgba(92,59,255,0.38); color: #fff; }
.chat-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.call-btn {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.09);
  font-size: 1rem;
}
.call-btn:hover { background: rgba(255,255,255,0.12); }

.block-btn {
  background: rgba(255,59,140,0.1);
  border: 1px solid rgba(255,59,140,0.17);
  font-size: 1rem;
}
.block-btn:hover { background: rgba(255,59,140,0.22); }

.unblock-btn {
  background: rgba(52,211,153,0.1);
  color: #34d399;
  border: 1px solid rgba(52,211,153,0.22);
  min-width: 84px;
}
.unblock-btn:hover { background: rgba(52,211,153,0.22); }

.mini-spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin-right: 4px;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.72);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1.5rem;
}

.modal-fade-enter-active, .modal-fade-leave-active { transition: all 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

.modal {
  background: #0f1222;
  border: 1px solid rgba(255,255,255,0.11);
  border-radius: 20px;
  padding: 2rem;
  max-width: 380px;
  width: 100%;
  text-align: center;
  color: #e2e8f0;
  box-shadow: 0 20px 64px rgba(0,0,0,0.7);
}
.modal h2 {
  font-family: 'Syne', sans-serif;
  color: #fff;
  margin: 0 0 0.75rem;
  font-size: 1.25rem;
}
.modal p {
  color: rgba(255,255,255,0.52);
  font-size: 0.9rem;
  margin: 0 0 1.5rem;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.modal-cancel {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.11);
  border-radius: 10px;
  padding: 0.625rem 1.5rem;
  color: rgba(255,255,255,0.75);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
  min-height: 44px;
}
.modal-cancel:hover { background: rgba(255,255,255,0.12); }
.modal-cancel:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }

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
  min-height: 44px;
}
.modal-confirm:hover { opacity: 0.87; }
.modal-confirm:focus-visible { outline: 3px solid #ff9bb5; outline-offset: 2px; }

.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

.results-count { display: none; }
</style>
