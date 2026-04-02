// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { useAppStore } from '../stores/app'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'welcome',
      component: () => import('../components/WelcomeScreen.vue')
    },
    {
      path: '/auth',
      name: 'auth',
      component: () => import('../components/AuthScreen.vue'),
      meta: { title: 'Sign In — Soft Connect' }
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../components/Dashboard.vue'),
      meta: { requiresAuth: true, title: 'Messages — Soft Connect' }
    },
    {
      path: '/chat/:chatId',
      name: 'chat',
      component: () => import('../components/ChatScreen.vue'),
      meta: { requiresAuth: true, title: 'Chat — Soft Connect' }
    },
    {
      path: '/call/:uid',
      name: 'call',
      component: () => import('../components/CallScreen.vue'),
      meta: { requiresAuth: true, title: 'Call — Soft Connect' }
    },
    {
      path: '/new-chat',
      name: 'new-chat',
      component: () => import('../components/NewChatScreen.vue'),
      meta: { requiresAuth: true, title: 'New Conversation — Soft Connect' }
    },
    {
      path: '/profile/:uid?',
      name: 'profile',
      component: () => import('../components/ProfileScreen.vue'),
      meta: { requiresAuth: true, title: 'Profile — Soft Connect' }
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../components/SettingsScreen.vue'),
      meta: { requiresAuth: true, title: 'Settings — Soft Connect' }
    },
    {
      path: '/call-history',
      name: 'call-history',
      component: () => import('../components/CallHistoryScreen.vue'),
      meta: { requiresAuth: true, title: 'Call History — Soft Connect' }
    }
  ]
})

// Wait helper
async function waitForAuth(): Promise<void> {
  const appStore = useAppStore()
  if (appStore.isAuthReady) return
  return new Promise<void>(resolve => {
    const id = setInterval(() => {
      if (appStore.isAuthReady) { clearInterval(id); resolve() }
    }, 50)
  })
}

router.beforeEach(async (to) => {
  const appStore = useAppStore()

  // Wait for Firebase Auth state
  await waitForAuth()

  // Auth guard
  if (to.meta.requiresAuth && !appStore.isAuthenticated) {
    return { name: 'auth', query: { redirect: to.fullPath } }
  }

  // Redirect authenticated users away from auth/welcome
  if ((to.name === 'auth' || to.name === 'welcome') && appStore.isAuthenticated) {
    return { name: 'dashboard' }
  }

  // Redirect to active incoming call (except when already going to call)
  if (to.name !== 'call' && appStore.callState.isIncoming && appStore.callState.peerId) {
    return { name: 'call', params: { uid: appStore.callState.peerId } }
  }

  return true
})

// Update document title and announce route to screen readers after each navigation
router.afterEach((to) => {
  // Update page title
  const title = to.meta.title as string | undefined
  if (title) document.title = title

  // Announce to screen readers via app store
  try {
    const appStore = useAppStore()
    const routeNames: Record<string, string> = {
      'welcome': 'Loading',
      'auth': 'Sign in page',
      'dashboard': 'Messages dashboard',
      'chat': 'Chat',
      'call': 'Call screen',
      'new-chat': 'New conversation',
      'profile': 'User profile',
      'settings': 'Settings',
      'call-history': 'Call history',
    }
    const name = to.name as string
    const label = routeNames[name] || name
    appStore.announceRoute(`Page: ${label}`)
  } catch {}
})

export default router
