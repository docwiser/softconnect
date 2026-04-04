<template>
  <div class="blocklist-screen" id="main-content" tabindex="-1">
    <header class="header">
      <button class="back-btn" @click="router.push('/dashboard')" aria-label="Back to dashboard">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
      </button>
      <h1>Blocklist</h1>
    </header>

    <main class="content">
      <div v-if="loading" class="loading-state" role="status">
        <div class="spinner" aria-hidden="true"></div>
        <p>Loading blocked users…</p>
      </div>

      <div v-else-if="blockedUsers.length === 0" class="empty-state">
        <div class="empty-icon" aria-hidden="true">🛡️</div>
        <h2>No blocked users</h2>
        <p>Users you block will appear here. You can unblock them at any time.</p>
      </div>

      <div v-else class="user-list" role="list" :aria-label="`${blockedUsers.length} blocked user${blockedUsers.length !== 1 ? 's' : ''}`">
        <div v-for="user in blockedUsers" :key="user.uid" class="user-item" role="listitem">
          <div class="user-info">
            <div class="user-avatar" aria-hidden="true">
              <img v-if="user.photoURL" :src="user.photoURL" :alt="user.displayName" />
              <span v-else>{{ user.displayName.charAt(0).toUpperCase() }}</span>
            </div>
            <div class="user-meta">
              <span class="user-name">{{ user.displayName }}</span>
              <span class="user-handle">@{{ user.username }}</span>
            </div>
          </div>
          <button 
            class="unblock-btn" 
            @click="confirmUnblock(user)"
            :aria-label="`Unblock ${user.displayName}`"
          >
            Unblock
          </button>
        </div>
      </div>
    </main>

    <!-- Unblock confirmation dialog -->
    <Transition name="modal-fade">
      <div
        v-if="showUnblockModal"
        class="modal-overlay"
        @click.self="showUnblockModal = false"
        role="presentation"
      >
        <dialog
          open
          class="modal"
          :aria-label="`Unblock ${unblockTarget?.displayName}`"
          @keydown.escape="showUnblockModal = false"
        >
          <h2>Unblock {{ unblockTarget?.displayName }}?</h2>
          <p>They will be able to send you messages and call you again.</p>
          <div class="modal-actions">
            <button class="modal-cancel" @click="showUnblockModal = false">Cancel</button>
            <button class="modal-confirm" @click="doUnblock" :aria-label="`Confirm unblocking ${unblockTarget?.displayName}`">Unblock</button>
          </div>
        </dialog>
      </div>
    </Transition>

    <div aria-live="assertive" aria-atomic="true" class="sr-only" role="alert">{{ announcement }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { auth, getUserProfile, unblockUser } from '../services/firebase'
import type { UserProfile } from '../services/firebase'

const router = useRouter()
const appStore = useAppStore()

const loading = ref(true)
const blockedUsers = ref<UserProfile[]>([])
const announcement = ref('')
const showUnblockModal = ref(false)
const unblockTarget = ref<UserProfile | null>(null)

async function fetchBlockedUsers() {
  if (!auth.currentUser) return
  loading.value = true
  try {
    const uids = appStore.myBlockedUsers
    const profiles = await Promise.all(uids.map(uid => getUserProfile(uid)))
    blockedUsers.value = profiles.filter((p): p is UserProfile => p !== null)
  } catch (e) {
    appStore.addNotification('Failed to load blocklist', 'error')
  } finally {
    loading.value = false
  }
}

function confirmUnblock(user: UserProfile) {
  unblockTarget.value = user
  showUnblockModal.value = true
}

async function doUnblock() {
  if (!unblockTarget.value || !auth.currentUser) return
  const target = unblockTarget.value
  try {
    await unblockUser(auth.currentUser.uid, target.uid)
    appStore.addNotification(`${target.displayName} unblocked`, 'success')
    announcement.value = `${target.displayName} has been unblocked`
    blockedUsers.value = blockedUsers.value.filter(u => u.uid !== target.uid)
    showUnblockModal.value = false
  } catch (e) {
    appStore.addNotification('Failed to unblock user', 'error')
  }
}

onMounted(() => {
  fetchBlockedUsers()
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap');

.blocklist-screen {
  min-height: 100vh;
  background: #070a14;
  color: #e2e8f0;
  font-family: 'DM Sans', sans-serif;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  background: rgba(10,12,24,0.97);
  backdrop-filter: blur(20px);
  position: sticky;
  top: 0;
  z-index: 50;
}

.back-btn {
  background: rgba(255,255,255,0.06);
  border: none;
  border-radius: 10px;
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  color: rgba(255,255,255,0.7);
  transition: background 0.2s;
}
.back-btn:hover { background: rgba(255,255,255,0.12); }

.header h1 {
  font-family: 'Syne', sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.content {
  flex: 1;
  padding: 1rem 1.5rem;
  max-width: 600px;
  width: 100%;
  margin: 0 auto;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 50vh;
  gap: 1rem;
  color: rgba(255,255,255,0.4);
}

.spinner {
  width: 30px; height: 30px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: #5c3bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  text-align: center;
  color: rgba(255,255,255,0.4);
  gap: 0.75rem;
}
.empty-icon { font-size: 3rem; margin-bottom: 0.5rem; }
.empty-state h2 { color: #fff; font-size: 1.25rem; margin: 0; }
.empty-state p { font-size: 0.9rem; max-width: 300px; line-height: 1.5; }

.user-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.user-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 12px;
  transition: transform 0.2s, background 0.2s;
}
.user-item:hover {
  background: rgba(255,255,255,0.05);
  transform: translateY(-1px);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar {
  width: 44px; height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #5c3bff40, #ff3b8c40);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; color: #a78bfa;
  overflow: hidden; flex-shrink: 0;
}
.user-avatar img { width: 100%; height: 100%; object-fit: cover; }

.user-meta { display: flex; flex-direction: column; }
.user-name { font-weight: 600; font-size: 0.95rem; color: #fff; }
.user-handle { font-size: 0.8rem; color: rgba(255,255,255,0.4); }

.unblock-btn {
  background: rgba(92,59,255,0.1);
  border: 1px solid rgba(92,59,255,0.2);
  color: #a78bfa;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.unblock-btn:hover {
  background: rgba(92,59,255,0.2);
  border-color: rgba(92,59,255,0.4);
  transform: scale(1.05);
}

/* Modal */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  z-index: 500; padding: 1.5rem;
}
.modal {
  background: #0f1222; border: 1px solid rgba(255,255,255,0.11);
  border-radius: 20px; padding: 2rem; max-width: 360px; width: 100%; text-align: center;
  box-shadow: 0 20px 64px rgba(0,0,0,0.7); color: #e2e8f0;
}
.modal h2 { font-family: 'Syne', sans-serif; color: #fff; margin: 0 0 0.75rem; font-size: 1.15rem; }
.modal p { color: rgba(255,255,255,0.52); font-size: 0.875rem; margin: 0 0 1.5rem; line-height: 1.5; }
.modal-actions { display: flex; gap: 0.75rem; justify-content: center; }
.modal-cancel {
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.11);
  border-radius: 10px; padding: 0.625rem 1.5rem; color: rgba(255,255,255,0.7);
  cursor: pointer; font-family: inherit; font-size: 0.9rem; min-height: 44px;
}
.modal-confirm {
  background: linear-gradient(135deg, #5c3bff, #7c3bff); border: none;
  border-radius: 10px; padding: 0.625rem 1.5rem; color: #fff;
  cursor: pointer; font-family: inherit; font-size: 0.9rem; font-weight: 600; min-height: 44px;
}

.modal-fade-enter-active, .modal-fade-leave-active { transition: all 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
</style>
