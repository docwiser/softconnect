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
  signInWithRedirect,
  getRedirectResult,
  fetchSignInMethodsForEmail,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
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

  authDomain: "softconnect.susantswain.com",

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
  role?: 'admin' | 'user'
}

export interface Report {
  id: string
  reporterId: string
  reporterName: string
  targetId: string      // The user being reported (peer)
  targetName: string
  chatId: string
  messageId?: string    // If reporting a specific message
  content: string       // The message content or "Full Chat Report"
  reason: string        // Optional reason from reporter
  timestamp: Timestamp
  status: 'pending' | 'resolved' | 'dismissed'
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
  replyTo?: string
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
  username: string,
  phone: string | null = null
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
    phone,
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
    },
    role: 'user'
  }
  await setDoc(doc(db, 'users', cred.user.uid), profile)
  return cred.user
}

export async function loginUser(email: string, password: string): Promise<FirebaseUser> {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

export async function loginWithGoogle(): Promise<void> {
  await signInWithRedirect(auth, googleProvider)
}

export async function handleRedirectResult(): Promise<FirebaseUser | null> {
  const result = await getRedirectResult(auth)
  if (!result) return null

  const userRef = doc(db, 'users', result.user.uid)
  const snap = await getDoc(userRef)

  if (!snap.exists()) {
    // New Google user — create profile
    const baseUsername = (result.user.displayName || result.user.email || 'user')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20)
    const username = `${baseUsername}${Math.floor(Math.random() * 999)}`

    const profile: UserProfile = {
      uid: result.user.uid,
      username,
      displayName: result.user.displayName || 'User',
      email: result.user.email || '',
      phone: result.user.phoneNumber || null,
      photoURL: result.user.photoURL || null,
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
      },
      role: 'user'
    }
    await setDoc(userRef, profile)
  }
  return result.user
}

export async function checkEmailExists(email: string): Promise<boolean> {
  try {
    const methods = await fetchSignInMethodsForEmail(auth, email)
    return methods.length > 0
  } catch (e: any) {
    // Fallback to Firestore check if Auth enumeration is protected
    const q = query(collection(db, 'users'), where('email', '==', email))
    const snap = await getDocs(q)
    return !snap.empty
  }
}

export async function getUserByPhone(phone: string): Promise<UserProfile | null> {
  // Normalize phone for searching if needed, but the requirement says "not strict =="
  // Firestore doesn't support fuzzy matching well without external tools, 
  // but we can try to search for the string as provided.
  const q = query(collection(db, 'users'), where('phone', '==', phone))
  const snap = await getDocs(q)
  if (!snap.empty) return snap.docs[0].data() as UserProfile

  // If not found, try a simple normalization (remove non-digits) and search
  const normalized = phone.replace(/\D/g, '')
  if (normalized && normalized !== phone) {
    const q2 = query(collection(db, 'users'), where('phone', '==', normalized))
    const snap2 = await getDocs(q2)
    if (!snap2.empty) return snap2.docs[0].data() as UserProfile
  }
  
  return null
}

export async function sendMagicLink(email: string): Promise<void> {
  const actionCodeSettings = {
    url: window.location.origin + '/auth',
    handleCodeInApp: true,
  }
  await sendSignInLinkToEmail(auth, email, actionCodeSettings)
  window.localStorage.setItem('emailForSignIn', email)
}

export async function completeMagicLinkSignIn(): Promise<FirebaseUser | null> {
  if (isSignInWithEmailLink(auth, window.location.href)) {
    let email = window.localStorage.getItem('emailForSignIn')
    if (!email) {
      email = window.prompt('Please provide your email for confirmation')
    }
    if (email) {
      const result = await signInWithEmailLink(auth, email, window.location.href)
      window.localStorage.removeItem('emailForSignIn')
      
      const userRef = doc(db, 'users', result.user.uid)
      const snap = await getDoc(userRef)

      if (!snap.exists()) {
        // New Magic Link user — create profile
        const baseUsername = (result.user.displayName || result.user.email || 'user')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 20)
        const username = `${baseUsername}${Math.floor(Math.random() * 999)}`

        const profile: UserProfile = {
          uid: result.user.uid,
          username,
          displayName: result.user.displayName || 'User',
          email: result.user.email || email,
          phone: result.user.phoneNumber || null,
          photoURL: result.user.photoURL || null,
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
          },
          role: 'user'
        }
        await setDoc(userRef, profile)
      }
      
      return result.user
    }
  }
  return null
}

export async function logoutUser(): Promise<void> {
  if (auth.currentUser) {
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        isOnline: false,
        lastSeen: serverTimestamp()
      })
    } catch (error) {
      console.error('Error updating user status during logout:', error)
      // We continue to sign out even if the status update fails
    }
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

export async function deleteChat(chatId: string): Promise<void> {
  const batch = writeBatch(db)
  const messagesSnap = await getDocs(collection(db, 'chats', chatId, 'messages'))
  messagesSnap.forEach(d => batch.delete(d.ref))
  batch.delete(doc(db, 'chats', chatId))
  await batch.commit()
}

// ─── Reporting Functions ─────────────────────────────────────────────────────
export async function reportContent(
  reporterId: string,
  reporterName: string,
  targetId: string,
  targetName: string,
  chatId: string,
  content: string,
  messageId?: string,
  reason = 'Policy violation'
): Promise<void> {
  const report: Omit<Report, 'id'> = {
    reporterId,
    reporterName,
    targetId,
    targetName,
    chatId,
    messageId,
    content,
    reason,
    timestamp: Timestamp.now(),
    status: 'pending'
  }
  await addDoc(collection(db, 'reports'), report)
}

export async function getReports(): Promise<Report[]> {
  const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Report))
}

export async function resolveReport(reportId: string, status: 'resolved' | 'dismissed'): Promise<void> {
  await updateDoc(doc(db, 'reports', reportId), { status })
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
