<template>
  <div class="auth-screen">
    <div class="auth-bg">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>

    <div class="auth-card">
      <div class="auth-header">
        <div class="logo">
          <span class="logo-icon">◈</span>
          <span class="logo-text">Soft Connect</span>
        </div>
        <p class="tagline">Open. Private. Yours.</p>
      </div>

      <!-- Tab Switcher -->
      <div class="tab-switcher" role="tablist">
        <button
          role="tab"
          :aria-selected="mode === 'login'"
          :class="['tab', { active: mode === 'login' }]"
          @click="mode = 'login'"
        >Sign In</button>
        <button
          role="tab"
          :aria-selected="mode === 'register'"
          :class="['tab', { active: mode === 'register' }]"
          @click="mode = 'register'"
        >Create Account</button>
      </div>

      <!-- Login Form -->
      <form v-if="mode === 'login'" @submit.prevent="handleLogin" class="auth-form" novalidate>
        <div class="field-group">
          <label for="login-email">Email</label>
          <input
            id="login-email"
            v-model="loginForm.email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            required
            :aria-invalid="!!errors.email"
          />
          <span v-if="errors.email" class="field-error" role="alert">{{ errors.email }}</span>
        </div>

        <div class="field-group">
          <label for="login-password">Password</label>
          <div class="password-wrapper">
            <input
              id="login-password"
              v-model="loginForm.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••"
              autocomplete="current-password"
              required
            />
            <button type="button" class="eye-btn" @click="showPassword = !showPassword"
              :aria-label="showPassword ? 'Hide password' : 'Show password'">
              {{ showPassword ? '🙈' : '👁️' }}
            </button>
          </div>
          <button type="button" class="forgot-link" @click="handleForgotPassword">
            Forgot password?
          </button>
        </div>

        <div v-if="formError" class="form-error" role="alert">{{ formError }}</div>

        <button type="submit" class="submit-btn" :disabled="isLoading">
          <span v-if="isLoading" class="spinner"></span>
          <span v-else>Sign In</span>
        </button>

        <div class="divider"><span>or</span></div>

        <button type="button" class="google-btn" @click="handleGoogleLogin" :disabled="isLoading">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
      </form>

      <!-- Register Form -->
      <form v-else @submit.prevent="handleRegister" class="auth-form" novalidate>
        <div class="form-row">
          <div class="field-group">
            <label for="reg-name">Display Name</label>
            <input
              id="reg-name"
              v-model="regForm.displayName"
              type="text"
              placeholder="Your name"
              autocomplete="name"
              required
              maxlength="50"
            />
            <span v-if="errors.displayName" class="field-error">{{ errors.displayName }}</span>
          </div>
          <div class="field-group">
            <label for="reg-username">
              Username
              <span class="field-hint">@</span>
            </label>
            <input
              id="reg-username"
              v-model="regForm.username"
              type="text"
              placeholder="unique_handle"
              autocomplete="username"
              required
              maxlength="30"
              @input="validateUsername"
            />
            <span v-if="errors.username" class="field-error">{{ errors.username }}</span>
          </div>
        </div>

        <div class="field-group">
          <label for="reg-email">Email</label>
          <input
            id="reg-email"
            v-model="regForm.email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            required
          />
          <span v-if="errors.email" class="field-error">{{ errors.email }}</span>
        </div>

        <div class="field-group">
          <label for="reg-password">Password</label>
          <div class="password-wrapper">
            <input
              id="reg-password"
              v-model="regForm.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="At least 8 characters"
              autocomplete="new-password"
              required
              minlength="8"
            />
            <button type="button" class="eye-btn" @click="showPassword = !showPassword">
              {{ showPassword ? '🙈' : '👁️' }}
            </button>
          </div>
          <div class="password-strength" v-if="regForm.password">
            <div class="strength-bar">
              <div :class="['strength-fill', passwordStrengthClass]" :style="{ width: passwordStrengthPct + '%' }"></div>
            </div>
            <span class="strength-label">{{ passwordStrengthLabel }}</span>
          </div>
          <span v-if="errors.password" class="field-error">{{ errors.password }}</span>
        </div>

        <div class="field-group">
          <label for="reg-phone">Phone (optional)</label>
          <input
            id="reg-phone"
            v-model="regForm.phone"
            type="tel"
            placeholder="+1 555 000 0000"
            autocomplete="tel"
          />
        </div>

        <div v-if="formError" class="form-error" role="alert">{{ formError }}</div>

        <button type="submit" class="submit-btn" :disabled="isLoading">
          <span v-if="isLoading" class="spinner"></span>
          <span v-else>Create Account</span>
        </button>

        <div class="divider"><span>or</span></div>

        <button type="button" class="google-btn" @click="handleGoogleLogin" :disabled="isLoading">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <p class="terms-text">
          By creating an account you agree to our privacy-first policy. We collect no data beyond what you share.
        </p>
      </form>
    </div>

    <div aria-live="polite" class="sr-only">{{ announcement }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  registerUser,
  loginUser,
  loginWithGoogle,
  resetPassword
} from '../services/firebase'
import { useAppStore } from '../stores/app'

const router = useRouter()
const appStore = useAppStore()

const mode = ref<'login' | 'register'>('login')
const isLoading = ref(false)
const showPassword = ref(false)
const formError = ref('')
const announcement = ref('')
const errors = ref<Record<string, string>>({})

const loginForm = ref({ email: '', password: '' })
const regForm = ref({ displayName: '', username: '', email: '', password: '', phone: '' })

const passwordStrengthPct = computed(() => {
  const p = regForm.value.password
  let score = 0
  if (p.length >= 8) score += 25
  if (p.length >= 12) score += 15
  if (/[A-Z]/.test(p)) score += 20
  if (/[0-9]/.test(p)) score += 20
  if (/[^A-Za-z0-9]/.test(p)) score += 20
  return Math.min(score, 100)
})
const passwordStrengthClass = computed(() => {
  const p = passwordStrengthPct.value
  if (p < 40) return 'weak'
  if (p < 70) return 'medium'
  return 'strong'
})
const passwordStrengthLabel = computed(() => {
  const p = passwordStrengthPct.value
  if (p < 40) return 'Weak'
  if (p < 70) return 'Medium'
  return 'Strong'
})

function validateUsername() {
  const u = regForm.value.username
  if (!/^[a-zA-Z0-9_]+$/.test(u)) {
    errors.value.username = 'Only letters, numbers, underscores'
  } else if (u.length < 3) {
    errors.value.username = 'At least 3 characters'
  } else {
    delete errors.value.username
  }
}

async function handleLogin() {
  formError.value = ''
  errors.value = {}
  if (!loginForm.value.email) { errors.value.email = 'Email required'; return }
  isLoading.value = true
  try {
    await loginUser(loginForm.value.email, loginForm.value.password)
    announcement.value = 'Signed in successfully'
    router.push('/dashboard')
  } catch (e: any) {
    formError.value = friendlyError(e.code)
    announcement.value = formError.value
  } finally {
    isLoading.value = false
  }
}

async function handleRegister() {
  formError.value = ''
  errors.value = {}
  validateUsername()
  if (Object.keys(errors.value).length) return
  if (regForm.value.password.length < 8) {
    errors.value.password = 'At least 8 characters'
    return
  }
  isLoading.value = true
  try {
    await registerUser(
      regForm.value.email,
      regForm.value.password,
      regForm.value.displayName,
      regForm.value.username
    )
    announcement.value = 'Account created! Check your email to verify.'
    appStore.addNotification('Account created! Check your email to verify.', 'success')
    router.push('/dashboard')
  } catch (e: any) {
    formError.value = e.message || friendlyError(e.code)
    announcement.value = formError.value
  } finally {
    isLoading.value = false
  }
}

async function handleGoogleLogin() {
  formError.value = ''
  isLoading.value = true
  try {
    await loginWithGoogle()
    router.push('/dashboard')
  } catch (e: any) {
    formError.value = friendlyError(e.code)
  } finally {
    isLoading.value = false
  }
}

async function handleForgotPassword() {
  if (!loginForm.value.email) {
    errors.value.email = 'Enter your email first'
    return
  }
  try {
    await resetPassword(loginForm.value.email)
    appStore.addNotification('Password reset email sent!', 'success')
  } catch {
    formError.value = 'Could not send reset email'
  }
}

function friendlyError(code: string): string {
  const map: Record<string, string> = {
    'auth/user-not-found': 'No account found with that email',
    'auth/wrong-password': 'Incorrect password',
    'auth/email-already-in-use': 'Email already registered',
    'auth/weak-password': 'Password too weak',
    'auth/invalid-email': 'Invalid email address',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/popup-closed-by-user': 'Login cancelled',
  }
  return map[code] || 'Something went wrong. Please try again.'
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');

.auth-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #060812;
  font-family: 'DM Sans', sans-serif;
  padding: 1.5rem;
  position: relative;
  overflow: hidden;
}

.auth-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.35;
}
.orb-1 {
  width: 500px; height: 500px;
  background: #5c3bff;
  top: -150px; left: -100px;
  animation: orbFloat 12s ease-in-out infinite;
}
.orb-2 {
  width: 400px; height: 400px;
  background: #ff3b8c;
  bottom: -100px; right: -50px;
  animation: orbFloat 15s ease-in-out infinite reverse;
}
.orb-3 {
  width: 300px; height: 300px;
  background: #00d4ff;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  animation: orbFloat 18s ease-in-out infinite;
}

@keyframes orbFloat {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-30px) scale(1.05); }
}

.auth-card {
  background: rgba(12, 14, 28, 0.85);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 24px;
  padding: 2.5rem;
  width: 100%;
  max-width: 480px;
  backdrop-filter: blur(40px);
  position: relative;
  z-index: 1;
  box-shadow: 0 0 80px rgba(92, 59, 255, 0.15);
}

.auth-header {
  text-align: center;
  margin-bottom: 2rem;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.logo-icon {
  font-size: 2rem;
  background: linear-gradient(135deg, #5c3bff, #ff3b8c);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.logo-text {
  font-family: 'Syne', sans-serif;
  font-size: 1.75rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.03em;
}

.tagline {
  color: rgba(255,255,255,0.4);
  font-size: 0.875rem;
  margin: 0;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.tab-switcher {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: rgba(255,255,255,0.05);
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 1.75rem;
  gap: 4px;
}

.tab {
  padding: 0.625rem;
  border: none;
  background: transparent;
  color: rgba(255,255,255,0.5);
  border-radius: 9px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}
.tab.active {
  background: rgba(92, 59, 255, 0.5);
  color: #fff;
}

.auth-form { display: flex; flex-direction: column; gap: 1rem; }

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field-group label {
  font-size: 0.8rem;
  font-weight: 500;
  color: rgba(255,255,255,0.6);
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.field-hint {
  background: rgba(92,59,255,0.3);
  color: #a78bfa;
  font-size: 0.75rem;
  padding: 0 4px;
  border-radius: 4px;
}

.field-group input {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 0.75rem 1rem;
  color: #fff;
  font-size: 0.95rem;
  font-family: inherit;
  transition: all 0.2s;
  width: 100%;
  box-sizing: border-box;
}
.field-group input:focus {
  outline: none;
  border-color: #5c3bff;
  background: rgba(92,59,255,0.08);
  box-shadow: 0 0 0 3px rgba(92,59,255,0.15);
}
.field-group input::placeholder { color: rgba(255,255,255,0.2); }
.field-group input[aria-invalid="true"] { border-color: #ff3b8c; }

.password-wrapper {
  position: relative;
}
.password-wrapper input { padding-right: 3rem; }
.eye-btn {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
  color: rgba(255,255,255,0.4);
}

.forgot-link {
  background: none;
  border: none;
  color: #7c6fff;
  font-size: 0.8rem;
  cursor: pointer;
  text-align: right;
  padding: 0;
  font-family: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
  align-self: flex-end;
}
.forgot-link:hover { color: #a78bfa; }

.password-strength { margin-top: 0.375rem; }
.strength-bar {
  height: 3px;
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 0.25rem;
}
.strength-fill {
  height: 100%;
  border-radius: 2px;
  transition: all 0.3s;
}
.strength-fill.weak { background: #ff3b8c; }
.strength-fill.medium { background: #fbbf24; }
.strength-fill.strong { background: #34d399; }
.strength-label { font-size: 0.75rem; color: rgba(255,255,255,0.4); }

.field-error {
  font-size: 0.78rem;
  color: #ff3b8c;
}

.form-error {
  background: rgba(255, 59, 140, 0.1);
  border: 1px solid rgba(255, 59, 140, 0.3);
  border-radius: 8px;
  padding: 0.75rem;
  font-size: 0.875rem;
  color: #ff3b8c;
  text-align: center;
}

.submit-btn {
  width: 100%;
  padding: 0.875rem;
  background: linear-gradient(135deg, #5c3bff, #7c3bff);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 52px;
}
.submit-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #6d4fff, #8d4fff);
  transform: translateY(-1px);
  box-shadow: 0 8px 25px rgba(92,59,255,0.4);
}
.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.spinner {
  width: 18px; height: 18px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: rgba(255,255,255,0.2);
  font-size: 0.8rem;
}
.divider::before, .divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255,255,255,0.1);
}

.google-btn {
  width: 100%;
  padding: 0.75rem;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  transition: all 0.2s;
}
.google-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.1);
  border-color: rgba(255,255,255,0.2);
}
.google-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.terms-text {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.25);
  text-align: center;
  line-height: 1.5;
  margin: 0;
}

.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

@media (max-width: 500px) {
  .auth-card { padding: 1.75rem 1.25rem; }
  .form-row { grid-template-columns: 1fr; }
}
</style>
