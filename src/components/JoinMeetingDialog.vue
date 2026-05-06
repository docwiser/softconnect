<template>
  <Transition name="modal-fade">
    <div v-if="show" class="modal-overlay" @click.self="$emit('close')" role="presentation">
      <dialog open class="join-dialog" aria-label="Join a meeting" @keydown.escape="$emit('close')">
        <div class="dialog-header">
          <h2>Join Meeting</h2>
          <button class="dialog-close" @click="$emit('close')" aria-label="Close">✕</button>
        </div>
        <div class="join-form">
          <div class="form-field">
            <label for="join-code">Meeting Code or Link</label>
            <input
              id="join-code"
              v-model="joinCode"
              type="text"
              placeholder="abc-defg-hij or paste link"
              autocomplete="off"
              ref="joinCodeInputRef"
            />
          </div>
          <div v-if="joinError" class="join-error" role="alert">{{ joinError }}</div>
          <div class="form-actions">
            <button type="button" class="btn-cancel" @click="$emit('close')">Cancel</button>
            <button class="btn-create" @click="handleJoin" :disabled="!joinCode.trim() || isJoining" :aria-busy="isJoining">
              {{ isJoining ? 'Finding…' : 'Continue' }}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { getMeetingByCode } from '../services/meetings'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const router = useRouter()
const joinCode = ref('')
const joinError = ref('')
const isJoining = ref(false)
const joinCodeInputRef = ref<HTMLInputElement>()

watch(() => props.show, async (open) => {
  if (open) {
    joinCode.value = ''
    joinError.value = ''
    await nextTick()
    joinCodeInputRef.value?.focus()
  }
})

async function handleJoin() {
  joinError.value = ''
  let code = joinCode.value.trim()
  
  // Handle full URLs
  if (code.includes('/join/')) {
    code = code.split('/join/').pop() || code
  }
  
  if (!code) return
  
  isJoining.value = true
  try {
    const meeting = await getMeetingByCode(code)
    if (!meeting) {
      joinError.value = 'Meeting not found. Check the code and try again.'
      return
    }
    if (meeting.status === 'ended') {
      joinError.value = 'This meeting has ended.'
      return
    }
    emit('close')
    router.push(`/meeting/prejoin/${code}`)
  } catch {
    joinError.value = 'Could not find meeting. Try again.'
  } finally {
    isJoining.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.72); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center; z-index: 500; padding: 1rem;
}
.modal-fade-enter-active, .modal-fade-leave-active { transition: all 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; transform: scale(0.97); }

.join-dialog {
  background: #0e1222; border: 1px solid rgba(255,255,255,0.11);
  border-radius: 20px; padding: 0; max-width: 420px; width: 100%;
  color: #e2e8f0; box-shadow: 0 24px 72px rgba(0,0,0,0.8);
}

.dialog-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.5rem 1.5rem 0; margin-bottom: 1.25rem;
}
.dialog-header h2 { font-family: 'Syne', sans-serif; font-size: 1.15rem; font-weight: 800; color: #fff; margin: 0; }
.dialog-close {
  background: rgba(255,255,255,0.07); border: none; border-radius: 8px;
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: rgba(255,255,255,0.55); font-size: 0.85rem;
}
.dialog-close:hover { background: rgba(255,255,255,0.13); color: #fff; }

.join-form {
  padding: 0 1.5rem 1.5rem;
  display: flex; flex-direction: column; gap: 1rem;
}

.form-field { display: flex; flex-direction: column; gap: 0.375rem; }
.form-field label {
  font-size: 0.82rem; font-weight: 600; color: rgba(255,255,255,0.65); letter-spacing: 0.04em;
}
.form-field input {
  background: rgba(255,255,255,0.06); border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 10px; padding: 0.75rem 1rem; color: #e2e8f0;
  font-family: inherit; font-size: 0.9rem; transition: all 0.2s; min-height: 44px;
}
.form-field input:focus {
  outline: none; border-color: rgba(92,59,255,0.6);
  background: rgba(92,59,255,0.06); box-shadow: 0 0 0 3px rgba(92,59,255,0.12);
}

.form-actions {
  display: flex; gap: 0.75rem; justify-content: flex-end; padding-top: 0.5rem;
}
.btn-cancel {
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.11);
  border-radius: 10px; padding: 0.625rem 1.25rem; color: rgba(255,255,255,0.72);
  cursor: pointer; font-family: inherit; font-size: 0.9rem; min-height: 44px;
}
.btn-create {
  background: linear-gradient(135deg, #5c3bff, #7c3bff); border: none;
  border-radius: 10px; padding: 0.625rem 1.5rem; color: #fff;
  cursor: pointer; font-family: inherit; font-size: 0.9rem; font-weight: 700;
  min-height: 44px;
}
.btn-create:disabled { opacity: 0.5; cursor: not-allowed; }

.join-error {
  background: rgba(255,59,92,0.1); border: 1px solid rgba(255,59,92,0.25);
  border-radius: 8px; padding: 0.75rem; font-size: 0.875rem; color: #ff9bb5;
}
</style>
