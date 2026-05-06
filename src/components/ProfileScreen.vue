<template>
  <div class="profile-screen" id="main-content" tabindex="-1">
    <SubPageHeader :title="isOwnProfile ? 'My Profile' : 'Profile'">
      <template #actions>
        <button
          v-if="isOwnProfile"
          class="edit-btn"
          @click="router.push('/settings')"
          aria-label="Edit your profile in settings"
        >Edit</button>
      </template>
    </SubPageHeader>

    <main class="profile-main" aria-label="Profile content">
      <div v-if="isLoading" class="loading-state" role="status" aria-label="Loading profile">
        <div class="spinner-lg" aria-hidden="true"></div>
        <span class="sr-only">Loading profile…</span>
      </div>

      <div v-else-if="profile" class="profile-body">
        <!-- Cover / Avatar -->
        <section class="profile-hero" aria-label="Profile overview">
          <div
            class="avatar-xl"
            role="img"
            :aria-label="`${profile.displayName}'s profile photo${profile.isOnline ? ', online' : ''}`"
          >
            <img v-if="profile.photoURL" :src="profile.photoURL" :alt="`${profile.displayName}'s photo`" />
            <span v-else aria-hidden="true">{{ profile.displayName.charAt(0).toUpperCase() }}</span>
            <span
              v-if="profile.isOnline"
              class="online-badge"
              aria-label="Currently online"
            >Online</span>
          </div>
          <h2 class="profile-name">{{ profile.displayName }}</h2>
          <p class="profile-username">
            <span class="sr-only">Username: </span>@{{ profile.username }}
          </p>
          <p v-if="profile.bio" class="profile-bio">{{ profile.bio }}</p>
        </section>

        <!-- Info chips -->
        <ul class="info-chips" aria-label="Profile details">
          <li v-if="profile.settings?.showPhone && profile.phone" class="chip">
            <span aria-label="Phone number">📱 {{ profile.phone }}</span>
          </li>
          <li class="chip">
            <span>📅 Joined {{ formatJoinDate(profile.createdAt?.toMillis()) }}</span>
          </li>
          <li v-if="profile.settings?.showLastSeen && !profile.isOnline" class="chip">
            <span>🕐 {{ lastSeenText }}</span>
          </li>
        </ul>

        <!-- Actions (for others' profiles) -->
        <div
          v-if="!isOwnProfile"
          class="profile-actions"
          role="group"
          :aria-label="`Actions for ${profile.displayName}'s profile`"
        >
          <button
            class="action-btn primary"
            @click="startChat"
            :aria-label="`Send a message to ${profile.displayName}`"
          >Message</button>
          <button
            class="action-btn"
            @click="startCall(false)"
            :aria-label="`Voice call ${profile.displayName}`"
          >📞 Call</button>
          <button
            class="action-btn"
            @click="startCall(true)"
            :aria-label="`Video call ${profile.displayName}`"
          >📹 Video</button>
          <button
            v-if="profile.blockable && !isBlocked"
            class="action-btn danger"
            @click="confirmBlock"
            :aria-label="`Block ${profile.displayName}`"
          >Block</button>
          <button
            v-if="isBlocked"
            class="action-btn"
            @click="doUnblock"
            :aria-label="`Unblock ${profile.displayName}`"
          >Unblock</button>
        </div>
      </div>

      <div v-else class="not-found" role="status">
        <p>User not found or profile is private.</p>
      </div>
    </main>

    <!-- Block modal — auto-opens when showBlockModal is true -->
    <Transition name="modal-fade">
      <div
        v-if="showBlockModal"
        class="modal-overlay"
        @click.self="showBlockModal = false"
        role="presentation"
      >
        <dialog
          open
          class="modal"
          :aria-label="`Block ${profile?.displayName}`"
          @keydown.escape="showBlockModal = false"
        >
          <h2>Block {{ profile?.displayName }}?</h2>
          <p>They won't be able to contact you. You can unblock from their profile at any time.</p>
          <div class="modal-actions">
            <button
              class="modal-cancel"
              @click="showBlockModal = false"
              ref="cancelBlockRef"
            >Cancel</button>
            <button
              class="modal-confirm"
              @click="doBlock"
              :aria-label="`Confirm blocking ${profile?.displayName}`"
            >Block</button>
          </div>
        </dialog>
      </div>
    </Transition>

    <div aria-live="polite" aria-atomic="true" class="sr-only" role="status">{{ announcement }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { usePeerStore } from '../stores/peer'
import SubPageHeader from './SubPageHeader.vue'
import {
  auth, db,
  getUserProfile,
  getOrCreateChat,
  blockUser,
  unblockUser
} from '../services/firebase'
import type { UserProfile } from '../services/firebase'
import { doc, getDoc } from 'firebase/firestore'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const peerStore = usePeerStore()

const uid = computed(() => (route.params.uid as string) || auth.currentUser?.uid || '')
const isOwnProfile = computed(() => uid.value === auth.currentUser?.uid)

const profile = ref<UserProfile | null>(null)
const isLoading = ref(true)
const showBlockModal = ref(false)
const announcement = ref('')
const cancelBlockRef = ref<HTMLButtonElement>()

const isBlocked = computed(() => appStore.myBlockedUsers.includes(uid.value))
const lastSeenText = computed(() => {
  const ls = profile.value?.lastSeen?.toDate()
  if (!ls) return 'Offline'
  const diff = Date.now() - ls.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs/24)}d ago`
})

// Auto-focus cancel button when block dialog opens
watch(showBlockModal, async (open) => {
  if (open) {
    announcement.value = `Block ${profile.value?.displayName} dialog opened. Press Escape to cancel.`
    await nextTick()
    cancelBlockRef.value?.focus()
  }
})

onMounted(async () => {
  if (isOwnProfile.value) {
    profile.value = appStore.currentUserProfile
  } else {
    profile.value = await getUserProfile(uid.value)
    if (profile.value && !profile.value.settings?.profileVisible) {
      profile.value = null
    }
  }
  isLoading.value = false
})

function formatJoinDate(ts?: number): string {
  if (!ts) return 'Unknown'
  return new Date(ts).toLocaleDateString([], { month: 'long', year: 'numeric' })
}

async function startChat() {
  if (!auth.currentUser || !appStore.currentUserProfile || !profile.value) return
  const profiles = {
    [auth.currentUser.uid]: appStore.currentUserProfile,
    [uid.value]: profile.value
  }
  const chatId = await getOrCreateChat(auth.currentUser.uid, uid.value, profiles)
  appStore.setActiveChatId(chatId)
  router.push(`/chat/${chatId}`)
}

async function startCall(withVideo: boolean) {
  const snap = await getDoc(doc(db, 'peerIds', uid.value))
  if (!snap.exists()) {
    appStore.addNotification('User not online', 'warning')
    announcement.value = 'User is not online for a call'
    return
  }
  const peerConnId = snap.data().peerId
  appStore.updateCallState({
    peerName: profile.value?.displayName || '',
    peerPhoto: profile.value?.photoURL || null
  })
  await peerStore.startCall(uid.value, peerConnId, withVideo)
  router.push(`/call/${uid.value}`)
}

function confirmBlock() {
  showBlockModal.value = true
}

async function doBlock() {
  if (!auth.currentUser) return
  try {
    await blockUser(auth.currentUser.uid, uid.value)
    appStore.addNotification('User blocked', 'success')
    announcement.value = `${profile.value?.displayName} has been blocked`
    showBlockModal.value = false
    router.push('/dashboard')
  } catch (e: any) {
    appStore.addNotification(e.message, 'error')
    showBlockModal.value = false
  }
}

async function doUnblock() {
  if (!auth.currentUser) return
  await unblockUser(auth.currentUser.uid, uid.value)
  appStore.addNotification('User unblocked', 'success')
  announcement.value = `${profile.value?.displayName} has been unblocked`
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
* { box-sizing: border-box; }

.profile-screen {
  min-height: 100vh;
  background: #070a14;
  font-family: 'DM Sans', sans-serif;
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
}

.screen-header {
  display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  background: rgba(10,12,24,0.92); backdrop-filter: blur(20px);
}
.back-btn {
  background: rgba(255,255,255,0.07); border: none; border-radius: 10px;
  width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: rgba(255,255,255,0.72); font-size: 1.1rem;
}
.back-btn:hover { background: rgba(255,255,255,0.12); }
.back-btn:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }

.screen-header h1 {
  flex: 1; font-family: 'Syne', sans-serif; font-size: 1.25rem; font-weight: 700; color: #fff; margin: 0;
}
.edit-btn {
  background: rgba(92,59,255,0.22); border: 1px solid rgba(92,59,255,0.35);
  border-radius: 10px; padding: 0.5rem 1rem; color: #a78bfa;
  text-decoration: none; font-size: 0.875rem; font-weight: 600; transition: all 0.2s;
  min-height: 40px; display: flex; align-items: center;
}
.edit-btn:hover { background: rgba(92,59,255,0.38); }
.edit-btn:focus-visible { outline: 3px solid #a78bfa; outline-offset: 2px; }

.profile-main { flex: 1; }

.loading-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 50vh; gap: 1rem;
}
.spinner-lg {
  width: 40px; height: 40px;
  border: 3px solid rgba(255,255,255,0.1); border-top-color: #5c3bff;
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.profile-body { max-width: 500px; margin: 0 auto; padding: 2rem 1.5rem; }
.profile-hero { text-align: center; margin-bottom: 1.5rem; }
.avatar-xl {
  width: 100px; height: 100px; border-radius: 50%;
  background: linear-gradient(135deg, #5c3bff, #ff3b8c);
  display: flex; align-items: center; justify-content: center;
  font-size: 2.5rem; font-weight: 700; color: #fff;
  margin: 0 auto 1rem; position: relative; overflow: hidden;
  border: 3px solid rgba(92,59,255,0.45);
}
.avatar-xl img { width: 100%; height: 100%; object-fit: cover; }
.online-badge {
  position: absolute; bottom: 4px; right: 4px;
  background: #34d399; color: #fff; font-size: 0.6rem; font-weight: 700;
  padding: 2px 6px; border-radius: 999px; border: 2px solid #070a14;
}
.profile-name {
  font-family: 'Syne', sans-serif; font-size: 1.5rem; font-weight: 800;
  color: #fff; margin: 0 0 0.25rem;
}
.profile-username { font-size: 0.9rem; color: rgba(255,255,255,0.42); margin: 0; }
.profile-bio {
  font-size: 0.9rem; color: rgba(255,255,255,0.62);
  margin: 0.75rem 0 0; line-height: 1.5;
}

.info-chips {
  display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem;
  justify-content: center; list-style: none; padding: 0;
}
.chip {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);
  border-radius: 999px; padding: 0.375rem 0.875rem; font-size: 0.8rem;
  color: rgba(255,255,255,0.57); display: flex; align-items: center; gap: 0.375rem;
}

.profile-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; }
.action-btn {
  padding: 0.625rem 1.25rem; border-radius: 10px; border: none; cursor: pointer;
  font-family: inherit; font-size: 0.875rem; font-weight: 600; transition: all 0.2s;
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.11);
  color: #e2e8f0; min-height: 44px;
}
.action-btn:hover { background: rgba(255,255,255,0.14); }
.action-btn:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }
.action-btn.primary { background: linear-gradient(135deg, #5c3bff, #7c3bff); border-color: transparent; color: #fff; }
.action-btn.danger { background: rgba(255,59,140,0.11); border-color: rgba(255,59,140,0.22); color: #ff6b8a; }

.not-found { text-align: center; padding: 4rem 2rem; color: rgba(255,255,255,0.42); }

.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.72); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1.5rem;
}
.modal-fade-enter-active, .modal-fade-leave-active { transition: all 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

.modal {
  background: #0f1222; border: 1px solid rgba(255,255,255,0.11);
  border-radius: 20px; padding: 2rem; max-width: 380px; width: 100%; text-align: center;
  color: #e2e8f0; box-shadow: 0 20px 64px rgba(0,0,0,0.7);
}
.modal h2 {
  font-family: 'Syne', sans-serif; color: #fff; margin: 0 0 0.75rem; font-size: 1.2rem;
}
.modal p { color: rgba(255,255,255,0.52); font-size: 0.875rem; margin: 0 0 1.5rem; line-height: 1.5; }
.modal-actions { display: flex; gap: 0.75rem; justify-content: center; }
.modal-cancel {
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.11);
  border-radius: 10px; padding: 0.625rem 1.5rem; color: rgba(255,255,255,0.75);
  cursor: pointer; font-family: inherit; font-size: 0.9rem; min-height: 44px;
}
.modal-cancel:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }
.modal-confirm {
  background: linear-gradient(135deg, #ff3b5c, #ff3b8c); border: none;
  border-radius: 10px; padding: 0.625rem 1.5rem; color: #fff;
  cursor: pointer; font-family: inherit; font-size: 0.9rem; font-weight: 600; min-height: 44px;
}
.modal-confirm:focus-visible { outline: 3px solid #ff9bb5; outline-offset: 2px; }

.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
</style>
