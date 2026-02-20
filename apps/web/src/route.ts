export type AppRoute =
  | { view: 'home' }
  | { view: 'download' }
  | { view: 'invite'; inviteCode: string }
  | { view: 'guild'; guildId: string; channelId?: string; messageId?: string }
  | { view: 'dm'; channelId: string; messageId?: string };

export function parseRoute(pathname: string): AppRoute {
  const clean = pathname.replace(/\/+$/, '');
  if (!clean || clean === '/') return { view: 'home' };

  const parts = clean.split('/').filter(Boolean);
  if (parts[0] === 'invite' && parts[1]) {
    return { view: 'invite', inviteCode: parts[1] };
  }

  if (parts[0] === 'download') {
    return { view: 'download' };
  }

  if (parts[0] === 'guild' && parts[1]) {
    return {
      view: 'guild',
      guildId: parts[1],
      channelId: parts[3],
      messageId: parts[5],
    };
  }

  if (parts[0] === 'dm' && parts[1]) {
    return {
      view: 'dm',
      channelId: parts[1],
      messageId: parts[3],
    };
  }

  return { view: 'home' };
}
