// src/services/firebase.ts
import { initializeApp } from 'firebase/app'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  type User as FirebaseUser
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp,
  getDocs,
  arrayUnion,
  arrayRemove,
  increment,
  writeBatch,
  Timestamp,
  type DocumentData
} from 'firebase/firestore'
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage'

// ─── Firebase Config ──────────────────────────────────────────────────────────
// Replace with your own Firebase project config
const firebaseConfig = {

  apiKey: "AIzaSyBkZNyR4vH0bcPrh3xqXvrJen_bIFU4Da8",

  authDomain: "softconnectdev.firebaseapp.com",

  projectId: "softconnectdev",

  storageBucket: "softconnectdev.firebasestorage.app",

  messagingSenderId: "864295813972",

  appId: "1:864295813972:web:a71a6dc4abfcf8a3b5fec1",

  measurementId: "G-BE10Y5J44E"

};
const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const googleProvider = new GoogleAuthProvider()

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UserProfile {
  uid: string
  username: string        // unique, searchable, lowercase
  displayName: string
  email: string
  phone: string | null
  photoURL: string | null
  bio: string
  createdAt: Timestamp | null
  lastSeen: Timestamp | null
  isOnline: boolean
  blockable: boolean      // if false, no one can block this user
  blockedUsers: string[]  // UIDs this user has blocked
  settings: UserSettings
}

export interface UserSettings {
  profileVisible: boolean     // others can view profile
  readReceipts: boolean       // send/show read receipts
  showLastSeen: boolean
  showPhone: boolean
  notificationsEnabled: boolean
}

export interface Message {
  id: string
  senderId: string
  content: string
  timestamp: Timestamp | null
  type: 'text' | 'system' | 'image'
  readBy: string[]
  deleted: boolean
}

export interface Chat {
  id: string
  participants: string[]    // UIDs
  participantNames: Record<string, string>
  participantPhotos: Record<string, string | null>
  lastMessage: {
    content: string
    senderId: string
    timestamp: Timestamp | null
  } | null
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
  unreadCounts: Record<string, number>
}

export interface CallRecord {
  id: string
  callerId: string
  callerName: string
  callerPhoto: string | null
  receiverId: string
  receiverName: string
  receiverPhoto: string | null
  type: 'voice' | 'video'
  status: 'missed' | 'answered' | 'rejected' | 'ongoing'
  startedAt: Timestamp | null
  endedAt: Timestamp | null
  duration: number   // seconds
}

// ─── Auth Functions ───────────────────────────────────────────────────────────
export async function registerUser(
  email: string,
  password: string,
  displayName: string,
  username: string
): Promise<FirebaseUser> {
  // Check username uniqueness
  const usernameQuery = query(
    collection(db, 'users'),
    where('username', '==', username.toLowerCase())
  )
  const existing = await getDocs(usernameQuery)
  if (!existing.empty) throw new Error('Username already taken')

  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(cred.user, { displayName })
  await sendEmailVerification(cred.user)

  // Create Firestore profile
  const profile: UserProfile = {
    uid: cred.user.uid,
    username: username.toLowerCase(),
    displayName,
    email,
    phone: null,
    photoURL: null,
    bio: '',
    createdAt: Timestamp.now(),
    lastSeen: Timestamp.now(),
    isOnline: true,
    blockable: true,
    blockedUsers: [],
    settings: {
      profileVisible: true,
      readReceipts: true,
      showLastSeen: true,
      showPhone: false,
      notificationsEnabled: true
    }
  }
  await setDoc(doc(db, 'users', cred.user.uid), profile)
  return cred.user
}

export async function loginUser(email: string, password: string): Promise<FirebaseUser> {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  await updateDoc(doc(db, 'users', cred.user.uid), {
    isOnline: true,
    lastSeen: serverTimestamp()
  })
  return cred.user
}

export async function loginWithGoogle(): Promise<FirebaseUser> {
  const cred = await signInWithPopup(auth, googleProvider)
  const userRef = doc(db, 'users', cred.user.uid)
  const snap = await getDoc(userRef)

  if (!snap.exists()) {
    // New Google user — create profile
    const baseUsername = (cred.user.displayName || cred.user.email || 'user')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20)
    const username = `${baseUsername}${Math.floor(Math.random() * 999)}`

    const profile: UserProfile = {
      uid: cred.user.uid,
      username,
      displayName: cred.user.displayName || 'User',
      email: cred.user.email || '',
      phone: cred.user.phoneNumber || null,
      photoURL: cred.user.photoURL || null,
      bio: '',
      createdAt: Timestamp.now(),
      lastSeen: Timestamp.now(),
      isOnline: true,
      blockable: true,
      blockedUsers: [],
      settings: {
        profileVisible: true,
        readReceipts: true,
        showLastSeen: true,
        showPhone: false,
        notificationsEnabled: true
      }
    }
    await setDoc(userRef, profile)
  } else {
    await updateDoc(userRef, { isOnline: true, lastSeen: serverTimestamp() })
  }
  return cred.user
}

export async function logoutUser(): Promise<void> {
  if (auth.currentUser) {
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      isOnline: false,
      lastSeen: serverTimestamp()
    })
  }
  await signOut(auth)
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email)
}

// ─── User Profile Functions ───────────────────────────────────────────────────
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? (snap.data() as UserProfile) : null
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  await updateDoc(doc(db, 'users', uid), updates)
  if (updates.displayName && auth.currentUser) {
    await updateProfile(auth.currentUser, { displayName: updates.displayName })
  }
  if (updates.photoURL && auth.currentUser) {
    await updateProfile(auth.currentUser, { photoURL: updates.photoURL })
  }
}

export async function uploadProfilePhoto(uid: string, file: File): Promise<string> {
  const ref = storageRef(storage, `profile-photos/${uid}/${Date.now()}-${file.name}`)
  await uploadBytes(ref, file)
  const url = await getDownloadURL(ref)
  await updateDoc(doc(db, 'users', uid), { photoURL: url })
  if (auth.currentUser) {
    await updateProfile(auth.currentUser, { photoURL: url })
  }
  return url
}

export async function searchUsers(searchTerm: string, currentUid: string): Promise<UserProfile[]> {
  const term = searchTerm.toLowerCase().trim()
  if (!term) return []

  // Search by username prefix
  const usernameQuery = query(
    collection(db, 'users'),
    where('username', '>=', term),
    where('username', '<=', term + '\uf8ff'),
    limit(20)
  )
  const snap = await getDocs(usernameQuery)
  const results: UserProfile[] = []
  snap.forEach(d => {
    const data = d.data() as UserProfile
    if (data.uid !== currentUid) results.push(data)
  })
  return results
}

// ─── Blocking Functions ───────────────────────────────────────────────────────
export async function blockUser(currentUid: string, targetUid: string): Promise<void> {
  // Check if target is blockable
  const targetSnap = await getDoc(doc(db, 'users', targetUid))
  if (!targetSnap.exists()) throw new Error('User not found')
  const targetData = targetSnap.data() as UserProfile
  if (!targetData.blockable) throw new Error('This user cannot be blocked')

  await updateDoc(doc(db, 'users', currentUid), {
    blockedUsers: arrayUnion(targetUid)
  })
}

export async function unblockUser(currentUid: string, targetUid: string): Promise<void> {
  await updateDoc(doc(db, 'users', currentUid), {
    blockedUsers: arrayRemove(targetUid)
  })
}

// ─── Chat Functions ───────────────────────────────────────────────────────────
export async function getOrCreateChat(uid1: string, uid2: string, profiles: Record<string, UserProfile>): Promise<string> {
  // Find existing chat
  const chatQuery = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', uid1)
  )
  const snap = await getDocs(chatQuery)
  for (const d of snap.docs) {
    const chat = d.data() as Chat
    if (chat.participants.includes(uid2)) return d.id
  }

  // Create new chat
  const p1 = profiles[uid1]
  const p2 = profiles[uid2]
  const chatData: Omit<Chat, 'id'> = {
    participants: [uid1, uid2],
    participantNames: {
      [uid1]: p1?.displayName || 'Unknown',
      [uid2]: p2?.displayName || 'Unknown'
    },
    participantPhotos: {
      [uid1]: p1?.photoURL || null,
      [uid2]: p2?.photoURL || null
    },
    lastMessage: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    unreadCounts: { [uid1]: 0, [uid2]: 0 }
  }
  const ref = await addDoc(collection(db, 'chats'), chatData)
  return ref.id
}

export async function sendMessage(chatId: string, senderId: string, content: string, type: 'text' | 'image' = 'text'): Promise<void> {
  const batch = writeBatch(db)

  const msgRef = doc(collection(db, 'chats', chatId, 'messages'))
  const msg: Omit<Message, 'id'> = {
    senderId,
    content,
    timestamp: Timestamp.now(),
    type,
    readBy: [senderId],
    deleted: false
  }
  batch.set(msgRef, msg)

  // Update chat metadata
  const chatRef = doc(db, 'chats', chatId)
  const chatSnap = await getDoc(chatRef)
  if (chatSnap.exists()) {
    const chatData = chatSnap.data() as Chat
    const unreadUpdate: Record<string, number> = {}
    chatData.participants.forEach(uid => {
      if (uid !== senderId) {
        unreadUpdate[`unreadCounts.${uid}`] = increment(1) as any
      }
    })
    batch.update(chatRef, {
      lastMessage: { content, senderId, timestamp: Timestamp.now() },
      updatedAt: Timestamp.now(),
      ...unreadUpdate
    })
  }

  await batch.commit()
}

export async function markMessagesRead(chatId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'chats', chatId), {
    [`unreadCounts.${uid}`]: 0
  })
}

export async function deleteMessage(chatId: string, messageId: string): Promise<void> {
  await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
    deleted: true,
    content: 'This message was deleted'
  })
}

// ─── Call History Functions ───────────────────────────────────────────────────
export async function createCallRecord(record: Omit<CallRecord, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'calls'), record)
  return ref.id
}

export async function updateCallRecord(callId: string, updates: Partial<CallRecord>): Promise<void> {
  await updateDoc(doc(db, 'calls', callId), updates)
}

export async function getCallHistory(uid: string, limitCount = 50): Promise<CallRecord[]> {
  const q = query(
    collection(db, 'calls'),
    where('participants', 'array-contains', uid),
    orderBy('startedAt', 'desc'),
    limit(limitCount)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CallRecord))
}

// ─── Real-time Listeners ──────────────────────────────────────────────────────
export function listenToUserChats(uid: string, callback: (chats: (Chat & { id: string })[]) => void) {
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', uid),
    orderBy('updatedAt', 'desc')
  )
  return onSnapshot(q, snap => {
    const chats = snap.docs.map(d => ({ id: d.id, ...d.data() } as Chat & { id: string }))
    callback(chats)
  })
}

export function listenToChatMessages(
  chatId: string,
  callback: (messages: (Message & { id: string })[]) => void
) {
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('timestamp', 'asc')
  )
  return onSnapshot(q, snap => {
    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message & { id: string }))
    callback(messages)
  })
}

export function listenToUserPresence(uid: string, callback: (data: Partial<UserProfile>) => void) {
  return onSnapshot(doc(db, 'users', uid), snap => {
    if (snap.exists()) callback(snap.data() as Partial<UserProfile>)
  })
}

export function listenToUserProfile(uid: string, callback: (profile: UserProfile | null) => void) {
  return onSnapshot(doc(db, 'users', uid), snap => {
    callback(snap.exists() ? (snap.data() as UserProfile) : null)
  })
}

export { onAuthStateChanged, serverTimestamp, Timestamp }
export type { FirebaseUser, DocumentData }
