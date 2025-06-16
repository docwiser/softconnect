import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { User, Chat, Message, CallState} from "../types";
export const useAppStore = defineStore("app", () => {
const currentUser = ref<User | null>(null);
const isSetupComplete = ref(false);
const chats = ref<Chat[]>([]);
const activeChat = ref<string | null>(null);
const callState = ref<CallState>({
isActive: false,
isIncoming: false,
isOutgoing: false,
peerId: "",
peerName: "",
isAudioEnabled: true,
isVideoEnabled: false,
isMuted: false,
isOnHold: false,
playbackSpeed: 1.0
});
const availableAudioInputs = ref<MediaDeviceInfo[]>([]);
const availableAudioOutputs = ref<MediaDeviceInfo[]>([]);
const availableVideoInputs = ref<MediaDeviceInfo[]>([]);
const notifications = ref<string[]>([]);
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
currentUser,
isSetupComplete,
chats,
activeChat,
callState,
availableAudioInputs,
availableAudioOutputs,
availableVideoInputs,
notifications,
activeChatData,
sortedChats,
setCurrentUser,
addChat,
addMessage,
setActiveChat,
updateCallState,
addNotification,
clearNotifications
};
});