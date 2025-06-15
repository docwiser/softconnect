import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User, Chat, Message, CallState, PeerConfig } from '../types';

export const useAppStore = defineStore('app', () => {
  // User state
  const currentUser = ref<User | null>(null);
  const isSetupComplete = ref(false);
  
  // Chats state
  const chats = ref<Chat[]>([]);
  const activeChat = ref<string | null>(null);
  
  // Call state
  const callState = ref<CallState>({
    isActive: false,
    isIncoming: false,
    isOutgoing: false,
    peerId: '',
    peerName: '',
    isAudioEnabled: true,
    isVideoEnabled: false,
    isMuted: false,
    isOnHold: false,
    playbackSpeed: 1.0
  });
  
  // Media devices
  const availableAudioInputs = ref<MediaDeviceInfo[]>([]);
  const availableAudioOutputs = ref<MediaDeviceInfo[]>([]);
  const availableVideoInputs = ref<MediaDeviceInfo[]>([]);
  
  // Notifications
  const notifications = ref<string[]>([]);
  
  // Getters
  const activeChatData = computed(() => {
    if (!activeChat.value) return null;
    return chats.value.find(chat => chat.peerId === activeChat.value) || null;
  });
  
  const sortedChats = computed(() => {
    return [...chats.value].sort((a, b) => {
      const aTime = a.lastMessage?.timestamp || 0;
      const bTime = b.lastMessage?.timestamp || 0;
      return bTime - aTime;
    });
  });
  
  // Actions
  function setCurrentUser(user: User) {
    currentUser.value = user;
    isSetupComplete.value = true;
  }
  
  function addChat(peerId: string, peerName: string) {
    const existingChat = chats.value.find(chat => chat.peerId === peerId);
    if (!existingChat) {
      chats.value.push({
        peerId,
        peerName,
        messages: [],
        unreadCount: 0
      });
    }
  }
  
  function addMessage(peerId: string, message: Message) {
    const chat = chats.value.find(chat => chat.peerId === peerId);
    if (chat) {
      chat.messages.push(message);
      chat.lastMessage = message;
      if (message.senderId !== currentUser.value?.id && activeChat.value !== peerId) {
        chat.unreadCount++;
      }
    }
  }
  
  function setActiveChat(peerId: string | null) {
    if (peerId) {
      const chat = chats.value.find(chat => chat.peerId === peerId);
      if (chat) {
        chat.unreadCount = 0;
      }
    }
    activeChat.value = peerId;
  }
  
  function updateCallState(updates: Partial<CallState>) {
    Object.assign(callState.value, updates);
  }
  
  function addNotification(message: string) {
    notifications.value.push(message);
    // Auto-remove after 5 seconds
    setTimeout(() => {
      const index = notifications.value.indexOf(message);
      if (index > -1) {
        notifications.value.splice(index, 1);
      }
    }, 5000);
  }
  
  function clearNotifications() {
    notifications.value = [];
  }
  
  return {
    // State
    currentUser,
    isSetupComplete,
    chats,
    activeChat,
    callState,
    availableAudioInputs,
    availableAudioOutputs,
    availableVideoInputs,
    notifications,
    
    // Getters
    activeChatData,
    sortedChats,
    
    // Actions
    setCurrentUser,
    addChat,
    addMessage,
    setActiveChat,
    updateCallState,
    addNotification,
    clearNotifications
  };
});