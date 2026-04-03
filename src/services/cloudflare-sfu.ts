// src/services/cloudflare-sfu.ts
// Cloudflare Realtime SFU — pure WebRTC signalling client.
// All media (audio/video) goes through the SFU.
// DataChannels carry rapid control messages (mute, speaking, hand-raise).
// Firestore is kept for durable state only (meeting doc, chat, participant roster).

const CF_APP_ID    = '83cb9ae8dcf02319b91a465b88a675f9'
const CF_APP_TOKEN = '414a715e9ac654cca5363a3cd374043a8ef0055e72be1392341aa279b9731040'
const BASE_URL     = `https://rtc.live.cloudflare.com/v1/apps/${CF_APP_ID}`

// ── Cloudflare SFU HTTPS helpers ───────────────────────────────────────────

async function sfuFetch(path: string, method: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${CF_APP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Cloudflare SFU [${res.status}] ${path}: ${err}`)
  }
  return res.json()
}

export async function sfuCreateSession(): Promise<{ sessionId: string }> {
  return sfuFetch('/sessions/new', 'POST') as Promise<{ sessionId: string }>
}

export interface SfuTrackDescriptor {
  location: 'local' | 'remote'
  mid?: string
  trackName: string
  sessionId?: string   // only for remote tracks
  kind?: 'audio' | 'video'
}

export interface SfuTracksResponse {
  sessionDescription?: { sdp: string; type: 'answer' | 'offer' }
  requiresImmediateRenegotiation: boolean
  tracks: Array<{ trackName: string; mid: string; sessionId?: string }>
  errorCode?: string
}

export async function sfuAddTracks(
  sessionId: string,
  tracks: SfuTrackDescriptor[],
  offer?: RTCSessionDescriptionInit,
): Promise<SfuTracksResponse> {
  return sfuFetch(`/sessions/${sessionId}/tracks/new`, 'POST', {
    sessionDescription: offer ? { sdp: offer.sdp, type: offer.type } : undefined,
    tracks,
  }) as Promise<SfuTracksResponse>
}

export async function sfuRenegotiate(
  sessionId: string,
  answer: RTCSessionDescriptionInit,
): Promise<void> {
  await sfuFetch(`/sessions/${sessionId}/renegotiate`, 'PUT', {
    sessionDescription: { sdp: answer.sdp, type: answer.type },
  })
}

export async function sfuCloseTracks(
  sessionId: string,
  mids: string[],
  offer?: RTCSessionDescriptionInit,
): Promise<SfuTracksResponse> {
  return sfuFetch(`/sessions/${sessionId}/tracks/close`, 'PUT', {
    tracks: mids.map(mid => ({ mid })),
    sessionDescription: offer ? { sdp: offer.sdp, type: offer.type } : undefined,
    force: false,
  }) as Promise<SfuTracksResponse>
}

// ── ICE config for the SFU connection ─────────────────────────────────────
export const SFU_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.cloudflare.com:3478' },
]

// ── DataChannel message types ─────────────────────────────────────────────
// Sent peer-to-SFU-broadcast via the server-events DataChannel.
// Since the SFU doesn't natively broadcast DataChannel msgs between peers,
// we broadcast state updates through Firestore for simplicity.
// BUT: the DataChannel is still opened for the server-events channel (required
// by Cloudflare to keep the connection alive for server-push).

export type DcMsg =
  | { type: 'state'; uid: string; muted: boolean; videoOff: boolean; speaking: boolean; handRaised: boolean; screenSharing: boolean }
  | { type: 'ping'; uid: string }
  | { type: 'pong'; uid: string }
