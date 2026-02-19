import type { Snowflake } from './snowflake';

// ============================================================================
// Voice & Video types
// ============================================================================

/** Voice state (who is in which voice channel) */
export interface VoiceState {
  userId: Snowflake;
  channelId: Snowflake;
  guildId: Snowflake | null;
  sessionId: string;
  deaf: boolean; // server-deafened
  mute: boolean; // server-muted
  selfDeaf: boolean;
  selfMute: boolean;
  selfStream: boolean; // screen sharing / go live
  selfVideo: boolean; // camera on
  suppress: boolean; // suppressed in stage channel
  requestToSpeakTimestamp: string | null; // stage hand raise
}

/** Screen share session */
export interface ScreenShareSession {
  userId: Snowflake;
  channelId: Snowflake;
  quality: StreamQuality;
  shareType: ShareType;
  audioEnabled: boolean;
  viewerCount: number;
  startedAt: string;
}

/** Soundboard sound */
export interface SoundboardSound {
  id: Snowflake;
  guildId: Snowflake;
  name: string; // max 32 chars
  soundHash: string;
  volume: number; // 0.0–1.0
  emojiId: Snowflake | null;
  emojiName: string | null;
  uploaderId: Snowflake;
  available: boolean;
}

/** Stage instance */
export interface StageInstance {
  id: Snowflake;
  guildId: Snowflake;
  channelId: Snowflake;
  topic: string; // max 120 chars
  privacyLevel: StagePrivacyLevel;
  scheduledEventId: Snowflake | null;
}

// ============================================================================
// Enums
// ============================================================================

export type StreamQuality = 'standard' | 'high' | 'source';

export type ShareType = 'screen' | 'window' | 'tab' | 'game';

export type StagePrivacyLevel = 'public' | 'guild_only';
