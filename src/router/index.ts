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
      component: () => import('../components/AuthScreen.vue')
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../components/Dashboard.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/chat/:chatId',
      name: 'chat',
      component: () => import('../components/ChatScreen.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/call/:uid',
      name: 'call',
      component: () => import('../components/CallScreen.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/new-chat',
      name: 'new-chat',
      component: () => import('../components/NewChatScreen.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/profile/:uid?',
      name: 'profile',
      component: () => import('../components/ProfileScreen.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../components/SettingsScreen.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/call-history',
      name: 'call-history',
      component: () => import('../components/CallHistoryScreen.vue'),
      meta: { requiresAuth: true }
    }
  ]
})

router.beforeEach(async (to) => {
  const appStore = useAppStore()

  // Wait for auth to be ready
  if (!appStore.isAuthReady) {
    await new Promise<void>(resolve => {
      const unwatch = setInterval(() => {
        if (appStore.isAuthReady) { clearInterval(unwatch); resolve() }
      }, 50)
    })
  }

  if (to.meta.requiresAuth && !appStore.isAuthenticated) {
    return { name: 'auth' }
  }

  if ((to.name === 'auth' || to.name === 'welcome') && appStore.isAuthenticated) {
    return { name: 'dashboard' }
  }

  // Redirect to active incoming call
  if (to.name !== 'call' && appStore.callState.isIncoming) {
    return { name: 'call', params: { uid: appStore.callState.peerId } }
  }

  return true
})

export default router
