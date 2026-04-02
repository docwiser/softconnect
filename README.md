# ◈ Soft Connect

**Open-source, privacy-first real-time chat & calling platform**  
Engineered by Susant Swain

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3 + TypeScript + Vite |
| State | Pinia |
| Realtime DB | Firebase Firestore |
| Auth | Firebase Authentication |
| File Storage | Firebase Storage |
| P2P Calls | PeerJS (WebRTC) |
| Styling | Scoped CSS (DM Sans + Syne) |

---

## Features

### Authentication
- Email/password registration & login
- Google OAuth one-tap login
- Password reset via email
- Email verification on signup
- Persistent sessions via Firebase Auth

### User Profiles (`users/{uid}`)
Every user document follows this standard schema:
```
users/{uid}
  uid: string
  username: string          ← unique, searchable, lowercase
  displayName: string
  email: string
  phone: string | null
  photoURL: string | null
  bio: string
  createdAt: Timestamp
  lastSeen: Timestamp
  isOnline: boolean
  blockable: boolean        ← if false, NO user can block them
  blockedUsers: string[]    ← UIDs this user has blocked
  settings:
    profileVisible: boolean
    readReceipts: boolean
    showLastSeen: boolean
    showPhone: boolean
    notificationsEnabled: boolean
```

### Messaging
- Real-time messages via Firestore `onSnapshot`
- Per-chat unread counts (per-user)
- Read receipts (respects privacy setting)
- Soft message deletion ("This message was deleted")
- Date dividers in message thread
- Auto-scrolling to latest message
- Shift+Enter for newline, Enter to send

### Blocking System
- Any user can block any other user
- **Exception**: Users with `blockable: false` in Firestore **cannot be blocked by anyone**
  - This is enforced both in app logic and Firestore security rules
  - Only a Firebase Admin (server-side) can set `blockable: false`
- Blocked users are filtered from search results
- Block/unblock from: New Chat screen, Chat screen, Profile screen

### Calling (PeerJS + Firestore)
- Voice calls and video calls
- Incoming call UI with ringtone + ring pulse animation
- Reject with quick reply messages or custom message
- In-call controls: Mute, Camera toggle, Screen share, Hold, Settings
- Playback speed control (0.5x – 3x)
- Audio/video device switching mid-call
- All calls logged to Firestore `calls/{callId}`:
  ```
  callerId, callerName, callerPhoto
  receiverId, receiverName, receiverPhoto
  type: 'voice' | 'video'
  status: 'missed' | 'answered' | 'rejected' | 'ongoing'
  startedAt, endedAt, duration (seconds)
  ```
- Full call history screen with recall button

### Settings
- Edit display name, username, bio, phone
- Upload/change profile photo (Firebase Storage, max 5MB)
- Toggle: profile visibility, read receipts, show last seen, show phone, notifications

### New Chat (User Search)
- Search users by username (prefix search)
- Start chat, voice call, or video call directly from results
- Block user from search results
- Blocked users hidden from results

---

## Setup

### 1. Create Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Enable these services:
   - **Authentication** → Email/Password + Google
   - **Firestore Database** (start in production mode)
   - **Storage**

### 2. Configure Firebase

Edit `src/services/firebase.ts` and replace the config object:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
}
```

Find these values in: Firebase Console → Project Settings → Your apps → Web app config

### 3. Deploy Security Rules

```bash
npm install -g firebase-tools
firebase login
firebase init   # select Firestore, Storage, Hosting
firebase deploy --only firestore:rules,storage
```

Or paste `firestore.rules` manually in:  
Firebase Console → Firestore → Rules tab

### 4. Set Up Indexes

```bash
firebase deploy --only firestore:indexes
```

Or create them manually per `firestore.indexes.json`.

### 5. Install & Run

```bash
npm install
npm run dev
```

### 6. Build & Deploy

```bash
npm run build
firebase deploy --only hosting
```

---

## Setting `blockable: false` (Admin Only)

To make a user unblockable (e.g. support accounts, bots), use the Firebase Admin SDK or the Firestore console:

```javascript
// Firebase Admin SDK (server-side only)
await admin.firestore().doc(`users/${uid}`).update({ blockable: false })
```

The Firestore security rules prevent any client from changing the `blockable` field, so this is fully server-enforced.

---

## PeerJS Architecture

Each user gets a PeerJS connection ID of `sc_{uid}` (stored in `peerIds/{uid}`).  
When starting a call:
1. App fetches target's peer connection ID from `peerIds/{targetUid}`
2. Establishes a data channel for call signaling (request/reject/busy/hold)
3. Opens a media connection for audio/video streams
4. Creates a Firestore call record

---

## Project Structure

```
src/
├── components/
│   ├── AuthScreen.vue        ← Login / Register / Google OAuth
│   ├── WelcomeScreen.vue     ← Auth-ready redirect loader
│   ├── Dashboard.vue         ← Chat list + sidebar nav
│   ├── NewChatScreen.vue     ← Search users, start chat/call/block
│   ├── ChatScreen.vue        ← Real-time messaging
│   ├── CallScreen.vue        ← PeerJS voice/video call UI
│   ├── CallHistoryScreen.vue ← Firestore call log
│   ├── ProfileScreen.vue     ← User profile view
│   └── SettingsScreen.vue    ← Edit profile + privacy toggles
├── stores/
│   ├── app.ts                ← Auth state, chats, call state, notifications
│   └── peer.ts               ← PeerJS connection, call controls
├── services/
│   └── firebase.ts           ← All Firebase functions + type exports
├── composables/
│   └── useAuth.ts            ← Auth state listener + peer init
├── router/
│   └── index.ts              ← Vue Router + auth guards
├── types/
│   └── index.ts              ← Shared TypeScript types
├── App.vue                   ← Root: global call banner + toast stack
└── main.ts                   ← App bootstrap
```

---

## Privacy Policy Summary

- No ads, no tracking, no data selling
- All messages stored in your own Firebase project
- E2E encryption: not implemented (PeerJS media streams are encrypted via DTLS, but Firestore messages are not E2E encrypted — consider adding Signal Protocol for true E2E)
- Users control their own visibility, last seen, read receipts

---

*© 2025 Soft Connect · Engineered by Susant Swain*
