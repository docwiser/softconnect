<template>
  <div class="reports-screen" id="main-content">
    <header class="screen-header">
      <button class="back-btn" @click="router.back()" aria-label="Go back">
        <span aria-hidden="true">←</span>
      </button>
      <h1>User Reports (Admin)</h1>
    </header>

    <main class="reports-container">
      <div v-if="!isAdmin" class="access-denied" role="alert">
        <h2>Access Denied</h2>
        <p>You do not have administrative privileges to view this page.</p>
        <RouterLink to="/dashboard" class="home-link">Return to Dashboard</RouterLink>
      </div>

      <div v-else-if="isLoading" class="loading-state" role="status">
        <div class="spinner"></div>
        <p>Loading reports…</p>
      </div>

      <div v-else-if="reports.length === 0" class="empty-state">
        <p>No pending reports. Great job!</p>
      </div>

      <div v-else class="reports-list">
        <article v-for="report in reports" :key="report.id" class="report-card">
          <div class="report-header">
            <span :class="['status-badge', report.status]">{{ report.status }}</span>
            <time class="report-time">{{ formatDate(report.timestamp.toMillis()) }}</time>
          </div>
          
          <div class="report-body">
            <p><strong>Reporter:</strong> {{ report.reporterName }} (@{{ report.reporterId.slice(0,6) }})</p>
            <p><strong>Targeted User:</strong> {{ report.targetName }} (@{{ report.targetId.slice(0,6) }})</p>
            <p><strong>Report Type:</strong> {{ report.messageId ? 'Specific Message' : 'Chat' }}</p>
            
            <div class="reported-content">
              <label>Reported Content:</label>
              <blockquote>{{ report.content }}</blockquote>
            </div>

            <p v-if="report.reason"><strong>Reason:</strong> {{ report.reason }}</p>
          </div>

          <div class="report-actions" v-if="report.status === 'pending'">
            <button class="action-btn dismiss" @click="handleAction(report, 'dismissed')">Dismiss Report</button>
            <button class="action-btn resolve" @click="handleAction(report, 'resolved')">Mark as Resolved</button>
            <button 
              v-if="report.messageId" 
              class="action-btn delete" 
              @click="handleDeleteMessage(report)"
            >Delete Message & Resolve</button>
            <button 
              v-else 
              class="action-btn delete" 
              @click="handleDeleteChat(report)"
            >Delete Chat & Resolve</button>
          </div>
        </article>
      </div>
    </main>

    <div aria-live="polite" class="sr-only" role="status">{{ announcement }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAppStore } from '../stores/app'
import { getReports, resolveReport, deleteMessage, deleteChat } from '../services/firebase'
import type { Report } from '../services/firebase'

const router = useRouter()
const appStore = useAppStore()
const reports = ref<Report[]>([])
const isLoading = ref(true)
const announcement = ref('')

const isAdmin = computed(() => appStore.currentUserProfile?.role === 'admin')

onMounted(async () => {
  if (isAdmin.value) {
    await fetchReports()
  } else {
    isLoading.value = false
  }
})

async function fetchReports() {
  isLoading.value = true
  try {
    reports.value = await getReports()
  } catch {
    appStore.addNotification('Failed to fetch reports', 'error')
  } finally {
    isLoading.value = false
  }
}

async function handleAction(report: Report, status: 'resolved' | 'dismissed') {
  try {
    await resolveReport(report.id, status)
    report.status = status
    announcement.value = `Report marked as ${status}`
    appStore.addNotification(`Report ${status}`, 'success')
  } catch {
    appStore.addNotification('Failed to update report', 'error')
  }
}

async function handleDeleteMessage(report: Report) {
  if (!report.messageId) return
  if (!confirm('Are you sure you want to delete this message?')) return
  
  try {
    await deleteMessage(report.chatId, report.messageId)
    await resolveReport(report.id, 'resolved')
    report.status = 'resolved'
    announcement.value = 'Message deleted and report resolved'
    appStore.addNotification('Message deleted', 'success')
  } catch {
    appStore.addNotification('Action failed', 'error')
  }
}

async function handleDeleteChat(report: Report) {
  if (!confirm('Are you sure you want to delete this ENTIRE chat? This is a severe action.')) return
  
  try {
    await deleteChat(report.chatId)
    await resolveReport(report.id, 'resolved')
    report.status = 'resolved'
    announcement.value = 'Chat deleted and report resolved'
    appStore.addNotification('Chat deleted', 'success')
  } catch {
    appStore.addNotification('Action failed', 'error')
  }
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString()
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Syne:wght@700&display=swap');

.reports-screen {
  min-height: 100vh;
  background: #060812;
  color: #e2e8f0;
  font-family: 'DM Sans', sans-serif;
  padding: 2rem;
}

.screen-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 2rem;
  max-width: 900px;
  margin-left: auto;
  margin-right: auto;
}

.screen-header h1 {
  font-family: 'Syne', sans-serif;
  font-size: 1.5rem;
  margin: 0;
}

.back-btn {
  background: rgba(255,255,255,0.06);
  border: none;
  border-radius: 10px;
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  color: #fff;
}

.reports-container {
  max-width: 900px;
  margin: 0 auto;
}

.report-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
}
.status-badge.pending { background: rgba(251, 191, 36, 0.2); color: #fbbf24; }
.status-badge.resolved { background: rgba(52, 211, 153, 0.2); color: #34d399; }
.status-badge.dismissed { background: rgba(255, 255, 255, 0.1); color: rgba(255,255,255,0.5); }

.report-time { font-size: 0.85rem; color: rgba(255,255,255,0.3); }

.report-body p { margin: 0.5rem 0; font-size: 0.9rem; }

.reported-content {
  margin: 1rem 0;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  border-left: 3px solid #5c3bff;
}
.reported-content label { font-size: 0.75rem; color: rgba(255,255,255,0.4); display: block; margin-bottom: 0.5rem; }
.reported-content blockquote { margin: 0; font-style: italic; color: #fff; }

.report-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
  flex-wrap: wrap;
}

.action-btn {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: none;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.dismiss { background: rgba(255,255,255,0.1); color: #fff; }
.action-btn.resolve { background: rgba(52, 211, 153, 0.2); color: #34d399; }
.action-btn.delete { background: rgba(255, 59, 140, 0.2); color: #ff6b8a; }

.action-btn:hover { opacity: 0.8; transform: translateY(-1px); }

.access-denied, .loading-state, .empty-state {
  text-align: center;
  padding: 4rem 2rem;
}

.access-denied h2 { color: #ff6b8a; }
.home-link { color: #7c6fff; text-decoration: underline; margin-top: 1rem; display: block; }

.spinner {
  width: 32px; height: 32px;
  border: 4px solid rgba(255,255,255,0.1);
  border-top-color: #5c3bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}
@keyframes spin { to { transform: rotate(360deg); } }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
</style>
