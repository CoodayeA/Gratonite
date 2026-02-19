// ============================================================================
// Permissions — Discord-faithful bitwise permission flags
// Stored as BIGINT in PostgreSQL, resolved as bigint in TypeScript
// ============================================================================

/**
 * Permission bit flags.
 * Resolution order:
 * 1. @everyone role permissions
 * 2. Bitwise OR of all user's assigned roles
 * 3. Channel-level role overrides (allow/deny)
 * 4. Channel-level user overrides (highest priority)
 */
export const PermissionFlags = {
  // General
  CREATE_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  ADD_REACTIONS: 1n << 6n,
  VIEW_AUDIT_LOG: 1n << 7n,
  PRIORITY_SPEAKER: 1n << 8n,
  STREAM: 1n << 9n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  SEND_TTS_MESSAGES: 1n << 12n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,
  USE_EXTERNAL_EMOJIS: 1n << 18n,
  VIEW_GUILD_INSIGHTS: 1n << 19n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
  USE_VAD: 1n << 25n,
  CHANGE_NICKNAME: 1n << 26n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_WEBHOOKS: 1n << 29n,
  MANAGE_EMOJIS_AND_STICKERS: 1n << 30n,
  USE_APPLICATION_COMMANDS: 1n << 31n,
  REQUEST_TO_SPEAK: 1n << 32n,
  MANAGE_EVENTS: 1n << 33n,
  MANAGE_THREADS: 1n << 34n,
  CREATE_PUBLIC_THREADS: 1n << 35n,
  CREATE_PRIVATE_THREADS: 1n << 36n,
  USE_EXTERNAL_STICKERS: 1n << 37n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
  USE_SOUNDBOARD: 1n << 39n,
  MODERATE_MEMBERS: 1n << 40n, // timeout
  VIEW_GUILD_ANALYTICS: 1n << 41n,
} as const;

export type PermissionFlag = (typeof PermissionFlags)[keyof typeof PermissionFlags];

/** Check if a permission bitfield has a specific permission */
export function hasPermission(permissions: bigint, flag: bigint): boolean {
  // Administrator bypasses all checks
  if ((permissions & PermissionFlags.ADMINISTRATOR) === PermissionFlags.ADMINISTRATOR) {
    return true;
  }
  return (permissions & flag) === flag;
}

/** Check if a permission bitfield has ALL of the specified permissions */
export function hasAllPermissions(permissions: bigint, ...flags: bigint[]): boolean {
  if ((permissions & PermissionFlags.ADMINISTRATOR) === PermissionFlags.ADMINISTRATOR) {
    return true;
  }
  return flags.every((flag) => (permissions & flag) === flag);
}

/** Check if a permission bitfield has ANY of the specified permissions */
export function hasAnyPermission(permissions: bigint, ...flags: bigint[]): boolean {
  if ((permissions & PermissionFlags.ADMINISTRATOR) === PermissionFlags.ADMINISTRATOR) {
    return true;
  }
  return flags.some((flag) => (permissions & flag) === flag);
}

/** Add permissions to a bitfield */
export function addPermissions(permissions: bigint, ...flags: bigint[]): bigint {
  return flags.reduce((acc, flag) => acc | flag, permissions);
}

/** Remove permissions from a bitfield */
export function removePermissions(permissions: bigint, ...flags: bigint[]): bigint {
  return flags.reduce((acc, flag) => acc & ~flag, permissions);
}

/**
 * Resolve effective permissions for a member in a channel.
 * Implements Discord-faithful resolution order.
 */
export function resolvePermissions(params: {
  everyonePermissions: bigint;
  rolePermissions: bigint[]; // OR'd together
  channelRoleOverrides: Array<{ allow: bigint; deny: bigint }>;
  channelUserOverride: { allow: bigint; deny: bigint } | null;
  isOwner: boolean;
}): bigint {
  // Server owner has all permissions
  if (params.isOwner) {
    return Object.values(PermissionFlags).reduce((acc, flag) => acc | flag, 0n);
  }

  // Step 1: Start with @everyone permissions
  let permissions = params.everyonePermissions;

  // Step 2: OR in all role permissions
  for (const rolePerms of params.rolePermissions) {
    permissions |= rolePerms;
  }

  // Administrator bypasses channel overrides
  if ((permissions & PermissionFlags.ADMINISTRATOR) === PermissionFlags.ADMINISTRATOR) {
    return Object.values(PermissionFlags).reduce((acc, flag) => acc | flag, 0n);
  }

  // Step 3: Apply channel-level role overrides
  for (const override of params.channelRoleOverrides) {
    permissions &= ~override.deny;
    permissions |= override.allow;
  }

  // Step 4: Apply channel-level user override (highest priority)
  if (params.channelUserOverride) {
    permissions &= ~params.channelUserOverride.deny;
    permissions |= params.channelUserOverride.allow;
  }

  return permissions;
}
