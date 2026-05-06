<template>
  <div class="nav-tabs" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.path"
      role="tab"
      :aria-selected="currentRouteName === tab.name"
      :class="['tab-item', { active: currentRouteName === tab.name }]"
      @click="router.push(tab.path)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const currentRouteName = computed(() => route.name)

const tabs = [
  { label: 'Chats', name: 'dashboard', path: '/dashboard' },
  { label: 'Meetings', name: 'meetings', path: '/meetings' },
  { label: 'Call History', name: 'call-history', path: '/call-history' }
]
</script>

<style scoped>
.nav-tabs {
  display: flex;
  gap: 2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tab-item {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  padding: 0.75rem 0;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
  font-family: 'DM Sans', sans-serif;
}

.tab-item.active {
  color: #a78bfa;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 3px;
  background: #a78bfa;
  border-radius: 3px 3px 0 0;
}

@media (max-width: 600px) {
  .nav-tabs {
    gap: 1rem;
  }
  .tab-item {
    font-size: 0.9rem;
  }
}
</style>
