import { and, eq } from 'drizzle-orm';
import { db } from '../db/index';
import { channelNotificationPrefs } from '../db/schema/channel-notification-prefs';
import { channels } from '../db/schema/channels';
import { guilds } from '../db/schema/guilds';
import { userSettings } from '../db/schema/settings';
import { isWithinNotificationQuietHours } from './notificationQuietHours';
import { redis } from './redis';

export type NotificationPreferenceLevel = 'all' | 'mentions' | 'nothing';
type StoredPreferenceLevel = NotificationPreferenceLevel | 'default';
export type NotificationRequirementLevel = 'all' | 'mentions' | 'always';
export type NotificationPreferenceSourceScope =
  | 'channel'
  | 'guild'
  | 'guild_default'
  | 'app_default'
  | 'direct'
  | 'system';

type StoredPreference = {
  level: StoredPreferenceLevel | null;
  mutedUntil: string | null;
  activeMute: boolean;
  storage: 'table' | 'legacy_redis' | 'redis';
};

export type EffectiveNotificationPreference = {
  effectiveLevel: NotificationPreferenceLevel;
  sourceScope: NotificationPreferenceSourceScope;
  sourceLabel: string;
  muted: boolean;
  mutedUntil: string | null;
  precedence: string[];
  channel: StoredPreference | null;
  guild: StoredPreference | null;
  guildDefault: NotificationPreferenceLevel | null;
};

export type NotificationTrustExplanation = {
  version: 1;
  type: string;
  summary: string;
  requiredLevel: NotificationRequirementLevel;
  effectiveLevel: NotificationPreferenceLevel | 'always';
  sourceScope: NotificationPreferenceSourceScope;
  sourceLabel: string;
  muted: boolean;
  mutedUntil: string | null;
  quietHoursActive: boolean;
  presence: string | null;
  realtimeSuppressed: boolean;
  delivery: 'realtime' | 'inbox_only';
  precedence: string[];
  details: string[];
};

export type NotificationTrustDecision = {
  shouldCreate: boolean;
  explanation: NotificationTrustExplanation;
};

const PREFERENCE_PRECEDENCE = [
  'Channel mute',
  'Channel override',
  'Server mute',
  'Server override',
  'Server default',
  'App default',
] as const;

function normalizePreferenceLevel(raw: unknown): StoredPreferenceLevel | null {
  if (raw === 'all' || raw === 'mentions' || raw === 'nothing' || raw === 'default') return raw;
  if (raw === 'none') return 'nothing';
  return null;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isMuteActive(mutedUntil: string | null, now: Date): boolean {
  if (!mutedUntil) return false;
  const mutedUntilDate = new Date(mutedUntil);
  return !Number.isNaN(mutedUntilDate.getTime()) && mutedUntilDate > now;
}

function levelMeetsRequirement(level: NotificationPreferenceLevel, required: Exclude<NotificationRequirementLevel, 'always'>): boolean {
  if (required === 'mentions') return level === 'all' || level === 'mentions';
  return level === 'all';
}

function describeLevel(level: NotificationPreferenceLevel | 'always'): string {
  if (level === 'always') return 'Always';
  if (level === 'all') return 'All messages';
  if (level === 'mentions') return 'Mentions and direct replies';
  return 'Nothing';
}

function getSourceLabel(scope: NotificationPreferenceSourceScope): string {
  switch (scope) {
    case 'channel':
      return 'Channel override';
    case 'guild':
      return 'Server override';
    case 'guild_default':
      return 'Server default';
    case 'app_default':
      return 'App default';
    case 'direct':
      return 'Direct conversation';
    case 'system':
      return 'System delivery';
    default:
      return 'Notification policy';
  }
}

function buildStoredPreference(
  level: unknown,
  mutedUntil: Date | string | null | undefined,
  storage: StoredPreference['storage'],
  now: Date,
): StoredPreference | null {
  const normalizedLevel = normalizePreferenceLevel(level);
  const mutedUntilIso = toIsoString(mutedUntil);
  if (!normalizedLevel && !mutedUntilIso) return null;
  return {
    level: normalizedLevel,
    mutedUntil: mutedUntilIso,
    activeMute: isMuteActive(mutedUntilIso, now),
    storage,
  };
}

async function readLegacyPreference(
  userId: string,
  key: string,
  storage: StoredPreference['storage'],
  now: Date,
): Promise<StoredPreference | null> {
  try {
    const raw = await redis.get(`user-notif:${userId}:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { level?: unknown; mutedUntil?: string | null };
    return buildStoredPreference(parsed.level, parsed.mutedUntil, storage, now);
  } catch {
    return null;
  }
}

export async function resolveEffectiveNotificationPreference(args: {
  userId: string;
  guildId?: string | null;
  channelId?: string | null;
  now?: Date;
}): Promise<EffectiveNotificationPreference> {
  const now = args.now ?? new Date();
  let resolvedGuildId = args.guildId ?? null;

  if (!resolvedGuildId && args.channelId) {
    const [channel] = await db
      .select({ guildId: channels.guildId })
      .from(channels)
      .where(eq(channels.id, args.channelId))
      .limit(1);
    resolvedGuildId = channel?.guildId ?? null;
  }

  const [channelRow] = args.channelId
    ? await db
      .select({
        level: channelNotificationPrefs.level,
        mutedUntil: channelNotificationPrefs.mutedUntil,
      })
      .from(channelNotificationPrefs)
      .where(and(
        eq(channelNotificationPrefs.userId, args.userId),
        eq(channelNotificationPrefs.channelId, args.channelId),
      ))
      .limit(1)
    : [];

  const channelPreference = channelRow
    ? buildStoredPreference(channelRow.level, channelRow.mutedUntil, 'table', now)
    : await (args.channelId
      ? readLegacyPreference(args.userId, `notif:channel:${args.channelId}`, 'legacy_redis', now)
      : Promise.resolve(null));

  const guildPreference = resolvedGuildId
    ? await readLegacyPreference(args.userId, `notif:guild:${resolvedGuildId}`, 'redis', now)
    : null;

  const [guildRow] = resolvedGuildId
    ? await db
      .select({ defaultMemberNotificationLevel: guilds.defaultMemberNotificationLevel })
      .from(guilds)
      .where(eq(guilds.id, resolvedGuildId))
      .limit(1)
    : [];

  const guildDefault = normalizePreferenceLevel(guildRow?.defaultMemberNotificationLevel ?? null);
  const inheritedGuildDefault = guildDefault && guildDefault !== 'default' ? guildDefault : null;

  if (channelPreference?.activeMute) {
    return {
      effectiveLevel: 'nothing',
      sourceScope: 'channel',
      sourceLabel: getSourceLabel('channel'),
      muted: true,
      mutedUntil: channelPreference.mutedUntil,
      precedence: [...PREFERENCE_PRECEDENCE],
      channel: channelPreference,
      guild: guildPreference,
      guildDefault: inheritedGuildDefault,
    };
  }

  if (channelPreference?.level && channelPreference.level !== 'default') {
    return {
      effectiveLevel: channelPreference.level,
      sourceScope: 'channel',
      sourceLabel: getSourceLabel('channel'),
      muted: false,
      mutedUntil: null,
      precedence: [...PREFERENCE_PRECEDENCE],
      channel: channelPreference,
      guild: guildPreference,
      guildDefault: inheritedGuildDefault,
    };
  }

  if (guildPreference?.activeMute) {
    return {
      effectiveLevel: 'nothing',
      sourceScope: 'guild',
      sourceLabel: getSourceLabel('guild'),
      muted: true,
      mutedUntil: guildPreference.mutedUntil,
      precedence: [...PREFERENCE_PRECEDENCE],
      channel: channelPreference,
      guild: guildPreference,
      guildDefault: inheritedGuildDefault,
    };
  }

  if (guildPreference?.level && guildPreference.level !== 'default') {
    return {
      effectiveLevel: guildPreference.level,
      sourceScope: 'guild',
      sourceLabel: getSourceLabel('guild'),
      muted: false,
      mutedUntil: null,
      precedence: [...PREFERENCE_PRECEDENCE],
      channel: channelPreference,
      guild: guildPreference,
      guildDefault: inheritedGuildDefault,
    };
  }

  if (inheritedGuildDefault) {
    return {
      effectiveLevel: inheritedGuildDefault,
      sourceScope: 'guild_default',
      sourceLabel: getSourceLabel('guild_default'),
      muted: false,
      mutedUntil: null,
      precedence: [...PREFERENCE_PRECEDENCE],
      channel: channelPreference,
      guild: guildPreference,
      guildDefault: inheritedGuildDefault,
    };
  }

  return {
    effectiveLevel: 'all',
    sourceScope: 'app_default',
    sourceLabel: getSourceLabel('app_default'),
    muted: false,
    mutedUntil: null,
    precedence: [...PREFERENCE_PRECEDENCE],
    channel: channelPreference,
    guild: guildPreference,
    guildDefault: inheritedGuildDefault,
  };
}

function getRequirement(type: string): {
  requiredLevel: NotificationRequirementLevel;
  sourceScope: NotificationPreferenceSourceScope;
  eventLabel: string;
} {
  switch (type) {
    case 'dm':
      return { requiredLevel: 'always', sourceScope: 'direct', eventLabel: 'direct message' };
    case 'mention':
      return { requiredLevel: 'mentions', sourceScope: 'channel', eventLabel: 'mention' };
    case 'forum_reply':
      return { requiredLevel: 'mentions', sourceScope: 'channel', eventLabel: 'forum reply' };
    case 'channel_new_post':
      return { requiredLevel: 'all', sourceScope: 'channel', eventLabel: 'channel activity' };
    default:
      return { requiredLevel: 'always', sourceScope: 'system', eventLabel: 'system notification' };
  }
}

function buildDetails(args: {
  requirement: ReturnType<typeof getRequirement>;
  effectivePreference: EffectiveNotificationPreference | null;
  explanation: NotificationTrustExplanation;
}): string[] {
  const details = [
    `Required setting: ${describeLevel(args.explanation.requiredLevel)} for this ${args.requirement.eventLabel}.`,
    `Effective setting: ${describeLevel(args.explanation.effectiveLevel)} from ${args.explanation.sourceLabel.toLowerCase()}.`,
  ];

  if (args.effectivePreference?.muted && args.effectivePreference.mutedUntil) {
    details.push(`Mute active until ${new Date(args.effectivePreference.mutedUntil).toLocaleString()}.`);
  }
  if (args.explanation.quietHoursActive) {
    details.push('Live alerts are paused because notification quiet hours are active.');
  }
  if (args.explanation.presence === 'dnd') {
    details.push('Live alerts are paused because your presence is set to Do Not Disturb.');
  }
  if (args.explanation.precedence.length > 0) {
    details.push(`Preference order: ${args.explanation.precedence.join(' → ')}.`);
  }
  return details;
}

function buildSummary(args: {
  eventLabel: string;
  effectiveLevel: NotificationPreferenceLevel | 'always';
  sourceLabel: string;
  shouldCreate: boolean;
  muted: boolean;
  quietHoursActive: boolean;
  presence: string | null;
}): string {
  if (!args.shouldCreate) {
    if (args.muted) {
      return `Blocked by ${args.sourceLabel.toLowerCase()} because this ${args.eventLabel} is muted.`;
    }
    return `This ${args.eventLabel} matched ${args.sourceLabel.toLowerCase()}, but your setting only allows ${describeLevel(args.effectiveLevel).toLowerCase()}.`;
  }
  if (args.quietHoursActive || args.presence === 'dnd') {
    return `Saved to your inbox because this ${args.eventLabel} matches ${args.sourceLabel.toLowerCase()}, but live alerts are paused right now.`;
  }
  return `You received this ${args.eventLabel} because it matches ${args.sourceLabel.toLowerCase()} (${describeLevel(args.effectiveLevel).toLowerCase()}).`;
}

export async function evaluateNotificationTrust(args: {
  userId: string;
  type: string;
  data?: Record<string, unknown> | null;
  now?: Date;
}): Promise<NotificationTrustDecision> {
  const now = args.now ?? new Date();
  const requirement = getRequirement(args.type);
  const guildId = typeof args.data?.guildId === 'string' ? args.data.guildId : null;
  const channelId = typeof args.data?.channelId === 'string' ? args.data.channelId : null;

  const effectivePreference = requirement.sourceScope === 'channel' || requirement.sourceScope === 'guild'
    ? await resolveEffectiveNotificationPreference({
      userId: args.userId,
      guildId,
      channelId,
      now,
    })
    : null;

  const effectiveLevel = requirement.requiredLevel === 'always'
    ? 'always'
    : (effectivePreference?.effectiveLevel ?? 'all');

  const shouldCreate = requirement.requiredLevel === 'always'
    ? true
    : levelMeetsRequirement(effectivePreference?.effectiveLevel ?? 'all', requirement.requiredLevel);

  const [settingsRow] = await db
    .select({ notificationQuietHours: userSettings.notificationQuietHours })
    .from(userSettings)
    .where(eq(userSettings.userId, args.userId))
    .limit(1);

  let presence: string | null = null;
  try {
    presence = await redis.get(`presence:${args.userId}`);
  } catch {
    presence = null;
  }

  const quietHoursActive = isWithinNotificationQuietHours(settingsRow?.notificationQuietHours, now);
  const realtimeSuppressed = shouldCreate && (quietHoursActive || presence === 'dnd');
  const sourceScope = effectivePreference?.sourceScope ?? requirement.sourceScope;
  const sourceLabel = effectivePreference?.sourceLabel ?? getSourceLabel(requirement.sourceScope);

  const explanation: NotificationTrustExplanation = {
    version: 1,
    type: args.type,
    summary: buildSummary({
      eventLabel: requirement.eventLabel,
      effectiveLevel,
      sourceLabel,
      shouldCreate,
      muted: effectivePreference?.muted ?? false,
      quietHoursActive,
      presence,
    }),
    requiredLevel: requirement.requiredLevel,
    effectiveLevel,
    sourceScope,
    sourceLabel,
    muted: effectivePreference?.muted ?? false,
    mutedUntil: effectivePreference?.mutedUntil ?? null,
    quietHoursActive,
    presence,
    realtimeSuppressed,
    delivery: realtimeSuppressed ? 'inbox_only' : 'realtime',
    precedence: effectivePreference?.precedence ?? [],
    details: [],
  };

  explanation.details = buildDetails({
    requirement,
    effectivePreference,
    explanation,
  });

  return { shouldCreate, explanation };
}

export function getStoredNotificationTrust(data: unknown): NotificationTrustExplanation | null {
  if (!data || typeof data !== 'object') return null;
  const trust = (data as Record<string, unknown>).notificationTrust;
  if (!trust || typeof trust !== 'object') return null;
  const candidate = trust as Partial<NotificationTrustExplanation>;
  if (candidate.version !== 1 || typeof candidate.summary !== 'string') return null;
  return candidate as NotificationTrustExplanation;
}
