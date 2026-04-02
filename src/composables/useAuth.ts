// src/composables/useAuth.ts
import { onUnmounted } from 'vue'
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
        // Set user online in Firestore
        try {
          await updateUserProfile(firebaseUser.uid, {
            isOnline: true,
            lastSeen: Timestamp.now()
          })
        } catch (e) { console.warn('Could not set online status') }

        // Listen to profile changes in real-time
        unsubscribeProfile = listenToUserProfile(firebaseUser.uid, (profile) => {
          if (profile) appStore.setUserProfile(profile)
        })

        // Listen to chats in real-time
        unsubscribeChats = listenToUserChats(firebaseUser.uid, (chats) => {
          appStore.setChats(chats)
        })

        // Initialize PeerJS immediately on login/account creation
        // Keep retrying if it fails
        let peerInitAttempts = 0
        const maxAttempts = 3
        const tryInitPeer = async () => {
          try {
            await peerStore.initializePeer(firebaseUser.uid)
            console.info('[PeerJS] Connected as sc_' + firebaseUser.uid)
          } catch (e) {
            peerInitAttempts++
            console.warn(`[PeerJS] Init attempt ${peerInitAttempts} failed:`, e)
            if (peerInitAttempts < maxAttempts) {
              setTimeout(tryInitPeer, 3000 * peerInitAttempts)
            } else {
              console.error('[PeerJS] Could not initialize after', maxAttempts, 'attempts')
            }
          }
        }
        await tryInitPeer()

      } else {
        // User signed out — cleanup
        unsubscribeProfile?.()
        unsubscribeChats?.()
        unsubscribeProfile = null
        unsubscribeChats = null
        appStore.setUserProfile(null)
        appStore.setChats([])

        // Destroy peer connection
        if (peerStore.peer && !peerStore.peer.destroyed) {
          peerStore.peer.destroy()
        }
      }

      appStore.setAuthReady(true)
    })

    // Set offline on page unload
    window.addEventListener('beforeunload', () => {
      const uid = auth.currentUser?.uid
      if (uid) {
        // Use beacon for reliability
        try {
          updateUserProfile(uid, { isOnline: false, lastSeen: Timestamp.now() })
        } catch {}
      }
    })

    // Handle visibility change — reconnect peer when tab becomes visible
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const uid = auth.currentUser?.uid
        if (uid && peerStore.peer?.disconnected) {
          peerStore.peer.reconnect()
        }
      }
    })
  }

  return { init }
}
