<template>
  <div class="meeting-room" id="main-content" tabindex="-1" @keydown.escape="handleEscape">

    <!-- ── Waiting Room Lobby (shown to participant before host admits) ────── -->
    <div v-if="meetingStore.isWaiting" class="waiting-lobby" role="status" aria-live="polite">
      <div class="waiting-inner">
        <div class="waiting-orbs" aria-hidden="true">
          <div class="orb orb1"></div>
          <div class="orb orb2"></div>
        </div>
        <div class="waiting-icon" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
        </div>
        <h1>Waiting to be admitted</h1>
        <p>The host will let you in shortly. Your camera and microphone are ready.</p>
        <div class="waiting-status-row">
          <span :class="['device-chip', { muted: meetingStore.isAudioMuted }]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/></svg>
            {{ meetingStore.isAudioMuted ? 'Mic off' : 'Mic on' }}
          </span>
          <span :class="['device-chip', { muted: meetingStore.isVideoOff }]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
            {{ meetingStore.isVideoOff ? 'Camera off' : 'Camera on' }}
          </span>
        </div>
        <div class="waiting-pulse-bar" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <button class="leave-waiting-btn" @click="handleLeave" aria-label="Leave the waiting room">
          Leave
        </button>
      </div>
    </div>

    <!-- ── Main Room UI ───────────────────────────────────────────────────── -->
    <template v-else>

      <!-- Top bar -->
      <header class="room-topbar" role="banner">
        <div class="topbar-left">
          <div class="meeting-name-badge">
            <span class="badge-icon" aria-hidden="true">◈</span>
            <span class="badge-title">{{ meetingStore.meeting?.title || 'Meeting' }}</span>
          </div>
          <div class="divider-bar" aria-hidden="true">|</div>
          <time class="room-clock" :datetime="now.toISOString()">{{ formattedClock }}</time>
          <time class="room-timer" :aria-label="`Meeting duration: ${elapsedDisplay}`" aria-live="off">{{ elapsedDisplay }}</time>
          <div v-if="meetingStore.isRecording" class="recording-badge" role="status" aria-live="polite" aria-label="Recording in progress">
            <span class="rec-dot" aria-hidden="true"></span> REC
          </div>
        </div>
        <div class="topbar-right">
          <button class="topbar-btn" @click="copyMeetingLink" aria-label="Copy meeting invite link" title="Copy invite link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
          </button>
          <div class="participants-count" :aria-label="`${meetingStore.activeParticipants.length} participants`">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
            {{ meetingStore.activeParticipants.length }}
          </div>
        </div>
      </header>

      <!-- ── Waiting Room Queue (host sees this) ─────────────────────────── -->
      <Transition name="waiting-slide">
        <div
          v-if="meetingStore.canManageParticipants && meetingStore.waitingParticipants.length > 0"
          class="waiting-queue-banner"
          role="alert"
          aria-live="assertive"
          :aria-label="`${meetingStore.waitingParticipants.length} people waiting to join`"
        >
          <div class="wq-left">
            <span class="wq-count" aria-hidden="true">{{ meetingStore.waitingParticipants.length }}</span>
            <span class="wq-text">
              {{ meetingStore.waitingParticipants.length === 1 ? 'person is' : 'people are' }}
              waiting to join
            </span>
          </div>
          <div class="wq-people">
            <div
              v-for="p in meetingStore.waitingParticipants.slice(0, 3)"
              :key="p.uid"
              class="wq-person"
            >
              <div class="wq-avatar" aria-hidden="true">
                <img v-if="p.photoURL" :src="p.photoURL" :alt="p.displayName" />
                <span v-else>{{ p.displayName.charAt(0) }}</span>
              </div>
              <span class="wq-name">{{ p.displayName }}</span>
              <button
                class="wq-btn admit"
                @click="meetingStore.admitWaitingParticipant(p.uid)"
                :aria-label="`Admit ${p.displayName}`"
              >Admit</button>
              <button
                class="wq-btn deny"
                @click="meetingStore.denyWaitingParticipant(p.uid)"
                :aria-label="`Deny ${p.displayName}`"
              >Deny</button>
            </div>
            <span v-if="meetingStore.waitingParticipants.length > 3" class="wq-more">
              +{{ meetingStore.waitingParticipants.length - 3 }} more
            </span>
          </div>
          <div class="wq-bulk" v-if="meetingStore.waitingParticipants.length > 1">
            <button class="wq-btn admit" @click="admitAll" aria-label="Admit all waiting participants">Admit all</button>
          </div>
        </div>
      </Transition>

      <!-- Main video area -->
      <main class="room-main" :class="`layout-${meetingStore.layout}`" aria-label="Meeting video area">

        <!-- Grid -->
        <div v-if="meetingStore.layout === 'grid'" class="video-grid" :class="`grid-${gridClass}`" role="list" aria-label="Participants">
          <!-- Local tile -->
          <div class="video-tile local-tile" role="listitem" :aria-label="`You${meetingStore.isAudioMuted ? ', muted' : ''}${meetingStore.isVideoOff ? ', camera off' : ''}`">
            <div class="tile-video-wrapper">
              <video ref="localVideoRef" class="tile-video" autoplay muted playsinline :class="{ hidden: meetingStore.isVideoOff }" aria-label="Your video"></video>
              <div v-if="meetingStore.isVideoOff" class="tile-avatar" aria-hidden="true">
                <div class="ta-circle">
                  <img v-if="currentUser?.photoURL" :src="currentUser.photoURL" :alt="currentUser.displayName || ''" />
                  <span v-else>{{ (currentUser?.displayName || 'Y').charAt(0) }}</span>
                </div>
              </div>
              <div v-if="meetingStore.isScreenSharing" class="screen-share-badge" aria-hidden="true"><span>📺</span> Presenting</div>
            </div>
            <div class="tile-footer">
              <div class="tile-name">
                <span>You</span>
                <svg v-if="meetingStore.isAudioMuted" class="mute-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/></svg>
              </div>
            </div>
          </div>

          <!-- Remote tiles -->
          <div
            v-for="rs in meetingStore.remoteStreamsArray"
            :key="rs.uid"
            class="video-tile"
            role="listitem"
            :aria-label="`${rs.displayName}${rs.isAudioMuted ? ', muted' : ''}${rs.isVideoOff ? ', camera off' : ''}`"
            :class="{ speaking: rs.isSpeaking }"
            @dblclick="meetingStore.setSpotlight(rs.uid)"
            tabindex="0"
          >
            <div class="tile-video-wrapper">
              <RemoteVideoTile :stream="rs.stream" :is-video-off="rs.isVideoOff" />
              <div v-if="rs.isVideoOff" class="tile-avatar" aria-hidden="true">
                <div class="ta-circle">
                  <img v-if="rs.photoURL" :src="rs.photoURL" :alt="rs.displayName" />
                  <span v-else>{{ rs.displayName.charAt(0) }}</span>
                </div>
              </div>
            </div>
            <div class="tile-footer">
              <div class="tile-name">
                <span>{{ rs.displayName }}</span>
                <svg v-if="rs.isAudioMuted" class="mute-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/></svg>
              </div>
              <div class="tile-controls">
                <span v-if="rs.isHandRaised" aria-hidden="true">✋</span>
                <span v-if="getParticipantRole(rs.uid) === 'host'" class="role-badge host" aria-label="Host">H</span>
                <span v-else-if="getParticipantRole(rs.uid) === 'co-host'" class="role-badge cohost" aria-label="Co-host">C</span>
              </div>
            </div>
            <div v-if="meetingStore.canManageParticipants" class="host-overlay" role="group" :aria-label="`Host controls for ${rs.displayName}`">
              <button class="host-overlay-btn" @click.stop="meetingStore.hostMute(rs.uid)" :aria-label="`Mute ${rs.displayName}`">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/></svg>
              </button>
              <button class="host-overlay-btn" @click.stop="meetingStore.setSpotlight(rs.uid)" :aria-label="`Spotlight ${rs.displayName}`">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </button>
              <button class="host-overlay-btn danger" @click.stop="meetingStore.hostRemoveParticipant(rs.uid)" :aria-label="`Remove ${rs.displayName}`">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Spotlight -->
        <div v-else-if="meetingStore.layout === 'spotlight'" class="spotlight-layout" aria-label="Spotlight view">
          <div class="spotlight-main">
            <div v-if="spotlightStream" class="spotlight-video-wrap">
              <RemoteVideoTile v-if="spotlightStream.uid !== 'local'" :stream="spotlightStream.stream" :is-video-off="spotlightStream.isVideoOff" />
              <video v-else ref="spotlightLocalRef" class="tile-video" autoplay muted playsinline></video>
            </div>
            <div class="spotlight-name" aria-live="polite">
              {{ spotlightStream?.displayName || 'Unknown' }}
              <button class="exit-spotlight-btn" @click="meetingStore.setLayout('grid'); meetingStore.setSpotlight(null)" aria-label="Exit spotlight view">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Exit
              </button>
            </div>
          </div>
          <div class="spotlight-strip" role="list" aria-label="Other participants">
            <div v-for="rs in meetingStore.remoteStreamsArray" :key="rs.uid" class="strip-tile" role="listitem" @click="meetingStore.setSpotlight(rs.uid)" tabindex="0">
              <RemoteVideoTile :stream="rs.stream" :is-video-off="rs.isVideoOff" />
              <span class="strip-name">{{ rs.displayName }}</span>
            </div>
          </div>
        </div>

        <!-- Waiting state (no remote participants yet) -->
        <div v-if="meetingStore.remoteStreamsArray.length === 0 && meetingStore.layout === 'grid'" class="waiting-state" role="status" aria-live="polite">
          <div class="waiting-icon-sm" aria-hidden="true">👥</div>
          <h2>Waiting for others to join…</h2>
          <p>Share the invite link to get people to join</p>
          <button class="share-link-btn" @click="copyMeetingLink">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
            Copy Invite Link
          </button>
        </div>

        <!-- Hand-raise queue -->
        <div v-if="meetingStore.handRaisedQueue.length > 0 && meetingStore.canManageParticipants" class="hand-queue" role="status" aria-live="polite">
          <span aria-hidden="true">✋</span>
          {{ getParticipantName(meetingStore.handRaisedQueue[0]) }}
          <span v-if="meetingStore.handRaisedQueue.length > 1" class="hand-more">+{{ meetingStore.handRaisedQueue.length - 1 }} more</span>
          <button @click="meetingStore.hostLowerHand(meetingStore.handRaisedQueue[0])">Lower</button>
        </div>

        <!-- ── Reactions overlay (NEW — all participants' emoji float here) ── -->
        <div class="reaction-overlay" aria-hidden="true">
          <TransitionGroup name="react-float">
            <div
              v-for="r in meetingStore.floatingReactions"
              :key="r.id"
              class="reaction-bubble"
              :style="{ left: r.x + '%' }"
              :title="r.senderName"
            >{{ r.emoji }}</div>
          </TransitionGroup>
        </div>

        <!-- Chat panel -->
        <Transition name="panel-slide">
          <aside v-if="meetingStore.isChatOpen" class="chat-panel" aria-label="Meeting chat" role="complementary">
            <div class="panel-header">
              <h2>In-Meeting Chat</h2>
              <button @click="meetingStore.closeChat()" aria-label="Close chat panel">✕</button>
            </div>
            <div class="chat-messages" ref="chatMessagesRef" role="log" aria-live="polite" aria-relevant="additions" aria-label="Chat messages">
              <div v-if="meetingStore.chatMessages.length === 0" class="chat-empty" role="status">No messages yet. Say hello!</div>
              <div v-for="msg in meetingStore.chatMessages" :key="msg.id" class="chat-msg" :class="{ own: msg.senderUid === currentUser?.uid }" role="article" :aria-label="`${msg.senderName}: ${msg.content}`">
                <div class="msg-sender">
                  <div class="msg-avatar" aria-hidden="true">
                    <img v-if="msg.senderPhoto" :src="msg.senderPhoto" :alt="msg.senderName" />
                    <span v-else>{{ msg.senderName.charAt(0) }}</span>
                  </div>
                  <span class="msg-name">{{ msg.senderUid === currentUser?.uid ? 'You' : msg.senderName }}</span>
                  <time class="msg-time" :datetime="msg.timestamp?.toDate().toISOString()">{{ formatMsgTime(msg.timestamp?.toMillis()) }}</time>
                </div>
                <p class="msg-content">{{ msg.content }}</p>
              </div>
            </div>
            <div class="chat-input-area">
              <label for="chat-input" class="sr-only">Type a message</label>
              <textarea id="chat-input" v-model="chatInput" placeholder="Message everyone…" rows="1" maxlength="500" @keydown.enter.prevent="sendChat" @input="autoResizeChat" ref="chatInputRef" aria-label="Type a chat message"></textarea>
              <button @click="sendChat" :disabled="!chatInput.trim()" class="chat-send-btn" aria-label="Send message">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
          </aside>
        </Transition>

        <!-- Participants panel -->
        <Transition name="panel-slide">
          <aside v-if="meetingStore.isParticipantsPanelOpen" class="participants-panel" aria-label="Participants" role="complementary">
            <div class="panel-header">
              <h2>Participants <span class="panel-count">({{ meetingStore.activeParticipants.length }})</span></h2>
              <button @click="meetingStore.isParticipantsPanelOpen = false" aria-label="Close participants panel">✕</button>
            </div>
            <div v-if="meetingStore.canManageParticipants" class="host-controls-bar" role="group">
              <button class="host-bar-btn" @click="meetingStore.hostMuteAll()">Mute All</button>
            </div>
            <ul class="participants-list" role="list">
              <li class="participant-row" role="listitem">
                <div class="part-avatar" aria-hidden="true">
                  <img v-if="currentUser?.photoURL" :src="currentUser.photoURL" :alt="currentUser?.displayName || ''" />
                  <span v-else>{{ (currentUser?.displayName || 'Y').charAt(0) }}</span>
                </div>
                <div class="part-info">
                  <span class="part-name">You</span>
                  <span class="part-role" :class="meetingStore.isHost ? 'host' : 'attendee'">{{ meetingStore.isHost ? 'Host' : meetingStore.isCoHost ? 'Co-host' : 'Attendee' }}</span>
                </div>
                <div class="part-indicators" aria-hidden="true">
                  <svg v-if="meetingStore.isAudioMuted" class="indicator muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/></svg>
                  <svg v-if="meetingStore.isVideoOff" class="indicator" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  <span v-if="meetingStore.isHandRaised">✋</span>
                </div>
              </li>
              <li v-for="p in meetingStore.activeParticipants.filter(p => p.uid !== currentUser?.uid)" :key="p.uid" class="participant-row" role="listitem">
                <div class="part-avatar" aria-hidden="true">
                  <img v-if="p.photoURL" :src="p.photoURL" :alt="p.displayName" />
                  <span v-else>{{ p.displayName.charAt(0) }}</span>
                </div>
                <div class="part-info">
                  <span class="part-name">{{ p.displayName }}</span>
                  <span class="part-role" :class="p.role">{{ p.role }}</span>
                </div>
                <div class="part-indicators" aria-hidden="true">
                  <svg v-if="p.isAudioMuted" class="indicator muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/></svg>
                  <svg v-if="p.isVideoOff" class="indicator" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  <span v-if="p.isHandRaised">✋</span>
                </div>
                <div v-if="meetingStore.canManageParticipants" class="part-actions" role="group" :aria-label="`Actions for ${p.displayName}`">
                  <button class="part-action-btn" @click.stop="toggleParticipantMenu(p.uid)" :aria-expanded="openParticipantMenu === p.uid">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                  </button>
                  <div v-if="openParticipantMenu === p.uid" class="participant-menu" role="menu" @click.stop>
                    <button role="menuitem" @click="meetingStore.hostMute(p.uid); openParticipantMenu = null">Mute</button>
                    <button role="menuitem" @click="meetingStore.hostRequestUnmute(p.uid); openParticipantMenu = null">Ask to Unmute</button>
                    <button role="menuitem" @click="meetingStore.hostLowerHand(p.uid); openParticipantMenu = null">Lower Hand</button>
                    <div class="menu-div" role="separator"></div>
                    <button v-if="meetingStore.isHost" role="menuitem" @click="meetingStore.hostPromote(p.uid); openParticipantMenu = null">Make Co-host</button>
                    <button v-if="meetingStore.isHost && p.role === 'co-host'" role="menuitem" @click="meetingStore.hostDemote(p.uid); openParticipantMenu = null">Remove Co-host</button>
                    <div class="menu-div" role="separator"></div>
                    <button role="menuitem" class="remove-item" @click="meetingStore.hostRemoveParticipant(p.uid); openParticipantMenu = null">Remove from Meeting</button>
                  </div>
                </div>
              </li>
            </ul>
          </aside>
        </Transition>

        <!-- Settings panel (with live-propagating toggles) -->
        <Transition name="panel-slide">
          <aside v-if="meetingStore.isSettingsPanelOpen" class="settings-panel-room" aria-label="Meeting settings" role="complementary">
            <div class="panel-header">
              <h2>Settings</h2>
              <button @click="meetingStore.isSettingsPanelOpen = false" aria-label="Close settings">✕</button>
            </div>
            <div class="settings-content">

              <!-- Devices -->
              <section class="settings-section" aria-labelledby="devices-heading">
                <h3 id="devices-heading">Devices</h3>
                <div class="device-field">
                  <label for="room-mic">Microphone</label>
                  <select id="room-mic" v-model="meetingStore.selectedAudioInput" @change="meetingStore.switchAudioInput(meetingStore.selectedAudioInput)">
                    <option v-for="d in meetingStore.audioInputs" :key="d.deviceId" :value="d.deviceId">{{ d.label || 'Microphone' }}</option>
                  </select>
                </div>
                <div class="device-field">
                  <label for="room-cam">Camera</label>
                  <select id="room-cam" v-model="meetingStore.selectedVideoInput" @change="meetingStore.switchVideoInput(meetingStore.selectedVideoInput)">
                    <option v-for="d in meetingStore.videoInputs" :key="d.deviceId" :value="d.deviceId">{{ d.label || 'Camera' }}</option>
                  </select>
                </div>
                <div class="device-field">
                  <label for="room-layout">Layout</label>
                  <select id="room-layout" :value="meetingStore.layout" @change="meetingStore.setLayout(($event.target as HTMLSelectElement).value as any)">
                    <option value="grid">Grid</option>
                    <option value="spotlight">Spotlight</option>
                  </select>
                </div>
              </section>

              <!--
                Meeting Controls — UPDATED.
                Each toggle calls hostUpdateSettings() which internally calls
                propagateSettingToParticipants() so changes are instant for everyone.
              -->
              <section v-if="meetingStore.canManageParticipants" class="settings-section" aria-labelledby="meeting-settings-heading">
                <h3 id="meeting-settings-heading">Meeting controls</h3>

                <div class="setting-toggle-row">
                  <div class="setting-info">
                    <label for="set-mute-entry">Mute on entry</label>
                    <span class="setting-desc">New joiners start muted. Currently joined attendees also muted now.</span>
                  </div>
                  <input
                    id="set-mute-entry"
                    type="checkbox"
                    role="switch"
                    :checked="meetingStore.meeting?.settings.muteOnEntry"
                    @change="meetingStore.hostUpdateSettings({ muteOnEntry: ($event.target as HTMLInputElement).checked })"
                  />
                </div>

                <div class="setting-toggle-row">
                  <div class="setting-info">
                    <label for="set-allow-audio">Allow participant audio</label>
                    <span class="setting-desc">When off, all attendees are muted and cannot unmute themselves.</span>
                  </div>
                  <input
                    id="set-allow-audio"
                    type="checkbox"
                    role="switch"
                    :checked="meetingStore.meeting?.settings.allowParticipantAudio"
                    @change="meetingStore.hostUpdateSettings({ allowParticipantAudio: ($event.target as HTMLInputElement).checked })"
                  />
                </div>

                <div class="setting-toggle-row">
                  <div class="setting-info">
                    <label for="set-allow-video">Allow participant video</label>
                    <span class="setting-desc">When off, attendee cameras are disabled immediately.</span>
                  </div>
                  <input
                    id="set-allow-video"
                    type="checkbox"
                    role="switch"
                    :checked="meetingStore.meeting?.settings.allowParticipantVideo"
                    @change="meetingStore.hostUpdateSettings({ allowParticipantVideo: ($event.target as HTMLInputElement).checked })"
                  />
                </div>

                <div class="setting-toggle-row">
                  <div class="setting-info">
                    <label for="set-allow-screen">Allow screen sharing</label>
                    <span class="setting-desc">When off, attendees lose screen share permission immediately.</span>
                  </div>
                  <input
                    id="set-allow-screen"
                    type="checkbox"
                    role="switch"
                    :checked="meetingStore.meeting?.settings.allowScreenShare"
                    @change="meetingStore.hostUpdateSettings({ allowScreenShare: ($event.target as HTMLInputElement).checked })"
                  />
                </div>

                <div class="setting-toggle-row">
                  <div class="setting-info">
                    <label for="set-allow-chat">Allow chat</label>
                    <span class="setting-desc">When off, attendees cannot send messages.</span>
                  </div>
                  <input
                    id="set-allow-chat"
                    type="checkbox"
                    role="switch"
                    :checked="meetingStore.meeting?.settings.allowChat"
                    @change="meetingStore.hostUpdateSettings({ allowChat: ($event.target as HTMLInputElement).checked })"
                  />
                </div>

                <div class="setting-toggle-row">
                  <div class="setting-info">
                    <label for="set-allow-reactions">Allow reactions</label>
                    <span class="setting-desc">When off, attendees cannot send emoji reactions.</span>
                  </div>
                  <input
                    id="set-allow-reactions"
                    type="checkbox"
                    role="switch"
                    :checked="meetingStore.meeting?.settings.allowReactions"
                    @change="meetingStore.hostUpdateSettings({ allowReactions: ($event.target as HTMLInputElement).checked })"
                  />
                </div>

                <div class="setting-toggle-row">
                  <div class="setting-info">
                    <label for="set-waiting-room">Waiting room</label>
                    <span class="setting-desc">New joiners wait for you to admit them. Already-joined participants are unaffected.</span>
                  </div>
                  <input
                    id="set-waiting-room"
                    type="checkbox"
                    role="switch"
                    :checked="meetingStore.meeting?.settings.waitingRoom"
                    @change="meetingStore.hostUpdateSettings({ waitingRoom: ($event.target as HTMLInputElement).checked })"
                  />
                </div>
              </section>

            </div>
          </aside>
        </Transition>
      </main>

      <!-- Meeting notifications -->
      <div class="meeting-notifications" aria-live="polite" aria-atomic="false">
        <TransitionGroup name="notif">
          <div v-for="notif in meetingStore.notifications" :key="notif.id" :class="['meeting-notif', `notif-${notif.type}`]" role="status">{{ notif.message }}</div>
        </TransitionGroup>
      </div>

      <!-- Controls bar -->
      <nav class="controls-bar" role="toolbar" aria-label="Meeting controls">
        <div class="ctrl-group" role="group" aria-label="Audio and video">
          <div class="ctrl-split">
            <button :class="['ctrl-btn', { off: meetingStore.isAudioMuted }]" @click="meetingStore.toggleAudio()" :aria-label="meetingStore.isAudioMuted ? 'Microphone off' : 'Microphone on'" :aria-pressed="!meetingStore.isAudioMuted">
              <svg v-if="!meetingStore.isAudioMuted" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
              <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6M17 16.95A7 7 0 015 12v-2"/></svg>
              <span class="ctrl-label" aria-hidden="true">{{ meetingStore.isAudioMuted ? 'Mic off' : 'Mic on' }}</span>
            </button>
            <button class="ctrl-caret" @click="meetingStore.isSettingsPanelOpen = !meetingStore.isSettingsPanelOpen" aria-label="Audio settings">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
          </div>

          <div class="ctrl-split">
            <button :class="['ctrl-btn', { off: meetingStore.isVideoOff }]" @click="meetingStore.toggleVideo()" :aria-label="meetingStore.isVideoOff ? 'Camera off' : 'Camera on'" :aria-pressed="!meetingStore.isVideoOff">
              <svg v-if="!meetingStore.isVideoOff" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              <span class="ctrl-label" aria-hidden="true">{{ meetingStore.isVideoOff ? 'Cam off' : 'Cam on' }}</span>
            </button>
            <button class="ctrl-caret" @click="meetingStore.isSettingsPanelOpen = !meetingStore.isSettingsPanelOpen" aria-label="Video settings">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
          </div>
        </div>

        <div class="ctrl-group ctrl-center" role="group" aria-label="Meeting actions">
          <button :class="['ctrl-btn', { active: meetingStore.isScreenSharing }]" @click="meetingStore.toggleScreenShare()" :aria-label="meetingStore.isScreenSharing ? 'Stop sharing' : 'Share screen'">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            <span class="ctrl-label" aria-hidden="true">{{ meetingStore.isScreenSharing ? 'Stop' : 'Share' }}</span>
          </button>

          <!-- Reaction picker — NOW broadcasts to all via Firestore -->
          <div class="ctrl-reaction-wrap">
            <button class="ctrl-btn" @click="showReactionPicker = !showReactionPicker" :aria-label="showReactionPicker ? 'Close reactions' : 'Send a reaction'" :aria-expanded="showReactionPicker">
              <span aria-hidden="true" style="font-size:18px">😊</span>
              <span class="ctrl-label" aria-hidden="true">React</span>
            </button>
            <div v-if="showReactionPicker" class="reaction-picker" role="listbox" aria-label="Choose a reaction">
              <button v-for="e in reactionEmojis" :key="e" class="reaction-btn" @click="handleSendReaction(e)" :aria-label="e" role="option" style="font-size:22px">{{ e }}</button>
            </div>
          </div>

          <button :class="['ctrl-btn', { active: meetingStore.isHandRaised }]" @click="meetingStore.toggleHandRaise()" :aria-label="meetingStore.isHandRaised ? 'Lower hand' : 'Raise hand'">
            <span aria-hidden="true" style="font-size:18px">✋</span>
            <span class="ctrl-label" aria-hidden="true">{{ meetingStore.isHandRaised ? 'Lower' : 'Raise' }}</span>
          </button>

          <button v-if="meetingStore.isHost" :class="['ctrl-btn', { active: meetingStore.isRecording }]" @click="meetingStore.toggleRecording()" :aria-label="meetingStore.isRecording ? 'Stop recording' : 'Start recording'">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" :fill="meetingStore.isRecording ? 'currentColor' : 'none'"/></svg>
            <span class="ctrl-label" aria-hidden="true">{{ meetingStore.isRecording ? 'Stop' : 'Record' }}</span>
          </button>
        </div>

        <div class="ctrl-group ctrl-right" role="group" aria-label="Panels and leave">
          <button :class="['ctrl-btn', { active: meetingStore.isChatOpen }]" @click="meetingStore.isChatOpen ? meetingStore.closeChat() : meetingStore.openChat()" :aria-label="`${meetingStore.isChatOpen ? 'Close' : 'Open'} chat${meetingStore.unreadChatCount > 0 ? `, ${meetingStore.unreadChatCount} unread` : ''}`">
            <div class="icon-with-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              <span v-if="meetingStore.unreadChatCount > 0 && !meetingStore.isChatOpen" class="badge" aria-hidden="true">{{ meetingStore.unreadChatCount }}</span>
            </div>
            <span class="ctrl-label" aria-hidden="true">Chat</span>
          </button>

          <button :class="['ctrl-btn', { active: meetingStore.isParticipantsPanelOpen }]" @click="meetingStore.isParticipantsPanelOpen = !meetingStore.isParticipantsPanelOpen" :aria-label="`${meetingStore.isParticipantsPanelOpen ? 'Close' : 'Open'} participants. ${meetingStore.activeParticipants.length} in meeting.`">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            <span class="ctrl-label" aria-hidden="true">People</span>
          </button>

          <button :class="['ctrl-btn', { active: meetingStore.isSettingsPanelOpen }]" @click="meetingStore.isSettingsPanelOpen = !meetingStore.isSettingsPanelOpen" :aria-label="`${meetingStore.isSettingsPanelOpen ? 'Close' : 'Open'} settings`">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>
            <span class="ctrl-label" aria-hidden="true">Settings</span>
          </button>

          <button class="ctrl-btn leave-btn" @click="handleLeave" :aria-label="meetingStore.isHost ? 'End meeting for everyone' : 'Leave meeting'">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            <span class="ctrl-label" aria-hidden="true">{{ meetingStore.isHost ? 'End' : 'Leave' }}</span>
          </button>
        </div>
      </nav>

    </template><!-- end v-else (main room) -->

    <!-- Leave confirm -->
    <Transition name="modal-fade">
      <div v-if="showLeaveDialog" class="modal-overlay" @click.self="showLeaveDialog = false" role="presentation">
        <dialog open class="leave-dialog" :aria-label="meetingStore.isHost ? 'End meeting' : 'Leave meeting'" @keydown.escape="showLeaveDialog = false">
          <h2>{{ meetingStore.isHost ? 'End meeting?' : 'Leave meeting?' }}</h2>
          <p v-if="meetingStore.isHost">This will end the meeting for all participants.</p>
          <p v-else>You can rejoin later using the invite link.</p>
          <div class="leave-actions">
            <button class="leave-cancel" @click="showLeaveDialog = false" ref="leaveCancelRef">Cancel</button>
            <button class="leave-confirm-btn" @click="confirmLeave">{{ meetingStore.isHost ? 'End for All' : 'Leave' }}</button>
          </div>
        </dialog>
      </div>
    </Transition>

    <div aria-live="assertive" class="sr-only" role="alert">{{ meetingStore.screenReaderAnnouncement }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch, defineComponent, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMeetingStore } from '../stores/meeting'
import { auth } from '../services/firebase'
import { useAppStore } from '../stores/app'

const RemoteVideoTile = defineComponent({
  props: {
    stream:     { type: Object as () => MediaStream, required: true },
    isVideoOff: { type: Boolean, default: false },
  },
  setup(props) {
    const videoRef = ref<HTMLVideoElement>()
    watch(() => props.stream, s => { if (videoRef.value && s) videoRef.value.srcObject = s }, { immediate: true })
    onMounted(() => { if (videoRef.value && props.stream) videoRef.value.srcObject = props.stream })
    return () => h('video', {
      ref: videoRef,
      class: ['tile-video', { hidden: props.isVideoOff }],
      autoplay: true, playsinline: true, 'aria-hidden': true,
    })
  },
})

const route        = useRoute()
const router       = useRouter()
const meetingStore = useMeetingStore()
const appStore     = useAppStore()

const currentUser = computed(() => auth.currentUser)
const meetingCode = computed(() => route.params.code as string)

const localVideoRef    = ref<HTMLVideoElement>()
const spotlightLocalRef= ref<HTMLVideoElement>()
const chatMessagesRef  = ref<HTMLElement>()
const chatInputRef     = ref<HTMLTextAreaElement>()
const leaveCancelRef   = ref<HTMLButtonElement>()

const showLeaveDialog    = ref(false)
const showReactionPicker = ref(false)
const chatInput          = ref('')
const openParticipantMenu = ref<string | null>(null)
const elapsedMs          = ref(0)
const now                = ref(new Date())
let timerInterval: ReturnType<typeof setInterval> | null = null
let clockInterval: ReturnType<typeof setInterval> | null = null

const reactionEmojis = ['👍', '👎', '❤️', '😂', '😮', '🎉', '🙌', '🔥']

const formattedClock = computed(() =>
  now.value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) + ', ' +
  now.value.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
)

const elapsedDisplay = computed(() => {
  const s = Math.floor(elapsedMs.value / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}:${String(m % 60).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`
  return `${m}:${String(s % 60).padStart(2,'0')}`
})

const gridClass = computed(() => {
  const total = meetingStore.remoteStreamsArray.length + 1
  if (total <= 1) return '1'
  if (total <= 2) return '2'
  if (total <= 4) return '4'
  if (total <= 9) return '9'
  return 'many'
})

const spotlightStream = computed(() => {
  const uid = meetingStore.spotlightUid
  if (!uid) return null
  if (uid === currentUser.value?.uid)
    return { uid: 'local', stream: meetingStore.localStream!, displayName: 'You', isVideoOff: meetingStore.isVideoOff }
  return meetingStore.remoteStreams.get(uid) ?? null
})

const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  if (meetingStore.isInMeeting) { e.preventDefault(); e.returnValue = '' }
}

onMounted(async () => {
  if (!meetingStore.isInMeeting) {
    router.replace(`/meeting/prejoin/${meetingCode.value}`)
    return
  }
  if (localVideoRef.value && meetingStore.localStream)
    localVideoRef.value.srcObject = meetingStore.localStream

  await meetingStore.enumerateDevices()
  timerInterval = setInterval(() => { elapsedMs.value += 1000 }, 1000)
  clockInterval = setInterval(() => { now.value = new Date() }, 1000)
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('beforeunload', handleBeforeUnload)
  document.title = `${meetingStore.meeting?.title || 'Meeting'}: Ongoing | Soft Connect`
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
  if (clockInterval) clearInterval(clockInterval)
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

watch(() => meetingStore.localStream, s => {
  if (s && localVideoRef.value) localVideoRef.value.srcObject = s
})

watch(() => meetingStore.chatMessages.length, async (newLen, oldLen) => {
  if (newLen > oldLen) {
    const lastMsg = meetingStore.chatMessages[newLen - 1]
    if (lastMsg && lastMsg.senderUid !== currentUser.value?.uid)
      meetingStore.addScreenReaderAnnouncement(`New message from ${lastMsg.senderName}: ${lastMsg.content}`)
  }
  if (meetingStore.isChatOpen && chatMessagesRef.value) {
    await nextTick()
    chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
  }
})

watch(showLeaveDialog, async open => {
  if (open) { await nextTick(); leaveCancelRef.value?.focus() }
})

function handleClickOutside(e: MouseEvent) {
  if (openParticipantMenu.value) openParticipantMenu.value = null
  if (showReactionPicker.value) showReactionPicker.value = false
}

function handleGlobalKeydown(e: KeyboardEvent) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey
  if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
    if (e.key === 'Escape') handleEscape()
    return
  }
  if (cmdOrCtrl && e.key.toLowerCase() === 'd') { e.preventDefault(); meetingStore.toggleAudio() }
  if (cmdOrCtrl && e.key.toLowerCase() === 'e') { e.preventDefault(); meetingStore.toggleVideo() }
  if (cmdOrCtrl && e.altKey && e.key.toLowerCase() === 'h') { e.preventDefault(); meetingStore.toggleHandRaise() }
  if (cmdOrCtrl && e.altKey && e.key.toLowerCase() === 'c') { e.preventDefault(); meetingStore.isChatOpen ? meetingStore.closeChat() : meetingStore.openChat() }
  if (cmdOrCtrl && e.altKey && e.key.toLowerCase() === 'p') { e.preventDefault(); meetingStore.isParticipantsPanelOpen = !meetingStore.isParticipantsPanelOpen }
}

function handleEscape() {
  if (meetingStore.isChatOpen)               { meetingStore.closeChat(); return }
  if (meetingStore.isParticipantsPanelOpen)  { meetingStore.isParticipantsPanelOpen = false; return }
  if (meetingStore.isSettingsPanelOpen)      { meetingStore.isSettingsPanelOpen = false; return }
  if (showReactionPicker.value)              { showReactionPicker.value = false; return }
}

function toggleParticipantMenu(uid: string) {
  openParticipantMenu.value = openParticipantMenu.value === uid ? null : uid
}

async function sendChat() {
  if (!chatInput.value.trim()) return
  await meetingStore.sendChat(chatInput.value)
  chatInput.value = ''
  if (chatInputRef.value) chatInputRef.value.style.height = 'auto'
}

function autoResizeChat() {
  if (!chatInputRef.value) return
  chatInputRef.value.style.height = 'auto'
  chatInputRef.value.style.height = Math.min(chatInputRef.value.scrollHeight, 100) + 'px'
}

/** sendReaction now calls store.sendReaction which writes to Firestore */
async function handleSendReaction(emoji: string) {
  showReactionPicker.value = false
  await meetingStore.sendReaction(emoji)
}

async function admitAll() {
  for (const p of meetingStore.waitingParticipants) {
    await meetingStore.admitWaitingParticipant(p.uid)
  }
}

function handleLeave() { showLeaveDialog.value = true }

async function confirmLeave() {
  showLeaveDialog.value = false
  await meetingStore.leaveCurrentMeeting()
  router.push('/meetings')
}

async function copyMeetingLink() {
  const link = meetingStore.meeting?.inviteLink ?? ''
  if (!link) return
  try {
    await navigator.clipboard.writeText(link)
    appStore.addNotification('Invite link copied!', 'success')
  } catch {}
}

function getParticipantName(uid: string): string {
  return meetingStore.meeting?.participants[uid]?.displayName ?? uid
}

function getParticipantRole(uid: string) {
  return meetingStore.meeting?.participants[uid]?.role ?? 'attendee'
}

function formatMsgTime(ts?: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
* { box-sizing: border-box; }
.meeting-room { display:flex;flex-direction:column;height:100vh;background:#0a0c18;font-family:'DM Sans',sans-serif;color:#e2e8f0;overflow:hidden;position:relative; }

/* ── Waiting Lobby ──────────────────────────────────────────────────────────── */
.waiting-lobby {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #070a14;
  position: relative;
  overflow: hidden;
}
.waiting-orbs { position: absolute; inset: 0; pointer-events: none; }
.orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.2; }
.orb1 { width: 400px; height: 400px; background: #5c3bff; top: -100px; left: -100px; animation: orbFloat 12s ease-in-out infinite; }
.orb2 { width: 300px; height: 300px; background: #ff3b8c; bottom: -80px; right: -60px; animation: orbFloat 15s ease-in-out infinite reverse; }
@keyframes orbFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px)} }
.waiting-inner { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 1rem; text-align: center; max-width: 420px; padding: 2rem; }
.waiting-icon { color: rgba(255,255,255,0.3); margin-bottom: 0.5rem; }
.waiting-inner h1 { font-family: 'Syne', sans-serif; font-size: 1.5rem; font-weight: 800; color: #fff; margin: 0; }
.waiting-inner p { font-size: 0.9rem; color: rgba(255,255,255,0.52); margin: 0; line-height: 1.6; }
.waiting-status-row { display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center; margin: 0.25rem 0; }
.device-chip {
  display: flex; align-items: center; gap: 0.375rem;
  background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.2); color: #34d399;
  font-size: 0.78rem; font-weight: 600; padding: 0.3rem 0.75rem; border-radius: 999px;
}
.device-chip.muted { background: rgba(255,59,92,0.1); border-color: rgba(255,59,92,0.2); color: #ff6b8a; }
.waiting-pulse-bar { display: flex; gap: 5px; align-items: flex-end; height: 24px; margin: 0.5rem 0; }
.waiting-pulse-bar span { width: 4px; border-radius: 2px; background: #5c3bff; animation: pulseBars 1.2s ease-in-out infinite; }
.waiting-pulse-bar span:nth-child(1) { height: 14px; animation-delay: 0s; }
.waiting-pulse-bar span:nth-child(2) { height: 24px; animation-delay: 0.2s; }
.waiting-pulse-bar span:nth-child(3) { height: 14px; animation-delay: 0.4s; }
@keyframes pulseBars { 0%,100%{opacity:0.4;transform:scaleY(0.7)} 50%{opacity:1;transform:scaleY(1)} }
.leave-waiting-btn {
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.65); border-radius: 10px; padding: 0.625rem 1.5rem;
  font-family: inherit; font-size: 0.875rem; cursor: pointer; margin-top: 0.5rem;
}
.leave-waiting-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
.leave-waiting-btn:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }

/* ── Waiting Queue Banner (host) ─────────────────────────────────────────────── */
.waiting-queue-banner {
  background: rgba(92,59,255,0.12);
  border-bottom: 1px solid rgba(92,59,255,0.3);
  padding: 0.75rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  flex-shrink: 0;
  z-index: 25;
}
.wq-left { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.wq-count { background: rgba(92,59,255,0.4); color: #a78bfa; font-size: 0.75rem; font-weight: 800; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.wq-text { font-size: 0.82rem; font-weight: 600; color: #a78bfa; }
.wq-people { display: flex; align-items: center; gap: 0.75rem; flex: 1; flex-wrap: wrap; }
.wq-person { display: flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.09); border-radius: 10px; padding: 0.375rem 0.625rem; }
.wq-avatar { width: 26px; height: 26px; border-radius: 50%; background: linear-gradient(135deg,#5c3bff40,#ff3b8c40); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; color: #a78bfa; overflow: hidden; flex-shrink: 0; }
.wq-avatar img { width: 100%; height: 100%; object-fit: cover; }
.wq-name { font-size: 0.8rem; font-weight: 500; color: #e2e8f0; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wq-more { font-size: 0.75rem; color: rgba(255,255,255,0.45); }
.wq-btn { border: none; border-radius: 7px; padding: 0.3rem 0.75rem; font-family: inherit; font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.15s; min-height: 28px; }
.wq-btn.admit { background: rgba(52,211,153,0.2); color: #34d399; }
.wq-btn.admit:hover { background: rgba(52,211,153,0.35); }
.wq-btn.deny { background: rgba(255,59,92,0.15); color: #ff6b8a; }
.wq-btn.deny:hover { background: rgba(255,59,92,0.28); }
.wq-btn:focus-visible { outline: 3px solid #7c6fff; outline-offset: 2px; }
.wq-bulk { margin-left: auto; }
.waiting-slide-enter-active, .waiting-slide-leave-active { transition: all 0.3s ease; max-height: 200px; }
.waiting-slide-enter-from, .waiting-slide-leave-to { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; }

/* ── Reactions (now Firestore-broadcast, shown for ALL participants) ─────────── */
.reaction-overlay { position: absolute; inset: 0; pointer-events: none; z-index: 20; overflow: hidden; }
.reaction-bubble {
  position: absolute;
  bottom: 80px;
  font-size: 2.2rem;
  line-height: 1;
  animation: floatUpReact 4s ease-out forwards;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
}
@keyframes floatUpReact {
  0%   { transform: translateY(0) scale(1);    opacity: 1; }
  80%  { transform: translateY(-260px) scale(1.2); opacity: 0.85; }
  100% { transform: translateY(-320px) scale(1.4); opacity: 0; }
}
.react-float-enter-active { transition: opacity 0.2s; }
.react-float-leave-active { transition: opacity 0.5s; }
.react-float-leave-to { opacity: 0; }

/* ── Settings panel — toggle descriptions ────────────────────────────────────── */
.setting-toggle-row { display:flex;align-items:flex-start;justify-content:space-between;padding:.75rem 0;border-bottom:1px solid rgba(255,255,255,.05);gap:1rem; }
.setting-toggle-row:last-child { border-bottom: none; }
.setting-info { flex: 1; display: flex; flex-direction: column; gap: 3px; }
.setting-info label { font-size:.875rem;font-weight:500;color:#e2e8f0;cursor:pointer; }
.setting-desc { font-size:.72rem;color:rgba(255,255,255,.38);line-height:1.4; }
.setting-toggle-row input[type=checkbox] { width:36px;height:20px;border-radius:999px;appearance:none;-webkit-appearance:none;background:rgba(255,255,255,.15);transition:background .2s;cursor:pointer;position:relative;flex-shrink:0;margin-top:2px; }
.setting-toggle-row input[type=checkbox]:checked { background:linear-gradient(135deg,#5c3bff,#7c3bff); }
.setting-toggle-row input[type=checkbox]::after { content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .2s; }
.setting-toggle-row input[type=checkbox]:checked::after { transform:translateX(16px); }
.setting-toggle-row input[type=checkbox]:focus-visible { outline:3px solid #7c6fff;outline-offset:2px;border-radius:999px; }

/* ── All the rest (copied + trimmed from original) ─────────────────────────── */
.room-topbar { display:flex;align-items:center;justify-content:space-between;padding:.625rem 1.25rem;background:rgba(6,8,16,.9);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0;z-index:30;min-height:52px; }
.topbar-left,.topbar-right { display:flex;align-items:center;gap:1rem; }
.meeting-name-badge { display:flex;align-items:center;gap:.5rem; }
.badge-icon { background:linear-gradient(135deg,#5c3bff,#ff3b8c);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:1.1rem; }
.badge-title { font-weight:700;font-size:.95rem;color:#fff; }
.divider-bar { color: rgba(255,255,255,0.2); font-size: 0.8rem; }
.room-clock { font-size:.85rem;color:#fff;font-weight:500; }
.room-timer { font-family:monospace;font-size:.85rem;color:rgba(255,255,255,.5); }
.recording-badge { display:flex;align-items:center;gap:.375rem;background:rgba(255,59,92,.2);border:1px solid rgba(255,59,92,.35);border-radius:999px;padding:.2rem .625rem;font-size:.75rem;font-weight:700;color:#ff6b8a; }
.rec-dot { width:6px;height:6px;border-radius:50%;background:#ff3b5c;animation:pulse 1s infinite; }
@keyframes pulse { 0%,100%{opacity:1}50%{opacity:.3} }
.participants-count { display:flex;align-items:center;gap:.375rem;font-size:.85rem;color:rgba(255,255,255,.6); }
.topbar-btn { background:rgba(255,255,255,.07);border:none;border-radius:8px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,.6);transition:all .15s; }
.topbar-btn:hover { background:rgba(255,255,255,.12);color:#fff; }
.room-main { flex:1;display:flex;position:relative;overflow:hidden;min-height:0; }
.video-grid { flex:1;display:grid;gap:4px;padding:4px;align-content:center; }
.video-grid.grid-1 { grid-template-columns:1fr; }
.video-grid.grid-2 { grid-template-columns:1fr 1fr; }
.video-grid.grid-4 { grid-template-columns:1fr 1fr; }
.video-grid.grid-9 { grid-template-columns:repeat(3,1fr); }
.video-grid.grid-many { grid-template-columns:repeat(4,1fr); }
.video-tile { background:#0f1126;border-radius:10px;overflow:hidden;position:relative;aspect-ratio:16/9;border:2px solid transparent;transition:border-color .2s; }
.video-tile.speaking { border-color:#34d399; }
.video-tile:focus-visible { outline:3px solid #7c6fff;outline-offset:-3px; }
.tile-video { width:100%;height:100%;object-fit:cover; }
.tile-video.hidden { opacity:0;pointer-events:none; }
.tile-video-wrapper { width:100%;height:100%;position:relative; }
.tile-avatar { position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0e1128,#1a0a2e); }
.ta-circle { width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#5c3bff,#ff3b8c);display:flex;align-items:center;justify-content:center;font-size:1.75rem;font-weight:700;color:#fff;overflow:hidden; }
.ta-circle img { width:100%;height:100%;object-fit:cover; }
.screen-share-badge { position:absolute;top:.5rem;left:50%;transform:translateX(-50%);background:rgba(92,59,255,.85);color:#fff;padding:.2rem .625rem;border-radius:999px;font-size:.72rem;font-weight:600;display:flex;align-items:center;gap:.25rem; }
.tile-footer { position:absolute;bottom:0;left:0;right:0;padding:.5rem .625rem;background:linear-gradient(to top,rgba(0,0,0,.8),transparent);display:flex;align-items:flex-end;justify-content:space-between; }
.tile-name { display:flex;align-items:center;gap:.375rem;font-size:.78rem;font-weight:600;color:#fff; }
.mute-icon { color:#ff6b8a;flex-shrink:0; }
.tile-controls { display:flex;gap:.25rem;align-items:center; }
.role-badge { width:18px;height:18px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:800; }
.role-badge.host { background:rgba(251,191,36,.3);color:#fbbf24; }
.role-badge.cohost { background:rgba(52,211,153,.2);color:#34d399; }
.host-overlay { position:absolute;top:.5rem;right:.5rem;display:none;gap:4px;flex-direction:column; }
.video-tile:hover .host-overlay { display:flex; }
.host-overlay-btn { width:30px;height:30px;border-radius:8px;border:none;background:rgba(0,0,0,.7);backdrop-filter:blur(8px);color:rgba(255,255,255,.8);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s; }
.host-overlay-btn:hover { background:rgba(255,255,255,.2);color:#fff; }
.host-overlay-btn.danger:hover { background:rgba(255,59,92,.6); }
.waiting-state { position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;display:flex;flex-direction:column;align-items:center;gap:1rem;max-width:360px; }
.waiting-icon-sm { font-size:3.5rem; }
.waiting-state h2 { font-family:'Syne',sans-serif;color:rgba(255,255,255,.75);margin:0;font-size:1.15rem; }
.waiting-state p { color:rgba(255,255,255,.38);font-size:.875rem;margin:0; }
.share-link-btn { display:inline-flex;align-items:center;gap:.5rem;background:rgba(92,59,255,.22);border:1px solid rgba(92,59,255,.35);border-radius:10px;padding:.625rem 1.25rem;color:#a78bfa;font-family:inherit;font-size:.875rem;font-weight:600;cursor:pointer;min-height:44px; }
.hand-queue { position:absolute;top:1rem;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:.5rem;background:rgba(251,191,36,.15);border:1px solid rgba(251,191,36,.3);border-radius:999px;padding:.375rem 1rem;font-size:.82rem;color:#fbbf24; }
.hand-more { opacity:.7; }
.hand-queue button { background:rgba(251,191,36,.2);border:none;border-radius:999px;padding:.2rem .625rem;color:#fbbf24;font-size:.78rem;font-weight:600;cursor:pointer;font-family:inherit; }
.spotlight-layout { flex:1;display:flex;flex-direction:column;padding:4px;gap:4px;min-height:0; }
.spotlight-main { flex:1;background:#0f1126;border-radius:10px;overflow:hidden;position:relative;min-height:0; }
.spotlight-video-wrap { width:100%;height:100%; }
.spotlight-name { position:absolute;bottom:1rem;left:1rem;display:flex;align-items:center;gap:.75rem;font-weight:600;color:#fff;font-size:.9rem; }
.exit-spotlight-btn { display:flex;align-items:center;gap:.375rem;background:rgba(255,255,255,.15);backdrop-filter:blur(8px);border:none;border-radius:8px;padding:.375rem .75rem;color:#fff;font-family:inherit;font-size:.78rem;cursor:pointer; }
.spotlight-strip { display:flex;gap:4px;height:120px;overflow-x:auto; }
.strip-tile { flex-shrink:0;width:160px;background:#0f1126;border-radius:8px;overflow:hidden;position:relative;cursor:pointer; }
.strip-name { position:absolute;bottom:0;left:0;right:0;padding:.375rem;font-size:.72rem;color:#fff;font-weight:500;background:linear-gradient(to top,rgba(0,0,0,.8),transparent); }
.chat-panel,.participants-panel,.settings-panel-room { position:absolute;top:0;right:0;bottom:0;width:320px;background:rgba(8,10,20,.97);backdrop-filter:blur(20px);border-left:1px solid rgba(255,255,255,.09);display:flex;flex-direction:column;z-index:20; }
.panel-header { display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0; }
.panel-header h2 { font-family:'Syne',sans-serif;font-size:.95rem;font-weight:700;color:#fff;margin:0; }
.panel-count { font-family:'DM Sans',sans-serif;font-size:.85rem;color:rgba(255,255,255,.4); }
.panel-header button { background:rgba(255,255,255,.07);border:none;border-radius:8px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,.55);font-size:.85rem; }
.panel-header button:hover { background:rgba(255,255,255,.12);color:#fff; }
.panel-slide-enter-active,.panel-slide-leave-active { transition:all .25s ease; }
.panel-slide-enter-from,.panel-slide-leave-to { transform:translateX(100%);opacity:0; }
.chat-messages { flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.875rem; }
.chat-empty { text-align:center;color:rgba(255,255,255,.35);font-size:.85rem;padding:2rem 0; }
.chat-msg { display:flex;flex-direction:column;gap:.25rem; }
.chat-msg.own .msg-sender { flex-direction:row-reverse; }
.chat-msg.own .msg-content { align-self:flex-end;background:linear-gradient(135deg,#5c3bff,#7c3bff); }
.msg-sender { display:flex;align-items:center;gap:.5rem; }
.msg-avatar { width:24px;height:24px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#5c3bff40,#ff3b8c40);display:flex;align-items:center;justify-content:center;font-size:.75rem;overflow:hidden; }
.msg-avatar img { width:100%;height:100%;object-fit:cover; }
.msg-name { font-size:.75rem;font-weight:600;color:rgba(255,255,255,.65); }
.msg-time { font-size:.68rem;color:rgba(255,255,255,.3); }
.msg-content { padding:.5rem .75rem;border-radius:10px;background:rgba(255,255,255,.08);font-size:.85rem;line-height:1.4;max-width:85%;word-break:break-word;color:#e2e8f0; }
.chat-input-area { display:flex;gap:.5rem;padding:.875rem;border-top:1px solid rgba(255,255,255,.07);flex-shrink:0; }
.chat-input-area textarea { flex:1;background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.1);border-radius:10px;padding:.5rem .75rem;color:#e2e8f0;font-family:inherit;font-size:.875rem;resize:none;min-height:40px; }
.chat-input-area textarea:focus { outline:none;border-color:rgba(92,59,255,.6); }
.chat-send-btn { width:40px;height:40px;border-radius:50%;border:none;background:linear-gradient(135deg,#5c3bff,#7c3bff);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0; }
.chat-send-btn:disabled { opacity:.35;cursor:not-allowed; }
.host-controls-bar { display:flex;gap:.5rem;flex-wrap:wrap;padding:.75rem 1rem;border-bottom:1px solid rgba(255,255,255,.06); }
.host-bar-btn { background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:.375rem .75rem;color:rgba(255,255,255,.7);font-family:inherit;font-size:.78rem;font-weight:500;cursor:pointer;min-height:32px; }
.host-bar-btn:hover { background:rgba(255,255,255,.12); }
.participants-list { flex:1;overflow-y:auto;padding:.5rem 0;list-style:none;margin:0; }
.participant-row { display:flex;align-items:center;gap:.75rem;padding:.625rem 1rem;transition:background .15s;position:relative; }
.participant-row:hover { background:rgba(255,255,255,.04); }
.part-avatar { width:36px;height:36px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#5c3bff40,#ff3b8c40);display:flex;align-items:center;justify-content:center;font-size:1rem;overflow:hidden; }
.part-avatar img { width:100%;height:100%;object-fit:cover; }
.part-info { flex:1;min-width:0;display:flex;flex-direction:column; }
.part-name { font-size:.875rem;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.part-role { font-size:.7rem;font-weight:600;text-transform:capitalize; }
.part-role.host { color:#fbbf24; }
.part-role.co-host { color:#34d399; }
.part-role.attendee { color:rgba(255,255,255,.38); }
.part-indicators { display:flex;gap:4px;align-items:center;flex-shrink:0; }
.indicator { color:rgba(255,255,255,.4); }
.indicator.muted { color:#ff6b8a; }
.part-actions { flex-shrink:0;position:relative; }
.part-action-btn { background:rgba(255,255,255,.07);border:none;border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,.5); }
.participant-menu { position:absolute;right:0;top:100%;margin-top:4px;background:#0e1222;border:1px solid rgba(255,255,255,.11);border-radius:12px;overflow:hidden;min-width:200px;z-index:50;box-shadow:0 12px 40px rgba(0,0,0,.7); }
.participant-menu button { display:block;width:100%;padding:.625rem 1rem;background:none;border:none;color:rgba(255,255,255,.72);cursor:pointer;font-family:inherit;font-size:.82rem;text-align:left;min-height:36px; }
.participant-menu button:hover { background:rgba(255,255,255,.07);color:#fff; }
.remove-item { color:#ff6b8a!important; }
.menu-div { height:1px;background:rgba(255,255,255,.07);margin:.25rem 0; }
.settings-content { flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:1.5rem; }
.settings-section h3 { font-size:.75rem;font-weight:700;color:rgba(255,255,255,.38);text-transform:uppercase;letter-spacing:.1em;margin:0 0 .875rem; }
.device-field { display:flex;flex-direction:column;gap:.375rem;margin-bottom:.75rem; }
.device-field label { font-size:.8rem;font-weight:600;color:rgba(255,255,255,.55); }
.device-field select { background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.1);border-radius:8px;padding:.5rem .75rem;color:#e2e8f0;font-family:inherit;font-size:.85rem;min-height:40px; }
.meeting-notifications { position:absolute;bottom:90px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:.5rem;z-index:40;pointer-events:none; }
.meeting-notif { background:rgba(10,12,24,.92);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:.5rem 1rem;font-size:.82rem;font-weight:500;backdrop-filter:blur(16px);white-space:nowrap; }
.notif-success { border-color:rgba(52,211,153,.4);color:#34d399; }
.notif-warning { border-color:rgba(251,191,36,.4);color:#fbbf24; }
.notif-error { border-color:rgba(255,59,92,.4);color:#ff6b8a; }
.notif-info { color:#a78bfa; }
.notif-enter-active,.notif-leave-active { transition:all .25s ease; }
.notif-enter-from { opacity:0;transform:translateY(10px); }
.notif-leave-to { opacity:0;transform:translateY(-10px); }
.controls-bar { display:flex;align-items:center;justify-content:space-between;padding:.75rem 1.25rem;background:rgba(6,8,16,.95);backdrop-filter:blur(20px);border-top:1px solid rgba(255,255,255,.07);flex-shrink:0;z-index:30;gap:.5rem;min-height:76px; }
.ctrl-group { display:flex;align-items:center;gap:.375rem; }
.ctrl-center { flex:1;justify-content:center; }
.ctrl-right { justify-content:flex-end; }
.ctrl-btn { display:flex;flex-direction:column;align-items:center;gap:3px;background:rgba(255,255,255,.09);border:none;border-radius:12px;min-width:60px;padding:.5rem .75rem;cursor:pointer;color:rgba(255,255,255,.8);transition:all .15s;min-height:56px;font-family:inherit; }
.ctrl-btn:hover { background:rgba(255,255,255,.15);color:#fff; }
.ctrl-btn:focus-visible { outline:3px solid #7c6fff;outline-offset:2px; }
.ctrl-btn.off { background:rgba(255,59,92,.25);color:#ff6b8a; }
.ctrl-btn.active { background:rgba(92,59,255,.3);color:#a78bfa; }
.ctrl-label { font-size:.62rem;font-weight:600;letter-spacing:.03em; }
.ctrl-split { display:flex;align-items:center; }
.ctrl-split .ctrl-btn { border-radius:12px 0 0 12px; }
.ctrl-caret { background:rgba(255,255,255,.07);border:none;border-radius:0 12px 12px 0;padding:0;height:56px;width:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,.5);transition:all .15s;border-left:1px solid rgba(255,255,255,.1); }
.ctrl-caret:hover { background:rgba(255,255,255,.12);color:#fff; }
.leave-btn { background:rgba(255,59,92,.2)!important;color:#ff6b8a!important; }
.leave-btn:hover { background:rgba(255,59,92,.35)!important; }
.icon-with-badge { position:relative;display:inline-flex; }
.badge { position:absolute;top:-6px;right:-6px;background:#ff3b5c;color:#fff;font-size:.6rem;font-weight:800;border-radius:999px;padding:1px 4px;min-width:16px;text-align:center; }
.ctrl-reaction-wrap { position:relative; }
.reaction-picker { position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);background:#0e1222;border:1px solid rgba(255,255,255,.11);border-radius:14px;padding:.5rem;display:flex;gap:4px;flex-wrap:wrap;width:220px;box-shadow:0 12px 40px rgba(0,0,0,.7);z-index:50; }
.reaction-btn { font-size:1.5rem;background:none;border:none;cursor:pointer;border-radius:8px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;transition:background .15s; }
.reaction-btn:hover { background:rgba(255,255,255,.1); }
.modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:100; }
.modal-fade-enter-active,.modal-fade-leave-active { transition:all .2s ease; }
.modal-fade-enter-from,.modal-fade-leave-to { opacity:0; }
.leave-dialog { background:#0e1222;border:1px solid rgba(255,255,255,.11);border-radius:20px;padding:2rem;max-width:360px;width:90%;text-align:center;color:#e2e8f0;box-shadow:0 20px 64px rgba(0,0,0,.7); }
.leave-dialog h2 { font-family:'Syne',sans-serif;color:#fff;margin:0 0 .75rem;font-size:1.15rem; }
.leave-dialog p { color:rgba(255,255,255,.52);font-size:.875rem;margin:0 0 1.5rem; }
.leave-actions { display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap; }
.leave-cancel { background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.11);border-radius:10px;padding:.625rem 1.25rem;color:rgba(255,255,255,.72);cursor:pointer;font-family:inherit;font-size:.9rem;min-height:44px; }
.leave-confirm-btn { background:linear-gradient(135deg,#ff3b5c,#ff3b8c);border:none;border-radius:10px;padding:.625rem 1.25rem;color:#fff;cursor:pointer;font-family:inherit;font-size:.9rem;font-weight:700;min-height:44px; }
.sr-only { position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0; }
@media(max-width:640px){ .controls-bar{flex-wrap:wrap;gap:.25rem;padding:.5rem} .ctrl-btn{min-width:48px;padding:.375rem .5rem} }
</style>
