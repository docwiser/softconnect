// src/composables/useAuth.ts
import { onMounted, onUnmounted } from 'vue'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, listenToUserProfile, listenToUserChats, updateUserProfile, Timestamp } from '../services/firebase'
import { useAppStore } from '../stores/app'
import { usePeerStore } from '../stores/peer'

let unsubscribeProfile: (() => void) | null = null
let unsubscribeChats: (() => void) | null = null
let authUnsubscribe: (() => void) | null = null
let initialized = false

export function useAuth() {
  const appStore = useAppStore()
  const peerStore = usePeerStore()

  function init() {
    if (initialized) return
    initialized = true

    authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Set online
        try {
          await updateUserProfile(firebaseUser.uid, {
            isOnline: true,
            lastSeen: Timestamp.now()
          })
        } catch (e) { console.warn('Could not set online status') }

        // Subscribe to profile
        unsubscribeProfile = listenToUserProfile(firebaseUser.uid, (profile) => {
          if (profile) appStore.setUserProfile(profile)
        })

        // Subscribe to chats
        unsubscribeChats = listenToUserChats(firebaseUser.uid, (chats) => {
          appStore.setChats(chats)
        })

        // Initialize PeerJS
        try {
          await peerStore.initializePeer(firebaseUser.uid)
        } catch (e) { console.warn('PeerJS init failed:', e) }

      } else {
        // Cleanup
        unsubscribeProfile?.()
        unsubscribeChats?.()
        unsubscribeProfile = null
        unsubscribeChats = null
        appStore.setUserProfile(null)
        appStore.setChats([])
      }

      appStore.setAuthReady(true)
    })

    // Handle page unload — set offline
    window.addEventListener('beforeunload', async () => {
      const uid = auth.currentUser?.uid
      if (uid) {
        try {
          await updateUserProfile(uid, { isOnline: false, lastSeen: Timestamp.now() })
        } catch (e) {}
      }
    })
  }

  return { init }
}
