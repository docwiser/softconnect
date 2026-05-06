<template>
  <div class="settings-screen" id="main-content" tabindex="-1">
    <SubPageHeader title="Settings">
      <template #actions>
        <button
          v-if="isDirty"
          class="save-btn"
          @click="saveSettings"
          :disabled="isSaving"
          :aria-busy="isSaving"
          :aria-label="isSaving ? 'Saving settings…' : 'Save settings'"
        >
          {{ isSaving ? 'Saving…' : 'Save' }}
        </button>
      </template>
    </SubPageHeader>

    <main class="settings-body" aria-label="Settings">

      <!-- Profile Photo -->
      <section class="settings-section" aria-labelledby="section-photo">
        <h2 id="section-photo">Profile Photo</h2>
        <div class="photo-section">
          <button
            class="current-photo"
            @click="photoInput?.click()"
            :aria-label="localProfile.photoURL ? 'Change your profile photo' : 'Upload a profile photo'"
            type="button"
          >
            <img v-if="localProfile.photoURL" :src="localProfile.photoURL" alt="Your current profile photo" />
            <span v-else class="photo-initial" aria-hidden="true">{{ localProfile.displayName?.charAt(0)?.toUpperCase() }}</span>
            <div class="photo-overlay" aria-hidden="true">📷 Change</div>
          </button>
          <input
            ref="photoInput"
            type="file"
            accept="image/*"
            class="hidden-input"
            aria-label="Upload profile photo file"
            @change="handlePhotoChange"
          />
          <div class="photo-info" aria-live="polite">
            <p>Click to upload a new photo</p>
            <p class="hint">JPG, PNG or GIF · Max 5MB</p>
          </div>
        </div>
      </section>

      <!-- Personal Info -->
      <section class="settings-section" aria-labelledby="section-personal">
        <h2 id="section-personal">Personal Info</h2>
        <fieldset class="fields-grid">
          <legend class="sr-only">Personal information fields</legend>
          <div class="field-group">
            <label for="settings-name">
              Display Name
              <span class="required-indicator" aria-label="required">*</span>
            </label>
            <input
              id="settings-name"
              v-model="localProfile.displayName"
              type="text"
              maxlength="50"
              placeholder="Your name"
              autocomplete="name"
              @input="dirty"
              aria-describedby="name-count"
            />
            <span id="name-count" class="char-counter-inline">{{ localProfile.displayName?.length || 0 }}/50</span>
          </div>
          <div class="field-group">
            <label for="settings-username">
              Username
              <span class="label-hint" aria-label="username prefix">@</span>
              <span class="required-indicator" aria-label="required">*</span>
            </label>
            <input
              id="settings-username"
              v-model="localProfile.username"
              type="text"
              maxlength="30"
              placeholder="unique_handle"
              autocomplete="username"
              @input="dirty"
              :aria-invalid="!!usernameError"
              :aria-describedby="usernameError ? 'username-error' : 'username-hint'"
            />
            <span id="username-hint" class="field-hint-text">3–30 chars, letters, numbers, underscores</span>
            <span v-if="usernameError" id="username-error" class="field-error" role="alert">{{ usernameError }}</span>
          </div>
          <div class="field-group full">
            <label for="settings-bio">Bio <span class="optional-label">(optional)</span></label>
            <textarea
              id="settings-bio"
              v-model="localProfile.bio"
              maxlength="200"
              placeholder="Tell others a bit about yourself…"
              rows="3"
              @input="dirty"
              aria-describedby="bio-count"
            ></textarea>
            <span id="bio-count" class="char-counter" aria-live="polite" :aria-label="`${localProfile.bio?.length || 0} of 200 characters used`">
              {{ localProfile.bio?.length || 0 }}/200
            </span>
          </div>
          <div class="field-group">
            <label for="settings-phone">Phone <span class="optional-label">(optional)</span></label>
            <input
              id="settings-phone"
              v-model="localProfile.phone"
              type="tel"
              placeholder="+1 555 000 0000"
              autocomplete="tel"
              aria-describedby="phone-hint"
              @input="dirty"
            />
            <span id="phone-hint" class="field-hint-text">Only shown if you enable "Show Phone Number" below</span>
          </div>
        </fieldset>
      </section>

      <!-- Privacy -->
      <section class="settings-section" aria-labelledby="section-privacy">
        <h2 id="section-privacy">Privacy</h2>
        <div class="toggles-list" role="group" aria-labelledby="section-privacy">
          <div class="toggle-row">
            <div class="toggle-info">
              <label class="toggle-label" for="toggle-profile-visible">Profile Visibility</label>
              <span class="toggle-desc" id="toggle-profile-visible-desc">Others can view your full profile</span>
            </div>
            <button
              id="toggle-profile-visible"
              :class="['toggle', { on: localProfile.settings?.profileVisible }]"
              @click="toggle('profileVisible')"
              role="switch"
              :aria-checked="localProfile.settings?.profileVisible"
              :aria-describedby="'toggle-profile-visible-desc'"
              :aria-label="`Profile visibility: ${localProfile.settings?.profileVisible ? 'on' : 'off'}`"
            >
              <span class="toggle-knob"></span>
            </button>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <label class="toggle-label" for="toggle-read-receipts">Read Receipts</label>
              <span class="toggle-desc" id="toggle-read-receipts-desc">Let others know when you've read messages</span>
            </div>
            <button
              id="toggle-read-receipts"
              :class="['toggle', { on: localProfile.settings?.readReceipts }]"
              @click="toggle('readReceipts')"
              role="switch"
              :aria-checked="localProfile.settings?.readReceipts"
              :aria-describedby="'toggle-read-receipts-desc'"
              :aria-label="`Read receipts: ${localProfile.settings?.readReceipts ? 'on' : 'off'}`"
            >
              <span class="toggle-knob"></span>
            </button>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <label class="toggle-label" for="toggle-last-seen">Show Last Seen</label>
              <span class="toggle-desc" id="toggle-last-seen-desc">Display when you were last online</span>
            </div>
            <button
              id="toggle-last-seen"
              :class="['toggle', { on: localProfile.settings?.showLastSeen }]"
              @click="toggle('showLastSeen')"
              role="switch"
              :aria-checked="localProfile.settings?.showLastSeen"
              :aria-describedby="'toggle-last-seen-desc'"
              :aria-label="`Show last seen: ${localProfile.settings?.showLastSeen ? 'on' : 'off'}`"
            >
              <span class="toggle-knob"></span>
            </button>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <label class="toggle-label" for="toggle-show-phone">Show Phone Number</label>
              <span class="toggle-desc" id="toggle-show-phone-desc">Make your phone visible on your profile</span>
            </div>
            <button
              id="toggle-show-phone"
              :class="['toggle', { on: localProfile.settings?.showPhone }]"
              @click="toggle('showPhone')"
              role="switch"
              :aria-checked="localProfile.settings?.showPhone"
              :aria-describedby="'toggle-show-phone-desc'"
              :aria-label="`Show phone number: ${localProfile.settings?.showPhone ? 'on' : 'off'}`"
            >
              <span class="toggle-knob"></span>
            </button>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <label class="toggle-label" for="toggle-notifications">Notifications</label>
              <span class="toggle-desc" id="toggle-notifications-desc">Enable in-app notifications</span>
            </div>
            <button
              id="toggle-notifications"
              :class="['toggle', { on: localProfile.settings?.notificationsEnabled }]"
              @click="toggle('notificationsEnabled')"
              role="switch"
              :aria-checked="localProfile.settings?.notificationsEnabled"
              :aria-describedby="'toggle-notifications-desc'"
              :aria-label="`Notifications: ${localProfile.settings?.notificationsEnabled ? 'on' : 'off'}`"
            >
              <span class="toggle-knob"></span>
            </button>
          </div>
        </div>
      </section>

      <!-- Account -->
      <section class="settings-section" aria-labelledby="section-account">
        <h2 id="section-account">Account</h2>
        <div class="account-actions">
          <button
            class="account-btn danger"
            @click="handleLogout"
            aria-label="Sign out of your account"
          >Sign Out</button>
        </div>
      </section>

    </main>

    <!-- Save status announcements -->
    <div aria-live="polite" aria-atomic="true" class="sr-only" role="status">{{ saveAnnouncement }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import SubPageHeader from './SubPageHeader.vue'
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
const saveAnnouncement = ref('')

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
    const newVal = !(localProfile.settings as any)[key]
    ;(localProfile.settings as any)[key] = newVal
    isDirty.value = true
    const labels: Record<string, string> = {
      profileVisible: 'Profile visibility',
      readReceipts: 'Read receipts',
      showLastSeen: 'Show last seen',
      showPhone: 'Show phone number',
      notificationsEnabled: 'Notifications'
    }
    saveAnnouncement.value = `${labels[key] || key} turned ${newVal ? 'on' : 'off'}`
  }
}

async function handlePhotoChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !auth.currentUser) return
  if (file.size > 5 * 1024 * 1024) {
    appStore.addNotification('Photo must be under 5MB', 'error')
    saveAnnouncement.value = 'Photo upload failed: file too large'
    return
  }
  try {
    const url = await uploadProfilePhoto(auth.currentUser.uid, file)
    localProfile.photoURL = url
    appStore.addNotification('Photo updated!', 'success')
    saveAnnouncement.value = 'Profile photo updated successfully'
  } catch {
    appStore.addNotification('Failed to upload photo', 'error')
    saveAnnouncement.value = 'Photo upload failed'
  }
}

async function saveSettings() {
  if (!auth.currentUser) return
  if (localProfile.username && !/^[a-zA-Z0-9_]{3,30}$/.test(localProfile.username)) {
    usernameError.value = 'Username: 3-30 chars, letters/numbers/underscores only'
    saveAnnouncement.value = `Error: ${usernameError.value}`
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
    saveAnnouncement.value = 'Settings saved successfully'
    isDirty.value = false
  } catch (e: any) {
    appStore.addNotification(e.message || 'Failed to save settings', 'error')
    saveAnnouncement.value = `Failed to save: ${e.message || 'Unknown error'}`
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
  border-bottom: 1px solid rgba(255,255,255,0.07);
  background: rgba(10,12,24,0.92);
  backdrop-filter: blur(20px);
  position: sticky;
  top: 0;
  z-index: 10;
}
.back-btn {
  background: rgba(255,255,255,0.07); border: none; border-radius: 10px;
  width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: rgba(255,255,255,0.72); font-size: 1.1rem; transition: background 0.2s;
}
.back-btn:hover { background: rgba(255,255,255,0.12); }
.back-btn:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }

.screen-header h1 {
  flex: 1;
  font-family: 'Syne', sans-serif; font-size: 1.25rem; font-weight: 700; color: #fff; margin: 0;
}
.save-btn {
  background: linear-gradient(135deg, #5c3bff, #7c3bff);
  border: none; border-radius: 10px; padding: 0.5rem 1.25rem;
  color: #fff; font-family: inherit; font-size: 0.875rem; font-weight: 700; cursor: pointer;
  transition: opacity 0.2s; min-height: 40px;
}
.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.save-btn:focus-visible { outline: 3px solid #a78bfa; outline-offset: 2px; }

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
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.38);
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
  border: 2px solid rgba(92,59,255,0.35);
}
.current-photo img { width: 100%; height: 100%; object-fit: cover; }
.photo-overlay {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.65);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.72rem; font-weight: 700; color: #fff;
  opacity: 0; transition: opacity 0.2s;
}
.current-photo:hover .photo-overlay,
.current-photo:focus-visible .photo-overlay { opacity: 1; }
.current-photo:focus-visible { outline: 3px solid #7c6fff; outline-offset: 3px; }
.photo-info p { margin: 0; font-size: 0.85rem; color: rgba(255,255,255,0.57); }
.photo-info .hint { font-size: 0.75rem; color: rgba(255,255,255,0.27); margin-top: 0.25rem; }
.hidden-input { display: none; }

.fields-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  border: none;
  padding: 0;
  margin: 0;
}
.field-group { display: flex; flex-direction: column; gap: 0.375rem; position: relative; }
.field-group.full { grid-column: 1 / -1; }

.field-group label {
  font-size: 0.82rem; font-weight: 600;
  color: rgba(255,255,255,0.62); letter-spacing: 0.04em;
  display: flex; align-items: center; gap: 0.25rem;
}

.required-indicator { color: #ff6b8a; font-weight: 700; margin-left: 2px; }
.optional-label { color: rgba(255,255,255,0.35); font-weight: 400; font-size: 0.78rem; }

.label-hint {
  background: rgba(92,59,255,0.3); color: #a78bfa;
  font-size: 0.75rem; padding: 0 4px; border-radius: 4px;
}
.field-hint-text {
  font-size: 0.72rem; color: rgba(255,255,255,0.35); line-height: 1.3;
}

.field-group input, .field-group textarea {
  background: rgba(255,255,255,0.06); border: 1.5px solid rgba(255,255,255,0.09);
  border-radius: 10px; padding: 0.75rem 1rem;
  color: #e2e8f0; font-family: inherit; font-size: 0.9rem; transition: all 0.2s;
  min-height: 48px;
}
.field-group input:focus, .field-group textarea:focus {
  outline: none; border-color: rgba(92,59,255,0.6);
  background: rgba(92,59,255,0.06); box-shadow: 0 0 0 3px rgba(92,59,255,0.12);
}
.field-group input[aria-invalid="true"] { border-color: #ff6b8a; }
.field-group input::placeholder, .field-group textarea::placeholder { color: rgba(255,255,255,0.22); }
.field-group textarea { resize: vertical; min-height: 80px; }
.char-counter { font-size: 0.7rem; color: rgba(255,255,255,0.28); text-align: right; }
.char-counter-inline { font-size: 0.7rem; color: rgba(255,255,255,0.28); text-align: right; }
.field-error { font-size: 0.75rem; color: #ff9bb5; }

.toggles-list { display: flex; flex-direction: column; gap: 0; }
.toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);
  gap: 1rem;
}
.toggle-row:last-child { border-bottom: none; }
.toggle-info { flex: 1; min-width: 0; }
.toggle-label {
  display: block; font-size: 0.9rem; font-weight: 500; color: #e2e8f0;
  cursor: pointer;
}
.toggle-desc { display: block; font-size: 0.78rem; color: rgba(255,255,255,0.38); margin-top: 2px; }

.toggle {
  width: 52px; height: 28px;
  background: rgba(255,255,255,0.11); border: none; border-radius: 999px;
  cursor: pointer; position: relative; transition: background 0.25s; flex-shrink: 0;
  padding: 0;
  min-width: 52px;
}
.toggle.on { background: linear-gradient(135deg, #5c3bff, #7c3bff); }
.toggle:focus-visible { outline: 3px solid #7c6fff; outline-offset: 3px; }
.toggle-knob {
  position: absolute;
  top: 4px; left: 4px;
  width: 20px; height: 20px;
  background: #fff; border-radius: 50%;
  transition: transform 0.25s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.35);
}
.toggle.on .toggle-knob { transform: translateX(24px); }

.account-actions { display: flex; flex-direction: column; gap: 0.75rem; }
.account-btn {
  width: 100%; padding: 0.875rem;
  border: none; border-radius: 12px;
  font-family: inherit; font-size: 0.95rem; font-weight: 600; cursor: pointer;
  transition: opacity 0.2s; min-height: 52px;
}
.account-btn.danger {
  background: rgba(255,59,140,0.15); color: #ff6b8a;
  border: 1px solid rgba(255,59,140,0.22);
}
.account-btn.danger:hover { background: rgba(255,59,140,0.25); }
.account-btn:focus-visible { outline: 3px solid #ff9bb5; outline-offset: 3px; }

.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

@media (max-width: 500px) {
  .fields-grid { grid-template-columns: 1fr; }
  .photo-section { flex-direction: column; text-align: center; }
}
</style>
