<template>
  <div class="meetings-screen" id="main-content" tabindex="-1">
    <header class="screen-header" role="banner">
      <button class="back-btn" @click="router.push('/dashboard')" aria-label="Back to dashboard">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      </button>
      <h1>Meetings</h1>
      <button class="new-meeting-btn" @click="() => openCreateDialog(false)" aria-label="Create a new meeting">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Meeting
      </button>
    </header>

    <main class="meetings-main" aria-label="Meetings list">
      <!-- Quick actions -->
      <section class="quick-actions" aria-label="Quick meeting actions">
        <button class="quick-card new-card" @click="() => openCreateDialog(false)" aria-label="Create and start a new meeting">
          <div class="quick-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
          </div>
          <span class="quick-label">New Meeting</span>
          <span class="quick-desc">Start an instant meeting</span>
        </button>
        <button class="quick-card join-card" @click="showJoinDialog = true" aria-label="Join a meeting with a code or link">
          <div class="quick-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          </div>
          <span class="quick-label">Join Meeting</span>
          <span class="quick-desc">Enter a code or link</span>
        </button>
        <button class="quick-card schedule-card" @click="() => openCreateDialog(true)" aria-label="Schedule a future meeting">
          <div class="quick-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <span class="quick-label">Schedule</span>
          <span class="quick-desc">Plan for later</span>
        </button>
      </section>

      <!-- Meetings list -->
      <section class="meetings-list-section" aria-labelledby="meetings-list-heading">
        <div class="section-header">
          <h2 id="meetings-list-heading">Your Meetings</h2>
          <div class="filter-tabs" role="tablist" aria-label="Filter meetings">
            <button
              v-for="tab in tabs"
              :key="tab.value"
              role="tab"
              :aria-selected="activeTab === tab.value"
              :class="['filter-tab', { active: activeTab === tab.value }]"
              @click="activeTab = tab.value"
            >{{ tab.label }}</button>
          </div>
        </div>

        <div v-if="isLoading" class="loading-state" role="status" aria-label="Loading meetings">
          <div class="spinner" aria-hidden="true"></div>
        </div>

        <div v-else-if="filteredMeetings.length === 0" class="empty-meetings" role="status">
          <div class="empty-icon" aria-hidden="true">📅</div>
          <p>No meetings yet</p>
          <button class="empty-cta" @click="() => openCreateDialog(false)">Create your first meeting</button>
        </div>

        <ul class="meetings-list" role="list" v-else>
          <li
            v-for="m in filteredMeetings"
            :key="m.id"
            class="meeting-card"
            role="listitem"
          >
            <div class="meeting-card-header">
              <div class="meeting-status-badge" :class="m.status" :aria-label="`Status: ${m.status}`">
                <span class="status-dot" aria-hidden="true"></span>
                {{ m.status }}
              </div>
              <div class="meeting-card-actions">
                <button
                  class="card-action-btn"
                  @click="copyLink(m.inviteLink)"
                  :aria-label="`Copy invite link for ${m.title}`"
                  title="Copy invite link"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                </button>
                <button
                  v-if="m.status !== 'ended'"
                  class="card-action-btn start-btn-sm"
                  @click="startOrJoin(m)"
                  :aria-label="`${m.status === 'active' ? 'Join' : 'Start'} meeting: ${m.title}`"
                >
                  {{ m.status === 'active' ? 'Join' : 'Start' }}
                </button>
                <button
                  class="card-action-btn delete-btn-sm"
                  @click="confirmDeleteMeeting(m)"
                  :aria-label="`Delete meeting: ${m.title}`"
                  title="Delete meeting"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                </button>
              </div>
            </div>

            <h3 class="meeting-title">{{ m.title }}</h3>
            <p v-if="m.description" class="meeting-desc">{{ m.description }}</p>

            <div class="meeting-meta">
              <span v-if="m.scheduledAt" class="meta-chip">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {{ formatScheduled(m.scheduledAt.toMillis()) }}
              </span>
              <span class="meta-chip">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                {{ getActiveCount(m) }} participant{{ getActiveCount(m) !== 1 ? 's' : '' }}
              </span>
              <span class="meta-chip code-chip" @click="copyCode(m.meetingCode)" role="button" tabindex="0" :aria-label="`Meeting code: ${m.meetingCode}. Click to copy`" @keydown.enter="copyCode(m.meetingCode)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                {{ m.meetingCode }}
              </span>
            </div>
          </li>
        </ul>
      </section>
    </main>

    <!-- Create Meeting Dialog -->
    <Transition name="modal-fade">
      <div
        v-if="showCreateDialog"
        class="modal-overlay"
        @click.self="showCreateDialog = false"
        role="presentation"
      >
        <dialog
          open
          class="create-dialog"
          aria-label="Create new meeting"
          @keydown.escape="showCreateDialog = false"
        >
          <div class="dialog-header">
            <h2>{{ isScheduling ? 'Schedule Meeting' : 'New Meeting' }}</h2>
            <button class="dialog-close" @click="showCreateDialog = false" aria-label="Close dialog" ref="createDialogCloseRef">✕</button>
          </div>

          <form @submit.prevent="handleCreate" class="create-form" aria-label="Meeting creation form">
            <div class="form-field">
              <label for="meet-title">
                Meeting Title
                <span class="required" aria-label="required">*</span>
              </label>
              <input
                id="meet-title"
                v-model="form.title"
                type="text"
                placeholder="Team Standup, Product Review…"
                required
                maxlength="100"
                :aria-invalid="!!formErrors.title"
              />
              <span v-if="formErrors.title" class="field-error" role="alert">{{ formErrors.title }}</span>
            </div>

            <div class="form-field">
              <label for="meet-desc">Description <span class="optional">(optional)</span></label>
              <textarea
                id="meet-desc"
                v-model="form.description"
                placeholder="What's this meeting about?"
                rows="2"
                maxlength="500"
              ></textarea>
            </div>

            <div class="form-field">
              <label for="meet-agenda">Agenda <span class="optional">(optional)</span></label>
              <textarea
                id="meet-agenda"
                v-model="form.agenda"
                placeholder="Discussion points, goals…"
                rows="3"
                maxlength="1000"
              ></textarea>
            </div>

            <div v-if="isScheduling" class="form-field">
              <label for="meet-time">Scheduled Time</label>
              <input
                id="meet-time"
                v-model="form.scheduledAt"
                type="datetime-local"
                :min="minDateTime"
              />
            </div>

            <div class="form-field">
              <label for="meet-max">Max Participants <span class="optional">(0 = unlimited)</span></label>
              <input
                id="meet-max"
                v-model.number="form.maxParticipants"
                type="number"
                min="0"
                max="500"
                placeholder="0"
              />
            </div>

            <!-- Settings toggles -->
            <fieldset class="settings-fieldset">
              <legend>Meeting Options</legend>
              <div class="toggle-grid">
                <label class="toggle-item">
                  <span class="toggle-item-label">Mute on entry</span>
                  <input type="checkbox" v-model="form.muteOnEntry" role="switch" :aria-checked="form.muteOnEntry" />
                </label>
                <label class="toggle-item">
                  <span class="toggle-item-label">Video off on entry</span>
                  <input type="checkbox" v-model="form.videoOffOnEntry" role="switch" :aria-checked="form.videoOffOnEntry" />
                </label>
                <label class="toggle-item">
                  <span class="toggle-item-label">Waiting room</span>
                  <input type="checkbox" v-model="form.waitingRoom" role="switch" :aria-checked="form.waitingRoom" />
                </label>
                <label class="toggle-item">
                  <span class="toggle-item-label">Allow participant audio</span>
                  <input type="checkbox" v-model="form.allowParticipantAudio" role="switch" :aria-checked="form.allowParticipantAudio" />
                </label>
                <label class="toggle-item">
                  <span class="toggle-item-label">Allow participant video</span>
                  <input type="checkbox" v-model="form.allowParticipantVideo" role="switch" :aria-checked="form.allowParticipantVideo" />
                </label>
                <label class="toggle-item">
                  <span class="toggle-item-label">Allow screen share</span>
                  <input type="checkbox" v-model="form.allowScreenShare" role="switch" :aria-checked="form.allowScreenShare" />
                </label>
                <label class="toggle-item">
                  <span class="toggle-item-label">Allow chat</span>
                  <input type="checkbox" v-model="form.allowChat" role="switch" :aria-checked="form.allowChat" />
                </label>
                <label class="toggle-item">
                  <span class="toggle-item-label">Allow reactions</span>
                  <input type="checkbox" v-model="form.allowReactions" role="switch" :aria-checked="form.allowReactions" />
                </label>
              </div>
            </fieldset>

            <div class="form-actions">
              <button type="button" class="btn-cancel" @click="showCreateDialog = false">Cancel</button>
              <button type="submit" class="btn-create" :disabled="isCreating" :aria-busy="isCreating">
                <span v-if="isCreating" class="btn-spinner" aria-hidden="true"></span>
                {{ isCreating ? 'Creating…' : (isScheduling ? 'Schedule' : 'Create & Start') }}
              </button>
            </div>
          </form>
        </dialog>
      </div>
    </Transition>

    <!-- Join with code dialog -->
    <Transition name="modal-fade">
      <div v-if="showJoinDialog" class="modal-overlay" @click.self="showJoinDialog = false" role="presentation">
        <dialog open class="join-dialog" aria-label="Join a meeting" @keydown.escape="showJoinDialog = false">
          <div class="dialog-header">
            <h2>Join Meeting</h2>
            <button class="dialog-close" @click="showJoinDialog = false" aria-label="Close" ref="joinDialogCloseRef">✕</button>
          </div>
          <div class="join-form">
            <div class="form-field">
              <label for="join-code">Meeting Code or Link</label>
              <input
                id="join-code"
                v-model="joinCode"
                type="text"
                placeholder="abc-defg-hij or paste link"
                autocomplete="off"
                ref="joinCodeInputRef"
              />
            </div>
            <div v-if="joinError" class="join-error" role="alert">{{ joinError }}</div>
            <div class="form-actions">
              <button type="button" class="btn-cancel" @click="showJoinDialog = false">Cancel</button>
              <button class="btn-create" @click="handleJoin" :disabled="!joinCode.trim() || isJoining" :aria-busy="isJoining">
                {{ isJoining ? 'Finding…' : 'Continue' }}
              </button>
            </div>
          </div>
        </dialog>
      </div>
    </Transition>

    <!-- Delete confirm -->
    <Transition name="modal-fade">
      <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null" role="presentation">
        <dialog open class="confirm-dialog" :aria-label="`Delete meeting: ${deleteTarget.title}`" @keydown.escape="deleteTarget = null">
          <h2>Delete "{{ deleteTarget.title }}"?</h2>
          <p>This meeting and all its data will be permanently deleted.</p>
          <div class="form-actions">
            <button class="btn-cancel" @click="deleteTarget = null" ref="deleteCancelRef">Cancel</button>
            <button class="btn-delete" @click="doDelete">Delete</button>
          </div>
        </dialog>
      </div>
    </Transition>

    <div aria-live="polite" aria-atomic="true" class="sr-only" role="status">{{ announcement }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import {
  createMeeting,
  getMeetingByCode,
  deleteMeeting,
  listenToMyMeetings,
  type Meeting
} from '../services/meetings'
import { auth } from '../services/firebase'

const router = useRouter()
const appStore = useAppStore()

const isLoading = ref(true)
const meetings = ref<Meeting[]>([])
const activeTab = ref<'all' | 'active' | 'scheduled' | 'ended'>('all')
const announcement = ref('')
const showCreateDialog = ref(false)
const showJoinDialog = ref(false)
const isCreating = ref(false)
const isJoining = ref(false)
const isScheduling = ref(false)
const joinCode = ref('')
const joinError = ref('')
const deleteTarget = ref<Meeting | null>(null)

const createDialogCloseRef = ref<HTMLButtonElement>()
const joinDialogCloseRef = ref<HTMLButtonElement>()
const joinCodeInputRef = ref<HTMLInputElement>()
const deleteCancelRef = ref<HTMLButtonElement>()

const formErrors = ref<Record<string, string>>({})
const form = ref({
  title: '',
  description: '',
  agenda: '',
  scheduledAt: '',
  maxParticipants: 0,
  muteOnEntry: false,
  videoOffOnEntry: false,
  waitingRoom: false,
  allowParticipantAudio: true,
  allowParticipantVideo: true,
  allowScreenShare: true,
  allowChat: true,
  allowReactions: true
})

const tabs = [
  { label: 'All', value: 'all' as const },
  { label: 'Active', value: 'active' as const },
  { label: 'Scheduled', value: 'scheduled' as const },
  { label: 'Ended', value: 'ended' as const }
]

const minDateTime = computed(() => {
  const now = new Date()
  now.setMinutes(now.getMinutes() + 5)
  return now.toISOString().slice(0, 16)
})

const filteredMeetings = computed(() => {
  if (activeTab.value === 'all') return meetings.value
  return meetings.value.filter(m => m.status === activeTab.value)
})

let unsubMeetings: (() => void) | null = null

onMounted(() => {
  const uid = auth.currentUser?.uid
  if (!uid) return
  unsubMeetings = listenToMyMeetings(uid, (ms) => {
    meetings.value = ms
    isLoading.value = false
  })
})

onUnmounted(() => { unsubMeetings?.() })

// Auto-focus dialog buttons
watch(showCreateDialog, async (open) => {
  if (open) { await nextTick(); createDialogCloseRef.value?.focus() }
})
watch(showJoinDialog, async (open) => {
  if (open) { await nextTick(); joinCodeInputRef.value?.focus() }
})
watch(deleteTarget, async (t) => {
  if (t) { await nextTick(); deleteCancelRef.value?.focus() }
})

function openCreateDialog(scheduling = false) {
  isScheduling.value = scheduling === true
  // Reset form
  form.value = {
    title: '', description: '', agenda: '', scheduledAt: '',
    maxParticipants: 0, muteOnEntry: false, videoOffOnEntry: false,
    waitingRoom: false, allowParticipantAudio: true, allowParticipantVideo: true,
    allowScreenShare: true, allowChat: true, allowReactions: true
  }
  formErrors.value = {}
  showCreateDialog.value = true
}

async function handleCreate() {
  formErrors.value = {}
  if (!form.value.title.trim()) {
    formErrors.value.title = 'Meeting title is required'
    return
  }
  isCreating.value = true
  try {
    const meeting = await createMeeting({
      title: form.value.title.trim(),
      description: form.value.description.trim(),
      agenda: form.value.agenda.trim(),
      scheduledAt: form.value.scheduledAt ? new Date(form.value.scheduledAt) : null,
      tags: [],
      allowedEmails: [],
      settings: {
        muteOnEntry: form.value.muteOnEntry,
        videoOffOnEntry: form.value.videoOffOnEntry,
        waitingRoom: form.value.waitingRoom,
        allowParticipantAudio: form.value.allowParticipantAudio,
        allowParticipantVideo: form.value.allowParticipantVideo,
        allowScreenShare: form.value.allowScreenShare,
        allowChat: form.value.allowChat,
        allowReactions: form.value.allowReactions,
        maxParticipants: form.value.maxParticipants
      }
    })
    showCreateDialog.value = false
    announcement.value = `Meeting "${meeting.title}" created`
    if (!isScheduling.value) {
      // Go directly to prejoin
      router.push(`/meeting/prejoin/${meeting.meetingCode}`)
    } else {
      appStore.addNotification('Meeting scheduled!', 'success')
    }
  } catch (e: any) {
    appStore.addNotification(e.message || 'Could not create meeting', 'error')
  } finally {
    isCreating.value = false
  }
}

async function handleJoin() {
  joinError.value = ''
  let code = joinCode.value.trim()
  // Handle full URLs
  if (code.includes('/join/')) {
    code = code.split('/join/').pop() || code
  }
  if (!code) return
  isJoining.value = true
  try {
    const meeting = await getMeetingByCode(code)
    if (!meeting) {
      joinError.value = 'Meeting not found. Check the code and try again.'
      return
    }
    if (meeting.status === 'ended') {
      joinError.value = 'This meeting has ended.'
      return
    }
    showJoinDialog.value = false
    router.push(`/meeting/prejoin/${code}`)
  } catch {
    joinError.value = 'Could not find meeting. Try again.'
  } finally {
    isJoining.value = false
  }
}

function startOrJoin(m: Meeting) {
  router.push(`/meeting/prejoin/${m.meetingCode}`)
}

function confirmDeleteMeeting(m: Meeting) {
  deleteTarget.value = m
}

async function doDelete() {
  if (!deleteTarget.value) return
  try {
    await deleteMeeting(deleteTarget.value.id)
    announcement.value = `Meeting "${deleteTarget.value.title}" deleted`
    appStore.addNotification('Meeting deleted', 'success')
  } catch {
    appStore.addNotification('Could not delete meeting', 'error')
  } finally {
    deleteTarget.value = null
  }
}

async function copyLink(link: string) {
  try {
    await navigator.clipboard.writeText(link)
    appStore.addNotification('Invite link copied!', 'success')
  } catch {
    appStore.addNotification('Could not copy link', 'error')
  }
}

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code)
    appStore.addNotification('Meeting code copied!', 'success')
  } catch {}
}

function getActiveCount(m: Meeting): number {
  return Object.values(m.participants).filter(p => p.status === 'joined').length
}

function formatScheduled(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
* { box-sizing: border-box; }

.meetings-screen {
  min-height: 100vh;
  background: #070a14;
  font-family: 'DM Sans', sans-serif;
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.screen-header {
  display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  background: rgba(10,12,24,0.95); backdrop-filter: blur(20px);
  position: sticky; top: 0; z-index: 40;
}
.back-btn {
  background: rgba(255,255,255,0.07); border: none; border-radius: 10px;
  width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: rgba(255,255,255,0.72); transition: background 0.2s;
}
.back-btn:hover { background: rgba(255,255,255,0.12); }
.back-btn:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }
.screen-header h1 { flex: 1; font-family: 'Syne', sans-serif; font-size: 1.25rem; font-weight: 700; color: #fff; margin: 0; }
.new-meeting-btn {
  display: flex; align-items: center; gap: 0.5rem;
  background: linear-gradient(135deg, #5c3bff, #7c3bff); border: none;
  border-radius: 10px; padding: 0.5rem 1rem; color: #fff;
  font-family: inherit; font-size: 0.875rem; font-weight: 600; cursor: pointer;
  transition: all 0.2s; min-height: 40px;
}
.new-meeting-btn:hover { opacity: 0.88; transform: translateY(-1px); }
.new-meeting-btn:focus-visible { outline: 3px solid #a78bfa; outline-offset: 2px; }

/* ── Main ────────────────────────────────────────────────────────────────── */
.meetings-main {
  max-width: 900px; margin: 0 auto; width: 100%; padding: 1.5rem; display: flex; flex-direction: column; gap: 2rem;
}

/* ── Quick Actions ────────────────────────────────────────────────────────── */
.quick-actions {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;
}
.quick-card {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px; padding: 1.5rem; display: flex; flex-direction: column;
  align-items: center; gap: 0.75rem; cursor: pointer; transition: all 0.2s;
  font-family: inherit; color: inherit; min-height: 130px;
}
.quick-card:hover { border-color: rgba(92,59,255,0.4); background: rgba(92,59,255,0.07); transform: translateY(-2px); }
.quick-card:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }
.new-card { border-color: rgba(92,59,255,0.25); }
.new-card .quick-icon { background: rgba(92,59,255,0.2); color: #a78bfa; }
.join-card .quick-icon { background: rgba(52,211,153,0.15); color: #34d399; }
.schedule-card .quick-icon { background: rgba(251,191,36,0.15); color: #fbbf24; }
.quick-icon {
  width: 56px; height: 56px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
}
.quick-label { font-weight: 700; font-size: 0.95rem; color: #fff; }
.quick-desc { font-size: 0.78rem; color: rgba(255,255,255,0.4); }

/* ── Section ─────────────────────────────────────────────────────────────── */
.section-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;
}
.section-header h2 { font-family: 'Syne', sans-serif; font-size: 1.05rem; font-weight: 700; color: #fff; margin: 0; }

.filter-tabs { display: flex; gap: 4px; background: rgba(255,255,255,0.05); border-radius: 10px; padding: 3px; }
.filter-tab {
  padding: 0.35rem 0.875rem; border: none; border-radius: 7px;
  background: transparent; color: rgba(255,255,255,0.5); font-size: 0.8rem; font-weight: 500;
  cursor: pointer; font-family: inherit; transition: all 0.15s; min-height: 32px;
}
.filter-tab.active { background: rgba(92,59,255,0.4); color: #fff; }
.filter-tab:focus-visible { outline: 3px solid #7c6fff; outline-offset: -2px; }

.loading-state { display: flex; justify-content: center; padding: 3rem; }
.spinner {
  width: 36px; height: 36px;
  border: 3px solid rgba(255,255,255,0.1); border-top-color: #5c3bff;
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.empty-meetings {
  display: flex; flex-direction: column; align-items: center;
  padding: 4rem 2rem; gap: 0.75rem; color: rgba(255,255,255,0.38); text-align: center;
}
.empty-icon { font-size: 2.5rem; }
.empty-cta {
  margin-top: 0.5rem; background: rgba(92,59,255,0.2); border: 1px solid rgba(92,59,255,0.35);
  border-radius: 10px; padding: 0.625rem 1.5rem; color: #a78bfa;
  font-family: inherit; font-size: 0.875rem; font-weight: 600; cursor: pointer; min-height: 44px;
}
.empty-cta:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }

/* ── Meeting Cards ────────────────────────────────────────────────────────── */
.meetings-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.75rem; }
.meeting-card {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px; padding: 1.25rem; transition: border-color 0.2s;
}
.meeting-card:hover { border-color: rgba(92,59,255,0.25); }

.meeting-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
.meeting-status-badge {
  display: flex; align-items: center; gap: 0.375rem;
  font-size: 0.72rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
  padding: 0.25rem 0.625rem; border-radius: 999px;
}
.meeting-status-badge.active { background: rgba(52,211,153,0.15); color: #34d399; }
.meeting-status-badge.scheduled { background: rgba(251,191,36,0.15); color: #fbbf24; }
.meeting-status-badge.ended { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.4); }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.meeting-status-badge.active .status-dot { animation: pulse 2s infinite; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

.meeting-card-actions { display: flex; align-items: center; gap: 0.5rem; }
.card-action-btn {
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.09);
  border-radius: 8px; padding: 0.375rem 0.75rem; color: rgba(255,255,255,0.65);
  font-family: inherit; font-size: 0.8rem; font-weight: 500; cursor: pointer;
  transition: all 0.15s; display: flex; align-items: center; gap: 0.375rem; min-height: 32px;
}
.card-action-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
.card-action-btn:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }
.start-btn-sm { background: rgba(92,59,255,0.22); border-color: rgba(92,59,255,0.35); color: #a78bfa; }
.start-btn-sm:hover { background: rgba(92,59,255,0.38); color: #fff; }
.delete-btn-sm { color: rgba(255,100,100,0.6); }
.delete-btn-sm:hover { background: rgba(255,59,92,0.15); color: #ff6b8a; border-color: rgba(255,59,92,0.25); }

.meeting-title { font-family: 'Syne', sans-serif; font-size: 1rem; font-weight: 700; color: #fff; margin: 0 0 0.375rem; }
.meeting-desc { font-size: 0.82rem; color: rgba(255,255,255,0.5); margin: 0 0 0.75rem; line-height: 1.4; }
.meeting-meta { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.meta-chip {
  display: inline-flex; align-items: center; gap: 0.35rem;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 999px; padding: 0.2rem 0.625rem; font-size: 0.75rem; color: rgba(255,255,255,0.5);
}
.code-chip { cursor: pointer; font-family: monospace; letter-spacing: 0.05em; }
.code-chip:hover { background: rgba(92,59,255,0.15); border-color: rgba(92,59,255,0.3); color: #a78bfa; }
.code-chip:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; border-radius: 999px; }

/* ── Dialogs ──────────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.72); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center; z-index: 500; padding: 1rem;
}
.modal-fade-enter-active, .modal-fade-leave-active { transition: all 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; transform: scale(0.97); }

.create-dialog, .join-dialog, .confirm-dialog {
  background: #0e1222; border: 1px solid rgba(255,255,255,0.11);
  border-radius: 20px; padding: 0; max-width: 520px; width: 100%;
  max-height: 90vh; overflow-y: auto;
  color: #e2e8f0; box-shadow: 0 24px 72px rgba(0,0,0,0.8);
}

.dialog-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.5rem 1.5rem 0; margin-bottom: 1.25rem;
}
.dialog-header h2 { font-family: 'Syne', sans-serif; font-size: 1.15rem; font-weight: 800; color: #fff; margin: 0; }
.dialog-close {
  background: rgba(255,255,255,0.07); border: none; border-radius: 8px;
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: rgba(255,255,255,0.55); font-size: 0.85rem;
}
.dialog-close:hover { background: rgba(255,255,255,0.13); color: #fff; }
.dialog-close:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }

.create-form, .join-form {
  padding: 0 1.5rem 1.5rem;
  display: flex; flex-direction: column; gap: 1rem;
}
.confirm-dialog { padding: 1.5rem; text-align: center; max-width: 380px; }
.confirm-dialog h2 { font-family: 'Syne', sans-serif; color: #fff; margin: 0 0 0.75rem; font-size: 1.15rem; }
.confirm-dialog p { color: rgba(255,255,255,0.52); font-size: 0.875rem; margin: 0 0 1.5rem; }

.form-field { display: flex; flex-direction: column; gap: 0.375rem; }
.form-field label {
  font-size: 0.82rem; font-weight: 600; color: rgba(255,255,255,0.65); letter-spacing: 0.04em;
  display: flex; align-items: center; gap: 0.25rem;
}
.required { color: #ff6b8a; }
.optional { color: rgba(255,255,255,0.35); font-weight: 400; }
.form-field input, .form-field textarea, .form-field select {
  background: rgba(255,255,255,0.06); border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 10px; padding: 0.75rem 1rem; color: #e2e8f0;
  font-family: inherit; font-size: 0.9rem; transition: all 0.2s; min-height: 44px;
}
.form-field input:focus, .form-field textarea:focus {
  outline: none; border-color: rgba(92,59,255,0.6);
  background: rgba(92,59,255,0.06); box-shadow: 0 0 0 3px rgba(92,59,255,0.12);
}
.form-field input::placeholder, .form-field textarea::placeholder { color: rgba(255,255,255,0.22); }
.form-field textarea { resize: vertical; }
.field-error { font-size: 0.78rem; color: #ff9bb5; }

.settings-fieldset {
  border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1rem; margin: 0;
}
.settings-fieldset legend {
  font-size: 0.82rem; font-weight: 600; color: rgba(255,255,255,0.55); padding: 0 0.5rem;
}
.toggle-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.75rem; }
.toggle-item {
  display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
  background: rgba(255,255,255,0.04); border-radius: 8px; padding: 0.5rem 0.75rem;
  cursor: pointer; font-size: 0.82rem; color: rgba(255,255,255,0.65);
}
.toggle-item input[type=checkbox] {
  width: 36px; height: 20px; border-radius: 999px; appearance: none; -webkit-appearance: none;
  background: rgba(255,255,255,0.15); transition: background 0.2s; cursor: pointer;
  position: relative; flex-shrink: 0; min-height: unset; padding: 0; border: none;
}
.toggle-item input[type=checkbox]:checked { background: linear-gradient(135deg, #5c3bff, #7c3bff); }
.toggle-item input[type=checkbox]::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px; border-radius: 50%; background: #fff;
  transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.toggle-item input[type=checkbox]:checked::after { transform: translateX(16px); }
.toggle-item input[type=checkbox]:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }

.form-actions {
  display: flex; gap: 0.75rem; justify-content: flex-end; padding-top: 0.5rem;
}
.btn-cancel {
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.11);
  border-radius: 10px; padding: 0.625rem 1.25rem; color: rgba(255,255,255,0.72);
  cursor: pointer; font-family: inherit; font-size: 0.9rem; min-height: 44px;
}
.btn-cancel:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }
.btn-create {
  background: linear-gradient(135deg, #5c3bff, #7c3bff); border: none;
  border-radius: 10px; padding: 0.625rem 1.5rem; color: #fff;
  cursor: pointer; font-family: inherit; font-size: 0.9rem; font-weight: 700;
  min-height: 44px; display: flex; align-items: center; gap: 0.5rem;
}
.btn-create:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-create:focus-visible { outline: 3px solid #a78bfa; outline-offset: 2px; }
.btn-delete {
  background: linear-gradient(135deg, #ff3b5c, #ff3b8c); border: none;
  border-radius: 10px; padding: 0.625rem 1.5rem; color: #fff;
  cursor: pointer; font-family: inherit; font-size: 0.9rem; font-weight: 700; min-height: 44px;
}
.btn-delete:focus-visible { outline: 3px solid #ff9bb5; outline-offset: 2px; }
.btn-spinner {
  width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;
}
.join-error {
  background: rgba(255,59,92,0.1); border: 1px solid rgba(255,59,92,0.25);
  border-radius: 8px; padding: 0.75rem; font-size: 0.875rem; color: #ff9bb5;
}

.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

@media (max-width: 600px) {
  .quick-actions { grid-template-columns: 1fr; }
  .toggle-grid { grid-template-columns: 1fr; }
}
</style>
