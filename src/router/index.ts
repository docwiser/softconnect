import { createRouter, createWebHistory } from 'vue-router';
import WelcomeScreen from '../components/WelcomeScreen.vue';
import Dashboard from '../components/Dashboard.vue';
import ChatScreen from '../components/ChatScreen.vue';
import CallScreen from '../components/CallScreen.vue';
import { useAppStore } from '../stores/app';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'welcome',
      component: WelcomeScreen
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: Dashboard,
      meta: { requiresSetup: true }
    },
    {
      path: '/chat/:id',
      name: 'chat',
      component: ChatScreen,
      meta: { requiresSetup: true }
    },
    {
      path: '/call/:id',
      name: 'call',
      component: CallScreen,
      meta: { requiresSetup: true }
    }
  ]
});

router.beforeEach((to) => {
  const appStore = useAppStore();
  
  if (to.meta.requiresSetup && !appStore.isSetupComplete) {
    return '/';
  }
  
  // Auto-redirect to call screen for incoming calls
  if (to.name !== 'call' && appStore.callState.isIncoming) {
    return `/call/${appStore.callState.peerId}`;
  }
  
  return true;
});

export default router;