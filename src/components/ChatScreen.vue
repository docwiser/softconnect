<template>
  <div class="chat-screen" id="main-content" tabindex="-1">
    <!-- Header -->
    <header class="chat-header" role="banner">
      <button
        class="back-btn"
        @click="goBack"
        aria-label="Back to dashboard"
        title="Back"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
      </button>

      <!-- Peer Info — clicking opens profile dialog -->
      <button
        class="peer-info-btn"
        @click="openProfile"
        :aria-label="`View ${peerName}'s profile. ${peerOnline ? 'Online' : lastSeenText}`"
        :title="`View ${peerName}'s profile`"
      >
        <div class="peer-avatar" aria-hidden="true">
          <img v-if="peerPhoto" :src="peerPhoto" :alt="peerName" />
          <span v-else>{{ peerName.charAt(0).toUpperCase() }}</span>
          <span v-if="peerOnline" class="presence-ring online" aria-hidden="true"></span>
        </div>
        <div class="peer-meta">
          <span class="peer-name">{{ peerName }}</span>
          <span class="peer-status" :class="{ online: peerOnline }">
            <span v-if="peerOnline" class="status-dot" aria-hidden="true"></span>
            {{ peerOnline ? 'Online' : lastSeenText }}
          </span>
        </div>
      </button>

      <!-- Action buttons -->
      <div class="header-actions" role="toolbar" :aria-label="`Actions for chat with ${peerName}`">
        <template v-if="isBlocked">
          <button
            class="header-btn unblock-btn-header"
            @click="showUnblockModal = true"
            aria-label="Unblock user"
            title="Unblock"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          </button>
          <button
            class="header-btn delete-btn-header"
            @click="showDeleteChatModal = true"
            aria-label="Delete chat"
            title="Delete Chat"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
            </svg>
          </button>
        </template>
        <template v-else>
          <button
            class="header-btn"
            @click="startCall(false)"
            :disabled="isCallActive || !peerOnline"
            :aria-label="peerOnline ? `Start voice call with ${peerName}` : `${peerName} is offline — voice call unavailable`"
            :title="peerOnline ? 'Voice call' : 'User offline'"
            :aria-disabled="isCallActive || !peerOnline"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14v2.92z"/>
            </svg>
          </button>
          <button
            class="header-btn"
            @click="startCall(true)"
            :disabled="isCallActive || !peerOnline"
            :aria-label="peerOnline ? `Start video call with ${peerName}` : `${peerName} is offline — video call unavailable`"
            :title="peerOnline ? 'Video call' : 'User offline'"
            :aria-disabled="isCallActive || !peerOnline"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </button>
          <button
            class="header-btn"
            @click="toggleMenu"
            :aria-label="showMenu ? 'Close options menu' : 'More options'"
            :aria-expanded="showMenu"
            aria-haspopup="true"
            ref="menuTriggerRef"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>
        </template>
      </div>

      <!-- Context Menu -->
      <Transition name="menu-pop">
        <div
          v-if="showMenu"
          class="context-menu"
          ref="menuRef"
          role="menu"
          :aria-label="`Options for chat with ${peerName}`"
        >
          <button role="menuitem" @click="openProfile">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 00-16 0"/></svg>
            View Profile
          </button>
          <button role="menuitem" @click="searchMessages">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Search Messages
          </button>
          <button role="menuitem" @click="copyLastMessage" :disabled="messages.length === 0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            Copy Last Message
          </button>
          <button role="menuitem" @click="exportChat">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export Chat
          </button>
          <div class="menu-divider" role="separator"></div>
          <button role="menuitem" @click="toggleMute">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            {{ isChatMuted ? 'Unmute Notifications' : 'Mute Notifications' }}
          </button>
          <button role="menuitem" @click="pinChat">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {{ isPinned ? 'Unpin Chat' : 'Pin Chat' }}
          </button>
          <button role="menuitem" @click="clearChat" class="menu-warning">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            Clear Messages
          </button>
          <button v-if="isPeerBlockable" role="menuitem" @click="confirmBlockPeer" class="menu-danger">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            Block User
          </button>
          <button role="menuitem" @click="confirmReportChat" class="menu-danger">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Report Chat
          </button>
        </div>
      </Transition>
    </header>

    <!-- Search bar (conditional) -->
    <Transition name="slide-down">
      <search v-if="isSearching" class="search-bar" aria-label="Search messages">
        <label for="msg-search" class="sr-only">Search messages</label>
        <input
          id="msg-search"
          ref="searchInputEl"
          v-model="searchQuery"
          type="search"
          placeholder="Search messages…"
          aria-label="Search messages"
          :aria-describedby="searchQuery ? 'search-results-count' : undefined"
          @keydown.escape="isSearching = false; searchQuery = ''"
        />
        <span
          v-if="searchQuery"
          id="search-results-count"
          class="search-results-count"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {{ searchResultCount }} result{{ searchResultCount !== 1 ? 's' : '' }}
        </span>
        <button
          @click="isSearching = false; searchQuery = ''"
          aria-label="Close message search"
        >✕</button>
      </search>
    </Transition>

    <!-- Messages -->
    <main
      ref="messagesEl"
      class="messages-area"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      :aria-label="`Messages with ${peerName}`"
    >
      <div v-if="filteredMessages.length === 0 && !searchQuery" class="no-messages" role="status">
        <div class="wave" aria-hidden="true">👋</div>
        <p>Say hello to <strong>{{ peerName }}</strong>!</p>
        <p class="no-msg-hint">Messages are end-to-end secured via Firebase rules.</p>
      </div>

      <div v-if="searchQuery && filteredMessages.length === 0" class="no-results" role="status">
        <p>No messages matching "{{ searchQuery }}"</p>
      </div>

      <template v-for="(msg, i) in filteredMessages" :key="msg.id">
        <!-- Date divider -->
        <div
          v-if="showDateDivider(msg, filteredMessages[i-1])"
          class="date-divider"
          role="separator"
          :aria-label="`Messages from ${formatDateDivider(msg.timestamp?.toMillis())}`"
        >
          <span>{{ formatDateDivider(msg.timestamp?.toMillis()) }}</span>
        </div>

        <article
          :class="['message-wrap', msg.senderId === myUid ? 'own' : 'peer']"
          :id="`msg-${msg.id}`"
          :aria-label="getMessageAriaLabel(msg)"
        >
          <div
            :class="['bubble', { deleted: msg.deleted, highlighted: highlightedMsgId === msg.id }]"
            @dblclick="msg.senderId === myUid && !msg.deleted ? startReplyTo(msg) : undefined"
          >
            <!-- Reply indicator -->
            <div v-if="msg.replyTo" class="reply-indicator" aria-label="Replying to a previous message">
              <span class="reply-bar" aria-hidden="true"></span>
              <span class="reply-text">{{ msg.replyTo }}</span>
            </div>

            <span class="msg-text">{{ msg.content }}</span>
            <div class="msg-meta">
              <time
                class="msg-time"
                :datetime="msg.timestamp?.toDate().toISOString()"
                :title="msg.timestamp?.toDate().toLocaleString()"
              >{{ formatMsgTime(msg.timestamp?.toMillis()) }}</time>
              <span
                v-if="msg.senderId === myUid && !msg.deleted"
                class="read-indicator"
                :title="msg.readBy.length > 1 ? 'Read' : 'Delivered'"
                :aria-label="msg.readBy.length > 1 ? 'Message read' : 'Message delivered'"
              >
                <svg v-if="msg.readBy.length > 1" width="14" height="10" viewBox="0 0 16 10" fill="none" aria-hidden="true">
                  <path d="M1 5l4 4L15 1" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M5 5l4 4" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <svg v-else width="10" height="10" viewBox="0 0 16 10" fill="none" aria-hidden="true">
                  <path d="M1 5l4 4L15 1" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </div>
          </div>

          <!-- Message actions on hover -->
          <div
            v-if="!msg.deleted"
            class="msg-actions"
            :class="msg.senderId === myUid ? 'own-actions' : 'peer-actions'"
            role="group"
            :aria-label="`Actions for message from ${msg.senderId === myUid ? 'you' : peerName}`"
          >
            <button
              class="msg-action-btn"
              @click="startReplyTo(msg)"
              aria-label="Reply to this message"
              title="Reply"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>
            </button>
            <button
              class="msg-action-btn"
              @click="copyMessage(msg.content)"
              aria-label="Copy message text to clipboard"
              title="Copy"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            </button>
            <button
              v-if="msg.senderId === myUid"
              class="msg-action-btn danger"
              @click="deleteMsg(msg.id)"
              aria-label="Delete this message"
              title="Delete"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            </button>
            <button
              v-if="msg.senderId !== myUid"
              class="msg-action-btn danger"
              @click="confirmReportMessage(msg)"
              aria-label="Report this message"
              title="Report"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </button>
          </div>
        </article>
      </template>

      <!-- Typing indicator -->
      <div
        v-if="peerIsTyping"
        class="typing-indicator"
        aria-live="polite"
        :aria-label="`${peerName} is typing`"
        role="status"
      >
        <span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>
        <span class="sr-only">{{ peerName }} is typing…</span>
      </div>

      <div ref="bottomAnchor" tabindex="-1"></div>
    </main>

    <!-- Reply banner -->
    <Transition name="slide-up-sm">
      <div
        v-if="replyTo"
        class="reply-banner"
        role="status"
        :aria-label="`Replying to message: ${replyTo.content}`"
      >
        <div class="reply-banner-content">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>
          <span>Replying to: {{ truncate(replyTo.content, 60) }}</span>
        </div>
        <button @click="replyTo = null" aria-label="Cancel reply">✕</button>
      </div>
    </Transition>

    <!-- Input area -->
    <footer class="input-area" role="contentinfo" aria-label="Compose message">
      <div v-if="isBlocked" class="blocked-input-area">
        <p class="blocked-hint">You have blocked this user. Unblock to resume chatting.</p>
        <div class="blocked-actions">
          <button class="blocked-btn unblock" @click="showUnblockModal = true">Unblock</button>
          <button class="blocked-btn delete" @click="showDeleteChatModal = true">Delete Chat</button>
        </div>
      </div>
      <form v-else @submit.prevent="sendMsg" :aria-label="`Send a message to ${peerName}`">
        <button
          type="button"
          class="attach-btn"
          @click="handleAttachment"
          aria-label="Attach a file (coming soon)"
          title="Attach file (coming soon)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
        </button>

        <div class="input-wrapper">
          <label for="message-input" class="sr-only">Type a message to {{ peerName }}</label>
          <textarea
            id="message-input"
            ref="inputEl"
            v-model="newMsg"
            placeholder="Message…"
            class="msg-input"
            :maxlength="2000"
            @keydown="handleInputKey"
            @input="autoResize(); handleTyping()"
            rows="1"
            :aria-label="`Type a message to ${peerName}`"
            :aria-describedby="newMsg.length > 1800 ? 'char-count' : 'input-hint'"
          ></textarea>
          <span id="input-hint" class="sr-only">Press Enter to send, Shift+Enter for new line</span>
          <span
            v-if="newMsg.length > 1800"
            id="char-count"
            class="char-hint"
            role="status"
            aria-live="polite"
            :aria-label="`${2000 - newMsg.length} characters remaining`"
          >{{ 2000 - newMsg.length }}</span>
        </div>

        <button
          type="submit"
          class="send-btn"
          :disabled="!newMsg.trim()"
          :aria-label="newMsg.trim() ? `Send message to ${peerName}` : 'Type a message first'"
          :aria-disabled="!newMsg.trim()"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </form>
    </footer>

    <!-- Profile Dialog — uses native dialog for auto-focus management -->
    <Transition name="modal-fade">
      <div
        v-if="showProfileDialog && peerProfile"
        class="modal-overlay"
        @click.self="showProfileDialog = false"
        role="presentation"
      >
        <dialog
          open
          class="profile-dialog"
          :aria-label="`${peerProfile.displayName}'s profile`"
          @keydown.escape="showProfileDialog = false"
        >
          <button
            class="dialog-close"
            @click="showProfileDialog = false"
            aria-label="Close profile"
            ref="profileDialogCloseRef"
          >✕</button>
          <div class="dialog-avatar" aria-hidden="true">
            <img v-if="peerProfile.photoURL" :src="peerProfile.photoURL" :alt="peerProfile.displayName" />
            <span v-else>{{ peerProfile.displayName.charAt(0).toUpperCase() }}</span>
            <span v-if="peerOnline" class="dialog-online-badge" aria-hidden="true">Online</span>
          </div>
          <h2>{{ peerProfile.displayName }}</h2>
          <p class="dialog-username">@{{ peerProfile.username }}</p>
          <p v-if="peerProfile.bio" class="dialog-bio">{{ peerProfile.bio }}</p>
          <ul class="dialog-chips" aria-label="Profile details">
            <li v-if="peerProfile.settings?.showPhone && peerProfile.phone">
              <span aria-label="Phone number">📱 {{ peerProfile.phone }}</span>
            </li>
            <li>
              <span>📅 Joined {{ formatJoinDate(peerProfile.createdAt?.toMillis()) }}</span>
            </li>
            <li v-if="!peerOnline && peerProfile.settings?.showLastSeen">
              <span>🕐 {{ lastSeenText }}</span>
            </li>
          </ul>
          <div class="dialog-actions" role="group" aria-label="Actions">
            <button
              class="dialog-btn primary"
              @click="startCall(false); showProfileDialog = false"
              :disabled="!peerOnline"
              :aria-label="`Voice call ${peerProfile.displayName}`"
            >
              📞 Call
            </button>
            <button
              class="dialog-btn primary"
              @click="startCall(true); showProfileDialog = false"
              :disabled="!peerOnline"
              :aria-label="`Video call ${peerProfile.displayName}`"
            >
              📹 Video
            </button>
            <button
              class="dialog-btn"
              @click="viewFullProfile"
              aria-label="View full profile page"
            >View Full Profile</button>
          </div>
        </dialog>
      </div>
    </Transition>

    <!-- Block confirm dialog -->
    <Transition name="modal-fade">
      <div
        v-if="showBlockModal"
        class="modal-overlay"
        @click.self="showBlockModal = false"
        role="presentation"
      >
        <dialog
          open
          class="modal"
          :aria-label="`Block ${peerName}`"
          @keydown.escape="showBlockModal = false"
        >
          <h2 id="block-dialog-title">Block {{ peerName }}?</h2>
          <p id="block-dialog-desc">They won't be able to send you messages or call you. You can unblock later from the Blocklist or this chat.</p>
          <div class="modal-actions">
            <button class="modal-cancel" @click="showBlockModal = false">Cancel</button>
            <button class="modal-confirm" @click="doBlockPeer" :aria-label="`Confirm blocking ${peerName}`">Block</button>
          </div>
        </dialog>
      </div>
    </Transition>

    <!-- Unblock confirm dialog -->
    <Transition name="modal-fade">
      <div
        v-if="showUnblockModal"
        class="modal-overlay"
        @click.self="showUnblockModal = false"
        role="presentation"
      >
        <dialog
          open
          class="modal"
          :aria-label="`Unblock ${peerName}`"
          @keydown.escape="showUnblockModal = false"
        >
          <h2 id="unblock-dialog-title">Unblock {{ peerName }}?</h2>
          <p id="unblock-dialog-desc">They will be able to send you messages and call you again.</p>
          <div class="modal-actions">
            <button class="modal-cancel" @click="showUnblockModal = false">Cancel</button>
            <button class="modal-confirm" @click="doUnblockPeer" :aria-label="`Confirm unblocking ${peerName}`">Unblock</button>
          </div>
        </dialog>
      </div>
    </Transition>

    <!-- Delete chat confirm dialog -->
    <Transition name="modal-fade">
      <div
        v-if="showDeleteChatModal"
        class="modal-overlay"
        @click.self="showDeleteChatModal = false"
        role="presentation"
      >
        <dialog
          open
          class="modal"
          aria-label="Delete entire chat"
          @keydown.escape="showDeleteChatModal = false"
        >
          <h2>Delete this chat?</h2>
          <p>This will permanently delete all messages for both you and {{ peerName }}. This cannot be undone.</p>
          <div class="modal-actions">
            <button class="modal-cancel" @click="showDeleteChatModal = false">Cancel</button>
            <button class="modal-confirm" @click="doDeleteChat">Delete</button>
          </div>
        </dialog>
      </div>
    </Transition>

    <!-- Clear chat confirm dialog -->
    <Transition name="modal-fade">
      <div
        v-if="showClearModal"
        class="modal-overlay"
        @click.self="showClearModal = false"
        role="presentation"
      >
        <dialog
          open
          class="modal"
          aria-label="Clear all messages"
          @keydown.escape="showClearModal = false"
        >
          <h2>Clear all messages?</h2>
          <p>This will delete all messages in this chat for you. This cannot be undone.</p>
          <div class="modal-actions">
            <button class="modal-cancel" @click="showClearModal = false">Cancel</button>
            <button class="modal-confirm" @click="doClearChat">Clear</button>
          </div>
        </dialog>
      </div>
    </Transition>

    <!-- Report chat confirm dialog -->
    <Transition name="modal-fade">
      <div
        v-if="showReportChatModal"
        class="modal-overlay"
        @click.self="showReportChatModal = false"
        role="presentation"
      >
        <dialog
          open
          class="modal"
          aria-label="Report chat"
          @keydown.escape="showReportChatModal = false"
        >
          <h2>Report this chat?</h2>
          <p>This will send a copy of this chat's metadata and a summary to the administrators for review. Use this for reporting harassment or policy violations.</p>
          <div class="modal-actions">
            <button class="modal-cancel" @click="showReportChatModal = false">Cancel</button>
            <button class="modal-confirm danger" @click="doReportChat">Send Report</button>
          </div>
        </dialog>
      </div>
    </Transition>

    <!-- Report message confirm dialog -->
    <Transition name="modal-fade">
      <div
        v-if="reportMsgTarget"
        class="modal-overlay"
        @click.self="reportMsgTarget = null"
        role="presentation"
      >
        <dialog
          open
          class="modal"
          aria-label="Report message"
          @keydown.escape="reportMsgTarget = null"
        >
          <h2>Report this message?</h2>
          <p>Report the following content to administrators:</p>
          <blockquote class="report-preview">"{{ reportMsgTarget.content }}"</blockquote>
          <div class="modal-actions">
            <button class="modal-cancel" @click="reportMsgTarget = null">Cancel</button>
            <button class="modal-confirm danger" @click="doReportMessage">Send Report</button>
          </div>
        </dialog>
      </div>
    </Transition>

    <!-- Live region for announcements -->
    <div aria-live="assertive" aria-atomic="true" class="sr-only" role="alert">{{ announcement }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { usePeerStore } from '../stores/peer'
import {
  auth, db,
  sendMessage as fbSendMessage,
  markMessagesRead,
  deleteMessage,
  listenToChatMessages,
  listenToUserPresence,
  blockUser,
  unblockUser,
  getUserProfile,
  deleteChat,
  reportContent
} from '../services/firebase'
import type { Message, UserProfile } from '../services/firebase'
import { doc, getDoc } from 'firebase/firestore'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const peerStore = usePeerStore()

const chatId = ref(route.params.chatId as string)
const messages = ref<(Message & { id: string })[]>([])
const newMsg = ref('')
const announcement = ref('')
const showMenu = ref(false)
const showBlockModal = ref(false)
const showUnblockModal = ref(false)
const showDeleteChatModal = ref(false)
const showClearModal = ref(false)
const showReportChatModal = ref(false)
const reportMsgTarget = ref<(Message & { id: string }) | null>(null)
const showProfileDialog = ref(false)
const peerOnline = ref(false)
const peerLastSeen = ref<Date | null>(null)
const isPeerBlockable = ref(true)
const peerProfile = ref<UserProfile | null>(null)
const isChatMuted = ref(false)
const isPinned = ref(false)
const isSearching = ref(false)
const searchQuery = ref('')
const peerIsTyping = ref(false)
const replyTo = ref<(Message & { id: string }) | null>(null)
const highlightedMsgId = ref<string | null>(null)

const messagesEl = ref<HTMLElement>()
const bottomAnchor = ref<HTMLElement>()
const inputEl = ref<HTMLTextAreaElement>()
const menuRef = ref<HTMLElement>()
const menuTriggerRef = ref<HTMLButtonElement>()
const searchInputEl = ref<HTMLInputElement>()
const profileDialogCloseRef = ref<HTMLButtonElement>()

let typingTimer: ReturnType<typeof setTimeout> | null = null
let unsubMessages: (() => void) | null = null
let unsubPresence: (() => void) | null = null

const myUid = computed(() => auth.currentUser?.uid || '')
const chatData = computed(() => appStore.chats.find(c => c.id === chatId.value))
const peerId = computed(() => chatData.value?.participants.find(uid => uid !== myUid.value) || '')
const peerName = computed(() => chatData.value?.participantNames[peerId.value] || 'Unknown')
const peerPhoto = computed(() => chatData.value?.participantPhotos?.[peerId.value] || null)
const isCallActive = computed(() => appStore.callState.isActive || appStore.callState.isIncoming)
const isBlocked = computed(() => appStore.myBlockedUsers.includes(peerId.value))

const lastSeenText = computed(() => {
  if (!peerLastSeen.value) return 'Offline'
  const diff = Date.now() - peerLastSeen.value.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Last seen just now'
  if (mins < 60) return `Last seen ${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Last seen ${hrs}h ago`
  return `Last seen ${Math.floor(hrs / 24)}d ago`
})

const filteredMessages = computed(() => {
  if (!searchQuery.value.trim()) return messages.value
  const q = searchQuery.value.toLowerCase()
  return messages.value.filter(m => m.content.toLowerCase().includes(q))
})

const searchResultCount = computed(() => filteredMessages.value.length)

// Auto-focus profile dialog close button when it opens
watch(showProfileDialog, async (open) => {
  if (open) {
    await nextTick()
    profileDialogCloseRef.value?.focus()
  }
})

onMounted(async () => {
  appStore.setActiveChatId(chatId.value)

  unsubMessages = listenToChatMessages(chatId.value, (msgs) => {
    const prevLen = messages.value.length
    messages.value = msgs
    nextTick(() => {
      if (prevLen === 0 || msgs.length > prevLen) scrollToBottom()
      if (myUid.value) markMessagesRead(chatId.value, myUid.value)
    })
  })

  if (peerId.value) {
    unsubPresence = listenToUserPresence(peerId.value, (data) => {
      peerOnline.value = !!data.isOnline
      if (data.lastSeen) peerLastSeen.value = data.lastSeen.toDate()
    })

    const profile = await getUserProfile(peerId.value)
    if (profile) {
      peerProfile.value = profile
      isPeerBlockable.value = profile.blockable ?? true
    }
  }

  inputEl.value?.focus()
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleGlobalKey)
})

onUnmounted(() => {
  unsubMessages?.()
  unsubPresence?.()
  appStore.setActiveChatId(null)
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleGlobalKey)
  if (typingTimer) clearTimeout(typingTimer)
})

function handleClickOutside(e: MouseEvent) {
  if (showMenu.value && menuRef.value && menuTriggerRef.value) {
    if (!menuRef.value.contains(e.target as Node) && !menuTriggerRef.value.contains(e.target as Node)) {
      showMenu.value = false
    }
  }
}

function handleGlobalKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (showMenu.value) { showMenu.value = false; menuTriggerRef.value?.focus() }
    if (showProfileDialog.value) showProfileDialog.value = false
    if (isSearching.value) { isSearching.value = false; searchQuery.value = '' }
  }
}

function toggleMenu() {
  showMenu.value = !showMenu.value
}

async function sendMsg() {
  if (!newMsg.value.trim() || !myUid.value) return
  const content = newMsg.value.trim()
  newMsg.value = ''
  autoResize()
  replyTo.value = null
  try {
    await fbSendMessage(chatId.value, myUid.value, content)
  } catch {
    appStore.addNotification('Failed to send message', 'error')
    newMsg.value = content
  }
}

function handleInputKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMsg()
  }
}

function autoResize() {
  if (!inputEl.value) return
  inputEl.value.style.height = 'auto'
  inputEl.value.style.height = Math.min(inputEl.value.scrollHeight, 150) + 'px'
}

function handleTyping() {
  if (typingTimer) clearTimeout(typingTimer)
  typingTimer = setTimeout(() => {}, 2000)
}

function scrollToBottom(smooth = true) {
  bottomAnchor.value?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
}

function showDateDivider(msg: Message & { id: string }, prev?: Message & { id: string }): boolean {
  if (!prev) return true
  const d1 = msg.timestamp?.toDate()
  const d2 = prev.timestamp?.toDate()
  if (!d1 || !d2) return false
  return d1.toDateString() !== d2.toDateString()
}

function formatDateDivider(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatMsgTime(ts?: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatJoinDate(ts?: number): string {
  if (!ts) return 'Unknown'
  return new Date(ts).toLocaleDateString([], { month: 'long', year: 'numeric' })
}

function getMessageAriaLabel(msg: Message & { id: string }): string {
  const sender = msg.senderId === myUid.value ? 'You' : peerName.value
  const time = formatMsgTime(msg.timestamp?.toMillis())
  if (msg.deleted) return `${sender} deleted a message at ${time}`
  return `${sender} at ${time}: ${msg.content}`
}

function truncate(text: string, len: number): string {
  return text.length > len ? text.slice(0, len) + '…' : text
}

async function deleteMsg(msgId: string) {
  try {
    await deleteMessage(chatId.value, msgId)
    announcement.value = 'Message deleted'
  } catch {
    appStore.addNotification('Could not delete message', 'error')
  }
}

async function copyMessage(content: string) {
  try {
    await navigator.clipboard.writeText(content)
    appStore.addNotification('Copied to clipboard', 'success')
  } catch {
    appStore.addNotification('Could not copy', 'error')
  }
}

function startReplyTo(msg: Message & { id: string }) {
  replyTo.value = msg
  nextTick(() => inputEl.value?.focus())
  announcement.value = `Replying to message: ${msg.content.slice(0, 50)}`
}

async function startCall(withVideo: boolean) {
  if (isCallActive.value) return
  showMenu.value = false

  const snap = await getDoc(doc(db, 'peerIds', peerId.value))
  if (!snap.exists()) {
    appStore.addNotification(`${peerName.value} can't take the call right now.`, 'warning')
    return
  }
  const peerConnId = snap.data().peerId

  const isOnline = await peerStore.checkPeerOnline(peerConnId)
  if (!isOnline) {
    appStore.addNotification(`${peerName.value} can't take the call right now.`, 'warning')
    return
  }

  appStore.updateCallState({ peerName: peerName.value, peerPhoto: peerPhoto.value, peerId: peerId.value })
  const success = await peerStore.startCall(peerId.value, peerConnId, withVideo)
  if (success) router.push(`/call/${peerId.value}`)
}

function openProfile() {
  showMenu.value = false
  showProfileDialog.value = true
  announcement.value = `Opening ${peerName.value}'s profile`
}

function viewFullProfile() {
  showProfileDialog.value = false
  router.push(`/profile/${peerId.value}`)
}

function searchMessages() {
  showMenu.value = false
  isSearching.value = true
  nextTick(() => searchInputEl.value?.focus())
}

async function copyLastMessage() {
  showMenu.value = false
  if (messages.value.length === 0) return
  const last = messages.value[messages.value.length - 1]
  await copyMessage(last.content)
}

function exportChat() {
  showMenu.value = false
  const lines = messages.value.map(m => {
    const sender = m.senderId === myUid.value ? 'You' : peerName.value
    const time = formatMsgTime(m.timestamp?.toMillis())
    return `[${time}] ${sender}: ${m.deleted ? '[deleted]' : m.content}`
  })
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `chat-${peerName.value}-${new Date().toISOString().slice(0, 10)}.txt`
  a.click()
  URL.revokeObjectURL(url)
  appStore.addNotification('Chat exported', 'success')
}

function toggleMute() {
  showMenu.value = false
  isChatMuted.value = !isChatMuted.value
  appStore.addNotification(isChatMuted.value ? 'Notifications muted' : 'Notifications unmuted', 'info')
  announcement.value = isChatMuted.value ? 'Notifications muted for this chat' : 'Notifications unmuted'
}

function pinChat() {
  showMenu.value = false
  isPinned.value = !isPinned.value
  appStore.addNotification(isPinned.value ? 'Chat pinned' : 'Chat unpinned', 'info')
  announcement.value = isPinned.value ? 'Chat pinned' : 'Chat unpinned'
}

function clearChat() {
  showMenu.value = false
  showClearModal.value = true
}

function doClearChat() {
  showClearModal.value = false
  appStore.addNotification('Chat cleared locally', 'info')
}

function handleAttachment() {
  appStore.addNotification('File attachments coming soon', 'info')
}

function confirmBlockPeer() {
  showMenu.value = false
  showBlockModal.value = true
  announcement.value = `Block ${peerName.value} dialog opened`
}

async function doBlockPeer() {
  if (!myUid.value) return
  try {
    await blockUser(myUid.value, peerId.value)
    showBlockModal.value = false
    appStore.addNotification(`${peerName.value} blocked`, 'success')
    // No longer redirecting to dashboard, let the UI handle it
  } catch (e: any) {
    appStore.addNotification(e.message || 'Could not block user', 'error')
    showBlockModal.value = false
  }
}

async function doUnblockPeer() {
  if (!myUid.value) return
  try {
    await unblockUser(myUid.value, peerId.value)
    showUnblockModal.value = false
    appStore.addNotification(`${peerName.value} unblocked`, 'success')
    announcement.value = `${peerName.value} has been unblocked`
  } catch (e: any) {
    appStore.addNotification(e.message || 'Could not unblock user', 'error')
    showUnblockModal.value = false
  }
}

async function doDeleteChat() {
  try {
    await deleteChat(chatId.value)
    showDeleteChatModal.value = false
    appStore.addNotification('Chat deleted', 'success')
    router.push('/dashboard')
  } catch (e) {
    appStore.addNotification('Could not delete chat', 'error')
    showDeleteChatModal.value = false
  }
}

function confirmReportChat() {
  showMenu.value = false
  showReportChatModal.value = true
}

async function doReportChat() {
  try {
    const reporterName = appStore.currentUserProfile?.displayName || 'Unknown'
    await reportContent(
      myUid.value,
      reporterName,
      peerId.value,
      peerName.value,
      chatId.value,
      'Full Chat Report'
    )
    showReportChatModal.value = false
    appStore.addNotification('Chat reported to admins', 'success')
  } catch {
    appStore.addNotification('Could not send report', 'error')
  }
}

function confirmReportMessage(msg: Message & { id: string }) {
  reportMsgTarget.value = msg
}

async function doReportMessage() {
  if (!reportMsgTarget.value) return
  try {
    const reporterName = appStore.currentUserProfile?.displayName || 'Unknown'
    await reportContent(
      myUid.value,
      reporterName,
      peerId.value,
      peerName.value,
      chatId.value,
      reportMsgTarget.value.content,
      reportMsgTarget.value.id
    )
    reportMsgTarget.value = null
    appStore.addNotification('Message reported to admins', 'success')
  } catch {
    appStore.addNotification('Could not send report', 'error')
  }
}

function goBack() {
  appStore.setActiveChatId(null)
  router.push('/dashboard')
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Syne:wght@700;800&display=swap');

* { box-sizing: border-box; }

.chat-screen {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #070a14;
  font-family: 'DM Sans', sans-serif;
  color: #e2e8f0;
}

/* ── Header ───────────────────────────────────────────────────────────────────── */
.chat-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  background: rgba(10,12,24,0.97);
  backdrop-filter: blur(20px);
  position: sticky;
  top: 0;
  z-index: 50;
}

.back-btn {
  background: rgba(255,255,255,0.06);
  border: none;
  border-radius: 10px;
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  color: rgba(255,255,255,0.7);
  transition: background 0.2s;
  flex-shrink: 0;
}
.back-btn:hover { background: rgba(255,255,255,0.12); }
.back-btn:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }

.peer-info-btn {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  font-family: inherit;
  text-align: left;
  padding: 0.25rem 0.5rem;
  border-radius: 10px;
  min-width: 0;
  transition: background 0.15s;
  min-height: 48px;
}
.peer-info-btn:hover { background: rgba(255,255,255,0.04); }
.peer-info-btn:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }

.peer-avatar {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #5c3bff40, #ff3b8c40);
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem; font-weight: 700; color: #a78bfa;
  overflow: visible;
  flex-shrink: 0;
  position: relative;
}
.peer-avatar img {
  width: 100%; height: 100%;
  object-fit: cover;
  border-radius: 50%;
  position: absolute; inset: 0;
}
.presence-ring {
  position: absolute;
  bottom: -1px; right: -1px;
  width: 11px; height: 11px;
  border-radius: 50%;
  border: 2px solid #070a14;
}
.presence-ring.online { background: #34d399; }

.peer-meta { display: flex; flex-direction: column; min-width: 0; }
.peer-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.peer-status {
  font-size: 0.7rem;
  color: rgba(255,255,255,0.38);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.peer-status.online { color: #34d399; }
.status-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #34d399;
  animation: pulseDot 2s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes pulseDot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.header-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.header-btn {
  background: rgba(255,255,255,0.05);
  border: none;
  border-radius: 10px;
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  color: rgba(255,255,255,0.6);
  transition: all 0.2s;
}
.header-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.1);
  color: #fff;
}
.header-btn:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }
.header-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.unblock-btn-header { color: #a78bfa !important; background: rgba(92,59,255,0.1) !important; }
.delete-btn-header { color: #ff6b8a !important; background: rgba(255,59,92,0.1) !important; }

/* Context Menu */
.context-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0.5rem;
  background: #0e1222;
  border: 1px solid rgba(255,255,255,0.11);
  border-radius: 14px;
  overflow: hidden;
  z-index: 200;
  min-width: 210px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.7);
  backdrop-filter: blur(20px);
}
.context-menu button {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  color: rgba(255,255,255,0.7);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.85rem;
  text-align: left;
  transition: background 0.15s;
  min-height: 44px;
}
.context-menu button:hover:not(:disabled) { background: rgba(255,255,255,0.06); color: #fff; }
.context-menu button:focus-visible {
  outline: 3px solid #7c6fff;
  outline-offset: -3px;
  background: rgba(92,59,255,0.1);
}
.context-menu button:disabled { opacity: 0.3; cursor: not-allowed; }
.context-menu .menu-warning { color: #fbbf24; }
.context-menu .menu-warning:hover { background: rgba(251,191,36,0.08) !important; }
.context-menu .menu-danger { color: #ff6b8a; }
.context-menu .menu-danger:hover { background: rgba(255,59,140,0.08) !important; }
.menu-divider { height: 1px; background: rgba(255,255,255,0.07); margin: 0.25rem 0; }

.menu-pop-enter-active { transition: all 0.15s ease; }
.menu-pop-leave-active { transition: all 0.1s ease; }
.menu-pop-enter-from { opacity: 0; transform: translateY(-6px) scale(0.97); }
.menu-pop-leave-to { opacity: 0; transform: translateY(-4px) scale(0.98); }

/* Search bar */
.search-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.search-bar input {
  flex: 1;
  background: rgba(255,255,255,0.07);
  border: 1.5px solid rgba(255,255,255,0.11);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  color: #e2e8f0;
  font-family: inherit;
  font-size: 0.875rem;
  min-height: 40px;
}
.search-bar input:focus {
  outline: none;
  border-color: rgba(92,59,255,0.6);
  box-shadow: 0 0 0 3px rgba(92,59,255,0.12);
}
.search-results-count { font-size: 0.75rem; color: rgba(255,255,255,0.4); white-space: nowrap; }
.search-bar button {
  background: rgba(255,255,255,0.06); border: none; cursor: pointer;
  color: rgba(255,255,255,0.45); font-size: 0.875rem;
  padding: 0.375rem; border-radius: 6px; min-width: 32px; min-height: 32px;
  display: flex; align-items: center; justify-content: center;
}
.search-bar button:hover { color: #fff; background: rgba(255,255,255,0.1); }
.search-bar button:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.2s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-10px); }

/* ── Messages ────────────────────────────────────────────────────────────────── */
.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  scroll-behavior: smooth;
}

.no-messages {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.5rem;
  color: rgba(255,255,255,0.32);
  text-align: center;
}
.wave {
  font-size: 2.5rem;
  animation: wave 2s ease-in-out infinite;
  margin-bottom: 0.25rem;
}
@keyframes wave {
  0%, 100% { transform: rotate(0); }
  25% { transform: rotate(-15deg); }
  75% { transform: rotate(15deg); }
}
.no-messages p { font-size: 0.9rem; margin: 0; }
.no-msg-hint { font-size: 0.75rem; color: rgba(255,255,255,0.2); margin-top: 0.25rem !important; }
.no-results { padding: 2rem; text-align: center; color: rgba(255,255,255,0.32); font-size: 0.9rem; }

.date-divider {
  text-align: center;
  font-size: 0.72rem;
  color: rgba(255,255,255,0.28);
  margin: 0.875rem 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.date-divider::before, .date-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255,255,255,0.07);
}

.message-wrap {
  display: flex;
  align-items: flex-end;
  gap: 0.375rem;
  max-width: 78%;
  position: relative;
}
.message-wrap.own { align-self: flex-end; flex-direction: row-reverse; }
.message-wrap.peer { align-self: flex-start; }
.message-wrap:hover .msg-actions { opacity: 1; }

.bubble {
  background: rgba(255,255,255,0.08);
  border-radius: 18px;
  padding: 0.6rem 0.9rem;
  display: inline-block;
  max-width: 100%;
  transition: box-shadow 0.2s;
}
.message-wrap.own .bubble {
  background: linear-gradient(135deg, #5c3bff, #7c3bff);
  border-bottom-right-radius: 4px;
}
.message-wrap.peer .bubble {
  border-bottom-left-radius: 4px;
}
.bubble.deleted {
  background: transparent !important;
  border: 1px solid rgba(255,255,255,0.08);
}
.bubble.deleted .msg-text { color: rgba(255,255,255,0.28); font-style: italic; }
.bubble.highlighted { box-shadow: 0 0 0 2px #5c3bff; }

.reply-indicator {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
  padding-bottom: 0.375rem;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.reply-bar { width: 3px; min-height: 16px; background: rgba(255,255,255,0.4); border-radius: 2px; flex-shrink: 0; }
.reply-text { font-size: 0.75rem; color: rgba(255,255,255,0.5); font-style: italic; line-height: 1.3; }

.msg-text {
  font-size: 0.88rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: #e2e8f0;
  display: block;
}
.msg-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
  margin-top: 0.2rem;
}
.msg-time { font-size: 0.67rem; color: rgba(255,255,255,0.33); }
.read-indicator { display: flex; align-items: center; }

.msg-actions {
  opacity: 0;
  display: flex;
  gap: 2px;
  transition: opacity 0.15s;
  flex-shrink: 0;
}
.msg-action-btn {
  background: rgba(255,255,255,0.09);
  border: none;
  border-radius: 6px;
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  color: rgba(255,255,255,0.55);
  transition: all 0.15s;
  min-height: 28px;
}
.msg-action-btn:hover { background: rgba(255,255,255,0.16); color: #fff; }
.msg-action-btn:focus-visible { outline: 3px solid #7c6fff; outline-offset: 1px; opacity: 1; }
.msg-action-btn.danger:hover { background: rgba(255,59,140,0.2); color: #ff6b8a; }
.msg-action-btn.warning:hover { background: rgba(251,191,36,0.2); color: #fbbf24; }

/* Typing indicator */
.typing-indicator {
  align-self: flex-start;
  background: rgba(255,255,255,0.08);
  border-radius: 18px;
  border-bottom-left-radius: 4px;
  padding: 0.75rem 1rem;
  display: flex;
  gap: 4px;
  align-items: center;
  margin-bottom: 0.25rem;
}
.typing-indicator span {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: rgba(255,255,255,0.4);
  animation: typingBounce 1.2s ease-in-out infinite;
}
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}

/* Reply banner */
.reply-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background: rgba(92,59,255,0.13);
  border-top: 1px solid rgba(92,59,255,0.22);
  font-size: 0.8rem;
  color: rgba(255,255,255,0.65);
}
.reply-banner-content { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
.reply-banner-content span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reply-banner button {
  background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.45);
  font-size: 0.875rem; padding: 0.25rem; border-radius: 4px; flex-shrink: 0;
  min-width: 28px; min-height: 28px; display: flex; align-items: center; justify-content: center;
}
.reply-banner button:hover { color: #fff; }
.reply-banner button:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }

.slide-up-sm-enter-active, .slide-up-sm-leave-active { transition: all 0.15s ease; }
.slide-up-sm-enter-from, .slide-up-sm-leave-to { opacity: 0; transform: translateY(8px); }

/* ── Input area / footer ──────────────────────────────────────────────────────── */
.input-area {
  background: rgba(10,12,24,0.97);
  border-top: 1px solid rgba(255,255,255,0.07);
}

.blocked-input-area {
  padding: 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: rgba(15,20,35,0.95);
}
.blocked-hint {
  font-size: 0.85rem;
  color: rgba(255,255,255,0.45);
  margin: 0;
}
.blocked-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}
.blocked-btn {
  padding: 0.625rem 1.25rem;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 44px;
  border: none;
  font-family: inherit;
}
.blocked-btn.unblock {
  background: rgba(92,59,255,0.2);
  color: #a78bfa;
  border: 1px solid rgba(92,59,255,0.3);
}
.blocked-btn.unblock:hover { background: rgba(92,59,255,0.3); }
.blocked-btn.delete {
  background: rgba(255,59,92,0.1);
  color: #ff6b8a;
  border: 1px solid rgba(255,59,92,0.2);
}
.blocked-btn.delete:hover { background: rgba(255,59,92,0.2); }

.input-area form {
  padding: 0.75rem 1rem;
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.attach-btn {
  background: rgba(255,255,255,0.05);
  border: none;
  border-radius: 12px;
  width: 42px; min-height: 42px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  color: rgba(255,255,255,0.4);
  transition: all 0.2s;
  flex-shrink: 0;
}
.attach-btn:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); }
.attach-btn:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }

.input-wrapper {
  flex: 1;
  position: relative;
}

.msg-input {
  width: 100%;
  background: rgba(255,255,255,0.07);
  border: 1.5px solid rgba(255,255,255,0.11);
  border-radius: 18px;
  padding: 0.625rem 1rem;
  color: #e2e8f0;
  font-family: inherit;
  font-size: 0.88rem;
  resize: none;
  min-height: 44px;
  max-height: 150px;
  overflow-y: auto;
  transition: border-color 0.2s;
  line-height: 1.5;
  display: block;
}
.msg-input:focus {
  outline: none;
  border-color: rgba(92,59,255,0.6);
  background: rgba(92,59,255,0.05);
  box-shadow: 0 0 0 3px rgba(92,59,255,0.12);
}
.msg-input::placeholder { color: rgba(255,255,255,0.22); }

.char-hint {
  position: absolute;
  bottom: 4px; right: 10px;
  font-size: 0.65rem;
  color: rgba(255,100,100,0.85);
  pointer-events: none;
}

.send-btn {
  width: 42px; height: 42px;
  background: linear-gradient(135deg, #5c3bff, #7c3bff);
  border: none;
  border-radius: 50%;
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}
.send-btn:hover:not(:disabled) { transform: scale(1.06); opacity: 0.9; }
.send-btn:focus-visible { outline: 3px solid #a78bfa; outline-offset: 3px; }
.send-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* ── Profile Dialog ──────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  z-index: 500;
  padding: 1.5rem;
}
.modal-fade-enter-active, .modal-fade-leave-active { transition: all 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

.profile-dialog {
  background: #0f1222;
  border: 1px solid rgba(255,255,255,0.11);
  border-radius: 24px;
  padding: 2rem;
  max-width: 360px;
  width: 100%;
  text-align: center;
  position: relative;
  box-shadow: 0 20px 64px rgba(0,0,0,0.7);
  color: #e2e8f0;
}
.dialog-close {
  position: absolute; top: 1rem; right: 1rem;
  background: rgba(255,255,255,0.07); border: none; border-radius: 8px;
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: rgba(255,255,255,0.55); font-size: 0.85rem;
}
.dialog-close:hover { background: rgba(255,255,255,0.13); color: #fff; }
.dialog-close:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }

.dialog-avatar {
  width: 80px; height: 80px; border-radius: 50%;
  background: linear-gradient(135deg, #5c3bff, #ff3b8c);
  display: flex; align-items: center; justify-content: center;
  font-size: 2rem; font-weight: 700; color: #fff;
  margin: 0 auto 1rem;
  position: relative; overflow: hidden;
  border: 3px solid rgba(92,59,255,0.45);
}
.dialog-avatar img { width: 100%; height: 100%; object-fit: cover; }
.dialog-online-badge {
  position: absolute; bottom: 3px; right: 3px;
  background: #34d399; color: #fff; font-size: 0.55rem; font-weight: 700;
  padding: 2px 5px; border-radius: 999px; border: 2px solid #0f1222;
}
.profile-dialog h2 {
  font-family: 'Syne', sans-serif; font-size: 1.25rem; font-weight: 800;
  color: #fff; margin: 0 0 0.25rem;
}
.dialog-username { font-size: 0.85rem; color: rgba(255,255,255,0.42); margin-bottom: 0.5rem; }
.dialog-bio {
  font-size: 0.85rem; color: rgba(255,255,255,0.62);
  margin: 0.5rem 0 0.75rem; line-height: 1.5;
}
.dialog-chips {
  display: flex; flex-wrap: wrap; gap: 0.375rem; justify-content: center;
  margin-bottom: 1.25rem;
  list-style: none;
  padding: 0;
}
.dialog-chips li span {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);
  border-radius: 999px; padding: 0.25rem 0.75rem; font-size: 0.75rem;
  color: rgba(255,255,255,0.52);
  display: inline-block;
}
.dialog-actions {
  display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center;
}
.dialog-btn {
  padding: 0.5rem 1rem; border-radius: 10px; border: none; cursor: pointer;
  font-family: inherit; font-size: 0.85rem; font-weight: 500; transition: all 0.2s;
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.11); color: #e2e8f0;
  min-height: 40px;
}
.dialog-btn:hover:not(:disabled) { background: rgba(255,255,255,0.13); }
.dialog-btn:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }
.dialog-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.dialog-btn.primary {
  background: rgba(92,59,255,0.22); border-color: rgba(92,59,255,0.35); color: #a78bfa;
}
.dialog-btn.primary:hover:not(:disabled) { background: rgba(92,59,255,0.38); }

/* ── Generic Modal ───────────────────────────────────────────────────────────── */
.modal {
  background: #0f1222; border: 1px solid rgba(255,255,255,0.11);
  border-radius: 20px; padding: 2rem; max-width: 360px; width: 100%; text-align: center;
  box-shadow: 0 20px 64px rgba(0,0,0,0.7);
  color: #e2e8f0;
}
.modal h2 { font-family: 'Syne', sans-serif; color: #fff; margin: 0 0 0.75rem; font-size: 1.15rem; }
.modal p { color: rgba(255,255,255,0.52); font-size: 0.875rem; margin: 0 0 1.5rem; line-height: 1.5; }
.modal-actions { display: flex; gap: 0.75rem; justify-content: center; }
.modal-cancel {
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.11);
  border-radius: 10px; padding: 0.625rem 1.5rem; color: rgba(255,255,255,0.7);
  cursor: pointer; font-family: inherit; font-size: 0.9rem; min-height: 44px;
}
.modal-cancel:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }
.modal-confirm {
  background: linear-gradient(135deg, #ff3b5c, #ff3b8c); border: none;
  border-radius: 10px; padding: 0.625rem 1.5rem; color: #fff;
  cursor: pointer; font-family: inherit; font-size: 0.9rem; font-weight: 600; min-height: 44px;
}
.modal-confirm:focus-visible { outline: 3px solid #ff9bb5; outline-offset: 2px; }

.modal-confirm.danger {
  background: #ef4444;
}
.modal-confirm.danger:hover {
  background: #dc2626;
}

.report-preview {
  background: rgba(255, 255, 255, 0.05);
  border-left: 3px solid #ef4444;
  padding: 0.75rem 1rem;
  margin: 1rem 0;
  font-style: italic;
  font-size: 0.9rem;
  color: #e2e8f0;
  border-radius: 4px;
  word-break: break-word;
}

/* ── SR only ─────────────────────────────────────────────────────────────────── */
.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
</style>