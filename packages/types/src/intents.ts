// ==========================================================================
// Gateway intents (bitfield)
// ==========================================================================

export const GatewayIntents = {
  GUILDS: 1 << 0,
  GUILD_MEMBERS: 1 << 1,
  GUILD_MESSAGES: 1 << 2,
  GUILD_MESSAGE_TYPING: 1 << 3,
  GUILD_PRESENCES: 1 << 4,
  GUILD_VOICE_STATES: 1 << 5,
  DIRECT_MESSAGES: 1 << 6,
  DIRECT_MESSAGE_TYPING: 1 << 7,
} as const;

export type GatewayIntent = (typeof GatewayIntents)[keyof typeof GatewayIntents];
