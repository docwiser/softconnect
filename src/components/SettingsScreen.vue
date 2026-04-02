<template>
  <div class="settings-screen">
    <header class="screen-header">
      <button class="back-btn" @click="router.back()">←</button>
      <h1>Settings</h1>
      <button v-if="isDirty" class="save-btn" @click="saveSettings" :disabled="isSaving">
        {{ isSaving ? 'Saving…' : 'Save' }}
      </button>
    </header>

    <div class="settings-body">

      <!-- Profile Photo -->
      <section class="settings-section">
        <h2>Profile Photo</h2>
        <div class="photo-section">
          <div class="current-photo" @click="photoInput?.click()">
            <img v-if="localProfile.photoURL" :src="localProfile.photoURL" alt="Profile photo" />
            <span v-else class="photo-initial">{{ localProfile.displayName?.charAt(0)?.toUpperCase() }}</span>
            <div class="photo-overlay">📷 Change</div>
          </div>
          <input ref="photoInput" type="file" accept="image/*" class="hidden-input" @change="handlePhotoChange" />
          <div class="photo-info">
            <p>Click to upload a new photo</p>
            <p class="hint">JPG, PNG or GIF · Max 5MB</p>
          </div>
        </div>
      </section>

      <!-- Personal Info -->
      <section class="settings-section">
        <h2>Personal Info</h2>
        <div class="fields-grid">
          <div class="field-group">
            <label>Display Name</label>
            <input v-model="localProfile.displayName" type="text" maxlength="50" placeholder="Your name" @input="dirty" />
          </div>
          <div class="field-group">
            <label>Username <span class="label-hint">@</span></label>
            <input v-model="localProfile.username" type="text" maxlength="30" placeholder="unique_handle" @input="dirty" />
            <span v-if="usernameError" class="field-error">{{ usernameError }}</span>
          </div>
          <div class="field-group full">
            <label>Bio</label>
            <textarea v-model="localProfile.bio" maxlength="200" placeholder="Tell others a bit about yourself…" rows="3" @input="dirty"></textarea>
            <span class="char-counter">{{ localProfile.bio?.length || 0 }}/200</span>
          </div>
          <div class="field-group">
            <label>Phone (optional)</label>
            <input v-model="localProfile.phone" type="tel" placeholder="+1 555 000 0000" @input="dirty" />
          </div>
        </div>
      </section>

      <!-- Privacy -->
      <section class="settings-section">
        <h2>Privacy</h2>
        <div class="toggles-list">
          <div class="toggle-row">
            <div class="toggle-info">
              <span class="toggle-label">Profile Visibility</span>
              <span class="toggle-desc">Others can view your full profile</span>
            </div>
            <button
              :class="['toggle', { on: localProfile.settings?.profileVisible }]"
              @click="toggle('profileVisible')"
              :aria-label="`Profile visibility ${localProfile.settings?.profileVisible ? 'on' : 'off'}`"
              role="switch"
              :aria-checked="localProfile.settings?.profileVisible"
            >
              <span class="toggle-knob"></span>
            </button>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span class="toggle-label">Read Receipts</span>
              <span class="toggle-desc">Let others know when you've read messages</span>
            </div>
            <button
              :class="['toggle', { on: localProfile.settings?.readReceipts }]"
              @click="toggle('readReceipts')"
              role="switch"
              :aria-checked="localProfile.settings?.readReceipts"
            >
              <span class="toggle-knob"></span>
            </button>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span class="toggle-label">Show Last Seen</span>
              <span class="toggle-desc">Display when you were last online</span>
            </div>
            <button
              :class="['toggle', { on: localProfile.settings?.showLastSeen }]"
              @click="toggle('showLastSeen')"
              role="switch"
              :aria-checked="localProfile.settings?.showLastSeen"
            >
              <span class="toggle-knob"></span>
            </button>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span class="toggle-label">Show Phone Number</span>
              <span class="toggle-desc">Make your phone visible on your profile</span>
            </div>
            <button
              :class="['toggle', { on: localProfile.settings?.showPhone }]"
              @click="toggle('showPhone')"
              role="switch"
              :aria-checked="localProfile.settings?.showPhone"
            >
              <span class="toggle-knob"></span>
            </button>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span class="toggle-label">Notifications</span>
              <span class="toggle-desc">Enable in-app notifications</span>
            </div>
            <button
              :class="['toggle', { on: localProfile.settings?.notificationsEnabled }]"
              @click="toggle('notificationsEnabled')"
              role="switch"
              :aria-checked="localProfile.settings?.notificationsEnabled"
            >
              <span class="toggle-knob"></span>
            </button>
          </div>
        </div>
      </section>

      <!-- Account -->
      <section class="settings-section">
        <h2>Account</h2>
        <div class="account-actions">
          <button class="account-btn danger" @click="handleLogout">Sign Out</button>
        </div>
      </section>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import {
  auth,
  updateUserProfile,
  uploadProfilePhoto,
  logoutUser
} from '../services/firebase'
import type { UserProfile, UserSettings } from '../services/firebase'

const router = useRouter()
const appStore = useAppStore()

const isSaving = ref(false)
const isDirty = ref(false)
const usernameError = ref('')
const photoInput = ref<HTMLInputElement>()

const localProfile = reactive<Partial<UserProfile & { settings: UserSettings }>>({
  displayName: '',
  username: '',
  bio: '',
  phone: null,
  photoURL: null,
  settings: {
    profileVisible: true,
    readReceipts: true,
    showLastSeen: true,
    showPhone: false,
    notificationsEnabled: true
  }
})

onMounted(() => {
  const p = appStore.currentUserProfile
  if (p) {
    localProfile.displayName = p.displayName
    localProfile.username = p.username
    localProfile.bio = p.bio || ''
    localProfile.phone = p.phone
    localProfile.photoURL = p.photoURL
    localProfile.settings = { ...p.settings }
  }
})

function dirty() { isDirty.value = true; usernameError.value = '' }

function toggle(key: keyof UserSettings) {
  if (localProfile.settings) {
    ;(localProfile.settings as any)[key] = !(localProfile.settings as any)[key]
    isDirty.value = true
  }
}

async function handlePhotoChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !auth.currentUser) return
  if (file.size > 5 * 1024 * 1024) {
    appStore.addNotification('Photo must be under 5MB', 'error')
    return
  }
  try {
    const url = await uploadProfilePhoto(auth.currentUser.uid, file)
    localProfile.photoURL = url
    appStore.addNotification('Photo updated!', 'success')
  } catch {
    appStore.addNotification('Failed to upload photo', 'error')
  }
}

async function saveSettings() {
  if (!auth.currentUser) return
  if (localProfile.username && !/^[a-zA-Z0-9_]{3,30}$/.test(localProfile.username)) {
    usernameError.value = 'Username: 3-30 chars, letters/numbers/underscores only'
    return
  }
  isSaving.value = true
  try {
    await updateUserProfile(auth.currentUser.uid, {
      displayName: localProfile.displayName,
      username: localProfile.username?.toLowerCase(),
      bio: localProfile.bio,
      phone: localProfile.phone || null,
      settings: localProfile.settings as UserSettings
    })
    appStore.addNotification('Settings saved!', 'success')
    isDirty.value = false
  } catch (e: any) {
    appStore.addNotification(e.message || 'Failed to save settings', 'error')
  } finally {
    isSaving.value = false
  }
}

async function handleLogout() {
  await logoutUser()
  router.push('/auth')
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
* { box-sizing: border-box; }

.settings-screen {
  min-height: 100vh;
  background: #070a14;
  font-family: 'DM Sans', sans-serif;
  color: #e2e8f0;
}

.screen-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: rgba(10,12,24,0.9);
  backdrop-filter: blur(20px);
  position: sticky;
  top: 0;
  z-index: 10;
}
.back-btn {
  background: rgba(255,255,255,0.06); border: none; border-radius: 10px;
  width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: rgba(255,255,255,0.7); font-size: 1.1rem; transition: background 0.2s;
}
.back-btn:hover { background: rgba(255,255,255,0.1); }
.screen-header h1 {
  flex: 1;
  font-family: 'Syne', sans-serif; font-size: 1.25rem; font-weight: 700; color: #fff; margin: 0;
}
.save-btn {
  background: linear-gradient(135deg, #5c3bff, #7c3bff);
  border: none; border-radius: 10px; padding: 0.5rem 1.25rem;
  color: #fff; font-family: inherit; font-size: 0.875rem; font-weight: 600; cursor: pointer;
  transition: opacity 0.2s;
}
.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.settings-body {
  max-width: 640px;
  margin: 0 auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.settings-section h2 {
  font-family: 'Syne', sans-serif;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
  margin: 0 0 1rem;
}

.photo-section {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
.current-photo {
  width: 80px; height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #5c3bff40, #ff3b8c40);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 700;
  color: #a78bfa;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  border: 2px solid rgba(92,59,255,0.3);
}
.current-photo img { width: 100%; height: 100%; object-fit: cover; }
.photo-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: #fff;
  opacity: 0;
  transition: opacity 0.2s;
}
.current-photo:hover .photo-overlay { opacity: 1; }
.photo-info p { margin: 0; font-size: 0.85rem; color: rgba(255,255,255,0.55); }
.photo-info .hint { font-size: 0.75rem; color: rgba(255,255,255,0.25); margin-top: 0.25rem; }
.hidden-input { display: none; }

.fields-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.field-group { display: flex; flex-direction: column; gap: 0.375rem; position: relative; }
.field-group.full { grid-column: 1 / -1; }
.field-group label {
  font-size: 0.8rem; font-weight: 500;
  color: rgba(255,255,255,0.5); letter-spacing: 0.04em;
  display: flex; align-items: center; gap: 0.25rem;
}
.label-hint {
  background: rgba(92,59,255,0.3); color: #a78bfa;
  font-size: 0.75rem; padding: 0 4px; border-radius: 4px;
}
.field-group input, .field-group textarea {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; padding: 0.75rem 1rem;
  color: #e2e8f0; font-family: inherit; font-size: 0.9rem; transition: all 0.2s;
}
.field-group input:focus, .field-group textarea:focus {
  outline: none; border-color: rgba(92,59,255,0.5);
  background: rgba(92,59,255,0.05); box-shadow: 0 0 0 3px rgba(92,59,255,0.1);
}
.field-group input::placeholder, .field-group textarea::placeholder { color: rgba(255,255,255,0.2); }
.field-group textarea { resize: vertical; min-height: 80px; }
.char-counter { font-size: 0.7rem; color: rgba(255,255,255,0.25); text-align: right; }
.field-error { font-size: 0.75rem; color: #ff3b8c; }

.toggles-list { display: flex; flex-direction: column; gap: 0; }
.toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);
  gap: 1rem;
}
.toggle-row:last-child { border-bottom: none; }
.toggle-info { flex: 1; min-width: 0; }
.toggle-label { display: block; font-size: 0.9rem; font-weight: 500; color: #e2e8f0; }
.toggle-desc { display: block; font-size: 0.78rem; color: rgba(255,255,255,0.35); margin-top: 2px; }

.toggle {
  width: 48px; height: 26px;
  background: rgba(255,255,255,0.1); border: none; border-radius: 999px;
  cursor: pointer; position: relative; transition: background 0.25s; flex-shrink: 0;
  padding: 0;
}
.toggle.on { background: linear-gradient(135deg, #5c3bff, #7c3bff); }
.toggle-knob {
  position: absolute;
  top: 3px; left: 3px;
  width: 20px; height: 20px;
  background: #fff; border-radius: 50%;
  transition: transform 0.25s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
}
.toggle.on .toggle-knob { transform: translateX(22px); }

.account-actions { display: flex; flex-direction: column; gap: 0.75rem; }
.account-btn {
  width: 100%; padding: 0.875rem;
  border: none; border-radius: 12px;
  font-family: inherit; font-size: 0.95rem; font-weight: 600; cursor: pointer;
  transition: opacity 0.2s;
}
.account-btn.danger {
  background: rgba(255,59,140,0.15); color: #ff3b8c;
  border: 1px solid rgba(255,59,140,0.2);
}
.account-btn.danger:hover { background: rgba(255,59,140,0.25); }

@media (max-width: 500px) {
  .fields-grid { grid-template-columns: 1fr; }
  .photo-section { flex-direction: column; text-align: center; }
}
</style>
