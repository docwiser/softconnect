// src/stores/app.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserProfile, Chat, CallRecord } from '../services/firebase'
import type { LocalCallState } from '../types'

export const useAppStore = defineStore('app', () => {
  // ─── Auth State ─────────────────────────────────────────────────────────────
  const currentUserProfile = ref<UserProfile | null>(null)
  const isAuthReady = ref(false)
  const isAuthenticated = ref(false)

  // ─── Chat State ─────────────────────────────────────────────────────────────
  const chats = ref<(Chat & { id: string })[]>([])
  const activeChatId = ref<string | null>(null)
  const activeMessages = ref<any[]>([])

  // ─── Call State ─────────────────────────────────────────────────────────────
  const callState = ref<LocalCallState>({
    isActive: false,
    isIncoming: false,
    isOutgoing: false,
    peerId: '',
    peerName: '',
    peerPhoto: null,
    peerConnectionId: '',
    isAudioEnabled: true,
    isVideoEnabled: false,
    isMuted: false,
    isOnHold: false,
    playbackSpeed: 1.0
  })

  const callHistory = ref<CallRecord[]>([])

  // ─── UI State ───────────────────────────────────────────────────────────────
  const notifications = ref<{ id: string; message: string; type: 'info' | 'success' | 'error' | 'warning' }[]>([])
  const availableAudioInputs = ref<MediaDeviceInfo[]>([])
  const availableAudioOutputs = ref<MediaDeviceInfo[]>([])
  const availableVideoInputs = ref<MediaDeviceInfo[]>([])

  // ─── Route Announcer ────────────────────────────────────────────────────────
  const routeAnnouncement = ref('')

  // ─── Computed ────────────────────────────────────────────────────────────────
  const activeChatData = computed(() => {
    if (!activeChatId.value) return null
    return chats.value.find(c => c.id === activeChatId.value) || null
  })

  const sortedChats = computed(() => {
    return [...chats.value].sort((a, b) => {
      const aTime = a.updatedAt?.toMillis() || 0
      const bTime = b.updatedAt?.toMillis() || 0
      return bTime - aTime
    })
  })

  const myBlockedUsers = computed(() => currentUserProfile.value?.blockedUsers || [])

  // ─── Actions ─────────────────────────────────────────────────────────────────
  function setUserProfile(profile: UserProfile | null) {
    currentUserProfile.value = profile
    isAuthenticated.value = !!profile
  }

  function setAuthReady(ready: boolean) {
    isAuthReady.value = ready
  }

  function setChats(newChats: (Chat & { id: string })[]) {
    chats.value = newChats
  }

  function setActiveChatId(chatId: string | null) {
    activeChatId.value = chatId
  }

  function setActiveMessages(messages: any[]) {
    activeMessages.value = messages
  }

  function updateCallState(updates: Partial<LocalCallState>) {
    Object.assign(callState.value, updates)
  }

  function resetCallState() {
    callState.value = {
      isActive: false,
      isIncoming: false,
      isOutgoing: false,
      peerId: '',
      peerName: '',
      peerPhoto: null,
      peerConnectionId: '',
      isAudioEnabled: true,
      isVideoEnabled: false,
      isMuted: false,
      isOnHold: false,
      playbackSpeed: 1.0
    }
  }

  function setCallHistory(history: CallRecord[]) {
    callHistory.value = history
  }

  function addNotification(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
    const id = Date.now().toString()
    notifications.value.push({ id, message, type })
    setTimeout(() => {
      notifications.value = notifications.value.filter(n => n.id !== id)
    }, 5000)
  }

  function updateUserSettings(settings: Partial<NonNullable<typeof currentUserProfile.value>['settings']>) {
    if (currentUserProfile.value) {
      currentUserProfile.value.settings = {
        ...currentUserProfile.value.settings,
        ...settings
      }
    }
  }

  function announceRoute(message: string) {
    routeAnnouncement.value = ''
    // Use nextTick-like delay to ensure screen reader re-reads
    setTimeout(() => {
      routeAnnouncement.value = message
    }, 50)
  }

  return {
    // State
    currentUserProfile,
    isAuthReady,
    isAuthenticated,
    chats,
    activeChatId,
    activeMessages,
    callState,
    callHistory,
    notifications,
    availableAudioInputs,
    availableAudioOutputs,
    availableVideoInputs,
    routeAnnouncement,
    // Computed
    activeChatData,
    sortedChats,
    myBlockedUsers,
    // Actions
    setUserProfile,
    setAuthReady,
    setChats,
    setActiveChatId,
    setActiveMessages,
    updateCallState,
    resetCallState,
    setCallHistory,
    addNotification,
    updateUserSettings,
    announceRoute
  }
})
