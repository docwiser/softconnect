<template>
  <header class="app-header" role="banner">
    <div class="brand-section">
      <div class="app-brand" role="img" aria-label="Soft Connect">
        <span class="brand-icon" aria-hidden="true">◈</span>
        <span class="brand-name">Soft Connect</span>
      </div>
    </div>

    <MainNavigation />

    <div class="action-buttons">
      <slot name="actions">
        <!-- Default actions if none provided -->
        <button role="button" class="action-btn" @click="router.push('/new-chat')">New Chat</button>
        <button role="button" class="action-btn" @click="showJoinDialog = true">Join Meeting</button>
      </slot>
      
      <div class="more-options-wrap" v-click-outside="() => moreOptionsOpen = false">
        <button
          role="button"
          class="action-btn more-btn"
          @click="moreOptionsOpen = !moreOptionsOpen"
          :aria-expanded="moreOptionsOpen"
        >
          More options <span aria-hidden="true">▼</span>
        </button>
        <div v-if="moreOptionsOpen" class="more-menu" role="menu">
          <button @click="navigate(`/profile/${currentUser?.uid}`)" class="menu-link" role="menuitem">My Profile</button>
          <button @click="navigate('/blocklist')" class="menu-link" role="menuitem">My Blocklist</button>
          <button @click="navigate('/settings')" class="menu-link" role="menuitem">Settings</button>
          <div class="menu-divider" role="separator"></div>
          <button @click="navigate('/about')" class="menu-link" role="menuitem">About</button>
          <button @click="navigate('/help-support')" class="menu-link" role="menuitem">Help & Support</button>
          <button @click="navigate('/privacy-policy')" class="menu-link" role="menuitem">Privacy Policy</button>
          <button @click="navigate('/terms-of-use')" class="menu-link" role="menuitem">Terms of Use</button>
          <button @click="navigate('/ugc-disclosure')" class="menu-link" role="menuitem">UGC Disclosure</button>
          <div class="menu-divider" role="separator"></div>
          <button class="menu-link logout-item" role="menuitem" @click="confirmLogout">Sign Out</button>
        </div>
      </div>
    </div>

    <JoinMeetingDialog :show="showJoinDialog" @close="showJoinDialog = false" />
    
    <!-- Logout Confirmation Modal -->
    <Transition name="modal-fade">
      <div v-if="showLogoutConfirm" class="modal-overlay" @click.self="showLogoutConfirm = false" role="presentation">
        <dialog open class="confirm-dialog" aria-labelledby="logout-title" @keydown.escape="showLogoutConfirm = false">
          <h2 id="logout-title">Sign Out?</h2>
          <p>Are you sure you want to sign out of your account?</p>
          <div class="form-actions-modal">
            <button class="btn-cancel-modal" @click="showLogoutConfirm = false">Cancel</button>
            <button class="btn-logout-modal" @click="handleLogout">Sign Out</button>
          </div>
        </dialog>
      </div>
    </Transition>
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { auth, logoutUser } from '../services/firebase'
import { useAppStore } from '../stores/app'
import MainNavigation from './MainNavigation.vue'
import JoinMeetingDialog from './JoinMeetingDialog.vue'

const router = useRouter()
const appStore = useAppStore()

const currentUser = computed(() => auth.currentUser)
const moreOptionsOpen = ref(false)
const showJoinDialog = ref(false)
const showLogoutConfirm = ref(false)

const vClickOutside = {
  mounted(el: any, binding: any) {
    el.clickOutsideEvent = (event: Event) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value(event)
      }
    }
    document.body.addEventListener('click', el.clickOutsideEvent)
  },
  unmounted(el: any) {
    document.body.removeEventListener('click', el.clickOutsideEvent)
  }
}

function navigate(path: string) {
  moreOptionsOpen.value = false
  router.push(path)
}

function confirmLogout() {
  moreOptionsOpen.value = false
  showLogoutConfirm.value = true
}

async function handleLogout() {
  try {
    await logoutUser()
    router.push('/auth')
  } catch {
    appStore.addNotification('Failed to sign out', 'error')
  }
}
</script>

<style scoped>
.app-header {
  padding: 1.5rem;
  background: rgba(7, 10, 20, 0.9);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  z-index: 100;
}

.brand-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.app-brand { display: flex; align-items: center; gap: 0.5rem; }
.brand-icon { font-size: 1.4rem; background: linear-gradient(135deg, #5c3bff, #ff3b8c); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.brand-name { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.1rem; color: #fff; }

.action-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.action-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  font-family: 'DM Sans', sans-serif;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.more-options-wrap {
  position: relative;
}

.more-menu {
  position: absolute;
  top: 110%;
  left: 0;
  background: #1a1c2e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 100;
  min-width: 180px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
}

.menu-link {
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  padding: 0.6rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  transition: all 0.2s;
  background: none;
  border: none;
  text-align: left;
  width: 100%;
  cursor: pointer;
  font-family: inherit;
}

.menu-link:hover {
  background: rgba(92, 59, 255, 0.15);
  color: #a78bfa;
}

.menu-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0.5rem 0;
}

.logout-item {
  color: #ff6b8a !important;
}

.logout-item:hover {
  background: rgba(255, 59, 138, 0.1) !important;
}

/* Modal / Confirmation Dialog */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1.5rem;
}

.confirm-dialog {
  background: #1a1c2e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 2rem;
  max-width: 400px;
  width: 100%;
  text-align: center;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  color: #fff;
}

.confirm-dialog h2 {
  margin: 0 0 1rem;
  font-family: 'Syne', sans-serif;
  font-size: 1.5rem;
}

.confirm-dialog p {
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 2rem;
}

.form-actions-modal {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.btn-cancel-modal {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 0.75rem 1.5rem;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel-modal:hover {
  background: rgba(255, 255, 255, 0.1);
}

.btn-logout-modal {
  background: #ff3b8c;
  border: none;
  color: #fff;
  padding: 0.75rem 1.5rem;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-logout-modal:hover {
  background: #ff1f7a;
  transform: translateY(-1px);
}

.modal-fade-enter-active, .modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from, .modal-fade-leave-to {
  opacity: 0;
}
</style>
