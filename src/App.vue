<template>
<div id="app">
<div 
v-if="showCallIndicator"
class="call-indicator-header"
>
<button 
@click="goToCall"
class="header-call-btn"
:aria-label="callLabel"
>
<span class="call-indicator-icon">📞</span>
<span class="call-indicator-text">
{{ callState.isIncoming ? 'Incoming call from' : 'Call with' }} {{ callState.peerName }} - Click to return
</span>
</button>
</div>
<main id="main-content">
<RouterView />
</main>
<footer class="app-footer">
<p class="copyright">
&copy;Copyright 2025 Soft connect; innovation and engineered by Susant Swain
</p>
</footer>
<div v-if="notifications.length" class="notifications-container" aria-live="polite">
<div 
v-for="(notification, index) in notifications" 
:key="index"
class="notification"
role="alert"
>
{{ notification }}
</div>
</div>
</div>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { RouterView, useRouter, useRoute } from "vue-router";
import { useAppStore } from "./stores/app";
const router = useRouter();
const route = useRoute();
const appStore = useAppStore();
const notifications = computed(() => appStore.notifications);
const callState = computed(() => appStore.callState);
const showCallIndicator = computed(() => {
const isCallActive = callState.value.isActive || callState.value.isIncoming;
const isNotOnCallScreen = route.name !== "call";
return isCallActive && isNotOnCallScreen;
});
const callLabel = computed(() => {
return `${callState.value.isIncoming ? "Incoming call from " : "On-going call with "}${callState.value.peerName}. tap to return to the call screen`;
});
function goToCall() {
router.push(`/call/${callState.value.peerId}`);
}
</script>
<style scoped>
#app {
position: relative;
min-height: 100vh;
display: flex;
flex-direction: column;
}

.skip-link {
position: absolute;
top: -40px;
left: 6px;
background: #667eea;
color: white;
padding: 8px;
text-decoration: none;
border-radius: 4px;
z-index: 10000;
font-weight: 600;
}

.skip-link:focus {
top: 6px;
}

.call-indicator-header {
background: #e53e3e;
color: white;
padding: 0.5rem;
text-align: center;
position: sticky;
top: 0;
z-index: 1000;
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-call-btn {
background: none;
border: none;
color: white;
cursor: pointer;
display: flex;
align-items: center;
justify-content: center;
gap: 0.5rem;
font-weight: 600;
width: 100%;
padding: 0.5rem;
border-radius: 4px;
transition: all 0.2s ease;
}

.header-call-btn:hover {
background: rgba(255, 255, 255, 0.1);
}

.header-call-btn:focus {
outline: 2px solid white;
outline-offset: 2px;
}

.call-indicator-icon {
font-size: 1.25rem;
animation: pulse 2s infinite;
}

@keyframes pulse {
0%, 100% { opacity: 1; }
50% { opacity: 0.7; }
}

main {
flex: 1;
}

.app-footer {
background: #f7fafc;
border-top: 1px solid #e2e8f0;
padding: 1rem;
text-align: center;
margin-top: auto;
}

.copyright {
color: #718096;
font-size: 0.875rem;
margin: 0;
}

.notifications-container {
position: fixed;
top: 1rem;
left: 50%;
transform: translateX(-50%);
z-index: 10000;
display: flex;
flex-direction: column;
gap: 0.5rem;
max-width: 400px;
width: 90%;
pointer-events: none;
}

.notification {
background: rgba(45, 55, 72, 0.95);
color: white;
padding: 1rem;
border-radius: 8px;
backdrop-filter: blur(10px);
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
animation: slideIn 0.3s ease-out;
pointer-events: auto;
}

@keyframes slideIn {
from {
opacity: 0;
transform: translateY(-20px);
}
to {
opacity: 1;
transform: translateY(0);
}
}

@media (max-width: 640px) {
.notifications-container {
width: 95%;
}

.notification {
padding: 0.75rem;
font-size: 0.875rem;
}

.call-indicator-text {
font-size: 0.875rem;
}
}

@media (prefers-color-scheme: dark) {
.app-footer {
background: #2d3748;
border-color: #4a5568;
}

.copyright {
color: #a0aec0;
}
}
</style>