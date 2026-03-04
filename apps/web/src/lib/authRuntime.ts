import { useSyncExternalStore } from 'react';

export type AuthRuntimeState = 'active' | 'refreshing' | 'expired';

const AUTH_EXPIRED_NOTICE_COOLDOWN_MS = 30_000;
const listeners = new Set<() => void>();
let state: AuthRuntimeState = 'active';
let lastExpiryNoticeAt = 0;

const authGuardEnabled = (import.meta.env.VITE_AUTH_GUARD_V1 ?? '1') !== '0';

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function isAuthGuardEnabled(): boolean {
  return authGuardEnabled;
}

export function getAuthRuntimeState(): AuthRuntimeState {
  return state;
}

export function useAuthRuntimeState(): AuthRuntimeState {
  return useSyncExternalStore(subscribeAuthRuntime, getAuthRuntimeState, getAuthRuntimeState);
}

export function subscribeAuthRuntime(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isAuthRuntimeExpired(): boolean {
  return authGuardEnabled && state === 'expired';
}

export function setAuthRuntimeState(nextState: AuthRuntimeState): void {
  if (!authGuardEnabled) return;
  if (state === nextState) return;
  state = nextState;
  emitChange();
}

export function transitionAuthExpired(opts?: { redirectToLogin?: boolean; fromPath?: string }): boolean {
  if (!authGuardEnabled) return false;
  const firstTransition = state !== 'expired';
  state = 'expired';
  emitChange();

  const now = Date.now();
  if (firstTransition || now - lastExpiryNoticeAt >= AUTH_EXPIRED_NOTICE_COOLDOWN_MS) {
    lastExpiryNoticeAt = now;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gratonite:auth-expired', {
        detail: {
          fromPath: opts?.fromPath ?? window.location.pathname,
          timestamp: new Date(now).toISOString(),
        },
      }));
    }
  }

  if (opts?.redirectToLogin && typeof window !== 'undefined') {
    const fromPath = opts.fromPath ?? `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const target = `/login?from=${encodeURIComponent(fromPath)}`;
    if (!window.location.pathname.startsWith('/login')) {
      window.location.replace(target);
    }
  }

  return firstTransition;
}

