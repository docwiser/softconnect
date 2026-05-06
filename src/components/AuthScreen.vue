<template>
  <div class="auth-screen" id="main-content" tabindex="-1">
    <!-- Constant Background -->
    <div class="auth-bg" aria-hidden="true">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>

    <div class="auth-wrapper">
      <!-- Constant Header -->
      <header class="auth-header">
        <div class="logo" role="img" aria-label="Soft Connect logo">
          <span class="logo-icon" aria-hidden="true">◈</span>
          <span class="logo-text">Soft Connect</span>
        </div>
        <p class="tagline">Open. Private. Yours.</p>
      </header>

      <main class="auth-card" aria-label="Authentication">
        <div class="auth-content">
          <h1 class="main-heading">{{ currentUI.heading }}</h1>
          <p class="main-description">{{ currentUI.description }}</p>

          <!-- Account Identity Header (Visible when account found) -->
          <div v-if="step === 'exists' || step === 'password'" class="account-identity">
            <span class="identity-text">{{ userInput }}</span>
            <button @click="step = 'initial'" class="change-account-btn">Change</button>
          </div>

          <!-- Step: Initial (Email/Phone Input) -->
          <form v-if="step === 'initial'" @submit.prevent="handleNext" class="auth-form">
            <div class="field-group">
              <label for="identifier">Email or Phone Number</label>
              <input
                id="identifier"
                v-model="userInput"
                type="text"
                placeholder="you@example.com or +1 555 000 0000"
                required
                :disabled="isLoading"
                autofocus
              />
              <span v-if="errors.identifier" class="field-error">{{ errors.identifier }}</span>
            </div>
            
            <button
              type="submit"
              class="submit-btn"
              :disabled="isLoading || !userInput"
              :aria-busy="isLoading"
            >
              <span>{{ isLoading ? 'Processing...' : 'Next' }}</span>
              <span v-if="isLoading" class="spinner" aria-hidden="true"></span>
            </button>
          </form>

          <!-- Step: Account Exists (Choose Sign-in Method) -->
          <div v-else-if="step === 'exists'" class="method-list">
            <button @click="step = 'password'" class="method-btn">
              <span class="icon">🔑</span>
              <div class="text">
                <strong>Use your password</strong>
                <span>Sign in using your account password</span>
              </div>
            </button>
            <button @click="handleSendMagicLink" class="method-btn" :disabled="isLoading">
              <span class="icon">📧</span>
              <div class="text">
                <strong>Send an email with the link to sign in</strong>
                <span>Magic link sent to your inbox</span>
              </div>
              <span v-if="isLoading" class="spinner-small"></span>
            </button>
            <button @click="step = 'initial'" class="back-link">Back to email/phone</button>
          </div>

          <!-- Step: Password Input -->
          <form v-else-if="step === 'password'" @submit.prevent="handlePasswordSignIn" class="auth-form">
            <div class="field-group">
              <label for="password">Password</label>
              <div class="password-wrapper">
                <input
                  id="password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="••••••••"
                  required
                  autofocus
                />
                <button
                  type="button"
                  class="eye-btn"
                  @click="showPassword = !showPassword"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                >
                  <span aria-hidden="true">{{ showPassword ? '🙈' : '👁️' }}</span>
                </button>
              </div>
            </div>
            
            <div class="password-actions">
              <button type="button" class="forgot-link" @click="handleResetPassword" :disabled="isLoading">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              class="submit-btn"
              :disabled="isLoading || !password"
              :aria-busy="isLoading"
            >
              <span>{{ isLoading ? 'Signing in...' : 'Sign In' }}</span>
              <span v-if="isLoading" class="spinner" aria-hidden="true"></span>
            </button>
            <button type="button" @click="step = 'exists'" class="back-link">Try another way</button>
          </form>

          <!-- Step: Join (Create Account) -->
          <form v-else-if="step === 'create'" @submit.prevent="handleRegister" class="auth-form">
            <div class="form-row">
              <div class="field-group">
                <label for="reg-name">Display Name</label>
                <input id="reg-name" v-model="regForm.displayName" type="text" placeholder="Your name" required />
              </div>
              <div class="field-group">
                <label for="reg-username">Username</label>
                <input id="reg-username" v-model="regForm.username" type="text" placeholder="unique_handle" required />
              </div>
            </div>
            <div class="field-group">
              <label for="reg-email">Email</label>
              <input id="reg-email" v-model="regForm.email" type="email" placeholder="you@example.com" required :disabled="userType === 'email'" />
            </div>
            <div class="field-group">
              <label for="reg-password">Password</label>
              <input id="reg-password" v-model="regForm.password" type="password" placeholder="At least 8 characters" required />
            </div>
            <div class="field-group">
              <label for="reg-phone">Phone (Optional)</label>
              <input id="reg-phone" v-model="regForm.phone" type="tel" placeholder="+1 555 000 0000" :disabled="userType === 'phone'" />
            </div>

            <button
              type="submit"
              class="submit-btn"
              :disabled="isLoading"
              :aria-busy="isLoading"
            >
              <span>{{ isLoading ? 'Creating account...' : 'Create Account' }}</span>
              <span v-if="isLoading" class="spinner" aria-hidden="true"></span>
            </button>
            <button type="button" @click="step = 'initial'" class="back-link">Cancel</button>
          </form>

          <!-- Step: Success -->
          <div v-else-if="step === 'success'" class="success-ui">
            <div class="success-icon">✅</div>
            <h2>{{ successMessage.title }}</h2>
            <p>{{ successMessage.body }}</p>
            <button @click="step = 'initial'" class="submit-btn">Return to Sign In</button>
          </div>

          <!-- Common Error Display -->
          <div v-if="formError" class="form-error" role="alert">
            <span>⚠</span> {{ formError }}
          </div>

          <!-- Always Available Google Sign-in -->
          <div v-if="step !== 'success'" class="google-section">
            <div class="divider" role="separator"><span>or</span></div>
            <button
              type="button"
              class="google-btn"
              @click="handleGoogleLogin"
              :disabled="isLoading"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </div>
        </div>
      </main>

      <!-- Constant Footer -->
      <footer class="auth-footer">
        <p class="policies">
          By continuing, you agree to our 
          <RouterLink to="/privacy-policy">Privacy Policy</RouterLink> and 
          <RouterLink to="/terms-of-use">Terms of Use</RouterLink>.
        </p>
        <p class="copyright">© 2026 SoftConnect. All rights reserved.</p>
        <p class="credits">Built with privacy in mind.</p>
      </footer>
    </div>

    <div aria-live="polite" class="sr-only">{{ announcement }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import {
  checkEmailExists,
  getUserByPhone,
  loginUser,
  loginWithGoogle,
  registerUser,
  sendMagicLink,
  resetPassword,
  type UserProfile
} from '../services/firebase'
import { useAppStore } from '../stores/app'

type Step = 'initial' | 'exists' | 'create' | 'password' | 'success'

const router = useRouter()
const appStore = useAppStore()

const step = ref<Step>('initial')
const isLoading = ref(false)
const userInput = ref('')
const userType = ref<'email' | 'phone' | null>(null)
const foundUser = ref<UserProfile | null>(null)
const password = ref('')
const showPassword = ref(false)
const formError = ref('')
const announcement = ref('')
const errors = reactive({ identifier: '' })
const regForm = reactive({
  displayName: '',
  username: '',
  email: '',
  password: '',
  phone: ''
})
const successType = ref<'magic' | 'reset'>('magic')

const currentUI = computed(() => {
  const firstName = foundUser.value?.displayName.split(' ')[0] || ''
  
  switch (step.value) {
    case 'initial':
      return {
        heading: 'Welcome back to softConnect',
        description: 'Open, Private, fully yours. Enter your Email or phone number to continue'
      }
    case 'exists':
    case 'password':
      return {
        heading: 'Sign in to SoftConnect',
        description: `Welcome ${firstName}. Choose a way to sign in to your account. Once signed in, you'll stay signed in on this device for up to 1 year or until you manually log out.`
      }
    case 'create':
      return {
        heading: 'Join Softconnect',
        description: "Welcome to SoftConnect. We'll help you create your account so you can enjoy the true potential of SoftConnect. Enter the below details to proceed."
      }
    default:
      return { heading: '', description: '' }
  }
})

const successMessage = computed(() => {
  if (successType.value === 'magic') {
    return {
      title: 'Magic link sent!',
      body: 'Check your inbox for a sign-in link. You can close this tab now or wait to be redirected.'
    }
  } else {
    return {
      title: 'Password reset sent!',
      body: 'Check your email for instructions to reset your password.'
    }
  }
})

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,9}$/

async function handleNext() {
  formError.value = ''
  errors.identifier = ''
  const val = userInput.value.trim()
  
  if (emailRegex.test(val)) {
    userType.value = 'email'
  } else if (phoneRegex.test(val.replace(/\s/g, ''))) {
    userType.value = 'phone'
  } else {
    errors.identifier = 'Please enter a valid email or phone number'
    return
  }

  isLoading.value = true
  try {
    if (userType.value === 'email') {
      const exists = await checkEmailExists(val)
      if (exists) {
        step.value = 'exists'
        regForm.email = val
      } else {
        step.value = 'create'
        regForm.email = val
      }
    } else {
      const user = await getUserByPhone(val)
      if (user) {
        foundUser.value = user
        regForm.email = user.email
        regForm.phone = user.phone || val
        step.value = 'exists'
      } else {
        step.value = 'create'
        regForm.phone = val
      }
    }
  } catch (e: any) {
    formError.value = 'An error occurred. Please try again.'
  } finally {
    isLoading.value = false
  }
}

async function handleSendMagicLink() {
  formError.value = ''
  isLoading.value = true
  try {
    await sendMagicLink(regForm.email)
    successType.value = 'magic'
    step.value = 'success'
  } catch (e: any) {
    formError.value = 'Could not send magic link.'
  } finally {
    isLoading.value = false
  }
}

async function handlePasswordSignIn() {
  formError.value = ''
  isLoading.value = true
  try {
    await loginUser(regForm.email, password.value)
    router.push('/dashboard')
  } catch (e: any) {
    formError.value = 'Invalid password or account error.'
  } finally {
    isLoading.value = false
  }
}

async function handleResetPassword() {
  formError.value = ''
  isLoading.value = true
  try {
    await resetPassword(regForm.email)
    successType.value = 'reset'
    step.value = 'success'
  } catch (e: any) {
    formError.value = 'Could not send reset email.'
  } finally {
    isLoading.value = false
  }
}

async function handleRegister() {
  formError.value = ''
  isLoading.value = true
  try {
    await registerUser(
      regForm.email,
      regForm.password,
      regForm.displayName,
      regForm.username,
      regForm.phone || null
    )
    router.push('/dashboard')
  } catch (e: any) {
    formError.value = e.message || 'Registration failed.'
  } finally {
    isLoading.value = false
  }
}

async function handleGoogleLogin() {
  isLoading.value = true
  try {
    await loginWithGoogle()
    // Redirect happens
  } catch (e: any) {
    formError.value = 'Google login failed.'
    isLoading.value = false
  }
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

.auth-wrapper {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.auth-header {
  text-align: center;
}

.auth-card {
  background: rgba(12, 14, 28, 0.88);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 24px;
  padding: 2.5rem;
  width: 100%;
  backdrop-filter: blur(40px);
  box-shadow: 0 0 80px rgba(92, 59, 255, 0.15);
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
  color: rgba(255,255,255,0.45);
  font-size: 0.875rem;
  margin: 0;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.main-heading {
  font-family: 'Syne', sans-serif;
  font-size: 1.5rem;
  color: #fff;
  margin-bottom: 0.75rem;
  line-height: 1.2;
}

.main-description {
  color: rgba(255,255,255,0.6);
  font-size: 0.95rem;
  margin-bottom: 2rem;
  line-height: 1.5;
}

.account-identity {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  margin-bottom: 2rem;
}

.identity-text {
  font-weight: 600;
  color: #fff;
  font-size: 0.95rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 250px;
}

.change-account-btn {
  background: rgba(92, 59, 255, 0.15);
  border: 1px solid rgba(92, 59, 255, 0.3);
  color: #a78bfa;
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.change-account-btn:hover {
  background: rgba(92, 59, 255, 0.25);
  border-color: rgba(92, 59, 255, 0.5);
  color: #fff;
}

.auth-form { display: flex; flex-direction: column; gap: 1.25rem; }

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255,255,255,0.8);
}

.field-group input {
  background: rgba(255,255,255,0.05);
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  color: #fff;
  font-size: 1rem;
  transition: all 0.2s;
}
.field-group input:focus {
  outline: none;
  border-color: #5c3bff;
  background: rgba(92,59,255,0.08);
}

.field-error { color: #ff6b8a; font-size: 0.8rem; margin-top: 0.25rem; }

.submit-btn {
  width: 100%;
  padding: 1rem;
  background: linear-gradient(135deg, #5c3bff, #7c3bff);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  transition: all 0.2s;
}
.submit-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}
.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.spinner {
  width: 20px; height: 20px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.spinner-small {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-left: 0.5rem;
}
@keyframes spin { to { transform: rotate(360deg); } }

.method-list { display: flex; flex-direction: column; gap: 1rem; }

.method-btn {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1.25rem;
  background: rgba(255,255,255,0.05);
  border: 1.5px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
  color: #fff;
  width: 100%;
}
.method-btn:hover {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.15);
}
.method-btn .icon { font-size: 1.5rem; }
.method-btn .text { display: flex; flex-direction: column; }
.method-btn strong { font-size: 1rem; }
.method-btn span { font-size: 0.85rem; color: rgba(255,255,255,0.5); }

.back-link {
  background: none;
  border: none;
  color: rgba(255,255,255,0.4);
  font-size: 0.9rem;
  cursor: pointer;
  margin-top: 1rem;
  text-decoration: underline;
}
.back-link:hover { color: #fff; }

.password-wrapper { position: relative; }
.eye-btn {
  position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.5);
}

.password-actions { display: flex; justify-content: flex-end; }
.forgot-link {
  background: none; border: none; color: #7c6fff; font-size: 0.85rem; cursor: pointer;
}

.success-ui { text-align: center; }
.success-icon { font-size: 3rem; margin-bottom: 1rem; }
.success-ui h2 { color: #fff; margin-bottom: 0.5rem; }
.success-ui p { color: rgba(255,255,255,0.6); margin-bottom: 2rem; }

.form-error {
  margin-top: 1.5rem;
  padding: 0.75rem;
  background: rgba(255,107,138,0.1);
  border: 1px solid rgba(255,107,138,0.3);
  border-radius: 8px;
  color: #ff6b8a;
  font-size: 0.9rem;
  display: flex; align-items: center; gap: 0.5rem;
}

.google-section { margin-top: 1.5rem; }
.divider {
  display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;
  color: rgba(255,255,255,0.2); font-size: 0.8rem; text-transform: uppercase;
}
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.1); }

.google-btn {
  width: 100%;
  padding: 0.75rem;
  background: rgba(255,255,255,0.05);
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  color: #fff;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 0.75rem;
  transition: all 0.2s;
}
.google-btn:hover { background: rgba(255,255,255,0.1); }

.auth-footer {
  text-align: center;
  color: rgba(255,255,255,0.3);
  font-size: 0.8rem;
  display: flex; flex-direction: column; gap: 0.5rem;
}
.policies a { color: #7c6fff; text-decoration: underline; }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); border: 0;
}

@media (max-width: 500px) {
  .auth-card { padding: 1.5rem; }
  .form-row { grid-template-columns: 1fr; }
}
</style>
