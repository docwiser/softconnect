<template>
  <div id="app">

    <!-- Global incoming call banner (shows on any screen except /call) -->
    <Transition name="call-banner">
      <div
        v-if="showCallBanner"
        class="global-call-banner"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        aria-label="Active call notification"
      >
        <div class="banner-pulse" aria-hidden="true"></div>
        <div class="banner-info">
          <span class="banner-avatar" aria-hidden="true">
            <img v-if="callState.peerPhoto" :src="callState.peerPhoto" :alt="callState.peerName" />
            <span v-else>{{ callState.peerName.charAt(0).toUpperCase() }}</span>
          </span>
          <div class="banner-text">
            <strong>{{ callState.peerName }}</strong>
            <span>{{ callState.isIncoming ? 'Incoming call' : 'Call in progress' }}</span>
          </div>
        </div>
        <RouterLink
          :to="`/call/${callState.peerId}`"
          class="banner-return-btn"
          :aria-label="callState.isIncoming ? `Answer call from ${callState.peerName}` : `Return to call with ${callState.peerName}`"
        >
          {{ callState.isIncoming ? 'Answer' : 'Return' }}
        </RouterLink>
      </div>
    </Transition>

    <!-- Main content — RouterView renders each page's own semantic structure -->
    <RouterView id="main-content" />

    <!-- Toast Notifications -->
    <div
      class="toast-stack"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      aria-atomic="false"
    >
      <Transition
        v-for="notif in notifications"
        :key="notif.id"
        name="toast"
      >
        <div
          :class="['toast', `toast-${notif.type}`]"
          role="status"
          :aria-label="`${notif.type} notification: ${notif.message}`"
        >
          <span class="toast-icon" aria-hidden="true">{{ toastIcon(notif.type) }}</span>
          <span class="toast-msg">{{ notif.message }}</span>
        </div>
      </Transition>
    </div>

    <!-- Route Announcer for screen readers -->
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class="route-announcer"
    >{{ routeAnnouncement }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { useAppStore } from './stores/app'
import { useAuth } from './composables/useAuth'
import { handleRedirectResult, completeMagicLinkSignIn } from './services/firebase'
import { useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const { init } = useAuth()

const notifications = computed(() => appStore.notifications)
const callState = computed(() => appStore.callState)
const routeAnnouncement = computed(() => appStore.routeAnnouncement)

const showCallBanner = computed(() => {
  const hasCall = callState.value.isActive || callState.value.isIncoming
  const notOnCallScreen = route.name !== 'call'
  return hasCall && notOnCallScreen
})

watch(() => route.name, (newName) => {
  const routeNames: Record<string, string> = {
    'welcome': 'Loading…',
    'auth': 'Sign in page',
    'dashboard': 'Messages — Dashboard',
    'chat': 'Chat conversation',
    'call': 'Active call',
    'new-chat': 'New conversation',
    'profile': 'User profile',
    'settings': 'Settings',
    'call-history': 'Call history',
  }
  const label = routeNames[newName as string] || String(newName)
  appStore.announceRoute(`Navigated to: ${label}`)
})

function toastIcon(type: string): string {
  const icons: Record<string, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  }
  return icons[type] || 'ℹ'
}

onMounted(async () => {
  init()
  
  // Handle Google Redirects
  try {
    const user = await handleRedirectResult()
    if (user) {
      appStore.addNotification('Signed in with Google!', 'success')
      router.push('/dashboard')
    }
  } catch (e: any) {
    console.error('Google redirect result error:', e)
    appStore.addNotification('Google sign-in failed', 'error')
  }

  // Handle Magic Link Redirects
  try {
    const user = await completeMagicLinkSignIn()
    if (user) {
      appStore.addNotification('Signed in via Magic Link!', 'success')
      router.push('/dashboard')
    }
  } catch (e: any) {
    appStore.addNotification('Magic link sign-in failed', 'error')
  }
})
</script>

<style>
/* ── Global Reset ────────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html {
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  color-scheme: dark;
}

body {
  background: #060812;
  color: #e2e8f0;
  min-height: 100vh;
  overflow-x: hidden;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

/* Focus ring - WCAG 2.1 AAA: 3:1 contrast ratio minimum */
*:focus-visible {
  outline: 3px solid #7c6fff;
  outline-offset: 3px;
  border-radius: 4px;
}

button, input, textarea, select {
  font-family: inherit;
  font-size: inherit;
  color: inherit;
}

a { color: inherit; text-decoration: none; }

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* High contrast mode support */
@media (forced-colors: active) {
  *:focus-visible {
    outline: 3px solid ButtonText;
  }
}
</style>

<style scoped>
#app {
  position: relative;
  min-height: 100vh;
}

/* ── Skip Link ────────────────────────────────────────────────────────────────── */
.skip-link {
  position: absolute;
  top: -100%;
  left: 0.5rem;
  background: #5c3bff;
  color: #fff;
  padding: 0.625rem 1.25rem;
  border-radius: 0 0 8px 8px;
  font-size: 0.9rem;
  font-weight: 700;
  z-index: 99999;
  transition: top 0.2s;
  text-decoration: none;
}
.skip-link:focus {
  top: 0;
  outline: 3px solid #fff;
  outline-offset: 2px;
}

/* ── Call Banner ─────────────────────────────────────────────────────────────── */
.global-call-banner {
  position: fixed;
  top: 0; left: 0; right: 0;
  background: rgba(10, 8, 30, 0.96);
  border-bottom: 2px solid rgba(92,59,255,0.6);
  backdrop-filter: blur(20px);
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  z-index: 9999;
  box-shadow: 0 2px 20px rgba(92,59,255,0.2);
}

.banner-pulse {
  width: 8px; height: 8px;
  background: #5c3bff;
  border-radius: 50%;
  flex-shrink: 0;
  animation: bannerPulse 1.5s ease-in-out infinite;
}
@keyframes bannerPulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(92,59,255,0.5); }
  50% { opacity: 0.7; box-shadow: 0 0 0 6px rgba(92,59,255,0); }
}

.banner-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}

.banner-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #5c3bff, #ff3b8c);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  font-weight: 700;
  color: #fff;
  overflow: hidden;
  flex-shrink: 0;
}
.banner-avatar img { width: 100%; height: 100%; object-fit: cover; }

.banner-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.banner-text strong {
  font-size: 0.9rem;
  color: #fff;
  font-weight: 600;
}
.banner-text span {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.55);
}

.banner-return-btn {
  background: linear-gradient(135deg, #5c3bff, #7c3bff);
  color: #fff;
  padding: 0.5rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 700;
  transition: opacity 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
  text-decoration: none;
  min-height: 44px;
  display: flex;
  align-items: center;
}
.banner-return-btn:hover { opacity: 0.85; }
.banner-return-btn:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 2px;
}

.call-banner-enter-active, .call-banner-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.call-banner-enter-from, .call-banner-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

/* ── Toast Stack ─────────────────────────────────────────────────────────────── */
.toast-stack {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 10000;
  pointer-events: none;
  max-width: 420px;
  width: 90vw;
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  border-radius: 12px;
  backdrop-filter: blur(20px);
  box-shadow: 0 4px 24px rgba(0,0,0,0.4);
  font-size: 0.875rem;
  font-weight: 500;
  pointer-events: auto;
}

.toast-info {
  background: rgba(92, 59, 255, 0.9);
  border: 1px solid rgba(92,59,255,0.6);
  color: #fff;
}
.toast-success {
  background: rgba(20, 83, 45, 0.95);
  border: 1px solid rgba(52,211,153,0.5);
  color: #86efac;
}
.toast-error {
  background: rgba(127, 29, 29, 0.95);
  border: 1px solid rgba(255,59,92,0.5);
  color: #fca5a5;
}
.toast-warning {
  background: rgba(120, 80, 0, 0.95);
  border: 1px solid rgba(251,191,36,0.5);
  color: #fde68a;
}

.toast-icon {
  font-size: 1rem;
  font-weight: 700;
  flex-shrink: 0;
}
.toast-msg { flex: 1; line-height: 1.4; }

.toast-enter-active, .toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

/* ── Route Announcer (visually hidden, accessible) ────────────────────────── */
.route-announcer {
  position: absolute;
  width: 1px; height: 1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
  border: 0;
  left: -9999px;
}
</style>
