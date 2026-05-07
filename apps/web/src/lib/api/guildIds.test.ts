import { describe, expect, it, vi } from 'vitest';
import { channelsApi } from './channels';
import { guildsApi } from './guilds';
import { stickersApi, textReactionsApi } from './misc';

vi.mock('./_core', () => {
  class ApiRequestError extends Error {
    status = 500;
  }

  return {
    apiFetch: vi.fn(),
    ApiRequestError,
    walletRequestPromise: null,
    setWalletRequestPromise: vi.fn(),
  };
});

describe('guild id API guards', () => {
  it('rejects malformed guild ids before guild command requests', () => {
    expect(() => guildsApi.getCommands('channel')).toThrow('Invalid guildId: channel');
  });

  it('rejects malformed guild ids before guild sticker requests', () => {
    expect(() => stickersApi.getGuildStickers('channel')).toThrow('Invalid guildId: channel');
  });

  it('rejects malformed guild ids before guild channel requests', () => {
    expect(() => channelsApi.getGuildChannels('channel')).toThrow('Invalid guildId: channel');
  });

  it('rejects malformed guild ids before popular text reaction requests', () => {
    expect(() => textReactionsApi.popular('channel')).toThrow('Invalid guildId: channel');
  });
});
