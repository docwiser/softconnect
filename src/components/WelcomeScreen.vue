<!-- WelcomeScreen.vue - redirect to auth -->
<template>
  <div class="welcome">
    <div class="spinner"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'

const router = useRouter()
const appStore = useAppStore()

onMounted(() => {
  // Auth composable handles redirect; just show loader
  const check = setInterval(() => {
    if (appStore.isAuthReady) {
      clearInterval(check)
      if (appStore.isAuthenticated) router.replace('/dashboard')
      else router.replace('/auth')
    }
  }, 50)
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
.spinner {
  width: 40px; height: 40px;
  border: 3px solid rgba(92,59,255,0.2);
  border-top-color: #5c3bff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
