export function buildDmRoute(channelId: string): string {
  return `/dm/${channelId}`;
}

export function buildGuildChannelRoute(guildId: string, channelId: string): string {
  return `/guild/${guildId}/channel/${channelId}`;
}

export function buildGuildVoiceRoute(guildId: string, channelId: string): string {
  return `/guild/${guildId}/voice/${channelId}`;
}

export function normalizeLegacyRoute(route: string): string {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  try {
    const url = new URL(route, 'http://localhost');
    const { pathname, search, hash } = url;

    const guildsVoiceMatch = pathname.match(/^\/guilds\/([^/]+)\/voice\/([^/]+)$/);
    if (guildsVoiceMatch) {
      return `${buildGuildVoiceRoute(guildsVoiceMatch[1], guildsVoiceMatch[2])}${search}${hash}`;
    }

    const guildsChannelMatch = pathname.match(/^\/guilds\/([^/]+)\/([^/]+)$/);
    if (guildsChannelMatch && uuidPattern.test(guildsChannelMatch[2])) {
      return `${buildGuildChannelRoute(guildsChannelMatch[1], guildsChannelMatch[2])}${search}${hash}`;
    }

    const guildLegacyMatch = pathname.match(/^\/guild\/([^/]+)\/([^/]+)$/);
    if (guildLegacyMatch && uuidPattern.test(guildLegacyMatch[2])) {
      return `${buildGuildChannelRoute(guildLegacyMatch[1], guildLegacyMatch[2])}${search}${hash}`;
    }

    return route;
  } catch {
    return route;
  }
}
