import type { User } from '../types';

type AuthError = { status?: number };

export type AuthRestoreDeps = {
  refresh: () => Promise<string | null>;
  getAccessToken: () => string | null;
  getMe: () => Promise<User>;
  loadCachedUser: () => Promise<User | null>;
  saveCachedUser: (user: User) => Promise<void>;
  clearCachedUser: () => Promise<void>;
  clearTokens: () => Promise<void>;
  connectSocket: () => void;
  restoreSettings: () => Promise<void>;
};

export type AuthRestoreResult =
  | { status: 'authenticated'; user: User; source: 'network' | 'cache' }
  | { status: 'unauthenticated' };

function isAuthError(err: unknown): err is AuthError {
  return typeof err === 'object'
    && err !== null
    && ((err as AuthError).status === 401 || (err as AuthError).status === 403);
}

export async function restoreAuthSession(deps: AuthRestoreDeps): Promise<AuthRestoreResult> {
  const cachedUser = await deps.loadCachedUser();
  const token = await deps.refresh().catch(() => null) ?? deps.getAccessToken();

  if (!token) {
    return { status: 'unauthenticated' };
  }

  try {
    const user = await deps.getMe();
    await deps.saveCachedUser(user);
    deps.connectSocket();
    await deps.restoreSettings().catch(() => {});
    return { status: 'authenticated', user, source: 'network' };
  } catch (err) {
    if (isAuthError(err)) {
      await deps.clearTokens();
      await deps.clearCachedUser();
      return { status: 'unauthenticated' };
    }

    if (cachedUser) {
      return { status: 'authenticated', user: cachedUser, source: 'cache' };
    }

    return { status: 'unauthenticated' };
  }
}
