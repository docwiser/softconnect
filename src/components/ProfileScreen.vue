<template>
  <div class="profile-screen">
    <header class="screen-header">
      <button class="back-btn" @click="router.back()">←</button>
      <h1>{{ isOwnProfile ? 'My Profile' : 'Profile' }}</h1>
      <RouterLink v-if="isOwnProfile" to="/settings" class="edit-btn">Edit</RouterLink>
    </header>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner-lg"></div>
    </div>

    <div v-else-if="profile" class="profile-body">
      <!-- Cover / Avatar -->
      <div class="profile-hero">
        <div class="avatar-xl">
          <img v-if="profile.photoURL" :src="profile.photoURL" :alt="profile.displayName" />
          <span v-else>{{ profile.displayName.charAt(0).toUpperCase() }}</span>
          <span v-if="profile.isOnline" class="online-badge">Online</span>
        </div>
        <h2 class="profile-name">{{ profile.displayName }}</h2>
        <span class="profile-username">@{{ profile.username }}</span>
        <p v-if="profile.bio" class="profile-bio">{{ profile.bio }}</p>
      </div>

      <!-- Info chips -->
      <div class="info-chips">
        <div v-if="profile.settings?.showPhone && profile.phone" class="chip">
          <span>📱</span> {{ profile.phone }}
        </div>
        <div class="chip">
          <span>📅</span> Joined {{ formatJoinDate(profile.createdAt?.toMillis()) }}
        </div>
        <div v-if="profile.settings?.showLastSeen && !profile.isOnline" class="chip">
          <span>🕐</span> {{ lastSeenText }}
        </div>
      </div>

      <!-- Actions (for others' profiles) -->
      <div v-if="!isOwnProfile" class="profile-actions">
        <button class="action-btn primary" @click="startChat">Message</button>
        <button class="action-btn" @click="startCall(false)">📞 Call</button>
        <button class="action-btn" @click="startCall(true)">📹 Video</button>
        <button v-if="profile.blockable && !isBlocked" class="action-btn danger" @click="confirmBlock">Block</button>
        <button v-if="isBlocked" class="action-btn" @click="doUnblock">Unblock</button>
      </div>
    </div>

    <div v-else class="not-found">
      <p>User not found or profile is private.</p>
    </div>

    <!-- Block modal -->
    <div v-if="showBlockModal" class="modal-overlay" @click.self="showBlockModal = false">
      <div class="modal">
        <h2>Block {{ profile?.displayName }}?</h2>
        <p>They won't be able to contact you.</p>
        <div class="modal-actions">
          <button class="modal-cancel" @click="showBlockModal = false">Cancel</button>
          <button class="modal-confirm" @click="doBlock">Block</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { usePeerStore } from '../stores/peer'
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

onMounted(async () => {
  if (isOwnProfile.value) {
    profile.value = appStore.currentUserProfile
  } else {
    profile.value = await getUserProfile(uid.value)
    // Check privacy
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
  if (!snap.exists()) { appStore.addNotification('User not online', 'warning'); return }
  const peerConnId = snap.data().peerId
  appStore.updateCallState({ peerName: profile.value?.displayName || '', peerPhoto: profile.value?.photoURL || null })
  await peerStore.startCall(uid.value, peerConnId, withVideo)
  router.push(`/call/${uid.value}`)
}

function confirmBlock() { showBlockModal.value = true }
async function doBlock() {
  if (!auth.currentUser) return
  try {
    await blockUser(auth.currentUser.uid, uid.value)
    appStore.addNotification('User blocked', 'success')
    showBlockModal.value = false
    router.push('/dashboard')
  } catch (e: any) { appStore.addNotification(e.message, 'error'); showBlockModal.value = false }
}
async function doUnblock() {
  if (!auth.currentUser) return
  await unblockUser(auth.currentUser.uid, uid.value)
  appStore.addNotification('User unblocked', 'success')
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
* { box-sizing: border-box; }
.profile-screen { min-height: 100vh; background: #070a14; font-family: 'DM Sans', sans-serif; color: #e2e8f0; }
.screen-header {
  display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(10,12,24,0.9); backdrop-filter: blur(20px);
}
.back-btn {
  background: rgba(255,255,255,0.06); border: none; border-radius: 10px;
  width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: rgba(255,255,255,0.7); font-size: 1.1rem;
}
.screen-header h1 { flex: 1; font-family: 'Syne', sans-serif; font-size: 1.25rem; font-weight: 700; color: #fff; margin: 0; }
.edit-btn {
  background: rgba(92,59,255,0.2); border: 1px solid rgba(92,59,255,0.3);
  border-radius: 10px; padding: 0.5rem 1rem; color: #a78bfa;
  text-decoration: none; font-size: 0.875rem; font-weight: 600; transition: all 0.2s;
}
.edit-btn:hover { background: rgba(92,59,255,0.35); }
.loading-state { display: flex; align-items: center; justify-content: center; height: 50vh; }
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
  border: 3px solid rgba(92,59,255,0.4);
}
.avatar-xl img { width: 100%; height: 100%; object-fit: cover; }
.online-badge {
  position: absolute; bottom: 4px; right: 4px;
  background: #34d399; color: #fff; font-size: 0.6rem; font-weight: 700;
  padding: 2px 6px; border-radius: 999px; border: 2px solid #070a14;
}
.profile-name { font-family: 'Syne', sans-serif; font-size: 1.5rem; font-weight: 800; color: #fff; margin: 0 0 0.25rem; }
.profile-username { font-size: 0.9rem; color: rgba(255,255,255,0.4); }
.profile-bio { font-size: 0.9rem; color: rgba(255,255,255,0.6); margin: 0.75rem 0 0; line-height: 1.5; }
.info-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem; justify-content: center; }
.chip {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 999px; padding: 0.375rem 0.875rem; font-size: 0.8rem;
  color: rgba(255,255,255,0.55); display: flex; align-items: center; gap: 0.375rem;
}
.profile-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; }
.action-btn {
  padding: 0.625rem 1.25rem; border-radius: 10px; border: none; cursor: pointer;
  font-family: inherit; font-size: 0.875rem; font-weight: 600; transition: all 0.2s;
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); color: #e2e8f0;
}
.action-btn:hover { background: rgba(255,255,255,0.12); }
.action-btn.primary { background: linear-gradient(135deg, #5c3bff, #7c3bff); border-color: transparent; color: #fff; }
.action-btn.danger { background: rgba(255,59,140,0.1); border-color: rgba(255,59,140,0.2); color: #ff3b8c; }
.not-found { text-align: center; padding: 4rem 2rem; color: rgba(255,255,255,0.4); }
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1.5rem;
}
.modal { background: #0f1220; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 2rem; max-width: 380px; width: 100%; text-align: center; }
.modal h2 { font-family: 'Syne', sans-serif; color: #fff; margin: 0 0 0.75rem; font-size: 1.2rem; }
.modal p { color: rgba(255,255,255,0.5); font-size: 0.875rem; margin: 0 0 1.5rem; }
.modal-actions { display: flex; gap: 0.75rem; justify-content: center; }
.modal-cancel { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 0.625rem 1.5rem; color: rgba(255,255,255,0.7); cursor: pointer; font-family: inherit; font-size: 0.9rem; }
.modal-confirm { background: linear-gradient(135deg, #ff3b5c, #ff3b8c); border: none; border-radius: 10px; padding: 0.625rem 1.5rem; color: #fff; cursor: pointer; font-family: inherit; font-size: 0.9rem; font-weight: 600; }
</style>
