<template>
  <div class="call-history-screen" id="main-content" tabindex="-1">
    <AppHeader />

    <main class="call-main" aria-label="Call history">
      <div v-if="isLoading" class="loading-state" role="status" aria-label="Loading call history">
        <div class="spinner-lg" aria-hidden="true"></div>
        <span class="sr-only">Loading call history…</span>
      </div>

      <div
        v-else-if="callHistory.length === 0"
        class="empty-state"
        role="status"
      >
        <div class="empty-icon" aria-hidden="true">📋</div>
        <p>No calls yet</p>
      </div>

      <div v-else>
        <p class="sr-only" role="status">
          {{ callHistory.length }} call{{ callHistory.length !== 1 ? 's' : '' }} in history
        </p>
        <ul class="call-list" role="list" aria-label="Previous calls">
          <li
            v-for="call in callHistory"
            :key="call.id"
            class="call-item"
            role="listitem"
          >
            <div
              class="call-avatar"
              role="img"
              :aria-label="`${getOtherName(call)}'s avatar`"
            >
              <img v-if="getOtherPhoto(call)" :src="getOtherPhoto(call)!" :alt="getOtherName(call)" />
              <span v-else aria-hidden="true">{{ getOtherName(call).charAt(0).toUpperCase() }}</span>
            </div>

            <div class="call-info">
              <span class="call-name">{{ getOtherName(call) }}</span>
              <div class="call-details" aria-label="Call details">
                <span
                  :class="['call-status', call.status]"
                  :aria-label="`Status: ${statusLabel(call)}`"
                >
                  {{ statusLabel(call) }}
                </span>
                <span class="call-dot" aria-hidden="true">·</span>
                <span
                  class="call-type"
                  :aria-label="call.type === 'video' ? 'Video call' : 'Voice call'"
                >
                  <span aria-hidden="true">{{ call.type === 'video' ? '📹' : '📞' }}</span>
                </span>
                <span class="call-dot" aria-hidden="true">·</span>
                <time
                  class="call-time"
                  :datetime="call.startedAt?.toDate().toISOString()"
                  :aria-label="`Called at ${formatCallTime(call.startedAt?.toMillis())}`"
                >{{ formatCallTime(call.startedAt?.toMillis()) }}</time>
              </div>
              <span
                v-if="call.duration > 0"
                class="call-duration"
                :aria-label="`Duration: ${formatDuration(call.duration)}`"
              >{{ formatDuration(call.duration) }}</span>
            </div>

            <button
              class="recall-btn"
              @click="recallUser(call)"
              :aria-label="`Call ${getOtherName(call)} back with ${call.type === 'video' ? 'video' : 'voice'}`"
              :title="`Call ${getOtherName(call)}`"
            >
              <span aria-hidden="true">{{ call.type === 'video' ? '📹' : '📞' }}</span>
            </button>
          </li>
        </ul>
      </div>
    </main>

    <div aria-live="polite" aria-atomic="true" class="sr-only" role="status">{{ announcement }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { usePeerStore } from '../stores/peer'
import AppHeader from './AppHeader.vue'
import { auth, db } from '../services/firebase'
import type { CallRecord } from '../services/firebase'
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { doc, getDoc } from 'firebase/firestore'

const router = useRouter()
const appStore = useAppStore()
const peerStore = usePeerStore()

const callHistory = ref<CallRecord[]>([])
const isLoading = ref(true)
const announcement = ref('')

onMounted(async () => {
  if (!auth.currentUser) return
  try {
    const uid = auth.currentUser.uid
    const callerQuery = query(
      collection(db, 'calls'),
      where('callerId', '==', uid),
      orderBy('startedAt', 'desc'),
      limit(30)
    )
    const receiverQuery = query(
      collection(db, 'calls'),
      where('receiverId', '==', uid),
      orderBy('startedAt', 'desc'),
      limit(30)
    )
    const [callerSnap, receiverSnap] = await Promise.all([getDocs(callerQuery), getDocs(receiverQuery)])
    const allCalls: CallRecord[] = []
    callerSnap.forEach(d => allCalls.push({ id: d.id, ...d.data() } as CallRecord))
    receiverSnap.forEach(d => {
      if (!allCalls.find(c => c.id === d.id)) allCalls.push({ id: d.id, ...d.data() } as CallRecord)
    })
    allCalls.sort((a, b) => (b.startedAt?.toMillis() || 0) - (a.startedAt?.toMillis() || 0))
    callHistory.value = allCalls.slice(0, 50)
  } catch (e) {
    appStore.addNotification('Could not load call history', 'error')
    announcement.value = 'Failed to load call history'
  } finally {
    isLoading.value = false
  }
})

function getOtherName(call: CallRecord): string {
  return call.callerId === auth.currentUser?.uid ? call.receiverName : call.callerName
}
function getOtherPhoto(call: CallRecord): string | null {
  return call.callerId === auth.currentUser?.uid ? call.receiverPhoto : call.callerPhoto
}
function getOtherUid(call: CallRecord): string {
  return call.callerId === auth.currentUser?.uid ? call.receiverId : call.callerId
}

function statusLabel(call: CallRecord): string {
  const isCaller = call.callerId === auth.currentUser?.uid
  if (call.status === 'missed') return isCaller ? 'No answer' : 'Missed'
  if (call.status === 'rejected') return isCaller ? 'Declined' : 'You declined'
  if (call.status === 'answered') return isCaller ? 'Outgoing' : 'Incoming'
  return call.status
}

function formatCallTime(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diffH = (now.getTime() - d.getTime()) / 36e5
  if (diffH < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffH < 168) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s} seconds`
  return `${m} min ${s} sec`
}

async function recallUser(call: CallRecord) {
  const otherUid = getOtherUid(call)
  const snap = await getDoc(doc(db, 'peerIds', otherUid))
  if (!snap.exists()) {
    appStore.addNotification('User not online', 'warning')
    announcement.value = `${getOtherName(call)} is not available right now`
    return
  }
  const peerConnId = snap.data().peerId
  appStore.updateCallState({ peerName: getOtherName(call), peerPhoto: getOtherPhoto(call) })
  await peerStore.startCall(otherUid, peerConnId, call.type === 'video')
  router.push(`/call/${otherUid}`)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
* { box-sizing: border-box; }

.call-history-screen {
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
  font-family: 'Syne', sans-serif; font-size: 1.25rem; font-weight: 700; color: #fff; margin: 0;
}

.call-main { flex: 1; }

.loading-state {
  display: flex; align-items: center; justify-content: center;
  height: 50vh; gap: 1rem;
}
.spinner-lg {
  width: 40px; height: 40px;
  border: 3px solid rgba(255,255,255,0.1); border-top-color: #5c3bff;
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.empty-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; height: 60vh; color: rgba(255,255,255,0.35); gap: 0.75rem;
}
.empty-icon { font-size: 3rem; }

.call-list {
  padding: 0.5rem 0;
  list-style: none;
  margin: 0;
}

.call-item {
  display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s;
}
.call-item:hover { background: rgba(255,255,255,0.03); }

.call-avatar {
  width: 46px; height: 46px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, #5c3bff40, #ff3b8c40);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.1rem; font-weight: 700; color: #a78bfa; overflow: hidden;
}
.call-avatar img { width: 100%; height: 100%; object-fit: cover; }

.call-info { flex: 1; min-width: 0; }
.call-name { display: block; font-weight: 600; font-size: 0.95rem; color: #e2e8f0; margin-bottom: 0.25rem; }
.call-details { display: flex; align-items: center; gap: 0.375rem; font-size: 0.8rem; flex-wrap: wrap; }
.call-status { font-weight: 600; }
.call-status.answered { color: #34d399; }
.call-status.missed, .call-status.rejected { color: #ff6b8a; }
.call-dot { color: rgba(255,255,255,0.22); }
.call-type { font-size: 0.85rem; }
.call-time { color: rgba(255,255,255,0.38); }
.call-duration { font-size: 0.75rem; color: rgba(255,255,255,0.32); display: block; margin-top: 2px; }

.recall-btn {
  background: rgba(92,59,255,0.16); border: 1px solid rgba(92,59,255,0.28);
  border-radius: 10px; width: 44px; height: 44px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 1rem; transition: all 0.2s; flex-shrink: 0;
}
.recall-btn:hover { background: rgba(92,59,255,0.32); }
.recall-btn:focus-visible { outline: 3px solid #a78bfa; outline-offset: 2px; }

.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
</style>
