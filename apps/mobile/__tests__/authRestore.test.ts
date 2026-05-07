import { restoreAuthSession, type AuthRestoreDeps } from '../src/contexts/authRestore';
import type { User } from '../src/types';

const cachedUser: User = {
  id: 'user-cache',
  username: 'cache',
  email: 'cache@test.local',
  emailVerified: true,
  isAdmin: false,
  displayName: 'Cached User',
  avatarHash: null,
  bannerHash: null,
  bio: null,
  pronouns: null,
  status: 'online',
  customStatus: null,
};

const networkUser: User = {
  ...cachedUser,
  id: 'user-network',
  username: 'network',
  displayName: 'Network User',
};

function createDeps(overrides: Partial<AuthRestoreDeps> = {}): AuthRestoreDeps {
  return {
    refresh: jest.fn().mockResolvedValue('fresh-token'),
    getAccessToken: jest.fn(() => 'stored-token'),
    getMe: jest.fn().mockResolvedValue(networkUser),
    loadCachedUser: jest.fn().mockResolvedValue(cachedUser),
    saveCachedUser: jest.fn().mockResolvedValue(undefined),
    clearCachedUser: jest.fn().mockResolvedValue(undefined),
    clearTokens: jest.fn().mockResolvedValue(undefined),
    connectSocket: jest.fn(),
    restoreSettings: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('restoreAuthSession', () => {
  it('returns the network user and refreshes the cached snapshot when the API is reachable', async () => {
    const deps = createDeps();

    await expect(restoreAuthSession(deps)).resolves.toEqual({
      status: 'authenticated',
      user: networkUser,
      source: 'network',
    });
    expect(deps.saveCachedUser).toHaveBeenCalledWith(networkUser);
    expect(deps.connectSocket).toHaveBeenCalled();
  });

  it('keeps the cached user authenticated when profile fetch fails from a network error', async () => {
    const deps = createDeps({
      getMe: jest.fn().mockRejectedValue(new Error('offline')),
    });

    await expect(restoreAuthSession(deps)).resolves.toEqual({
      status: 'authenticated',
      user: cachedUser,
      source: 'cache',
    });
    expect(deps.clearTokens).not.toHaveBeenCalled();
    expect(deps.clearCachedUser).not.toHaveBeenCalled();
  });

  it('clears tokens and cached user when the server rejects the session', async () => {
    const deps = createDeps({
      getMe: jest.fn().mockRejectedValue({ status: 401 }),
    });

    await expect(restoreAuthSession(deps)).resolves.toEqual({ status: 'unauthenticated' });
    expect(deps.clearTokens).toHaveBeenCalled();
    expect(deps.clearCachedUser).toHaveBeenCalled();
  });

  it('returns unauthenticated when there is no token to restore', async () => {
    const deps = createDeps({
      refresh: jest.fn().mockResolvedValue(null),
      getAccessToken: jest.fn(() => null),
    });

    await expect(restoreAuthSession(deps)).resolves.toEqual({ status: 'unauthenticated' });
    expect(deps.getMe).not.toHaveBeenCalled();
  });
});
