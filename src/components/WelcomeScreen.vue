<template>
  <div class="welcome" id="main-content" tabindex="-1" role="main" aria-label="Loading Soft Connect">
    <div class="welcome-content">
      <div
        class="brand"
        role="img"
        aria-label="Soft Connect"
      >
        <span class="brand-icon" aria-hidden="true">◈</span>
        <span class="brand-name">Soft Connect</span>
      </div>
      <div
        class="spinner"
        aria-hidden="true"
      ></div>
      <p class="loading-text" role="status" aria-live="polite">
        {{ loadingText }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'

const router = useRouter()
const appStore = useAppStore()
const loadingText = ref('Connecting…')

onMounted(() => {
  const check = setInterval(() => {
    if (appStore.isAuthReady) {
      clearInterval(check)
      if (appStore.isAuthenticated) {
        loadingText.value = 'Welcome back!'
        router.replace('/dashboard')
      } else {
        router.replace('/auth')
      }
    }
  }, 50)

  // Update loading text after a second to reassure user
  setTimeout(() => {
    if (!appStore.isAuthReady) {
      loadingText.value = 'Almost ready…'
    }
  }, 1500)
})
</script>

<style scoped>
.welcome {
  min-height: 100vh;
  background: #060812;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.brand-icon {
  font-size: 2rem;
  background: linear-gradient(135deg, #5c3bff, #ff3b8c);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.brand-name {
  font-family: 'Syne', 'DM Sans', sans-serif;
  font-size: 1.5rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.03em;
}

.spinner {
  width: 40px; height: 40px;
  border: 3px solid rgba(92,59,255,0.22);
  border-top-color: #5c3bff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.loading-text {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.875rem;
  color: rgba(255,255,255,0.38);
  margin: 0;
}

@media (prefers-reduced-motion: reduce) {
  .spinner { animation: none; border-color: rgba(92,59,255,0.5); }
}
</style>
