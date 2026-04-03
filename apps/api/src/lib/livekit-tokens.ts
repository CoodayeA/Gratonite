/**
 * Shared LiveKit access token TTL (JWT lifetime).
 * Format: duration string understood by livekit-server-sdk (e.g. 30m, 1h) or omit for server default.
 */
export const LIVEKIT_ACCESS_TOKEN_TTL = (process.env.LIVEKIT_ACCESS_TOKEN_TTL || '1h').trim() || '1h';
