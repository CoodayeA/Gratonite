/**
 * bot.ts — Bot SDK types for Gratonite.
 *
 * Types used by bot developers building integrations with the Gratonite
 * webhook-based bot system. Bots receive events via HTTP webhooks and
 * respond with actions via the Gratonite API.
 */

import type {
  Message,
  UserSummary,
  Guild,
  Channel,
  Embed,
  EmbedField,
} from './api';

// ---------------------------------------------------------------------------
// Webhook event delivery
// ---------------------------------------------------------------------------

/** Events that a bot can subscribe to. */
export type BotEventType =
  | 'message_create'
  | 'message_update'
  | 'message_delete'
  | 'guild_member_add'
  | 'guild_member_remove'
  | 'reaction_add'
  | 'reaction_remove'
  | 'guild_join'
  | 'guild_leave'
  | 'interaction_create';

/** The envelope wrapping every webhook event delivery. */
export interface BotWebhookDelivery<T = unknown> {
  /** Unique delivery ID for idempotency. */
  deliveryId: string;
  /** The event type. */
  event: BotEventType;
  /** Timestamp of the event (ISO 8601). */
  timestamp: string;
  /** The guild where the event occurred (null for DMs). */
  guildId: string | null;
  /** The channel where the event occurred (if applicable). */
  channelId: string | null;
  /** Event-specific payload. */
  data: T;
}

// ---------------------------------------------------------------------------
// Event payloads (webhook data field)
// ---------------------------------------------------------------------------

export interface BotMessageEvent {
  message: Message;
  author: UserSummary;
}

export interface BotMessageDeleteEvent {
  messageId: string;
  channelId: string;
}

export interface BotGuildMemberEvent {
  guildId: string;
  user: UserSummary;
}

export interface BotReactionEvent {
  messageId: string;
  channelId: string;
  userId: string;
  emoji: string;
}

export interface BotGuildJoinEvent {
  guild: Guild;
}

export interface BotGuildLeaveEvent {
  guildId: string;
}

export interface BotInteractionEvent {
  interactionId: string;
  type: 'button' | 'select_menu' | 'slash_command';
  customId?: string;
  commandName?: string;
  options?: BotCommandOption[];
  userId: string;
  channelId: string;
  guildId: string | null;
  messageId?: string;
}

export interface BotCommandOption {
  name: string;
  value: string | number | boolean;
  type: 'string' | 'integer' | 'boolean' | 'user' | 'channel' | 'role';
}

// ---------------------------------------------------------------------------
// Bot API actions
// ---------------------------------------------------------------------------

/** Actions a bot can perform via the Gratonite API. */
export type BotActionType =
  | 'send_message'
  | 'edit_message'
  | 'delete_message'
  | 'add_reaction'
  | 'remove_reaction'
  | 'assign_role'
  | 'remove_role'
  | 'kick_member'
  | 'ban_member';

/** Base shape for a bot action request. */
export interface BotAction<T extends BotActionType = BotActionType> {
  action: T;
}

export interface BotSendMessageAction extends BotAction<'send_message'> {
  channelId: string;
  content?: string;
  embeds?: Embed[];
  components?: BotMessageComponent[];
}

export interface BotEditMessageAction extends BotAction<'edit_message'> {
  channelId: string;
  messageId: string;
  content?: string;
  embeds?: Embed[];
}

export interface BotDeleteMessageAction extends BotAction<'delete_message'> {
  channelId: string;
  messageId: string;
}

export interface BotAddReactionAction extends BotAction<'add_reaction'> {
  channelId: string;
  messageId: string;
  emoji: string;
}

export interface BotRemoveReactionAction extends BotAction<'remove_reaction'> {
  channelId: string;
  messageId: string;
  emoji: string;
}

export interface BotAssignRoleAction extends BotAction<'assign_role'> {
  guildId: string;
  userId: string;
  roleId: string;
}

export interface BotRemoveRoleAction extends BotAction<'remove_role'> {
  guildId: string;
  userId: string;
  roleId: string;
}

export interface BotKickMemberAction extends BotAction<'kick_member'> {
  guildId: string;
  userId: string;
  reason?: string;
}

export interface BotBanMemberAction extends BotAction<'ban_member'> {
  guildId: string;
  userId: string;
  reason?: string;
  deleteMessageDays?: number;
}

export type AnyBotAction =
  | BotSendMessageAction
  | BotEditMessageAction
  | BotDeleteMessageAction
  | BotAddReactionAction
  | BotRemoveReactionAction
  | BotAssignRoleAction
  | BotRemoveRoleAction
  | BotKickMemberAction
  | BotBanMemberAction;

// ---------------------------------------------------------------------------
// Bot message components (simplified builder types)
// ---------------------------------------------------------------------------

export interface BotMessageComponent {
  type: 'action_row';
  components: BotComponentItem[];
}

export interface BotComponentItem {
  type: 'button' | 'select_menu';
  customId: string;
  label?: string;
  style?: BotButtonStyle;
  url?: string;
  disabled?: boolean;
  emoji?: string;
  placeholder?: string;
  options?: BotSelectOption[];
}

export type BotButtonStyle = 'primary' | 'secondary' | 'success' | 'danger' | 'link';

export interface BotSelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: string;
  default?: boolean;
}

// ---------------------------------------------------------------------------
// Embed builder helper types
// ---------------------------------------------------------------------------

/** Input shape for building rich embeds programmatically. */
export interface EmbedInput {
  title?: string;
  description?: string;
  url?: string;
  color?: string;
  timestamp?: string;
  fields?: EmbedField[];
  thumbnail?: { url: string };
  image?: { url: string };
  footer?: { text: string; iconUrl?: string };
  author?: { name: string; url?: string; iconUrl?: string };
}

// ---------------------------------------------------------------------------
// Slash command registration
// ---------------------------------------------------------------------------

export type SlashCommandOptionType =
  | 'string'
  | 'integer'
  | 'boolean'
  | 'user'
  | 'channel'
  | 'role'
  | 'number';

export interface SlashCommandOption {
  name: string;
  description: string;
  type: SlashCommandOptionType;
  required?: boolean;
  choices?: SlashCommandChoice[];
}

export interface SlashCommandChoice {
  name: string;
  value: string | number;
}

export interface SlashCommandDefinition {
  name: string;
  description: string;
  options?: SlashCommandOption[];
  /** Guild-specific or global. Null = global. */
  guildId?: string;
}
