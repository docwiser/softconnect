<template>
  <div class="welcome-screen" role="main">
    <div class="welcome-container">
      <h1 class="welcome-title">Welcome to ChatConnect</h1>
      <p class="welcome-subtitle">Enter your name to get started</p>
      
      <form @submit.prevent="handleSubmit" class="welcome-form">
        <div class="form-group">
          <label for="username" class="form-label">Your Name</label>
          <input 
            id="username"
            ref="nameInput"
            v-model="userName" 
            type="text" 
            required
            class="form-input"
            placeholder="Enter your name"
            :aria-describedby="errorMessage ? 'error-message' : undefined"
            :aria-invalid="!!errorMessage"
            @input="clearError"
          />
          <div 
            v-if="errorMessage" 
            id="error-message" 
            class="error-message" 
            role="alert"
            aria-live="polite"
          >
            {{ errorMessage }}
          </div>
        </div>
        
        <button 
          type="submit" 
          class="btn btn-primary"
          :disabled="isLoading || !userName.trim()"
          :aria-describedby="isLoading ? 'loading-message' : undefined"
        >
          <span v-if="isLoading">Connecting...</span>
          <span v-else>Next</span>
        </button>
        
        <div 
          v-if="isLoading" 
          id="loading-message" 
          class="loading-message" 
          aria-live="polite"
        >
          Setting up your connection, please wait...
        </div>
      </form>
      
      <div class="instructions" role="region" aria-labelledby="instructions-title">
        <h2 id="instructions-title" class="instructions-title">How it works</h2>
        <ul class="instructions-list">
          <li>Enter your name and click Next</li>
          <li>You'll get a unique 4-digit number</li>
          <li>Share this number with others to connect</li>
          <li>Start chatting and making calls!</li>
        </ul>
      </div>
    </div>
    
    <!-- Screen reader announcements -->
    <div aria-live="assertive" class="sr-only">
      {{ announcement }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { usePeerStore } from '../stores/peer';

const router = useRouter();
const peerStore = usePeerStore();

const userName = ref('');
const isLoading = ref(false);
const errorMessage = ref('');
const announcement = ref('');
const nameInput = ref<HTMLInputElement>();

onMounted(async () => {
  await nextTick();
  nameInput.value?.focus();
  announcement.value = 'Welcome screen loaded. Enter your name to get started.';
});

async function handleSubmit() {
  if (!userName.value.trim()) {
    errorMessage.value = 'Please enter your name';
    announcement.value = 'Error: Please enter your name';
    return;
  }
  
  isLoading.value = true;
  errorMessage.value = '';
  announcement.value = 'Connecting to chat service...';
  
  try {
    const peerId = await peerStore.initializePeer(userName.value.trim());
    announcement.value = `Connected successfully! Your ID is ${peerId}`;
    
    setTimeout(() => {
      router.push('/dashboard');
    }, 1000);
  } catch (error) {
    errorMessage.value = 'Failed to connect. Please try again.';
    announcement.value = 'Connection failed. Please try again.';
    isLoading.value = false;
  }
}

function clearError() {
  errorMessage.value = '';
}
</script>

<style scoped>
.welcome-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 1rem;
}

.welcome-container {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  width: 100%;
}

.welcome-title {
  font-size: 2.5rem;
  font-weight: 700;
  text-align: center;
  color: #2d3748;
  margin-bottom: 0.5rem;
}

.welcome-subtitle {
  text-align: center;
  color: #718096;
  font-size: 1.1rem;
  margin-bottom: 2rem;
}

.welcome-form {
  margin-bottom: 2rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input[aria-invalid="true"] {
  border-color: #e53e3e;
}

.btn {
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5a67d8;
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
}

.error-message {
  color: #e53e3e;
  font-size: 0.875rem;
  margin-top: 0.5rem;
  font-weight: 500;
}

.loading-message {
  text-align: center;
  color: #718096;
  font-size: 0.875rem;
  margin-top: 1rem;
}

.instructions {
  background: #f7fafc;
  border-radius: 8px;
  padding: 1.5rem;
}

.instructions-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 1rem;
}

.instructions-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.instructions-list li {
  padding: 0.5rem 0;
  color: #4a5568;
  position: relative;
  padding-left: 1.5rem;
}

.instructions-list li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: #48bb78;
  font-weight: bold;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 640px) {
  .welcome-container {
    padding: 1.5rem;
  }
  
  .welcome-title {
    font-size: 2rem;
  }
}
</style>